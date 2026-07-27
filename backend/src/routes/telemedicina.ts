import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { authenticateToken } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import Teleconsulto from '../models/Teleconsulto';
import ConsensoTelemedicina from '../models/ConsensoTelemedicina';
import DispositivoMedico from '../models/DispositivoMedico';
import ParametroVita from '../models/ParametroVita';
import AlertTelemedicina from '../models/AlertTelemedicina';
import SogliaTelemedicina from '../models/SogliaTelemedicina';
import ProtocolloTelemedicina from '../models/ProtocolloTelemedicina';
import PacchettoTelemedicina from '../models/PacchettoTelemedicina';
import Patient from '../models/Patient';
import Staff from '../models/Staff';
import { inviaEmail } from '../utils/email';
import { generateTelemedicinaSummary } from '../utils/telemedicinaAi';
import { exportFhirBundle } from '../utils/telemedicinaFhir';

const router = Router();

const ruoliGestione = ['admin', 'coordinator', 'direttore'];
const ruoliOperatori = ['admin', 'coordinator', 'direttore', 'caregiver'];

const SLA_MINUTI: Record<string, number> = {
  bassa: 1440,
  media: 240,
  alta: 60,
  critica: 15,
};

function prioritaPiuAlta(p: string): string {
  const ord = ['bassa', 'media', 'alta', 'critica'];
  const i = ord.indexOf(p);
  return ord[Math.min(ord.length - 1, (i < 0 ? 1 : i) + 1)];
}

function dataScadenzaSLA(minuti?: number, da = new Date()): Date {
  return new Date(da.getTime() + (minuti || 240) * 60 * 1000);
}

function userId(req: Request): string { return (req as any).user?.userId || ''; }
function userRole(req: Request): string { return (req as any).user?.role || ''; }
function userName(req: Request): string { return (req as any).user?.name || ''; }

function roomId(): string { return `abbraccio-tele-${crypto.randomBytes(12).toString('hex')}`; }

function sendError(res: Response, status: number, message: string) {
  return res.status(status).json({ message });
}

function haAccessoTeleconsulto(req: Request, tele: any): boolean {
  const uid = userId(req);
  const role = userRole(req);
  if (ruoliGestione.includes(role)) return true;
  if (tele.operatori.some((o: any) => o.userId === uid)) return true;
  if (tele.pazientiCaregiver.some((p: any) => p.userId === uid)) return true;
  return false;
}

// ─── TELECONSULTO ─────────────────────────────────────────────────────────────

router.get('/teleconsulti', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { pazienteId, from, to, stato } = req.query as any;
    const q: any = {};
    const uid = userId(req);
    const role = userRole(req);
    if (!ruoliGestione.includes(role)) {
      q.$or = [{ 'operatori.userId': uid }, { 'pazientiCaregiver.userId': uid }];
    }
    if (pazienteId) q.patientId = pazienteId;
    if (stato) q.stato = stato;
    if (from || to) {
      q.dataOra = {};
      if (from) q.dataOra.$gte = new Date(from);
      if (to) q.dataOra.$lte = new Date(to);
    }
    const list = await Teleconsulto.find(q).sort({ dataOra: 1 });
    return res.json(list);
  } catch (error: any) { return sendError(res, 500, error.message); }
});

router.get('/teleconsulti/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tele = await Teleconsulto.findById(req.params.id);
    if (!tele) return sendError(res, 404, 'Teleconsulto non trovato');
    if (!haAccessoTeleconsulto(req, tele)) return sendError(res, 403, 'Accesso negato');
    return res.json(tele);
  } catch (error: any) { return sendError(res, 500, error.message); }
});

