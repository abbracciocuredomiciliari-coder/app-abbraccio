import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import BadanteIntermediazione from '../models/BadanteIntermediazione';
import DocumentoFatturazione from '../models/DocumentoFatturazione';
import Patient from '../models/Patient';
import ContrattoPaziente from '../models/ContrattoPaziente';
import ConsensoGDPR from '../models/ConsensoGDPR';
import TariffaCcnl from '../models/TariffaCcnl';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import { simulaCostoBadante, CONTRATTI_SIM, PARAMETRI_CCN_2026, ParametriCcnl } from '../utils/costoBadante';
import { generaPreventivoBadantePdf, generaPreventivoBadantePdfBuffer } from '../utils/preventivoBadantePdf';
import { inviaEmailContrattoPaziente } from '../utils/contrattoInvio';

const TARIFFE_BADANTI = {
  orario_non_convivente: {
    A: 9.13, AS: 9.42, B: 9.71, BS: 10.22, C: 10.70, CS: 11.21, D: 12.86, DS: 13.32,
  },
  convivente: {
    A: 1341.31, AS: 1400.01, B: 1428.65, BS: 1510.37, C: 1592.10, CS: 1673.79, D: 2160.59, DS: 2242.29,
  },
};

const LIVELLI = ['A', 'AS', 'B', 'BS', 'C', 'CS', 'D', 'DS'];
const CONTRATTI = ['orario_non_convivente', 'convivente'];

function calcolaCostoMensile(richiesta: any) {
  if (!richiesta.contrattoTipo || !richiesta.livello) return 0;
  const costo = (TARIFFE_BADANTI as any)[richiesta.contrattoTipo][richiesta.livello] || 0;
  if (richiesta.contrattoTipo === 'orario_non_convivente') {
    const ore = Number(richiesta.oreSettimanali) || 0;
    return Math.round(ore * 52 / 12 * costo * 100) / 100;
  }
  return costo;
}

function calcolaPrestazioni(richiesta: any, gestioneAmministrativa: number) {
  const mesi = Number(richiesta.mesiContratto) || 12;
  const costoBadanteMensile = calcolaCostoMensile(richiesta);
  const gaInput = Number(gestioneAmministrativa) || 0;
  const ivaGestioneMensile = Math.round(gaInput * 0.22 * 100) / 100;
  const gaLordoMensile = Math.round((gaInput + ivaGestioneMensile) * 100) / 100;

  const costoBadanteAnnuale = Math.round(costoBadanteMensile * mesi * 100) / 100;
  const gaLordaAnnuale = Math.round(gaLordoMensile * mesi * 100) / 100;

  const prestazioni: any[] = [];

  // 1) Costo contratto consigliato
  let descContratto = `Costo contratto consigliato - ${richiesta.contrattoTipo === 'orario_non_convivente' ? 'orario non convivente' : 'convivente'}, livello ${richiesta.livello}`;
  if (richiesta.contrattoTipo === 'orario_non_convivente' && richiesta.oreSettimanali) {
    descContratto += `, ${richiesta.oreSettimanali} ore settimanali`;
  }
  descContratto += `, ${mesi} mesi`;
  prestazioni.push({
    descrizione: descContratto,
    quantita: mesi,
    prezzoUnitario: costoBadanteMensile,
    importo: costoBadanteAnnuale,
    tipo: 'contratto',
  });

  // 2) Gestione amministrativa (iva inclusa, con totale di questa voce)
  if (gaInput > 0) {
    prestazioni.push({
      descrizione: `Gestione amministrativa - imponibile €${gaInput.toFixed(2)}/mese + IVA 22% €${ivaGestioneMensile.toFixed(2)}/mese - totale voce: €${gaLordaAnnuale.toFixed(2)}`,
      quantita: mesi,
      prezzoUnitario: gaLordoMensile,
      importo: gaLordaAnnuale,
      tipo: 'gestione',
    });
  }

  // 3) Attivazione contratto una tantum
  const attivazione = 120;
  prestazioni.push({
    descrizione: 'Attivazione contratto (una tantum)',
    quantita: 1,
    prezzoUnitario: attivazione,
    importo: attivazione,
    tipo: 'attivazione',
  });

  // 4) Consulenza specialistica alla famiglia (500 + iva)
  const imponibileConsulenza = 500;
  const ivaConsulenza = Math.round(imponibileConsulenza * 0.22 * 100) / 100;
  const totaleConsulenza = Math.round((imponibileConsulenza + ivaConsulenza) * 100) / 100;
  prestazioni.push({
    descrizione: `Consulenza specialistica alla famiglia per analisi di esigenze assistenziali e supporto alla valutazione del profilo professionale assistente familiare (imponibile €${imponibileConsulenza.toFixed(2)} + IVA 22% €${ivaConsulenza.toFixed(2)})`,
    quantita: 1,
    prezzoUnitario: totaleConsulenza,
    importo: totaleConsulenza,
    tipo: 'consulenza',
  });

  const totaleUnaTantum = Math.round((attivazione + totaleConsulenza) * 100) / 100;
  const totaleMensileStimato = Math.round((costoBadanteMensile + gaLordoMensile) * 100) / 100;
  return { prestazioni, totaleUnaTantum, totaleMensileStimato };
}

