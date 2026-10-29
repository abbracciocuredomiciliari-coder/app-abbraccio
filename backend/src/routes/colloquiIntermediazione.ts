import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import ColloquioIntermediazione, { IColloquioIntermediazione } from '../models/ColloquioIntermediazione';
import { authenticateToken } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import { generateMeetingMinutes, isVoiceAiAvailable, transcribeAudio } from '../utils/voiceAi';
import { inviaEmail } from '../utils/email';

// ═══════════════════════════════════════════════════════════════════════════
// COLLOQUI INTERMEDIAZIONE — riunioni colloquio con badanti/colf/famiglie.
// I partecipanti NON accedono al portale: ognuno riceve un invito email con
// link pubblico personale (token) per accettare o rifiutare, e il giorno
// dell'appuntamento un promemoria con il link di collegamento.
// Verbale identico alle Riunioni Équipe: microfono → trascrizione → verbale AI.
// ═══════════════════════════════════════════════════════════════════════════

const router = Router();
const RUOLI_GESTIONE = ['admin', 'coordinator', 'direttore'];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 }, fileFilter: (_req, file, cb) => file.mimetype.startsWith('audio/') ? cb(null, true) : cb(new Error('Solo file audio sono accettati') as any) });

const s = (v: any) => String(v ?? '').trim();
const tokenHash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
const frontendUrl = () => process.env.FRONTEND_URL || 'https://app.abbracciocuredomiciliari.it';

export const linkCollegamento = (c: Pick<IColloquioIntermediazione, 'modalita' | 'stanzaVideo' | 'linkCollegamento'>) =>
  c.linkCollegamento || (c.modalita === 'video' ? `https://meet.jit.si/${c.stanzaVideo}` : '');

const modalitaLabel: Record<string, string> = { video: 'Videochiamata', presenza: 'Colloquio in presenza', telefono: 'Colloquio telefonico' };
const dataLunga = (d: Date | string) => new Date(d).toLocaleString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const pagina = (contenuto: string) => `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">${contenuto}<p style="color:#64748b;font-size:13px;margin-top:24px;">Abbraccio Cure Domiciliari — Intermediazioni<br>Tel. 06 01905242 · info@abbracciocuredomiciliari.it</p></div>`;

export async function inviaEmailInvito(c: IColloquioIntermediazione, p: { nome: string; email: string; userId?: string }, token: string) {
  const link = `${frontendUrl()}/colloquio?token=${token}`;
  return inviaEmail({
    to: p.email,
    subject: `📅 Invito colloquio: ${c.titolo} — ${dataLunga(c.dataRiunione)}`,
    html: pagina(`
      <h2 style="color:#1e4d8c;margin-top:0;">Invito a un colloquio</h2>
      <p>Ciao <strong>${p.nome}</strong>,</p>
      <p>Abbraccio Cure Domiciliari ti invita al colloquio <strong>${c.titolo}</strong>.</p>
      <p style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px;">
        📅 <strong>${dataLunga(c.dataRiunione)}</strong><br>
        💬 ${modalitaLabel[c.modalita] || c.modalita}<br>
        📋 <strong>Motivo:</strong> ${c.ordineDelGiorno}
      </p>
      <p>Per confermare la tua partecipazione — oppure avvisarci che non puoi — clicca qui:</p>
      <a href="${link}" style="display:inline-block;background:#1e4d8c;color:#fff;padding:14px 26px;border-radius:8px;text-decoration:none;font-weight:bold;">Rispondi all'invito →</a>
      <p style="font-size:13px;color:#64748b;">Il giorno dell'appuntamento riceverai un promemoria con il link per collegarti${c.modalita === 'telefono' ? ' / il numero da chiamare' : ''}. Non serve registrarsi.</p>
    `),
    log: { tipo: 'invito_colloquio', area: 'intermediazione', riferimento: `${c.titolo} — ${p.nome}` },
  });
}

