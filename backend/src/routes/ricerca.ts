import express from 'express';
import { Types } from 'mongoose';
import { authenticateToken } from '../middleware/auth';
import { decrypt } from '../utils/encryption';
import Patient from '../models/Patient';
import Staff from '../models/Staff';
import DocumentoFatturazione from '../models/DocumentoFatturazione';
import ContrattoPaziente from '../models/ContrattoPaziente';
import PreventivoInviato from '../models/PreventivoInviato';
import BadanteIntermediazione from '../models/BadanteIntermediazione';
import RichiestaPrenotazione from '../models/RichiestaPrenotazione';
import EmailLog from '../models/EmailLog';
import ConsegnaAmministrativa from '../models/ConsegnaAmministrativa';
import ConsensoGDPR from '../models/ConsensoGDPR';
import WorkPlan from '../models/WorkPlan';
import CandidatoIntermediazione from '../models/CandidatoIntermediazione';

const router = express.Router();
router.use(authenticateToken);

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const nome = (p: any) => `${p?.firstName || ''} ${p?.lastName || ''}`.trim();
// contactPhone/address sono cifrati a riposo: con .lean() il toJSON che li
// decifra non viene eseguito → decifro a mano (torna la stringa com'è se non cifrata).
const dec = (v?: string) => { if (!v) return undefined; try { return decrypt(v) || v; } catch { return v; } };

// Tipi di gestione paziente inclusi per area. In 'consulenza' vediamo solo i
// pazienti intermediazione; in 'privato' escludiamo quelli consulenza.
function filtroArea(area?: string) {
  if (area === 'consulenza') return { tipoGestione: 'consulenza' };
  if (area === 'privato') return { tipoGestione: { $ne: 'consulenza' } };
  return {};
}