router.post('/teleconsulti', authenticateToken, auditLog('telemedicina', 'CREATE'), async (req: Request, res: Response) => {
  try {
    const { patientId, dataOra, durataMinuti, professione, titolo, notePianificazione, operatoriIds, partecipantiEmail } = req.body;
    if (!patientId || !dataOra) return sendError(res, 400, 'Paziente e data/ora sono obbligatori');

    const patient = await Patient.findById(patientId);
    if (!patient) return sendError(res, 400, 'Paziente non trovato');

    const operatori: any[] = [];
    if (Array.isArray(operatoriIds)) {
      for (const id of operatoriIds) {
        const staff = await Staff.findOne({ userId: id });
        operatori.push({ userId: id, nome: staff ? `${staff.firstName} ${staff.lastName}`.trim() : 'Operatore', email: staff?.email || '', ruolo: 'operatore' });
      }
    }
    // Aggiungi creatore
    const uid = userId(req);
    if (!operatori.find(o => o.userId === uid)) {
      operatori.push({ userId: uid, nome: userName(req), email: '', ruolo: 'operatore' });
    }

    const pazientiCaregiver: any[] = [];
    if (Array.isArray(partecipantiEmail)) {
      for (const entry of partecipantiEmail) {
        const email = typeof entry === 'string' ? entry : entry.email;
        const nome = typeof entry === 'string' ? email : (entry.nome || email);
        if (email) pazientiCaregiver.push({ nome, email, ruolo: 'caregiver' });
      }
    }
    if (patient.email && patient.email.trim()) {
      pazientiCaregiver.push({ nome: `${patient.firstName} ${patient.lastName}`.trim() || 'Paziente', email: patient.email, ruolo: 'paziente' });
    }

    const consenso = await ConsensoTelemedicina.findOne({ pazienteId: patientId, tipo: 'telemedicina' });

    const tele = await Teleconsulto.create({
      patientId,
      patientNome: `${patient.firstName} ${patient.lastName}`.trim(),
      dataOra: new Date(dataOra),
      durataMinuti: durataMinuti || 30,
      professione: professione || 'generico',
      titolo: titolo || `Teleconsulto ${patient.firstName} ${patient.lastName}`.trim(),
      notePianificazione: notePianificazione || '',
      stato: 'pianificato',
      roomId: roomId(),
      operatori,
      pazientiCaregiver,
      consensoVerificato: !!consenso?.accettato,
      consensoId: consenso?._id?.toString(),
      noteCliniche: [],
      diarioEntrata: '',
      diarioUscita: '',
      creatoDa: uid,
      creatoDaNome: userName(req),
    });

    // Invio inviti email
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const link = `${frontendUrl}/telemedicina/sala?id=${tele._id}`;
    await Promise.all([...tele.operatori, ...tele.pazientiCaregiver].map(async (p: any) => {
      if (!p.email) return;
      await inviaEmail({
        to: p.email,
        subject: `📹 Teleconsulto programmato: ${tele.titolo}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px"><h2 style="color:#0f766e">Teleconsulto Abbraccio</h2><p>Ciao <strong>${p.nome}</strong>,</p><p>Hai un teleconsulto programmato per <strong>${new Date(tele.dataOra).toLocaleString('it-IT')}</strong>.</p><p>Ruolo: <strong>${p.ruolo}</strong></p><a href="${link}" style="display:inline-block;background:#0f766e;color:white;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Entra nella sala</a><p style="font-size:12px;color:#64748b">Clicca sul link all'orario previsto.</p></div>`
      });
    }));

    return res.json(tele);
  } catch (error: any) { return sendError(res, 500, error.message); }
});

router.patch('/teleconsulti/:id/stato', authenticateToken, auditLog('telemedicina', 'UPDATE', req => req.params.id), async (req: Request, res: Response) => {
  try {
    const { stato } = req.body;
    const tele = await Teleconsulto.findById(req.params.id);
    if (!tele) return sendError(res, 404, 'Teleconsulto non trovato');
    if (!haAccessoTeleconsulto(req, tele) && !ruoliGestione.includes(userRole(req))) return sendError(res, 403, 'Accesso negato');
    if (stato === 'in_corso' && tele.stato === 'pianificato') {
      tele.stato = 'in_corso';
      tele.avviatoIl = new Date();
      const part = tele.operatori.find((p: any) => p.userId === userId(req)) || tele.pazientiCaregiver.find((p: any) => p.userId === userId(req));
      if (part && !part.entratoIl) part.entratoIl = new Date();
    } else if (stato === 'completato' && tele.stato === 'in_corso') {
      tele.stato = 'completato';
      tele.completatoIl = new Date();
      tele.operatori.forEach((p: any) => { if (!p.uscitoIl) p.uscitoIl = new Date(); });
      tele.pazientiCaregiver.forEach((p: any) => { if (!p.uscitoIl) p.uscitoIl = new Date(); });
    } else if (['annullato', 'non_presentato'].includes(stato)) {
      tele.stato = stato;
    } else {
      return sendError(res, 400, 'Transizione di stato non valida');
    }
    await tele.save();
    return res.json(tele);
  } catch (error: any) { return sendError(res, 500, error.message); }
});