export async function inviaEmailPromemoria(c: IColloquioIntermediazione): Promise<number> {
  const link = linkCollegamento(c);
  const come = c.modalita === 'video' ? `Collegati al colloquio da questo link (non serve registrarsi):`
    : c.modalita === 'telefono' ? `Ti chiameremo al numero che ci hai lasciato${link ? ` — oppure chiama: ${link}` : ''}.`
    : `Il colloquio si terrà in presenza${link ? ` presso: ${link}` : ''}.`;
  let inviate = 0;
  for (const p of c.partecipanti.filter(x => x.risposta !== 'rifiutato')) {
    const ok = await inviaEmail({
      to: p.email,
      subject: `🔔 Oggi: ${c.titolo} — promemoria e link`,
      html: pagina(`
        <h2 style="color:#1e4d8c;margin-top:0;">Promemoria colloquio — oggi</h2>
        <p>Ciao <strong>${p.nome}</strong>,</p>
        <p>ti ricordiamo l'appuntamento di oggi con Abbraccio Cure Domiciliari:</p>
        <p style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px;">
          📅 <strong>${dataLunga(c.dataRiunione)}</strong><br>
          💬 ${modalitaLabel[c.modalita] || c.modalita}<br>
          📋 <strong>Motivo:</strong> ${c.ordineDelGiorno}
        </p>
        ${c.modalita === 'video' && link ? `<a href="${link}" style="display:inline-block;background:#16a34a;color:#fff;padding:14px 26px;border-radius:8px;text-decoration:none;font-weight:bold;">🎥 Entra nel colloquio →</a><p style="font-size:12px;color:#64748b;">Se il pulsante non funziona: ${link}</p>` : `<p>${come}</p>`}
      `),
      log: { tipo: 'promemoria_colloquio', area: 'intermediazione', riferimento: `${c.titolo} — ${p.nome}` },
    });
    if (ok) inviate++;
  }
  c.promemoriaInviatoIl = new Date();
  await c.save();
  return inviate;
}

// ═══ ENDPOINT PUBBLICI (nessun login): risposta all'invito via token ════════

