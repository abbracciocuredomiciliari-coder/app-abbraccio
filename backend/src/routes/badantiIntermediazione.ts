import { Router, Request, Response } from 'express';
import BadanteIntermediazione from '../models/BadanteIntermediazione';
import DocumentoFatturazione from '../models/DocumentoFatturazione';
import Patient from '../models/Patient';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';

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

// ─── Numerazione progressiva per preventivi/fatture ────────────────────────────
// Le fatture della Consulenza Famiglie usano una serie dedicata FATT-CF con
// progressivo autonomo, distaccato dalla fatturazione dei pazienti privati.
async function generaNumero(tipo: 'preventivo' | 'fattura'): Promise<string> {
  const anno = new Date().getFullYear();
  const prefisso = tipo === 'preventivo' ? 'PREV-CF' : 'FATT-CF';
  const base = `${prefisso}-${anno}-`;
  const count = await DocumentoFatturazione.countDocuments({
    numero: { $regex: `^${base}` },
  });
  let progressivo = count + 1;
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
      .populate('fatturaId', 'numero stato totale')
      .populate('fattureGestione', 'numero stato totale data')
      .sort({ createdAt: -1 });
    const soloPrivate = richieste.filter((r: any) => r.patient?.tipoGestione !== 'convenzione');
    return res.json(soloPrivate);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel caricamento delle richieste', error: error.message });
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

// POST /api/badanti-intermediazione/:id/preventivo — genera preventivo
router.post('/:id/preventivo', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('badanti_intermediazione', 'CREATE'), async (req: AuthRequest, res: Response) => {
  try {
    const richiesta = await BadanteIntermediazione.findById(req.params.id);
    if (!richiesta) return res.status(404).json({ message: 'Richiesta non trovata' });
    if (richiesta.preventivoId) return res.status(400).json({ message: 'Preventivo già generato' });
    if (!richiesta.mesiContratto) return res.status(400).json({ message: 'Mesi contratto obbligatori' });

    const { gestioneAmministrativa, dataPrestazione, note } = req.body;
    const ga = Number(gestioneAmministrativa) >= 0 ? Number(gestioneAmministrativa) : (Number(richiesta.gestioneAmministrativa) || 0);
    const { prestazioni, totaleUnaTantum, totaleMensileStimato } = calcolaPrestazioni(richiesta, ga);
    const mesi = Number(richiesta.mesiContratto) || 12;
    const user = req.user as { name?: string; email?: string } | undefined;
    const numero = await generaNumero('preventivo');

    const preventivo = await DocumentoFatturazione.create({
      numero,
      tipo: 'preventivo',
      patient: richiesta.patient,
      riferimentoTipo: 'badante',
      riferimentoId: richiesta._id,
      prestazioni,
      totale: totaleUnaTantum,
      totaleLabel: 'TOTALE UNA TANTUM',
      totaleMensileStimato,
      totaleMensileLabel: `COSTO MENSILE A CARICO FAMIGLIA (x ${mesi} mesi)`,
      data: new Date(),
      dataPrestazione: dataPrestazione ? new Date(dataPrestazione) : undefined,
      stato: 'emesso',
      note: note || richiesta.note,
      creatoDa: user?.name || user?.email || 'Sistema',
    });

    richiesta.preventivoId = preventivo._id as any;
    richiesta.stato = 'preventivo_emesso';
    if (ga !== Number(richiesta.gestioneAmministrativa)) {
      richiesta.gestioneAmministrativa = ga;
    }
    await richiesta.save();

    const popolato = await DocumentoFatturazione.findById(preventivo._id).populate('patient', 'firstName lastName codiceFiscale address email');
    return res.status(201).json({ preventivo: popolato, richiesta });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nella generazione del preventivo', error: error.message });
  }
});

// POST /api/badanti-intermediazione/:id/fattura — converte preventivo accettato in fattura (solo consulenza)
router.post('/:id/fattura', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('badanti_intermediazione', 'CREATE'), async (req: AuthRequest, res: Response) => {
  try {
    const richiesta = await BadanteIntermediazione.findById(req.params.id);
    if (!richiesta) return res.status(404).json({ message: 'Richiesta non trovata' });
    if (!richiesta.preventivoId) return res.status(400).json({ message: 'Preventivo mancante' });
    if (richiesta.fatturaId) return res.status(400).json({ message: 'Fattura già generata' });

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
    const user = req.user as { name?: string; email?: string } | undefined;

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
    return res.json({ message: 'Richiesta eliminata' });
  } catch (error: any) {
    return res.status(500).json({ message: "Errore nell'eliminazione", error: error.message });
  }
});

export default router;
