import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import VerbaleEquipe from '../models/VerbaleEquipe';
import Staff from '../models/Staff';
import User from '../models/User';
import { authenticateToken } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { generateMeetingMinutes, isVoiceAiAvailable, transcribeAudio } from '../utils/voiceAi';
import { inviaEmail } from '../utils/email';

const router = Router();
const privilegedRoles = ['admin', 'coordinator', 'direttore'];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 }, fileFilter: (_req, file, cb) => file.mimetype.startsWith('audio/') ? cb(null, true) : cb(new Error('Solo file audio sono accettati') as any) });
const documentDirectory = path.join(process.cwd(), 'uploads', 'verbali-equipe');
if (!fs.existsSync(documentDirectory)) fs.mkdirSync(documentDirectory, { recursive: true });
const uploadDocument = multer({
  storage: multer.diskStorage({ destination: documentDirectory, filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname)}`) }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.mimetype) ? cb(null, true) : cb(new Error('Sono accettati PDF, TXT, DOC e DOCX') as any),
});
const userId = (req: Request) => (req as any).user.userId || (req as any).user.id;
const canManage = (req: Request) => privilegedRoles.includes((req as any).user.role);

router.use(authenticateToken);

router.get('/participants', async (_req: Request, res: Response) => {
  try {
    const staff = await Staff.find({ active: true }).select('userId email firstName lastName role').lean();
    const ids = staff.filter((s: any) => s.userId).map((s: any) => s.userId);
    const emails = staff.map((s: any) => s.email.toLowerCase());
    const users = await User.find({ status: 'approved', $or: [{ _id: { $in: ids } }, { email: { $in: emails } }] }).select('firstName lastName name email').lean();
    return res.json(users.map((u: any) => ({ id: u._id.toString(), nome: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || u.email, email: u.email })));
  } catch (error: any) { return res.status(500).json({ message: 'Errore recupero partecipanti', error: error.message }); }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const id = userId(req);
    const query = canManage(req) ? {} : { 'partecipanti.userId': id };
    return res.json(await VerbaleEquipe.find(query).sort({ dataRiunione: -1 }).lean());
  } catch (error: any) { return res.status(500).json({ message: 'Errore recupero verbali', error: error.message }); }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const verbale = await VerbaleEquipe.findById(req.params.id).lean();
    if (!verbale) return res.status(404).json({ message: 'Verbale non trovato' });
    if (!canManage(req) && !verbale.partecipanti.some((p: any) => p.userId === userId(req))) return res.status(403).json({ message: 'Non autorizzato a visualizzare questo verbale' });
    return res.json(verbale);
  } catch (error: any) { return res.status(500).json({ message: 'Errore recupero verbale', error: error.message }); }
});

router.post('/', auditLog('verbali_equipe', 'CREATE'), uploadDocument.single('allegato'), async (req: Request, res: Response) => {
  try {
    if (!canManage(req)) return res.status(403).json({ message: 'Solo coordinatori, direzione e admin possono creare riunioni' });
    const { titolo, dataRiunione, ordineDelGiorno, modalita = 'video', verbale: testoVerbale } = req.body;
    const partecipanti = typeof req.body.partecipanti === 'string' ? JSON.parse(req.body.partecipanti) : req.body.partecipanti;
    if (!titolo?.trim() || !dataRiunione || !ordineDelGiorno?.trim() || !Array.isArray(partecipanti) || !partecipanti.length) return res.status(400).json({ message: 'Compilare titolo, data, ordine del giorno e partecipanti' });
    const users = await User.find({ _id: { $in: partecipanti }, status: 'approved' }).select('firstName lastName name email').lean();
    const creator = (req as any).user;
    if (!users.some((u: any) => u._id.toString() === userId(req))) users.push({ _id: userId(req), firstName: creator.firstName, lastName: creator.lastName, name: creator.name, email: creator.email } as any);
    if (!users.length) return res.status(400).json({ message: 'Nessun partecipante attivo selezionato' });
    const stanzaVideo = `abbraccio-equipe-${crypto.randomBytes(12).toString('hex')}`;
    const verbale = await VerbaleEquipe.create({ titolo: titolo.trim(), dataRiunione, ordineDelGiorno: ordineDelGiorno.trim(), stanzaVideo, modalita, verbale: typeof testoVerbale === 'string' && testoVerbale.trim() ? testoVerbale.trim() : undefined, allegato: req.file ? { nome: req.file.originalname, url: `/api/verbali-equipe/allegato/${req.file.filename}`, tipo: req.file.mimetype } : undefined, partecipanti: users.map((u: any) => ({ userId: u._id.toString(), nome: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || u.email, email: u.email, invitatoIl: new Date() })), creatoDaId: userId(req), creatoDaNome: creator.name || creator.email });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const link = `${frontendUrl}/verbali-equipe/${verbale._id}`;
    const results = await Promise.all(verbale.partecipanti.map(p => inviaEmail({ to: p.email, subject: `📅 Invito riunione équipe: ${verbale.titolo}`, html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px"><h2>Invito riunione équipe</h2><p>Ciao <strong>${p.nome}</strong>, sei invitato/a alla riunione <strong>${verbale.titolo}</strong>.</p><p><strong>Data:</strong> ${new Date(verbale.dataRiunione).toLocaleString('it-IT')}<br><strong>Ordine del giorno:</strong> ${verbale.ordineDelGiorno}</p><a href="${link}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold">Apri e conferma partecipazione</a><p>Accedi al portale con il tuo account.</p></div>` })));
    return res.status(201).json({ ...verbale.toObject(), emailInviate: results.filter(Boolean).length });
  } catch (error: any) { return res.status(500).json({ message: 'Errore creazione riunione', error: error.message }); }
});