const router = Router();

const RUOLI_GESTIONE = ['admin', 'coordinator', 'direttore'];

// ─── Tariffe CCNL/INPS: merge delle override salvate su DB sopra i default 2026 ──
// Accetta solo chiavi presenti nei default e solo valori numerici: chiavi
// sconosciute o non numeriche vengono ignorate (i default restano). Così il
// motore può aggiungere parametri nuovi senza rompere i record esistenti.
function mergeParametri(override: any): ParametriCcnl {
  const merge = (def: any, ovr: any): any => {
    if (typeof def === 'number') {
      const n = Number(ovr);
      return Number.isFinite(n) ? n : def;
    }
    if (typeof def !== 'object' || def === null) return def;
    const out: any = { ...def };
    if (ovr && typeof ovr === 'object') {
      for (const k of Object.keys(def)) {
        if (k in ovr) out[k] = merge(def[k], ovr[k]);
      }
    }
    return out;
  };
  if (!override || typeof override !== 'object') return PARAMETRI_CCN_2026;
  return merge(PARAMETRI_CCN_2026, override);
}

async function caricaParametri(): Promise<ParametriCcnl> {
  const doc = await TariffaCcnl.findOne({ key: 'ccnl' }).lean();
  return mergeParametri(doc?.parametri);
}

// ─── Numerazione progressiva per preventivi/fatture ────────────────────────────
// Le fatture della Intermediazioni usano una serie dedicata FATT-CF con
// progressivo autonomo, distaccato dalla fatturazione dei pazienti privati.
async function generaNumero(tipo: 'preventivo' | 'fattura'): Promise<string> {
  const anno = new Date().getFullYear();
  const prefisso = tipo === 'preventivo' ? 'PREV-CF' : 'FATT-CF';
  const base = `${prefisso}-${anno}-`;
  // Il progressivo riparte dall'ultimo numero presente in archivio per la serie
  // (rispetta rinumerazioni manuali ed eliminazioni, non il semplice conteggio).
  const esistenti = await DocumentoFatturazione.find({ numero: { $regex: `^${base}` } })
    .select('numero')
    .lean();
  const maxProgressivo = esistenti.reduce((max: number, d: any) => {
    const m = String(d.numero || '').match(/-(\d+)$/);
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);
  let progressivo = maxProgressivo + 1;
  let numero = `${base}${String(progressivo).padStart(5, '0')}`;
  while (await DocumentoFatturazione.exists({ numero })) {
    progressivo++;
    numero = `${base}${String(progressivo).padStart(5, '0')}`;
  }
  return numero;
}

function normalizzaPrestazioni(prestazioni: any[]) {
  return prestazioni
    .map((p: any) => {
      const quantita = Number(p.quantita) > 0 ? Number(p.quantita) : 1;
      const prezzoUnitario = Number(p.prezzoUnitario) || 0;
      return {
        descrizione: String(p.descrizione || '').trim(),
        quantita,
        prezzoUnitario,
        importo: Math.round(quantita * prezzoUnitario * 100) / 100,
      };
    })
    .filter((p) => p.descrizione);
}

// GET /api/badanti-intermediazione — lista richieste (opzionalmente filtrate per paziente)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { patient } = req.query;
    const filtro: any = {};
    if (patient) filtro.patient = patient;
    const richieste = await BadanteIntermediazione.find(filtro)
      .populate('patient', 'firstName lastName codiceFiscale email tipoGestione')
      .populate('preventivoId', 'numero stato totale totaleMensileStimato')
      .populate('contrattoId', 'stato email dataFirma allegatoFileName token nome')
      .populate('fatturaId', 'numero stato totale')
      .populate('fattureGestione', 'numero stato totale data')
      .sort({ createdAt: -1 });
    const soloPrivate = richieste.filter((r: any) => r.patient?.tipoGestione !== 'convenzione');
    return res.json(soloPrivate);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel caricamento delle richieste', error: error.message });
  }
});
// POST /api/badanti-intermediazione/simula-costo - calcolo completo costo badante CCNL
// Replica il calcolatore esterno (doemploy): lorda + vitto/alloggio + contributi INPS + TFR + 13esima + ferie
router.post('/simula-costo', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { contrattoTipo, livello, oreSettimanali, tempoDeterminato, pagaPersonalizzata, indennitaPiuAutosuff, certificazioneUni, indennitaBabysitter } = req.body || {};
    const tipiValidi = CONTRATTI_SIM.map(c => c.value);
    if (!contrattoTipo || !tipiValidi.includes(contrattoTipo)) {
      return res.status(400).json({ message: `contrattoTipo deve essere uno tra: ${tipiValidi.join(', ')}` });
    }
    const orario = contrattoTipo === 'non_convivente' || contrattoTipo === 'sostituzione';
    if (orario && !(Number(oreSettimanali) > 0)) {
      return res.status(400).json({ message: 'Ore settimanali obbligatorie per i contratti ad orario' });
    }
    const P = await caricaParametri();
    const risultato = simulaCostoBadante({
      contrattoTipo,
      livello,
      oreSettimanali: oreSettimanali ? Number(oreSettimanali) : undefined,
      tempoDeterminato: !!tempoDeterminato,
      pagaPersonalizzata: pagaPersonalizzata ? Number(pagaPersonalizzata) : undefined,
      indennitaPiuAutosuff: !!indennitaPiuAutosuff,
      certificazioneUni: !!certificazioneUni,
      indennitaBabysitter: !!indennitaBabysitter,
    }, P);
    return res.json(risultato);
  } catch (error: any) {
    return res.status(400).json({ message: error.message || 'Errore nel calcolo del costo' });
  }
});

