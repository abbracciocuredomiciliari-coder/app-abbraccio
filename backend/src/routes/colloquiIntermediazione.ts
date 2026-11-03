// @ts-nocheck
// Ripristinato dalla build deployata su Aruba (codice non committato in precedenza)
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.linkCollegamento = void 0;
exports.inviaEmailInvito = inviaEmailInvito;
exports.inviaEmailPromemoria = inviaEmailPromemoria;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const crypto_1 = __importDefault(require("crypto"));
const ColloquioIntermediazione_1 = __importDefault(require("../models/ColloquioIntermediazione"));
const auth_1 = require("../middleware/auth");
const roles_1 = require("../middleware/roles");
const audit_1 = require("../middleware/audit");
const voiceAi_1 = require("../utils/voiceAi");
const email_1 = require("../utils/email");
const router = (0, express_1.Router)();
const RUOLI_GESTIONE = ['admin', 'coordinator', 'direttore'];
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 }, fileFilter: (_req, file, cb) => file.mimetype.startsWith('audio/') ? cb(null, true) : cb(new Error('Solo file audio sono accettati')) });
const s = (v) => String(v ?? '').trim();
const tokenHash = (token) => crypto_1.default.createHash('sha256').update(token).digest('hex');
const frontendUrl = () => process.env.FRONTEND_URL || 'https://app.abbracciocuredomiciliari.it';
const linkCollegamento = (c) => c.linkCollegamento || (c.modalita === 'video' ? `https://meet.jit.si/${c.stanzaVideo}` : '');
exports.linkCollegamento = linkCollegamento;
const modalitaLabel = { video: 'Videochiamata', presenza: 'Colloquio in presenza', telefono: 'Colloquio telefonico' };
const dataLunga = (d) => new Date(d).toLocaleString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const pagina = (contenuto) => `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">${contenuto}<p style="color:#64748b;font-size:13px;margin-top:24px;">Abbraccio Cure Domiciliari — Intermediazioni<br>Tel. 06 01905242 · info@abbracciocuredomiciliari.it</p></div>`;
async function inviaEmailInvito(c, p, token) {
    const link = `${frontendUrl()}/colloquio?token=${token}`;
    return (0, email_1.inviaEmail)({
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
async function inviaEmailPromemoria(c) {
    const link = (0, exports.linkCollegamento)(c);
    const come = c.modalita === 'video' ? `Collegati al colloquio da questo link (non serve registrarsi):`
        : c.modalita === 'telefono' ? `Ti chiameremo al numero che ci hai lasciato${link ? ` — oppure chiama: ${link}` : ''}.`
            : `Il colloquio si terrà in presenza${link ? ` presso: ${link}` : ''}.`;
    let inviate = 0;
    for (const p of c.partecipanti.filter(x => x.risposta !== 'rifiutato')) {
        const ok = await (0, email_1.inviaEmail)({
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
        if (ok)
            inviate++;
    }
    c.promemoriaInviatoIl = new Date();
    await c.save();
    return inviate;
}
router.get('/pubblico/:token', async (req, res) => {
    try {
        const hash = tokenHash(req.params.token);
        const c = await ColloquioIntermediazione_1.default.findOne({ 'partecipanti.tokenHash': hash }).lean();
        const p = c?.partecipanti.find(x => x.tokenHash === hash);
        if (!c || !p)
            return res.status(404).json({ message: 'Link invito non valido o scaduto' });
        return res.json({
            titolo: c.titolo,
            dataRiunione: c.dataRiunione,
            ordineDelGiorno: c.ordineDelGiorno,
            modalita: c.modalita,
            stato: c.stato,
            linkCollegamento: c.stato === 'programmato' ? (0, exports.linkCollegamento)(c) : '',
            partecipanti: c.partecipanti.map(x => ({ nome: x.nome, ruolo: x.ruolo })),
            io: { nome: p.nome, ruolo: p.ruolo, risposta: p.risposta, rispostoIl: p.rispostoIl },
        });
    }
    catch (error) {
        return res.status(500).json({ message: 'Errore caricamento invito', error: error.message });
    }
});
router.post('/pubblico/:token/rispondi', async (req, res) => {
    try {
        const hash = tokenHash(req.params.token);
        const c = await ColloquioIntermediazione_1.default.findOne({ 'partecipanti.tokenHash': hash });
        const p = c?.partecipanti.find(x => x.tokenHash === hash);
        if (!c || !p)
            return res.status(404).json({ message: 'Link invito non valido o scaduto' });
        if (c.stato !== 'programmato')
            return res.status(400).json({ message: 'Questo colloquio non è più aperto alle risposte' });
        const accetta = req.body?.accetta !== false;
        p.risposta = accetta ? 'accettato' : 'rifiutato';
        p.rispostoIl = new Date();
        p.notaRisposta = s(req.body?.nota) || undefined;
        await c.save();
        return res.json({ message: accetta ? 'Partecipazione confermata. Il giorno dell\'appuntamento riceverai il link per collegarti.' : 'Risposta registrata, grazie per averci avvisato.', risposta: p.risposta });
    }
    catch (error) {
        return res.status(500).json({ message: 'Errore registrazione risposta', error: error.message });
    }
});
router.use(auth_1.authenticateToken, (0, roles_1.authorizeRole)(...RUOLI_GESTIONE));
router.get('/', async (_req, res) => {
    try {
        return res.json(await ColloquioIntermediazione_1.default.find().sort({ dataRiunione: -1 }).lean());
    }
    catch (error) {
        return res.status(500).json({ message: 'Errore caricamento colloqui', error: error.message });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const c = await ColloquioIntermediazione_1.default.findById(req.params.id).lean();
        if (!c)
            return res.status(404).json({ message: 'Colloquio non trovato' });
        return res.json(c);
    }
    catch (error) {
        return res.status(500).json({ message: 'Errore caricamento colloquio', error: error.message });
    }
});
router.post('/', (0, audit_1.auditLog)('colloqui_intermediazione', 'CREATE'), async (req, res) => {
    try {
        const { titolo, dataRiunione, ordineDelGiorno, linkCollegamento: linkCustom, candidatoId, staffId } = req.body || {};
        const modalita = ['video', 'presenza', 'telefono'].includes(req.body?.modalita) ? req.body.modalita : 'video';
        const partecipanti = Array.isArray(req.body?.partecipanti) ? req.body.partecipanti : [];
        const validi = partecipanti
            .filter((p) => s(p?.nome) && /^\S+@\S+\.\S+$/.test(s(p?.email)))
            .map((p) => ({
            nome: s(p.nome), email: s(p.email).toLowerCase(), telefono: s(p.telefono) || undefined,
            ruolo: ['badante', 'famiglia', 'operatore', 'altro'].includes(p.ruolo) ? p.ruolo : 'altro',
            staffId: s(p.staffId) || undefined, invitatoIl: new Date(), risposta: 'attesa',
        }));
        if (!s(titolo) || !dataRiunione || !s(ordineDelGiorno) || !validi.length) {
            return res.status(400).json({ message: 'Compila titolo, data, motivo del colloquio e almeno un partecipante con email valida' });
        }
        const tokens = validi.map(() => crypto_1.default.randomBytes(32).toString('hex'));
        const c = await ColloquioIntermediazione_1.default.create({
            titolo: s(titolo), dataRiunione: new Date(dataRiunione), ordineDelGiorno: s(ordineDelGiorno),
            modalita, stanzaVideo: `abbraccio-colloquio-${crypto_1.default.randomBytes(12).toString('hex')}`,
            linkCollegamento: s(linkCustom) || undefined,
            partecipanti: validi.map((p, i) => ({ ...p, tokenHash: tokenHash(tokens[i]) })),
            candidatoId: s(candidatoId) || undefined, staffId: s(staffId) || undefined,
            creatoDaId: req.user.userId || req.user.id,
            creatoDaNome: req.user.name || req.user.email,
        });
        let emailInviate = 0;
        for (let i = 0; i < c.partecipanti.length; i++) {
            const ok = await inviaEmailInvito(c, c.partecipanti[i], tokens[i]).catch(() => false);
            if (ok)
                emailInviate++;
        }
        return res.status(201).json({ ...c.toObject(), emailInviate });
    }
    catch (error) {
        console.error('[Colloqui intermediazione] Errore creazione:', error);
        return res.status(500).json({ message: 'Errore creazione colloquio', error: error.message });
    }
});
router.post('/:id/reinvia-inviti', (0, audit_1.auditLog)('colloqui_intermediazione', 'UPDATE', req => req.params.id), async (req, res) => {
    try {
        const c = await ColloquioIntermediazione_1.default.findById(req.params.id);
        if (!c)
            return res.status(404).json({ message: 'Colloquio non trovato' });
        if (c.stato !== 'programmato')
            return res.status(400).json({ message: 'Il colloquio non è più programmato' });
        let inviate = 0;
        for (const p of c.partecipanti.filter(x => x.risposta === 'attesa')) {
            const token = crypto_1.default.randomBytes(32).toString('hex');
            p.tokenHash = tokenHash(token);
            p.invitatoIl = new Date();
            const ok = await inviaEmailInvito(c, p, token).catch(() => false);
            if (ok)
                inviate++;
        }
        await c.save();
        return res.json({ message: `Inviti reinviati: ${inviate}`, emailInviate: inviate });
    }
    catch (error) {
        return res.status(500).json({ message: 'Errore reinvio inviti', error: error.message });
    }
});
router.post('/:id/promemoria', (0, audit_1.auditLog)('colloqui_intermediazione', 'UPDATE', req => req.params.id), async (req, res) => {
    try {
        const c = await ColloquioIntermediazione_1.default.findById(req.params.id);
        if (!c)
            return res.status(404).json({ message: 'Colloquio non trovato' });
        const inviate = await inviaEmailPromemoria(c);
        return res.json({ message: `Promemoria inviato a ${inviate} partecipanti`, emailInviate: inviate });
    }
    catch (error) {
        return res.status(500).json({ message: 'Errore invio promemoria', error: error.message });
    }
});
router.post('/:id/recording-status', (0, audit_1.auditLog)('colloqui_intermediazione', 'UPDATE', req => req.params.id), async (req, res) => {
    try {
        const c = await ColloquioIntermediazione_1.default.findById(req.params.id);
        if (!c)
            return res.status(404).json({ message: 'Colloquio non trovato' });
        c.registrazioneInCorso = req.body.attiva === true;
        c.registrazioneIniziataIl = c.registrazioneInCorso ? new Date() : undefined;
        await c.save();
        return res.json(c);
    }
    catch (error) {
        return res.status(500).json({ message: 'Errore stato registrazione', error: error.message });
    }
});
router.post('/:id/transcribe', (0, audit_1.auditLog)('colloqui_intermediazione', 'UPDATE', req => req.params.id), upload.single('audio'), async (req, res) => {
    try {
        const c = await ColloquioIntermediazione_1.default.findById(req.params.id);
        if (!c)
            return res.status(404).json({ message: 'Colloquio non trovato' });
        if (req.body.confermaInformativaTrascrizione !== 'true')
            return res.status(400).json({ message: 'Confermare che i partecipanti sono stati informati della trascrizione per il verbale' });
        if (!(0, voiceAi_1.isVoiceAiAvailable)())
            return res.status(503).json({ message: 'Voice AI non configurata' });
        if (!req.file)
            return res.status(400).json({ message: 'Nessun audio ricevuto' });
        const transcript = await (0, voiceAi_1.transcribeAudio)(req.file.buffer, req.file.originalname, req.file.mimetype);
        c.confermaInformativaTrascrizione = true;
        c.registrazioneInCorso = false;
        c.registrazioneIniziataIl = undefined;
        c.trascrizione = transcript;
        await c.save();
        return res.json({ trascrizione: transcript });
    }
    catch (error) {
        return res.status(500).json({ message: 'Errore trascrizione colloquio', error: error.message });
    }
});
router.post('/:id/generate-minutes', (0, audit_1.auditLog)('colloqui_intermediazione', 'UPDATE', req => req.params.id), async (req, res) => {
    try {
        const c = await ColloquioIntermediazione_1.default.findById(req.params.id);
        if (!c?.trascrizione)
            return res.status(400).json({ message: 'Prima termina la registrazione e verifica la trascrizione' });
        c.verbale = await (0, voiceAi_1.generateMeetingMinutes)(c.trascrizione, {
            titolo: c.titolo,
            ordineDelGiorno: c.ordineDelGiorno,
            partecipanti: c.partecipanti.map(p => p.nome).join(', '),
            presenzeConfermate: c.partecipanti.filter(p => p.risposta === 'accettato').map(p => p.nome).join(', '),
        });
        c.stato = 'svolto';
        await c.save();
        return res.json(c);
    }
    catch (error) {
        return res.status(500).json({ message: 'Errore generazione verbale', error: error.message });
    }
});
router.patch('/:id', (0, audit_1.auditLog)('colloqui_intermediazione', 'UPDATE', req => req.params.id), async (req, res) => {
    try {
        const c = await ColloquioIntermediazione_1.default.findById(req.params.id);
        if (!c)
            return res.status(404).json({ message: 'Colloquio non trovato' });
        if (typeof req.body.verbale === 'string')
            c.verbale = req.body.verbale.trim();
        if (s(req.body.titolo))
            c.titolo = s(req.body.titolo);
        if (s(req.body.ordineDelGiorno))
            c.ordineDelGiorno = s(req.body.ordineDelGiorno);
        if (req.body.dataRiunione)
            c.dataRiunione = new Date(req.body.dataRiunione);
        if (typeof req.body.linkCollegamento === 'string')
            c.linkCollegamento = s(req.body.linkCollegamento) || undefined;
        if (['programmato', 'svolto', 'annullato'].includes(req.body.stato))
            c.stato = req.body.stato;
        await c.save();
        return res.json(c);
    }
    catch (error) {
        return res.status(500).json({ message: 'Errore aggiornamento colloquio', error: error.message });
    }
});
router.delete('/:id', (0, audit_1.auditLog)('colloqui_intermediazione', 'DELETE', req => req.params.id), async (req, res) => {
    try {
        const c = await ColloquioIntermediazione_1.default.findById(req.params.id);
        if (!c)
            return res.status(404).json({ message: 'Colloquio non trovato' });
        if (c.registrazioneInCorso)
            return res.status(400).json({ message: 'Termina prima la registrazione in corso' });
        await c.deleteOne();
        return res.json({ message: 'Colloquio eliminato' });
    }
    catch (error) {
        return res.status(500).json({ message: 'Errore eliminazione colloquio', error: error.message });
    }
});
export default router;