router.post('/:id/recording-status', auditLog('verbali_equipe', 'UPDATE', req => req.params.id), async (req: Request, res: Response) => {
  try {
    if (!canManage(req)) return res.status(403).json({ message: 'Solo chi gestisce la riunione può avviare la registrazione' });
    const verbale = await VerbaleEquipe.findById(req.params.id);
    if (!verbale) return res.status(404).json({ message: 'Verbale non trovato' });
    verbale.registrazioneInCorso = req.body.attiva === true;
    verbale.registrazioneIniziataIl = verbale.registrazioneInCorso ? new Date() : undefined;
    await verbale.save();
    return res.json(verbale);
  } catch (error: any) { return res.status(500).json({ message: 'Errore aggiornamento stato registrazione', error: error.message }); }
});

router.post('/:id/transcribe', auditLog('verbali_equipe', 'UPDATE', req => req.params.id), upload.single('audio'), async (req: Request, res: Response) => {
  try {
    const verbale = await VerbaleEquipe.findById(req.params.id);
    if (!verbale) return res.status(404).json({ message: 'Verbale non trovato' });
    if (!canManage(req)) return res.status(403).json({ message: 'Solo chi gestisce la riunione può trascrivere e redigere il verbale' });
    if (req.body.confermaInformativaTrascrizione !== 'true') return res.status(400).json({ message: 'Confermare che i partecipanti sono stati informati della trascrizione per il verbale' });
    if (!isVoiceAiAvailable()) return res.status(503).json({ message: 'Voice AI non configurata' });
    if (!req.file) return res.status(400).json({ message: 'Nessun audio ricevuto' });
    const transcript = await transcribeAudio(req.file.buffer, req.file.originalname, req.file.mimetype);
    verbale.confermaInformativaTrascrizione = true;
    verbale.registrazioneInCorso = false;
    verbale.registrazioneIniziataIl = undefined;
    verbale.trascrizione = transcript;
    await verbale.save();
    return res.json({ trascrizione: transcript });
  } catch (error: any) { return res.status(500).json({ message: 'Errore nella trascrizione della riunione', error: error.message }); }
});

router.post('/:id/generate-minutes', auditLog('verbali_equipe', 'UPDATE', req => req.params.id), async (req: Request, res: Response) => {
  try {
    if (!canManage(req)) return res.status(403).json({ message: 'Solo coordinatori, direzione e admin possono generare il verbale' });
    const verbale = await VerbaleEquipe.findById(req.params.id);
    if (!verbale?.trascrizione) return res.status(400).json({ message: 'Prima termina la registrazione e verifica la trascrizione' });
    verbale.verbale = await generateMeetingMinutes(verbale.trascrizione, {
      titolo: verbale.titolo,
      ordineDelGiorno: verbale.ordineDelGiorno,
      partecipanti: verbale.partecipanti.map(p => p.nome).join(', '),
      presenzeConfermate: verbale.partecipanti.filter(p => p.confermatoIl).map(p => p.nome).join(', '),
    });
    await verbale.save();
    return res.json(verbale);
  } catch (error: any) { return res.status(500).json({ message: 'Errore generazione verbale', error: error.message }); }
});