// POST /api/badanti-intermediazione/simula-costo/pdf — PDF preventivo brandizzato (template Abbraccio/RSD)
router.post('/simula-costo/pdf', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { contrattoTipo, livello, oreSettimanali, tempoDeterminato, pagaPersonalizzata, indennitaPiuAutosuff, certificazioneUni, indennitaBabysitter, intestatario, cafMensile } = req.body || {};
    const tipiValidi = CONTRATTI_SIM.map(c => c.value);
    if (!contrattoTipo || !tipiValidi.includes(contrattoTipo)) {
      return res.status(400).json({ message: `contrattoTipo deve essere uno tra: ${tipiValidi.join(', ')}` });
    }
    const orario = contrattoTipo === 'non_convivente' || contrattoTipo === 'sostituzione';
    if (orario && !(Number(oreSettimanali) > 0)) {
      return res.status(400).json({ message: 'Ore settimanali obbligatorie per i contratti ad orario' });
    }
    const P = await caricaParametri();
    const risultato = simulaCostoBadante({
      contrattoTipo,
      livello,
      oreSettimanali: oreSettimanali ? Number(oreSettimanali) : undefined,
      tempoDeterminato: !!tempoDeterminato,
      pagaPersonalizzata: pagaPersonalizzata ? Number(pagaPersonalizzata) : undefined,
      indennitaPiuAutosuff: !!indennitaPiuAutosuff,
      certificazioneUni: !!certificazioneUni,
      indennitaBabysitter: !!indennitaBabysitter,
    }, P);
    return generaPreventivoBadantePdf(res, risultato, {
      intestatario: intestatario ? String(intestatario).slice(0, 120) : undefined,
      cafMensile: cafMensile !== undefined && Number(cafMensile) >= 0 ? Number(cafMensile) : P.cafMensileDefault,
    });
  } catch (error: any) {
    return res.status(400).json({ message: error.message || 'Errore nella generazione del PDF' });
  }
});

// GET /api/badanti-intermediazione/tariffe-ccnl — parametri CCNL/INPS attivi (default + override DB)
router.get('/tariffe-ccnl', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const doc = await TariffaCcnl.findOne({ key: 'ccnl' }).lean();
    return res.json({
      parametri: mergeParametri(doc?.parametri),
      personalizzato: !!doc,
      aggiornatoIl: doc?.aggiornatoIl || null,
      aggiornatoDa: doc?.aggiornatoDa || null,
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore caricamento tariffe', error: error.message });
  }
});

// PUT /api/badanti-intermediazione/tariffe-ccnl — aggiorna le tariffe (salva solo i valori validi)
router.put('/tariffe-ccnl', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('badanti_intermediazione', 'UPDATE'), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user as { name?: string; email?: string } | undefined;
    const parametri = mergeParametri(req.body?.parametri);
    await TariffaCcnl.updateOne(
      { key: 'ccnl' },
      { $set: { parametri, aggiornatoDa: user?.name || user?.email || 'Sistema', aggiornatoIl: new Date() } },
      { upsert: true }
    );
    return res.json({ message: 'Tariffe CCNL aggiornate', parametri });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore salvataggio tariffe', error: error.message });
  }
});