// Dettaglio colloquio per l'invitato — solo dati pubblici (nomi, non email)
router.get('/pubblico/:token', async (req: Request, res: Response) => {
  try {
    const hash = tokenHash(req.params.token);
    const c = await ColloquioIntermediazione.findOne({ 'partecipanti.tokenHash': hash }).lean();
    const p = c?.partecipanti.find(x => x.tokenHash === hash);
    if (!c || !p) return res.status(404).json({ message: 'Link invito non valido o scaduto' });
    return res.json({
      titolo: c.titolo,
      dataRiunione: c.dataRiunione,
      ordineDelGiorno: c.ordineDelGiorno,
      modalita: c.modalita,
      stato: c.stato,
      linkCollegamento: c.stato === 'programmato' ? linkCollegamento(c) : '',
      partecipanti: c.partecipanti.map(x => ({ nome: x.nome, ruolo: x.ruolo })),
      io: { nome: p.nome, ruolo: p.ruolo, risposta: p.risposta, rispostoIl: p.rispostoIl },
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore caricamento invito', error: error.message });
  }
});

// Accetta / rifiuta il colloquio — senza login
router.post('/pubblico/:token/rispondi', async (req: Request, res: Response) => {
  try {
    const hash = tokenHash(req.params.token);
    const c = await ColloquioIntermediazione.findOne({ 'partecipanti.tokenHash': hash });
    const p = c?.partecipanti.find(x => x.tokenHash === hash);
    if (!c || !p) return res.status(404).json({ message: 'Link invito non valido o scaduto' });
    if (c.stato !== 'programmato') return res.status(400).json({ message: 'Questo colloquio non è più aperto alle risposte' });
    const accetta = req.body?.accetta !== false;
    p.risposta = accetta ? 'accettato' : 'rifiutato';
    p.rispostoIl = new Date();
    p.notaRisposta = s(req.body?.nota) || undefined;
    await c.save();
    return res.json({ message: accetta ? 'Partecipazione confermata. Il giorno dell\'appuntamento riceverai il link per collegarti.' : 'Risposta registrata, grazie per averci avvisato.', risposta: p.risposta });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore registrazione risposta', error: error.message });
  }
});

// ═══ GESTIONE (login richiesto) ═════════════════════════════════════════════
router.use(authenticateToken, authorizeRole(...RUOLI_GESTIONE));

router.get('/', async (_req: Request, res: Response) => {
  try {
    return res.json(await ColloquioIntermediazione.find().sort({ dataRiunione: -1 }).lean());
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore caricamento colloqui', error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const c = await ColloquioIntermediazione.findById(req.params.id).lean();
    if (!c) return res.status(404).json({ message: 'Colloquio non trovato' });
    return res.json(c);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore caricamento colloquio', error: error.message });
  }
});

router.post('/', auditLog('colloqui_intermediazione', 'CREATE'), async (req: Request, res: Response) => {
  try {
    const { titolo, dataRiunione, ordineDelGiorno, linkCollegamento: linkCustom, candidatoId, staffId } = req.body || {};
    const modalita = ['video', 'presenza', 'telefono'].includes(req.body?.modalita) ? req.body.modalita : 'video';
    const partecipanti = Array.isArray(req.body?.partecipanti) ? req.body.partecipanti : [];
    const validi = partecipanti
      .filter((p: any) => s(p?.nome) && /^\S+@\S+\.\S+$/.test(s(p?.email)))
      .map((p: any) => ({
        nome: s(p.nome), email: s(p.email).toLowerCase(), telefono: s(p.telefono) || undefined,
        ruolo: ['badante', 'famiglia', 'operatore', 'altro'].includes(p.ruolo) ? p.ruolo : 'altro',
        staffId: s(p.staffId) || undefined, invitatoIl: new Date(), risposta: 'attesa' as const,
      }));
    if (!s(titolo) || !dataRiunione || !s(ordineDelGiorno) || !validi.length) {
      return res.status(400).json({ message: 'Compila titolo, data, motivo del colloquio e almeno un partecipante con email valida' });
    }

    const tokens = validi.map(() => crypto.randomBytes(32).toString('hex'));
    const c = await ColloquioIntermediazione.create({
      titolo: s(titolo), dataRiunione: new Date(dataRiunione), ordineDelGiorno: s(ordineDelGiorno),
      modalita, stanzaVideo: `abbraccio-colloquio-${crypto.randomBytes(12).toString('hex')}`,
      linkCollegamento: s(linkCustom) || undefined,
      partecipanti: validi.map((p, i) => ({ ...p, tokenHash: tokenHash(tokens[i]) })),
      candidatoId: s(candidatoId) || undefined, staffId: s(staffId) || undefined,
      creatoDaId: (req as any).user.userId || (req as any).user.id,
      creatoDaNome: (req as any).user.name || (req as any).user.email,
    });

    let emailInviate = 0;
    for (let i = 0; i < c.partecipanti.length; i++) {
      const ok = await inviaEmailInvito(c, c.partecipanti[i] as any, tokens[i]).catch(() => false);
      if (ok) emailInviate++;
    }
    return res.status(201).json({ ...c.toObject(), emailInviate });
  } catch (error: any) {
    console.error('[Colloqui intermediazione] Errore creazione:', error);
    return res.status(500).json({ message: 'Errore creazione colloquio', error: error.message });
  }
});

// Reinvia l'invito ai partecipanti ancora in attesa di risposta (nuovo token)
router.post('/:id/reinvia-inviti', auditLog('colloqui_intermediazione', 'UPDATE', req => req.params.id), async (req: Request, res: Response) => {
  try {
    const c = await ColloquioIntermediazione.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Colloquio non trovato' });
    if (c.stato !== 'programmato') return res.status(400).json({ message: 'Il colloquio non è più programmato' });
    let inviate = 0;
    for (const p of c.partecipanti.filter(x => x.risposta === 'attesa')) {
      const token = crypto.randomBytes(32).toString('hex');
      p.tokenHash = tokenHash(token);
      p.invitatoIl = new Date();
      const ok = await inviaEmailInvito(c, p as any, token).catch(() => false);
      if (ok) inviate++;
    }
    await c.save();
    return res.json({ message: `Inviti reinviati: ${inviate}`, emailInviate: inviate });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore reinvio inviti', error: error.message });
  }
});

// Promemoria manuale con link di collegamento
router.post('/:id/promemoria', auditLog('colloqui_intermediazione', 'UPDATE', req => req.params.id), async (req: Request, res: Response) => {
  try {
    const c = await ColloquioIntermediazione.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Colloquio non trovato' });
    const inviate = await inviaEmailPromemoria(c);
    return res.json({ message: `Promemoria inviato a ${inviate} partecipanti`, emailInviate: inviate });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore invio promemoria', error: error.message });
  }
});

// ── Verbale: registrazione microfono → trascrizione → verbale AI ────────────
router.post('/:id/recording-status', auditLog('colloqui_intermediazione', 'UPDATE', req => req.params.id), async (req: Request, res: Response) => {
  try {
    const c = await ColloquioIntermediazione.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Colloquio non trovato' });
    c.registrazioneInCorso = req.body.attiva === true;
    c.registrazioneIniziataIl = c.registrazioneInCorso ? new Date() : undefined;
    await c.save();
    return res.json(c);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore stato registrazione', error: error.message });
  }
});

router.post('/:id/transcribe', auditLog('colloqui_intermediazione', 'UPDATE', req => req.params.id), upload.single('audio'), async (req: Request, res: Response) => {
  try {
    const c = await ColloquioIntermediazione.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Colloquio non trovato' });
    if (req.body.confermaInformativaTrascrizione !== 'true') return res.status(400).json({ message: 'Confermare che i partecipanti sono stati informati della trascrizione per il verbale' });
    if (!isVoiceAiAvailable()) return res.status(503).json({ message: 'Voice AI non configurata' });
    if (!req.file) return res.status(400).json({ message: 'Nessun audio ricevuto' });
    const transcript = await transcribeAudio(req.file.buffer, req.file.originalname, req.file.mimetype);
    c.confermaInformativaTrascrizione = true;
    c.registrazioneInCorso = false;
    c.registrazioneIniziataIl = undefined;
    c.trascrizione = transcript;
    await c.save();
    return res.json({ trascrizione: transcript });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore trascrizione colloquio', error: error.message });
  }
});

router.post('/:id/generate-minutes', auditLog('colloqui_intermediazione', 'UPDATE', req => req.params.id), async (req: Request, res: Response) => {
  try {
    const c = await ColloquioIntermediazione.findById(req.params.id);
    if (!c?.trascrizione) return res.status(400).json({ message: 'Prima termina la registrazione e verifica la trascrizione' });
    c.verbale = await generateMeetingMinutes(c.trascrizione, {
      titolo: c.titolo,
      ordineDelGiorno: c.ordineDelGiorno,
      partecipanti: c.partecipanti.map(p => p.nome).join(', '),
      presenzeConfermate: c.partecipanti.filter(p => p.risposta === 'accettato').map(p => p.nome).join(', '),
    });
    c.stato = 'svolto';
    await c.save();
    return res.json(c);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore generazione verbale', error: error.message });
  }
});

router.patch('/:id', auditLog('colloqui_intermediazione', 'UPDATE', req => req.params.id), async (req: Request, res: Response) => {
  try {
    const c = await ColloquioIntermediazione.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Colloquio non trovato' });
    if (typeof req.body.verbale === 'string') c.verbale = req.body.verbale.trim();
    if (s(req.body.titolo)) c.titolo = s(req.body.titolo);
    if (s(req.body.ordineDelGiorno)) c.ordineDelGiorno = s(req.body.ordineDelGiorno);
    if (req.body.dataRiunione) c.dataRiunione = new Date(req.body.dataRiunione);
    if (typeof req.body.linkCollegamento === 'string') c.linkCollegamento = s(req.body.linkCollegamento) || undefined;
    if (['programmato', 'svolto', 'annullato'].includes(req.body.stato)) c.stato = req.body.stato;
    await c.save();
    return res.json(c);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore aggiornamento colloquio', error: error.message });
  }
});

router.delete('/:id', auditLog('colloqui_intermediazione', 'DELETE', req => req.params.id), async (req: Request, res: Response) => {
  try {
    const c = await ColloquioIntermediazione.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Colloquio non trovato' });
    if (c.registrazioneInCorso) return res.status(400).json({ message: 'Termina prima la registrazione in corso' });
    await c.deleteOne();
    return res.json({ message: 'Colloquio eliminato' });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore eliminazione colloquio', error: error.message });
  }
});

export default router;