router.post('/teleconsulti/:id/entra', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tele = await Teleconsulto.findById(req.params.id);
    if (!tele) return sendError(res, 404, 'Teleconsulto non trovato');
    if (!haAccessoTeleconsulto(req, tele)) return sendError(res, 403, 'Accesso negato');
    const part = tele.operatori.find((p: any) => p.userId === userId(req)) || tele.pazientiCaregiver.find((p: any) => p.userId === userId(req));
    if (part && !part.entratoIl) part.entratoIl = new Date();
    if (tele.stato === 'pianificato') { tele.stato = 'in_corso'; tele.avviatoIl = new Date(); }
    await tele.save();
    return res.json({ roomId: tele.roomId, joinUrl: `https://meet.jit.si/${tele.roomId}#config.startWithVideoMuted=false` });
  } catch (error: any) { return sendError(res, 500, error.message); }
});

router.post('/teleconsulti/:id/esci', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tele = await Teleconsulto.findById(req.params.id);
    if (!tele) return sendError(res, 404, 'Teleconsulto non trovato');
    if (!haAccessoTeleconsulto(req, tele)) return sendError(res, 403, 'Accesso negato');
    const part = tele.operatori.find((p: any) => p.userId === userId(req)) || tele.pazientiCaregiver.find((p: any) => p.userId === userId(req));
    if (part && !part.uscitoIl) part.uscitoIl = new Date();
    await tele.save();
    return res.json({ message: 'Uscita registrata' });
  } catch (error: any) { return sendError(res, 500, error.message); }
});

router.post('/teleconsulti/:id/note', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { testo, tipo } = req.body;
    if (!testo?.trim()) return sendError(res, 400, 'Testo obbligatorio');
    const tele = await Teleconsulto.findById(req.params.id);
    if (!tele) return sendError(res, 404, 'Teleconsulto non trovato');
    if (!haAccessoTeleconsulto(req, tele)) return sendError(res, 403, 'Accesso negato');
    if (tipo === 'diario_ingresso') tele.diarioEntrata = testo;
    else if (tipo === 'diario_uscita') tele.diarioUscita = testo;
    else tele.noteCliniche.push({ autoreId: userId(req), autoreNome: userName(req), testo: testo.trim(), inseritaIl: new Date() });
    await tele.save();
    return res.json(tele);
  } catch (error: any) { return sendError(res, 500, error.message); }
});

// ─── CONSENSI TELEMEDICINA ────────────────────────────────────────────────────

router.get('/consensi/:pazienteId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const list = await ConsensoTelemedicina.find({ pazienteId: req.params.pazienteId }).sort({ createdAt: -1 });
    return res.json(list);
  } catch (error: any) { return sendError(res, 500, error.message); }
});

router.post('/consensi', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { pazienteId, pazienteNome, tipo, testo, accettato, accettatoDa, accettatoDaRuolo, firma } = req.body;
    const consenso = await ConsensoTelemedicina.create({
      pazienteId,
      pazienteNome,
      tipo: tipo || 'telemedicina',
      testo: testo || 'Consenso al teleconsulto e al trattamento dati sanitari da remoto.',
      accettato: !!accettato,
      firmatoIl: accettato ? new Date() : undefined,
      firma,
      accettatoDa,
      accettatoDaRuolo,
      creatoDa: userId(req),
    });
    await Teleconsulto.updateMany({ patientId: pazienteId }, { consensoVerificato: !!accettato, consensoId: consenso._id.toString() });
    return res.json(consenso);
  } catch (error: any) { return sendError(res, 500, error.message); }
});

// ─── DISPOSITIVI MEDICI ─────────────────────────────────────────────────────

router.get('/dispositivi', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { pazienteId, stato } = req.query as any;
    const q: any = {};
    if (pazienteId) q.pazienteId = pazienteId;
    if (stato) q.stato = stato;
    const list = await DispositivoMedico.find(q).sort({ createdAt: -1 });
    return res.json(list);
  } catch (error: any) { return sendError(res, 500, error.message); }
});

router.post('/dispositivi', authenticateToken, authorizeRole(...ruoliGestione), async (req: Request, res: Response) => {
  try {
    const { codice, pazienteId, pazienteNome, tipo, modello, serialNumber, fornitore, gatewayApi, parametriSupportati, note } = req.body;
    const disp = await DispositivoMedico.create({
      codice,
      pazienteId,
      pazienteNome,
      tipo,
      modello,
      serialNumber,
      fornitore,
      gatewayApi,
      parametriSupportati: parametriSupportati || [],
      note,
      creatoDa: userId(req),
    });
    return res.json(disp);
  } catch (error: any) { return sendError(res, 500, error.message); }
});