// POST /api/badanti-intermediazione/tariffe-ccnl/reset — ripristina i minimi ufficiali nel codice
router.post('/tariffe-ccnl/reset', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('badanti_intermediazione', 'UPDATE'), async (_req: AuthRequest, res: Response) => {
  try {
    await TariffaCcnl.deleteOne({ key: 'ccnl' });
    return res.json({ message: 'Tariffe ripristinate ai minimi ufficiali', parametri: PARAMETRI_CCN_2026 });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore reset tariffe', error: error.message });
  }
});

// GET /api/badanti-intermediazione/archivio/contratti — archivio "Preventivo + Contratto" intermediazione
router.get('/archivio/contratti', authenticateToken, authorizeRole(...RUOLI_GESTIONE), async (req: Request, res: Response) => {
  try {
    const richieste = await BadanteIntermediazione.find({ contrattoId: { $ne: null } })
      .populate('patient', 'firstName lastName codiceFiscale email')
      .populate('contrattoId', 'stato email dataFirma allegatoFileName token nome importo consensoGdprId')
      .select('-simulazione')
      .sort({ createdAt: -1 })
      .lean();
    // Contratti orfani: la richiesta è stata eliminata ma il contratto esiste ancora
    // (es. già firmato). Restano in archivio altrimenti un firmato sparirebbe dal portale.
    const collegati = new Set(
      richieste.map((r: any) => String(r.contrattoId?._id || r.contrattoId)).filter(Boolean)
    );
    const orfani = await ContrattoPaziente.find({ contesto: 'intermediazione' })
      .populate('patient', 'firstName lastName codiceFiscale email')
      .select('stato email dataFirma allegatoFileName token nome importo consensoGdprId patient data createdAt')
      .lean();
    const extra = orfani
      .filter((c: any) => !collegati.has(String(c._id)))
      .map((c: any) => ({
        _id: c._id,
        patient: c.patient,
        contrattoId: c,
        contrattoOrfano: true,
        createdAt: c.createdAt || c.data,
      }));
    return res.json([...richieste, ...extra]);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore caricamento archivio contratti', error: error.message });
  }
});

// GET /api/badanti-intermediazione/archivio/gdpr — archivio GDPR dedicato all'intermediazione
router.get('/archivio/gdpr', authenticateToken, authorizeRole(...RUOLI_GESTIONE), async (req: Request, res: Response) => {
  try {
    const consensi = await ConsensoGDPR.find({ contesto: 'intermediazione' })
      .select('patientId pazienteAnonimoId nomeFirmatario cognomeFirmatario codiceFiscaleFirmatario dataFirma luogoFirma versioneInformativa firmato revocato dataRevoca contrattoId ipAddress')
      .sort({ dataFirma: -1 })
      .lean();
    // Arricchisce con nome paziente leggibile
    const ids = [...new Set(consensi.map((c: any) => c.patientId).filter(Boolean))];
    const pazienti = await Patient.find({ _id: { $in: ids } }).select('firstName lastName').lean();
    const map = new Map(pazienti.map((p: any) => [String(p._id), p]));
    const out = consensi.map((c: any) => ({ ...c, patient: map.get(String(c.patientId)) || null }));
    return res.json(out);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore caricamento archivio GDPR', error: error.message });
  }
});

// GET /api/badanti-intermediazione/:id — dettaglio
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const richiesta = await BadanteIntermediazione.findById(req.params.id)
      .populate('patient', 'firstName lastName codiceFiscale email')
      .populate('preventivoId')
      .populate('fatturaId')
      .populate('fattureGestione');
    if (!richiesta) return res.status(404).json({ message: 'Richiesta non trovata' });
    return res.json(richiesta);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel caricamento', error: error.message });
  }
});

// POST /api/badanti-intermediazione — crea richiesta
router.post('/', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('badanti_intermediazione', 'CREATE'), async (req: AuthRequest, res: Response) => {
  try {
    const { patient, contrattoTipo, livello, oreSettimanali, mesiContratto, gestioneAmministrativa, note } = req.body;
    if (!patient) return res.status(400).json({ message: 'Paziente obbligatorio' });
    if (!contrattoTipo || !CONTRATTI.includes(contrattoTipo)) {
      return res.status(400).json({ message: "contrattoTipo deve essere 'orario_non_convivente' o 'convivente'" });
    }
    if (!livello || !LIVELLI.includes(livello)) {
      return res.status(400).json({ message: 'Livello non valido' });
    }
    if (contrattoTipo === 'orario_non_convivente' && !oreSettimanali) {
      return res.status(400).json({ message: 'Ore settimanali obbligatorie per orario non convivente' });
    }
    const paziente = await Patient.findById(patient);
    if (!paziente) return res.status(404).json({ message: 'Paziente non trovato' });

    const user = req.user as { name?: string; email?: string } | undefined;
    const data: any = {
      patient,
      contrattoTipo,
      livello,
      oreSettimanali,
      mesiContratto,
      gestioneAmministrativa: gestioneAmministrativa ? Number(gestioneAmministrativa) : 0,
      note,
      creatoDa: user?.name || user?.email || 'Sistema',
    };
    data.costoMensile = calcolaCostoMensile(data);
    const richiesta = await BadanteIntermediazione.create(data);
    const popolata = await BadanteIntermediazione.findById(richiesta._id).populate('patient', 'firstName lastName codiceFiscale email');
    return res.status(201).json(popolata);
  } catch (error: any) {
    return res.status(500).json({ message: "Errore nella creazione dell'assistenza domiciliare", error: error.message });
  }
});