// Dossier completo di UN paziente: tutto ciò che lo riguarda nel gestionale.
// Usato sia dalla ricerca globale (click sul paziente) sia dal pulsante
// "Storico" nell'anagrafica. I collegamenti non-id (email, consegne) sono
// fatti per email/nome per recuperare anche i record nati prima del paziente.
async function dossierPaziente(p: any) {
  const pid = p._id;
  const cognome = String(p.lastName || '').trim();
  const mailRegex = p.email ? escapeRegex(String(p.email).trim()) : null;
  const nomeRegex = cognome.length >= 3 ? new RegExp(escapeRegex(cognome), 'i') : null;

  // I contratti servono prima: gli invii WhatsApp/email del contratto sono
  // collegati tramite contrattoId (PreventivoInviato non ha il campo patient).
  const contratti = await ContrattoPaziente.find({ patient: pid }).sort({ createdAt: -1 }).limit(30)
    .select('profilo stato dataFirma createdAt').lean();
  const contrattoIds = contratti.map((c: any) => c._id);

  // Preventivi inviati: match per email, nome cliente E telefono (invii
  // WhatsApp spesso hanno solo il numero, non email né nome paziente)
  const telDigits = dec(p.contactPhone).replace(/\D/g, '');
  const telTail = telDigits.length >= 8 ? telDigits.slice(-8) : null;
  const inviiOr: any[] = [
    ...(mailRegex ? [{ email: { $regex: `^${mailRegex}$`, $options: 'i' } }] : []),
    ...(nomeRegex ? [{ nomeCliente: nomeRegex }] : []),
    ...(telTail ? [{ telefono: { $regex: telTail } }] : []),
    ...(contrattoIds.length ? [{ contrattoId: { $in: contrattoIds } }] : []),
  ];

  const [documenti, invii, richieste, badanti, piani, email, consegne, gdpr] = await Promise.all([
    DocumentoFatturazione.find({ patient: pid }).sort({ createdAt: -1 }).limit(60)
      .select('numero tipo totale totaleMensileStimato stato data createdAt').lean(),
    inviiOr.length
      ? PreventivoInviato.find({ $or: inviiOr }).sort({ createdAt: -1 }).limit(40)
          .select('tipo canale nomeCliente telefono totale createdAt inviatoDa').lean()
      : Promise.resolve([]),
    RichiestaPrenotazione.find({
      $or: [{ pazienteId: pid }, ...(nomeRegex ? [{ pazienteNome: nomeRegex }] : [])],
    }).sort({ createdAt: -1 }).limit(40).select('tipoServizio stato pazienteNome createdAt').lean(),
    BadanteIntermediazione.find({ patient: pid }).sort({ createdAt: -1 }).limit(20)
      .select('stato contrattoTipo livello oreSettimanali costoMensile createdAt').lean(),
    WorkPlan.find({ patient: pid }).sort({ date: -1 }).limit(30)
      .populate('staff', 'firstName lastName role')
      .select('task date status staff').lean(),
    EmailLog.find({
      $or: [
        ...(mailRegex ? [{ to: { $regex: `^${mailRegex}$`, $options: 'i' } }] : []),
        ...(nomeRegex ? [{ riferimento: nomeRegex }] : []),
      ],
    }).sort({ createdAt: -1 }).limit(40).select('to subject tipo area esito createdAt allegati').lean(),
    nomeRegex
      ? ConsegnaAmministrativa.find({ $or: [{ riferimento: nomeRegex }, { titolo: nomeRegex }, { testo: nomeRegex }] }).sort({ createdAt: -1 }).limit(30)
          .select('titolo tipo stato priorita autoreNome createdAt').lean()
      : Promise.resolve([]),
    ConsensoGDPR.find({ patientId: String(pid) }).sort({ dataFirma: -1 }).limit(20)
      .select('nomeFirmatario cognomeFirmatario dataFirma luogoFirma versioneInformativa contesto revocato').lean(),
  ]);

  return {
    paziente: {
      _id: p._id, nome: nome(p), tipoGestione: p.tipoGestione,
      email: p.email, telefono: dec(p.contactPhone), indirizzo: dec(p.address),
      categoriaPrivata: p.categoriaPrivata, inAccettazione: p.inAccettazione, createdAt: p.createdAt,
    },
    operatori: [...new Set(
      piani.map((w: any) => w.staff && nome(w.staff)).filter(Boolean) as string[],
    )],
    piani: piani.map((w: any) => ({
      _id: w._id, task: w.task, date: w.date, status: w.status,
      operatore: w.staff ? nome(w.staff) : undefined, ruoloOperatore: w.staff?.role,
    })),
    documenti: documenti.map((d: any) => ({
      _id: d._id, numero: d.numero, tipo: d.tipo, totale: d.totale,
      totaleMensileStimato: d.totaleMensileStimato, stato: d.stato, data: d.data || d.createdAt,
    })),
    contratti: contratti.map((c: any) => ({
      _id: c._id, profilo: c.profilo, stato: c.stato, firmatoIl: c.dataFirma, data: c.createdAt,
    })),
    invii: invii.map((i: any) => ({
      _id: i._id, tipo: i.tipo, canale: i.canale, nomeCliente: i.nomeCliente,
      telefono: i.telefono, totale: i.totale, data: i.createdAt, inviatoDa: i.inviatoDa,
    })),
    richieste: richieste.map((r: any) => ({
      _id: r._id, tipoServizio: r.tipoServizio, stato: r.stato, pazienteNome: r.pazienteNome, data: r.createdAt,
    })),
    intermediazioni: badanti.map((b: any) => ({
      _id: b._id, stato: b.stato, contrattoTipo: b.contrattoTipo, livello: b.livello,
      oreSettimanali: b.oreSettimanali, costoMensile: b.costoMensile, data: b.createdAt,
    })),
    email: email.map((e: any) => ({
      _id: e._id, to: e.to, subject: e.subject, tipo: e.tipo, esito: e.esito, data: e.createdAt,
      allegati: e.allegati?.length || 0,
    })),
    consegne: consegne.map((c: any) => ({
      _id: c._id, titolo: c.titolo, tipo: c.tipo, stato: c.stato, priorita: c.priorita, data: c.createdAt,
    })),
    gdpr: gdpr.map((g: any) => ({
      _id: g._id, firmatario: `${g.nomeFirmatario || ''} ${g.cognomeFirmatario || ''}`.trim(),
      dataFirma: g.dataFirma, luogo: g.luogoFirma, versione: g.versioneInformativa,
      contesto: g.contesto, revocato: !!g.revocato,
    })),
  };
}