router.patch('/dispositivi/:id/stato', authenticateToken, authorizeRole(...ruoliGestione), async (req: Request, res: Response) => {
  try {
    const { stato, note } = req.body;
    const disp = await DispositivoMedico.findById(req.params.id);
    if (!disp) return sendError(res, 404, 'Dispositivo non trovato');
    disp.stato = stato;
    if (note) disp.note = note;
    if (stato === 'restituito') disp.dataRestituzione = new Date();
    await disp.save();
    return res.json(disp);
  } catch (error: any) { return sendError(res, 500, error.message); }
});

router.post('/dispositivi/:id/sync', authenticateToken, async (req: Request, res: Response) => {
  try {
    const disp = await DispositivoMedico.findById(req.params.id);
    if (!disp) return sendError(res, 404, 'Dispositivo non trovato');
    disp.ultimaSincronizzazione = new Date();
    await disp.save();
    // TODO: chiamata al gateway del fornitore (disp.gatewayApi) con disp.apiKey e parsing del JSON
    return res.json({ message: 'Sincronizzazione registrata. Integrare il gateway del fornitore per caricamento automatico.', dispositivo: disp });
  } catch (error: any) { return sendError(res, 500, error.message); }
});

// ─── PARAMETRI VITALI ─────────────────────────────────────────────────────────

router.get('/parametri', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { pazienteId, tipo, from, to } = req.query as any;
    const q: any = {};
    if (pazienteId) q.pazienteId = pazienteId;
    if (tipo) q.tipo = tipo;
    if (from || to) {
      q.rilevatoIl = {};
      if (from) q.rilevatoIl.$gte = new Date(from);
      if (to) q.rilevatoIl.$lte = new Date(to);
    }
    const list = await ParametroVita.find(q).sort({ rilevatoIl: -1 }).limit(500);
    return res.json(list);
  } catch (error: any) { return sendError(res, 500, error.message); }
});

const soglieDefault: Record<string, { min?: number; max?: number }> = {
  frequenza_cardiaca: { min: 50, max: 120 },
  pressione_sistolica: { min: 90, max: 140 },
  pressione_diastolica: { min: 60, max: 90 },
  saturazione_o2: { min: 95, max: 100 },
  glicemia: { min: 70, max: 140 },
  temperatura: { min: 36, max: 37.5 },
  peso: { min: 30, max: 200 },
  spo2: { min: 95, max: 100 },
};

async function evaluaParametro(tipo: string, valore: number, pazienteId?: string): Promise<{ anomalo: boolean; soglia: string; messaggio?: string }> {
  const q: any = { tipoParametro: tipo, attiva: true };
  if (pazienteId) { q.$or = [{ pazienteId }, { pazienteId: { $exists: false } }]; }
  const soglieDb = await SogliaTelemedicina.find(q).sort({ pazienteId: -1 }).limit(1);
  const sDb = soglieDb[0];
  const s = sDb ? { min: sDb.min, max: sDb.max } : soglieDefault[tipo];
  if (!s) return { anomalo: false, soglia: '' };
  const r: string[] = [];
  if (s.min !== undefined && valore < s.min) r.push(`min ${s.min}`);
  if (s.max !== undefined && valore > s.max) r.push(`max ${s.max}`);
  if (r.length === 0) return { anomalo: false, soglia: `${s.min ?? ''}-${s.max ?? ''}` };
  return { anomalo: true, soglia: r.join(' / '), messaggio: `${tipo.replace(/_/g, ' ')} ${valore} fuori soglia (${r.join(' / ')})` };
}