// PUT /api/badanti-intermediazione/:id — aggiorna dati richiesta
router.put('/:id', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('badanti_intermediazione', 'UPDATE'), async (req: AuthRequest, res: Response) => {
  try {
    const richiesta = await BadanteIntermediazione.findById(req.params.id);
    if (!richiesta) return res.status(404).json({ message: 'Richiesta non trovata' });
    const { contrattoTipo, livello, oreSettimanali, mesiContratto, gestioneAmministrativa, note } = req.body;
    if (contrattoTipo) richiesta.contrattoTipo = contrattoTipo;
    if (livello) richiesta.livello = livello;
    if (oreSettimanali !== undefined) richiesta.oreSettimanali = oreSettimanali;
    if (mesiContratto !== undefined) richiesta.mesiContratto = mesiContratto;
    if (gestioneAmministrativa !== undefined) richiesta.gestioneAmministrativa = gestioneAmministrativa;
    if (note !== undefined) richiesta.note = note;
    richiesta.costoMensile = calcolaCostoMensile(richiesta);
    await richiesta.save();
    const popolata = await BadanteIntermediazione.findById(richiesta._id).populate('patient', 'firstName lastName codiceFiscale email');
    return res.json(popolata);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nella modifica', error: error.message });
  }
});

// PATCH /api/badanti-intermediazione/:id/stato — aggiorna stato
router.patch('/:id/stato', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('badanti_intermediazione', 'UPDATE'), async (req: Request, res: Response) => {
  try {
    const { stato } = req.body;
    if (!stato || !['aperta', 'preventivo_emesso', 'accettata', 'fatturata', 'annullata'].includes(stato)) {
      return res.status(400).json({ message: 'Stato non valido' });
    }
    const richiesta = await BadanteIntermediazione.findByIdAndUpdate(req.params.id, { stato }, { new: true })
      .populate('patient', 'firstName lastName codiceFiscale email');
    if (!richiesta) return res.status(404).json({ message: 'Richiesta non trovata' });
    return res.json(richiesta);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore modifica stato', error: error.message });
  }
});

// Valida l'input del simulatore costo (condiviso da /:id/preventivo e /simula-costo/contratto)
function validaSimInput(body: any): string | null {
  const tipiValidi = CONTRATTI_SIM.map((c: any) => c.value);
  if (!body?.contrattoTipo || !tipiValidi.includes(body.contrattoTipo)) {
    return `contrattoTipo deve essere uno tra: ${tipiValidi.join(', ')}`;
  }
  const orario = body.contrattoTipo === 'non_convivente' || body.contrattoTipo === 'sostituzione';
  if (orario && !(Number(body.oreSettimanali) > 0)) {
    return 'Ore settimanali obbligatorie per i contratti ad orario';
  }
  return null;
}