router.post('/:id/confirm-attendance', auditLog('verbali_equipe', 'UPDATE', req => req.params.id), async (req: Request, res: Response) => {
  try {
    const verbale = await VerbaleEquipe.findById(req.params.id);
    const partecipante = verbale?.partecipanti.find(p => p.userId === userId(req));
    if (!partecipante) return res.status(403).json({ message: 'Non sei tra i partecipanti invitati' });
    partecipante.confermatoIl = new Date();
    await verbale!.save();
    return res.json(verbale);
  } catch (error: any) { return res.status(500).json({ message: 'Errore conferma partecipazione', error: error.message }); }
});

router.get('/allegato/:filename', async (req: Request, res: Response) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(documentDirectory, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Allegato non trovato' });
  return res.sendFile(filePath);
});

router.patch('/:id', auditLog('verbali_equipe', 'UPDATE', req => req.params.id), async (req: Request, res: Response) => {
  try {
    if (!canManage(req)) return res.status(403).json({ message: 'Solo coordinatori, direzione e admin possono modificare il verbale' });
    const verbale = await VerbaleEquipe.findById(req.params.id);
    if (!verbale) return res.status(404).json({ message: 'Verbale non trovato' });
    if (verbale.stato !== 'bozza') return res.status(400).json({ message: 'Un verbale in firma non può essere modificato' });
    if (typeof req.body.verbale === 'string') verbale.verbale = req.body.verbale.trim();
    await verbale.save();
    return res.json(verbale);
  } catch (error: any) { return res.status(500).json({ message: 'Errore aggiornamento verbale', error: error.message }); }
});

router.post('/:id/request-signatures', auditLog('verbali_equipe', 'UPDATE', req => req.params.id), async (req: Request, res: Response) => {
  try {
    if (!canManage(req)) return res.status(403).json({ message: 'Solo coordinatori, direzione e admin possono richiedere le firme' });
    const verbale = await VerbaleEquipe.findById(req.params.id);
    if (!verbale?.verbale) return res.status(400).json({ message: 'Redigere il verbale prima di richiedere le firme' });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const link = `${frontendUrl}/verbali-equipe/${verbale._id}`;
    verbale.stato = 'in_firma';
    verbale.partecipanti.forEach(p => { p.invitatoIl = new Date(); });
    await verbale.save();
    const results = await Promise.all(verbale.partecipanti.map(p => inviaEmail({ to: p.email, subject: `✍️ Firma richiesta: ${verbale.titolo}`, html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px"><h2 style="color:#0f766e">Firma verbale riunione équipe</h2><p>Ciao <strong>${p.nome}</strong>,</p><p>È richiesta la tua firma sul verbale: <strong>${verbale.titolo}</strong>.</p><a href="${link}" style="display:inline-block;background:#0f766e;color:white;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Apri e firma il verbale</a><p style="font-size:12px;color:#64748b">Accedi al portale con il tuo account per visualizzare e firmare.</p></div>` })));
    return res.json({ message: 'Richieste firma inviate', emailInviate: results.filter(Boolean).length, verbale });
  } catch (error: any) { return res.status(500).json({ message: 'Errore invio richieste firma', error: error.message }); }
});

router.post('/:id/sign', auditLog('verbali_equipe', 'UPDATE', req => req.params.id), async (req: Request, res: Response) => {
  try {
    const { firma } = req.body;
    if (!firma?.startsWith('data:image/')) return res.status(400).json({ message: 'La firma con dito o penna è obbligatoria' });
    const verbale = await VerbaleEquipe.findById(req.params.id);
    if (!verbale || verbale.stato !== 'in_firma') return res.status(400).json({ message: 'Verbale non disponibile per la firma' });
    const partecipante = verbale.partecipanti.find(p => p.userId === userId(req));
    if (!partecipante) return res.status(403).json({ message: 'Non sei tra i partecipanti invitati' });
    if (partecipante.firma) return res.status(400).json({ message: 'Hai già firmato questo verbale' });
    partecipante.firma = firma;
    partecipante.firmatoIl = new Date();
    if (verbale.partecipanti.every(p => Boolean(p.firma))) verbale.stato = 'firmato';
    await verbale.save();
    return res.json(verbale);
  } catch (error: any) { return res.status(500).json({ message: 'Errore firma verbale', error: error.message }); }
});

export default router;