router.post('/parametri', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { pazienteId, pazienteNome, dispositivoId, tipo, valore, unita, rilevatoIl, fonte, note } = req.body;
    const ev = await evaluaParametro(tipo, Number(valore), pazienteId);
    const param = await ParametroVita.create({
      pazienteId,
      pazienteNome,
      dispositivoId,
      tipo,
      valore: Number(valore),
      unita,
      rilevatoIl: rilevatoIl ? new Date(rilevatoIl) : new Date(),
      fonte: fonte || 'manuale',
      note,
      anomalo: ev.anomalo,
      creatoDa: userId(req),
    });
    if (ev.anomalo && ev.messaggio) {
      const priorita = 'alta';
      const sla = SLA_MINUTI[priorita] || 60;
      await AlertTelemedicina.create({
        pazienteId,
        pazienteNome,
        tipo: 'parametro_fuori_range',
        priorita,
        messaggio: ev.messaggio,
        dettagli: `Soglia di riferimento: ${ev.soglia}`,
        parametroId: param._id?.toString(),
        dispositivoId,
        slaMinuti: sla,
        slaScadenza: dataScadenzaSLA(sla),
        creatoDa: userId(req),
      });
    }
    return res.json(param);
  } catch (error: any) { return sendError(res, 500, error.message); }
});

// ─── AI / REPORT TELEMEDICINA ─────────────────────────────────────────────────

router.get('/ai/summary/:pazienteId', authenticateToken, generateTelemedicinaSummary);
router.get('/fhir/:pazienteId', authenticateToken, exportFhirBundle);

// ─── ALERT TELEMEDICINA ───────────────────────────────────────────────────────

router.get('/alert', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { pazienteId, stato, priorita } = req.query as any;
    const q: any = {};
    if (pazienteId) q.pazienteId = pazienteId;
    if (stato) q.stato = stato;
    if (priorita) q.priorita = priorita;
    const list = await AlertTelemedicina.find(q).sort({ priorita: -1, createdAt: -1 });
    return res.json(list);
  } catch (error: any) { return sendError(res, 500, error.message); }
});

router.post('/alert', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { pazienteId, pazienteNome, tipo, priorita, messaggio, dettagli, parametroId, dispositivoId, teleconsultoId } = req.body;
    const prioritaNorm = priorita || 'media';
    const sla = SLA_MINUTI[prioritaNorm] || 240;
    const alert = await AlertTelemedicina.create({
      pazienteId,
      pazienteNome,
      tipo,
      priorita: prioritaNorm,
      messaggio,
      dettagli,
      parametroId,
      dispositivoId,
      teleconsultoId,
      slaMinuti: sla,
      slaScadenza: dataScadenzaSLA(sla),
      creatoDa: userId(req),
    });
    return res.json(alert);
  } catch (error: any) { return sendError(res, 500, error.message); }
});

router.patch('/alert/:id/azione', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { nota, assegnaA, assegnaANome, priorita, stato } = req.body;
    const alert = await AlertTelemedicina.findById(req.params.id);
    if (!alert) return sendError(res, 404, 'Alert non trovato');
    if (priorita && ['bassa', 'media', 'alta', 'critica'].includes(priorita)) {
      if (priorita !== alert.priorita) {
        alert.priorita = priorita as any;
        alert.slaMinuti = SLA_MINUTI[priorita] || 240;
        alert.slaScadenza = dataScadenzaSLA(alert.slaMinuti);
        alert.storicoAssegnazioni.push({ data: new Date(), autore: userName(req), autoreId: userId(req), nota: `Cambio priorità a ${priorita}` });
      }
    }
    if (assegnaA) {
      alert.assegnatoA = assegnaA;
      alert.assegnatoANome = assegnaANome || assegnaA;
      alert.inCaricoIl = new Date();
      alert.storicoAssegnazioni.push({ data: new Date(), assegnatoA: assegnaA, assegnatoANome: assegnaANome || assegnaA, autore: userName(req), autoreId: userId(req), nota: nota || 'Assegnazione' });
      if (alert.stato === 'aperto') alert.stato = 'in_carico';
    }
    if (stato) alert.stato = stato;
    if (stato === 'chiuso' || stato === 'risolto') alert.risoltoIl = new Date();
    if (nota) alert.azioni.push({ data: new Date(), autore: userName(req), autoreId: userId(req), nota });
    await alert.save();
    return res.json(alert);
  } catch (error: any) { return sendError(res, 500, error.message); }
});

// ─── GOVERNANCE: SOGLIE E PROTOCOLLI ──────────────────────────────────────────

router.get('/soglie', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { pazienteId } = req.query as any;
    const q: any = {};
    if (pazienteId) q.pazienteId = pazienteId;
    const list = await SogliaTelemedicina.find(q).sort({ createdAt: -1 });
    return res.json(list);
  } catch (error: any) { return sendError(res, 500, error.message); }
});