// Genera il PDF costo dal simulatore e crea il contratto d'incarico (allegato PDF + GDPR + firma).
// Restituisce { errore: { status, message } } oppure { contratto, richiesta, emailInviata }.
async function generaContrattoDaSimulazione(richiesta: any, body: any, req: Request): Promise<any> {
  const erroreInput = validaSimInput(body);
  if (erroreInput) return { errore: { status: 400, message: erroreInput } };

  const {
    contrattoTipo, livello, oreSettimanali, tempoDeterminato, pagaPersonalizzata,
    indennitaPiuAutosuff, certificazioneUni, indennitaBabysitter,
    cafMensile, importo, email, inviaEmail: inviaEmailFlag,
  } = body || {};

  const P = await caricaParametri();
  const simInput = {
    contrattoTipo,
    livello,
    oreSettimanali: oreSettimanali ? Number(oreSettimanali) : undefined,
    tempoDeterminato: !!tempoDeterminato,
    pagaPersonalizzata: pagaPersonalizzata ? Number(pagaPersonalizzata) : undefined,
    indennitaPiuAutosuff: !!indennitaPiuAutosuff,
    certificazioneUni: !!certificazioneUni,
    indennitaBabysitter: !!indennitaBabysitter,
  };
  const sim = simulaCostoBadante(simInput as any, P);

  const paziente: any = richiesta.patient;
  if (!paziente) return { errore: { status: 404, message: 'Paziente della richiesta non trovato' } };
  const intestatario = `${paziente.firstName || ''} ${paziente.lastName || ''}`.trim();

  // Genera il PDF preventivo dal simulatore
  const pdfBuffer = await generaPreventivoBadantePdfBuffer(sim, {
    intestatario,
    cafMensile: cafMensile !== undefined && Number(cafMensile) >= 0 ? Number(cafMensile) : P.cafMensileDefault,
  });
  const pdfFileName = `preventivo-intermediazione-${intestatario.replace(/\s+/g, '-').toLowerCase() || 'paziente'}.pdf`;

  // Crea il contratto d'incarico con il PDF allegato (contratto + GDPR + firma)
  const contratto = await ContrattoPaziente.create({
    patient: paziente._id || paziente,
    profilo: 'Assistente familiare',
    importo: Number(importo) > 0 ? Number(importo) : 610,
    token: crypto.randomBytes(32).toString('hex'),
    email: email || paziente.email || undefined,
    nome: intestatario,
    stato: 'emesso',
    richiestaId: richiesta._id,
    contesto: 'intermediazione',
    allegatoFileName: pdfFileName,
    allegatoContentType: 'application/pdf',
    allegatoData: pdfBuffer,
  });

  // Collega il contratto alla richiesta
  richiesta.contrattoId = contratto._id as any;
  richiesta.stato = 'preventivo_emesso';
  richiesta.simulazione = { ...simInput, totaleCostoMensile: sim.totaleCostoMensile, retribuzioneNetta: sim.retribuzioneNetta, cafMensile: Number(cafMensile) || 150 };
  richiesta.costoMensile = Math.round(sim.totaleCostoMensile * 100) / 100;
  richiesta.preventivoPdfFileName = pdfFileName;
  await richiesta.save();

  // Invio opzionale: contratto + GDPR + preventivo al paziente per la firma
  const emailDest = (email || paziente.email || '').trim();
  let emailInviata = false;
  if (inviaEmailFlag && emailDest) {
    emailInviata = await inviaEmailContrattoPaziente(String(contratto._id), emailDest, req);
    if (!emailInviata) {
      console.warn(`[Intermediazione] Contratto ${contratto._id} generato ma email a ${emailDest} rifiutata dall'SMTP`);
    }
  }

  return { contratto, richiesta, emailInviata };
}

// POST /api/badanti-intermediazione/:id/preventivo — genera il preventivo reale dal simulatore costi
// (PDF brandizzato) e lo associa al contratto d'incarico da inviare al paziente con
// contratto + informativa GDPR per la firma di accettazione.
router.post('/:id/preventivo', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('badanti_intermediazione', 'CREATE'), async (req: AuthRequest, res: Response) => {
  try {
    const richiesta = await BadanteIntermediazione.findById(req.params.id).populate('patient', 'firstName lastName codiceFiscale email');
    if (!richiesta) return res.status(404).json({ message: 'Richiesta non trovata' });
    if (richiesta.contrattoId) return res.status(400).json({ message: 'Contratto/preventivo già generato' });

    const out = await generaContrattoDaSimulazione(richiesta, req.body, req);
    if (out.errore) return res.status(out.errore.status).json({ message: out.errore.message });
    return res.status(201).json(out);
  } catch (error: any) {
    console.error('[Intermediazione preventivo] Errore:', error);
    return res.status(500).json({ message: 'Errore nella generazione del preventivo', error: error.message });
  }
});