// ═══ RICERCA GLOBALE — cerca ovunque: anagrafiche, documenti, email, consegne.
router.get('/', async (req: any, res: any) => {
  try {
    const q = String(req.query.q || '').trim();
    const area = String(req.query.area || '');
    if (q.length < 2) return res.status(400).json({ message: 'Scrivi almeno 2 caratteri.' });
    const rx = new RegExp(escapeRegex(q), 'i');
    const filtro = filtroArea(area);

    const [pazienti, operatori, candidati, documenti, contratti, richieste, email, consegne] = await Promise.all([
      Patient.find({ ...filtro, $or: [{ firstName: rx }, { lastName: rx }, { email: rx }] })
        .sort({ lastName: 1 }).limit(15)
        .select('firstName lastName tipoGestione email contactPhone address categoriaPrivata').lean(),
      Staff.find({ $or: [{ firstName: rx }, { lastName: rx }, { role: rx }, { email: rx }] })
        .limit(15).select('firstName lastName role category email telefono cittaResidenza indirizzoResidenza').lean(),
      CandidatoIntermediazione.find({ $or: [{ nome: rx }, { cognome: rx }, { email: rx }, { cittaResidenza: rx }] })
        .limit(10).select('nome cognome ruolo stato email telefono cittaResidenza createdAt').lean(),
      DocumentoFatturazione.find({ $or: [{ numero: rx }] }).sort({ createdAt: -1 }).limit(15)
        .populate('patient', 'firstName lastName tipoGestione')
        .select('numero tipo totale stato patient data createdAt').lean(),
      ContrattoPaziente.find({}).sort({ createdAt: -1 }).limit(200)
        .populate('patient', 'firstName lastName')
        .select('profilo stato patient dataFirma createdAt').lean()
        .then((all: any[]) => all.filter((c) => c.patient && rx.test(nome(c.patient))).slice(0, 10)),
      RichiestaPrenotazione.find({ $or: [{ pazienteNome: rx }, { richiedenteNome: rx }] })
        .sort({ createdAt: -1 }).limit(15).select('tipoServizio stato pazienteNome richiedenteNome createdAt').lean(),
      EmailLog.find({ $or: [{ to: rx }, { subject: rx }, { riferimento: rx }] })
        .sort({ createdAt: -1 }).limit(15).select('to subject tipo esito area createdAt').lean(),
      ConsegnaAmministrativa.find({ $or: [{ titolo: rx }, { testo: rx }, { riferimento: rx }] })
        .sort({ createdAt: -1 }).limit(15).select('titolo tipo stato priorita autoreNome createdAt').lean(),
    ]);

    // Documenti collegati ai pazienti trovati (anche senza numero nel testo)
    const ids = pazienti.map((p: any) => p._id);
    const docDeiPazienti = ids.length
      ? await DocumentoFatturazione.find({ patient: { $in: ids } }).sort({ createdAt: -1 }).limit(20)
          .select('numero tipo totale stato patient data createdAt').lean()
      : [];

    const seen = new Set(documenti.map((d: any) => String(d._id)));
    const tuttiDoc = [
      ...documenti.map((d: any) => ({ ...d, pazienteNome: nome(d.patient), tipoGestione: d.patient?.tipoGestione })),
      ...docDeiPazienti.filter((d: any) => !seen.has(String(d._id)))
        .map((d: any) => ({ ...d, pazienteNome: nome((pazienti as any[]).find((p) => String(p._id) === String(d.patient))) })),
    ];

    return res.json({
      q,
      pazienti: pazienti.map((p: any) => ({
        _id: p._id, nome: nome(p), tipoGestione: p.tipoGestione, email: p.email,
        telefono: dec(p.contactPhone), indirizzo: dec(p.address), categoria: p.categoriaPrivata,
      })),
      operatori: operatori.map((s: any) => ({
        _id: s._id, nome: nome(s), ruolo: s.role, categoria: s.category, email: s.email,
        telefono: s.telefono, citta: s.cittaResidenza, indirizzo: s.indirizzoResidenza,
      })),
      candidati: candidati.map((c: any) => ({
        _id: c._id, nome: `${c.nome || ''} ${c.cognome || ''}`.trim(), ruolo: c.ruolo,
        stato: c.stato, email: c.email, telefono: c.telefono, citta: c.cittaResidenza, data: c.createdAt,
      })),
      documenti: tuttiDoc.map((d: any) => ({
        _id: d._id, numero: d.numero, tipo: d.tipo, totale: d.totale, stato: d.stato,
        paziente: d.pazienteNome, pazienteId: d.patient?._id || d.patient, data: d.data || d.createdAt,
      })),
      contratti: contratti.map((c: any) => ({
        _id: c._id, profilo: c.profilo, stato: c.stato, firmatoIl: c.dataFirma,
        paziente: nome(c.patient), pazienteId: c.patient?._id, data: c.createdAt,
      })),
      richieste: richieste.map((r: any) => ({
        _id: r._id, tipoServizio: r.tipoServizio, stato: r.stato,
        paziente: r.pazienteNome, richiedente: r.richiedenteNome, data: r.createdAt,
      })),
      email: email.map((e: any) => ({
        _id: e._id, to: e.to, subject: e.subject, tipo: e.tipo, esito: e.esito, data: e.createdAt,
      })),
      consegne: consegne.map((c: any) => ({
        _id: c._id, titolo: c.titolo, tipo: c.tipo, stato: c.stato, priorita: c.priorita, data: c.createdAt,
      })),
    });
  } catch (e: any) {
    console.error('[ricerca] errore:', e);
    return res.status(500).json({ message: 'Errore nella ricerca.' });
  }
});

// ═══ DOSSIER PAZIENTE — tutto ciò che riguarda un paziente specifico.
router.get('/paziente/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'ID non valido.' });
    const p = await Patient.findById(id).lean();
    if (!p) return res.status(404).json({ message: 'Paziente non trovato.' });
    return res.json(await dossierPaziente(p));
  } catch (e: any) {
    console.error('[ricerca/paziente] errore:', e);
    return res.status(500).json({ message: 'Errore nel caricamento dello storico.' });
  }
});

export default router;
export { dossierPaziente };