router.post('/soglie', authenticateToken, authorizeRole(...ruoliGestione), async (req: Request, res: Response) => {
  try {
    const { pazienteId, pazienteNome, tipoParametro, professione, min, max, unita, note } = req.body;
    const soglia = await SogliaTelemedicina.create({
      pazienteId,
      pazienteNome,
      tipoParametro,
      professione,
      min: min !== undefined ? Number(min) : undefined,
      max: max !== undefined ? Number(max) : undefined,
      unita,
      note,
      creatoDa: userId(req),
    });
    return res.json(soglia);
  } catch (error: any) { return sendError(res, 500, error.message); }
});

router.patch('/soglie/:id', authenticateToken, authorizeRole(...ruoliGestione), async (req: Request, res: Response) => {
  try {
    const soglia = await SogliaTelemedicina.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!soglia) return sendError(res, 404, 'Soglia non trovata');
    return res.json(soglia);
  } catch (error: any) { return sendError(res, 500, error.message); }
});

router.get('/protocolli', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { professione } = req.query as any;
    const q: any = {};
    if (professione) q.professione = professione;
    const list = await ProtocolloTelemedicina.find(q).sort({ createdAt: -1 });
    return res.json(list);
  } catch (error: any) { return sendError(res, 500, error.message); }
});

router.post('/protocolli', authenticateToken, authorizeRole(...ruoliGestione), async (req: Request, res: Response) => {
  try {
    const { nome, professione, descrizione, passi, esercizi, questionari, soglieTipo } = req.body;
    const protocollo = await ProtocolloTelemedicina.create({
      nome,
      professione,
      descrizione,
      passi: Array.isArray(passi) ? passi : [],
      esercizi: Array.isArray(esercizi) ? esercizi : [],
      questionari: Array.isArray(questionari) ? questionari : [],
      soglieTipo: Array.isArray(soglieTipo) ? soglieTipo : [],
      creatoDa: userId(req),
    });
    return res.json(protocollo);
  } catch (error: any) { return sendError(res, 500, error.message); }
});

router.patch('/protocolli/:id', authenticateToken, authorizeRole(...ruoliGestione), async (req: Request, res: Response) => {
  try {
    const protocollo = await ProtocolloTelemedicina.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!protocollo) return sendError(res, 404, 'Protocollo non trovato');
    return res.json(protocollo);
  } catch (error: any) { return sendError(res, 500, error.message); }
});

// ─── CENTRALE OPERATIVA E DASHBOARD TELEMEDICINA ─────────────────────────────

async function processEscalations() {
  try {
    const now = new Date();
    const alerti = await AlertTelemedicina.find({ stato: { $in: ['aperto', 'in_carico'] }, slaScadenza: { $lt: now } });
    for (const alert of alerti) {
      if (!alert.inRitardo) {
        alert.inRitardo = true;
        alert.escalationLevel = (alert.escalationLevel || 0) + 1;
        const nuovaPriorita = prioritaPiuAlta(alert.priorita as string);
        if (nuovaPriorita !== alert.priorita) {
          alert.priorita = nuovaPriorita as any;
          alert.slaMinuti = SLA_MINUTI[nuovaPriorita] || 240;
        }
        alert.slaScadenza = dataScadenzaSLA(alert.slaMinuti || 240);
        await alert.save();
      }
    }
  } catch (e) { console.error('Errore processEscalations', e); }
}

router.get('/centrale', authenticateToken, authorizeRole(...ruoliGestione), async (req: Request, res: Response) => {
  try {
    await processEscalations();
    const { pazienteId, stato, priorita, assegnatoA, scaduto } = req.query as any;
    const q: any = {};
    if (pazienteId) q.pazienteId = pazienteId;
    if (stato) q.stato = stato;
    if (priorita) q.priorita = priorita;
    if (assegnatoA) q.assegnatoA = assegnatoA;
    if (scaduto === 'true') q.slaScadenza = { $lt: new Date() };
    const [aperti, inCarico, critici, scaduti] = await Promise.all([
      AlertTelemedicina.countDocuments({ stato: { $in: ['aperto', 'in_carico'] } }),
      AlertTelemedicina.countDocuments({ stato: 'in_carico' }),
      AlertTelemedicina.countDocuments({ stato: { $in: ['aperto', 'in_carico'] }, priorita: 'critica' }),
      AlertTelemedicina.countDocuments({ stato: { $in: ['aperto', 'in_carico'] }, slaScadenza: { $lt: new Date() } }),
    ]);
    const alerts = await AlertTelemedicina.find(q).sort({ priorita: -1, slaScadenza: 1 }).limit(200);
    return res.json({ summary: { aperti, inCarico, critici, scaduti }, alerts });
  } catch (error: any) { return sendError(res, 500, error.message); }
});