// POST /api/badanti-intermediazione/simula-costo/contratto — dal pannello "Simula costo":
// associa la simulazione a un paziente e crea richiesta + contratto d'incarico
// (PDF costo allegato + GDPR) da inviare per la firma, senza richiesta manuale.
router.post('/simula-costo/contratto', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('badanti_intermediazione', 'CREATE'), async (req: AuthRequest, res: Response) => {
  let richiesta: any = null;
  try {
    const { patient } = req.body || {};
    if (!patient) return res.status(400).json({ message: 'Seleziona un paziente' });
    const erroreInput = validaSimInput(req.body);
    if (erroreInput) return res.status(400).json({ message: erroreInput });

    const paziente = await Patient.findById(patient).select('firstName lastName codiceFiscale email tipoGestione').lean();
    if (!paziente) return res.status(404).json({ message: 'Paziente non trovato' });

    const user = req.user as { name?: string; email?: string } | undefined;
    richiesta = await BadanteIntermediazione.create({
      patient: paziente._id,
      contrattoTipo: req.body.contrattoTipo === 'non_convivente' ? 'orario_non_convivente' : 'convivente',
      livello: ['A', 'AS', 'B', 'BS', 'C', 'CS', 'D', 'DS'].includes(req.body.livello) ? req.body.livello : 'BS',
      oreSettimanali: Number(req.body.oreSettimanali) > 0 ? Number(req.body.oreSettimanali) : undefined,
      stato: 'aperta',
      creatoDa: user?.name || user?.email || 'Sistema',
    });
    richiesta.patient = paziente as any;

    const out = await generaContrattoDaSimulazione(richiesta, req.body, req);
    if (out.errore) {
      await BadanteIntermediazione.deleteOne({ _id: richiesta._id }).catch(() => {});
      return res.status(out.errore.status).json({ message: out.errore.message });
    }
    return res.status(201).json(out);
  } catch (error: any) {
    // Pulizia: se il contratto era già stato creato/linkato quando qualcosa è fallito
    // dopo, elimina contratto e richiesta — niente orfani con link firma ancora attivi.
    if (richiesta?.contrattoId) {
      await ContrattoPaziente.deleteOne({ _id: richiesta.contrattoId }).catch(() => {});
    }
    if (richiesta?._id) {
      await BadanteIntermediazione.deleteOne({ _id: richiesta._id }).catch(() => {});
    }
    console.error('[Intermediazione contratto da simulazione] Errore:', error);
    return res.status(500).json({ message: 'Errore nella generazione del contratto', error: error.message });
  }
});

// POST /api/badanti-intermediazione/:id/fattura — fattura la consulenza/incarico
// Nuovo flusso: contratto firmato (contrattoId) → fattura del corrispettivo d'incarico.
// Flusso legacy: preventivo DocumentoFatturazione firmato → fattura della sola voce consulenza.
router.post('/:id/fattura', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('badanti_intermediazione', 'CREATE'), async (req: AuthRequest, res: Response) => {
  try {
    const richiesta = await BadanteIntermediazione.findById(req.params.id);
    if (!richiesta) return res.status(404).json({ message: 'Richiesta non trovata' });
    if (richiesta.fatturaId) return res.status(400).json({ message: 'Fattura già generata' });

    const user = req.user as { name?: string; email?: string } | undefined;

    // ── Nuovo flusso: contratto firmato → fattura corrispettivo d'incarico ──
    if (richiesta.contrattoId) {
      const contratto = await ContrattoPaziente.findById(richiesta.contrattoId);
      if (!contratto) return res.status(404).json({ message: 'Contratto non trovato' });
      if (contratto.stato !== 'firmato') return res.status(400).json({ message: 'Il contratto deve essere firmato prima di emettere fattura' });

      const imponibile = Math.round(Number(contratto.importo || 0) * 100) / 100;
      if (!(imponibile > 0)) return res.status(400).json({ message: 'Importo contratto non valido' });
      const iva = Math.round(imponibile * 0.22 * 100) / 100;
      const totale = Math.round((imponibile + iva) * 100) / 100;
      const numero = await generaNumero('fattura');

      const fattura = await DocumentoFatturazione.create({
        numero,
        tipo: 'fattura',
        patient: contratto.patient,
        riferimentoTipo: 'badante',
        riferimentoId: richiesta._id,
        prestazioni: [{
          descrizione: `Corrispettivo per incarico di intermediazione e reclutamento ${contratto.profilo} — contratto firmato il ${contratto.dataFirma ? new Date(contratto.dataFirma).toLocaleDateString('it-IT') : '—'}`,
          quantita: 1,
          prezzoUnitario: imponibile,
          importo: imponibile,
          aliquotaIva: 22,
          tipo: 'consulenza',
        }],
        imponibile,
        totaleIva: iva,
        totale,
        data: new Date(),
        stato: 'emesso',
        creatoDa: user?.name || user?.email || 'Sistema',
        firma: { token: '', firmato: false },
      });

      richiesta.fatturaId = fattura._id as any;
      richiesta.stato = 'fatturata';
      await richiesta.save();

      const popolata = await DocumentoFatturazione.findById(fattura._id).populate('patient', 'firstName lastName codiceFiscale address email');
      return res.status(201).json({ fattura: popolata, richiesta });
    }

    // ── Flusso legacy: preventivo DocumentoFatturazione firmato ──
    if (!richiesta.preventivoId) return res.status(400).json({ message: 'Preventivo o contratto mancante' });

    const preventivo = await DocumentoFatturazione.findById(richiesta.preventivoId);
    if (!preventivo) return res.status(404).json({ message: 'Preventivo non trovato' });
    if (preventivo.stato !== 'firmato') return res.status(400).json({ message: 'Il preventivo deve essere firmato prima di emettere fattura' });

    const vociConsulenza = (preventivo.prestazioni || []).filter((p: any) =>
      p.tipo === 'consulenza' || String(p.descrizione).toLowerCase().includes('consulenza specialistica')
    );
    const totaleConsulenza = Math.round(vociConsulenza.reduce((acc: number, p: any) => acc + (Number(p.importo) || 0), 0) * 100) / 100;
    if (vociConsulenza.length === 0) {
      return res.status(400).json({ message: 'Nel preventivo non è presente la voce consulenza da fatturare' });
    }
    const numero = await generaNumero('fattura');

    const fattura = await DocumentoFatturazione.create({
      numero,
      tipo: 'fattura',
      patient: preventivo.patient,
      riferimentoTipo: preventivo.riferimentoTipo,
      riferimentoId: preventivo.riferimentoId,
      prestazioni: vociConsulenza,
      totale: totaleConsulenza,
      data: new Date(),
      dataPrestazione: preventivo.dataPrestazione,
      stato: 'emesso',
      note: preventivo.note,
      creatoDa: user?.name || user?.email || 'Sistema',
      firma: {
        token: '',
        firmato: false,
      },
    });

    richiesta.fatturaId = fattura._id as any;
    richiesta.stato = 'fatturata';
    await richiesta.save();

    const popolata = await DocumentoFatturazione.findById(fattura._id).populate('patient', 'firstName lastName codiceFiscale address email');
    return res.status(201).json({ fattura: popolata, richiesta });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nella generazione della fattura', error: error.message });
  }
});

// POST /api/badanti-intermediazione/:id/fattura-gestione — fattura mensile gestione amministrativa
router.post('/:id/fattura-gestione', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('badanti_intermediazione', 'CREATE'), async (req: AuthRequest, res: Response) => {
  try {
    const richiesta = await BadanteIntermediazione.findById(req.params.id);
    if (!richiesta) return res.status(404).json({ message: 'Richiesta non trovata' });
    if (!richiesta.fatturaId) return res.status(400).json({ message: 'Generare prima la fattura di assistenza domiciliare' });
    if (!richiesta.gestioneAmministrativa || Number(richiesta.gestioneAmministrativa) <= 0) {
      return res.status(400).json({ message: 'Nessuna gestione amministrativa configurata' });
    }

    const { meseRiferimento } = req.body;
    if (!meseRiferimento) return res.status(400).json({ message: 'Mese di riferimento obbligatorio' });
    const [y, m] = String(meseRiferimento).split('-');
    if (!y || !m) return res.status(400).json({ message: 'Mese di riferimento non valido (YYYY-MM)' });
    const label = `${m}/${y}`;
    const dataRif = new Date(Number(y), Number(m) - 1, 1);

    const ga = Number(richiesta.gestioneAmministrativa);
    const gaLordaMensile = Math.round(ga * 1.22 * 100) / 100;
    const numero = await generaNumero('fattura');
    const user = req.user as { name?: string; email?: string } | undefined;

    const fattura = await DocumentoFatturazione.create({
      numero,
      tipo: 'fattura',
      patient: richiesta.patient,
      riferimentoTipo: 'badante',
      riferimentoId: richiesta._id,
      prestazioni: [{
        descrizione: `Gestione amministrativa + IVA 22% - Mese di riferimento: ${label}`,
        quantita: 1,
        prezzoUnitario: gaLordaMensile,
        importo: gaLordaMensile,
      }],
      totale: gaLordaMensile,
      data: new Date(),
      dataPrestazione: dataRif,
      stato: 'emesso',
      creatoDa: user?.name || user?.email || 'Sistema',
      firma: {
        token: '',
        firmato: false,
      },
    });

    richiesta.fattureGestione = richiesta.fattureGestione || [];
    richiesta.fattureGestione.push(fattura._id as any);
    await richiesta.save();

    const popolata = await DocumentoFatturazione.findById(fattura._id).populate('patient', 'firstName lastName codiceFiscale address email');
    return res.status(201).json({ fattura: popolata, richiesta });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nella generazione della fattura di gestione', error: error.message });
  }
});

// DELETE /api/badanti-intermediazione/:id
router.delete('/:id', authenticateToken, authorizeRole('admin'), auditLog('badanti_intermediazione', 'DELETE'), async (req: Request, res: Response) => {
  try {
    const richiesta = await BadanteIntermediazione.findByIdAndDelete(req.params.id);
    if (!richiesta) return res.status(404).json({ message: 'Richiesta non trovata' });
    // Il contratto/richiesta firma collegato NON viene eliminato: resta in archivio
    // come contratto orfano (gestito da archivio/contratti) e può ancora essere firmato.
    return res.json({ message: 'Richiesta eliminata' });
  } catch (error: any) {
    return res.status(500).json({ message: "Errore nell'eliminazione", error: error.message });
  }
});

export default router;