router.post('/alert/:id/escalate', authenticateToken, authorizeRole(...ruoliGestione), async (req: Request, res: Response) => {
  try {
    const alert = await AlertTelemedicina.findById(req.params.id);
    if (!alert) return sendError(res, 404, 'Alert non trovato');
    const nuovaPriorita = prioritaPiuAlta(alert.priorita as string);
    alert.escalationLevel = (alert.escalationLevel || 0) + 1;
    alert.priorita = nuovaPriorita as any;
    alert.slaMinuti = SLA_MINUTI[nuovaPriorita] || 240;
    alert.slaScadenza = dataScadenzaSLA(alert.slaMinuti);
    alert.storicoAssegnazioni.push({ data: new Date(), autore: userName(req), autoreId: userId(req), nota: `Escalation manuale a priorità ${nuovaPriorita}` });
    await alert.save();
    return res.json(alert);
  } catch (error: any) { return sendError(res, 500, error.message); }
});

router.get('/dashboard', authenticateToken, authorizeRole(...ruoliGestione), async (req: Request, res: Response) => {
  try {
    await processEscalations();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const pazientiIds = await ParametroVita.distinct('pazienteId');
    const [alertCritici, alertAperti, teleconsultiOggi, dispositiviOffline, parametri24h] = await Promise.all([
      AlertTelemedicina.countDocuments({ stato: { $in: ['aperto', 'in_carico'] }, priorita: 'critica' }),
      AlertTelemedicina.countDocuments({ stato: { $in: ['aperto', 'in_carico'] } }),
      Teleconsulto.countDocuments({ dataOra: { $gte: startOfDay } }),
      DispositivoMedico.countDocuments({ stato: 'offline' }),
      ParametroVita.countDocuments({ rilevatoIl: { $gte: yesterday } }),
    ]);
    const topAlerts = await AlertTelemedicina.find({ stato: { $in: ['aperto', 'in_carico'] } }).sort({ priorita: -1, slaScadenza: 1 }).limit(5);
    return res.json({
      alertCritici,
      alertAperti,
      teleconsultiOggi,
      dispositiviOffline,
      parametri24h,
      pazientiMonitorati: pazientiIds.length,
      topAlerts,
    });
  } catch (error: any) { return sendError(res, 500, error.message); }
});

// ─── BUSINESS: PACCHETTI TELEMEDICINA ─────────────────────────────────────────

router.get('/pacchetti', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { attivo } = req.query as any;
    const q: any = {};
    if (attivo !== undefined) q.attivo = attivo === 'true';
    const list = await PacchettoTelemedicina.find(q).sort({ createdAt: -1 });
    return res.json(list);
  } catch (error: any) { return sendError(res, 500, error.message); }
});

router.post('/pacchetti', authenticateToken, authorizeRole(...ruoliGestione), async (req: Request, res: Response) => {
  try {
    const { codice, nome, descrizione, prezzoMensile, durataMinimaMesi, incluseProfessioni, dispositiviInclusi, visiteIncluse, parametriInclusi, note } = req.body;
    const pacchetto = await PacchettoTelemedicina.create({
      codice,
      nome,
      descrizione,
      prezzoMensile: Number(prezzoMensile),
      durataMinimaMesi: Number(durataMinimaMesi || 12),
      incluseProfessioni: Array.isArray(incluseProfessioni) ? incluseProfessioni : [],
      dispositiviInclusi: Array.isArray(dispositiviInclusi) ? dispositiviInclusi : [],
      visiteIncluse: Number(visiteIncluse || 0),
      parametriInclusi: Array.isArray(parametriInclusi) ? parametriInclusi : [],
      note,
      creatoDa: userId(req),
    });
    return res.json(pacchetto);
  } catch (error: any) { return sendError(res, 500, error.message); }
});

router.patch('/pacchetti/:id', authenticateToken, authorizeRole(...ruoliGestione), async (req: Request, res: Response) => {
  try {
    const pacchetto = await PacchettoTelemedicina.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!pacchetto) return sendError(res, 404, 'Pacchetto non trovato');
    return res.json(pacchetto);
  } catch (error: any) { return sendError(res, 500, error.message); }
});

export default router;
