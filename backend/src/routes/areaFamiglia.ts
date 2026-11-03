// @ts-nocheck
// Ripristinato dalla build deployata su Aruba (codice non committato in precedenza)
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const OtpFamiglia_1 = __importDefault(require("../models/OtpFamiglia"));
const RichiestaPrenotazione_1 = __importDefault(require("../models/RichiestaPrenotazione"));
const PreventivoInviato_1 = __importDefault(require("../models/PreventivoInviato"));
const RichiestaRegistrazionePaziente_1 = __importDefault(require("../models/RichiestaRegistrazionePaziente"));
const email_1 = require("../utils/email");
const rateLimit_1 = require("../middleware/rateLimit");
const router = (0, express_1.Router)();
const jwtSecret = process.env.JWT_SECRET;
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_TENTATIVI = 5;
const normEmail = (v) => String(v ?? '').trim().toLowerCase();
const hashCodice = (email, codice) => crypto_1.default.createHash('sha256').update(`${email}:${codice}`).digest('hex');
const MSG_OK = 'Se questa email è collegata a una richiesta, riceverai un codice di accesso entro pochi minuti.';
router.post('/richiedi-codice', (0, rateLimit_1.rateLimitByIP)(8, 60 * 60 * 1000), async (req, res) => {
    try {
        const email = normEmail(req.body?.email);
        if (!email || !email.includes('@'))
            return res.status(400).json({ message: 'Inserisci un indirizzo email valido.' });
        const [nRichieste, nPreventivi, nRegistrazioni] = await Promise.all([
            RichiestaPrenotazione_1.default.countDocuments({ richiedenteEmail: email }),
            PreventivoInviato_1.default.countDocuments({ email }),
            RichiestaRegistrazionePaziente_1.default.countDocuments({ email }),
        ]);
        if (nRichieste + nPreventivi + nRegistrazioni > 0) {
            const codice = String(crypto_1.default.randomInt(0, 1000000)).padStart(6, '0');
            await OtpFamiglia_1.default.deleteMany({ email });
            await OtpFamiglia_1.default.create({ email, codeHash: hashCodice(email, codice), expiresAt: new Date(Date.now() + OTP_TTL_MS) });
            (0, email_1.inviaEmail)({
                to: email,
                subject: `${codice} — il tuo codice di accesso all'Area Famiglie Abbraccio`,
                html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:10px;">
          <h2 style="color:#1e4d8c;margin-top:0;">Area Riservata Famiglie</h2>
          <p>Ecco il tuo codice di accesso, valido per <strong>10 minuti</strong>:</p>
          <div style="text-align:center;margin:22px 0;">
            <span style="font-size:2.2rem;font-weight:800;letter-spacing:8px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:12px;padding:14px 24px;color:#1e3a5f;">${codice}</span>
          </div>
          <p style="color:#64748b;font-size:0.9rem;">Se non hai richiesto tu questo codice, ignora questa email.</p>
          <p style="color:#64748b;font-size:0.85rem;">Abbraccio Cure Domiciliari · 06 01905242</p>
        </div>`,
                log: { tipo: 'otp_famiglia', area: 'privato', riferimento: email },
            }).catch(() => { });
        }
        return res.json({ message: MSG_OK });
    }
    catch (error) {
        console.error('[Area famiglia] Errore richiesta codice:', error);
        return res.status(500).json({ message: 'Errore nell\'invio del codice. Riprova.' });
    }
});
router.post('/verifica-codice', (0, rateLimit_1.rateLimitByIP)(20, 60 * 60 * 1000), async (req, res) => {
    try {
        const email = normEmail(req.body?.email);
        const codice = String(req.body?.codice ?? '').trim();
        if (!email || !codice)
            return res.status(400).json({ message: 'Email e codice sono necessari.' });
        const otp = await OtpFamiglia_1.default.findOne({ email }).sort({ createdAt: -1 });
        if (!otp || otp.expiresAt.getTime() < Date.now()) {
            return res.status(400).json({ message: 'Codice scaduto. Richiedine uno nuovo.' });
        }
        if (otp.attempts >= MAX_TENTATIVI) {
            return res.status(400).json({ message: 'Troppi tentativi. Richiedi un nuovo codice.' });
        }
        if (otp.codeHash !== hashCodice(email, codice)) {
            otp.attempts += 1;
            await otp.save();
            return res.status(400).json({ message: 'Codice non corretto.' });
        }
        await OtpFamiglia_1.default.deleteMany({ email });
        const token = jsonwebtoken_1.default.sign({ area: 'famiglia', email }, jwtSecret, { expiresIn: '24h' });
        return res.json({ token });
    }
    catch (error) {
        console.error('[Area famiglia] Errore verifica codice:', error);
        return res.status(500).json({ message: 'Errore nella verifica. Riprova.' });
    }
});
const famigliaAuth = (req, res, next) => {
    const token = (req.headers.authorization || '').startsWith('Bearer ')
        ? req.headers.authorization.slice(7) : undefined;
    if (!token)
        return res.status(401).json({ message: 'Accesso non autorizzato.' });
    try {
        const payload = jsonwebtoken_1.default.verify(token, jwtSecret);
        if (payload?.area !== 'famiglia' || !payload?.email)
            throw new Error('bad');
        req.famigliaEmail = payload.email;
        next();
    }
    catch {
        return res.status(401).json({ message: 'Sessione scaduta. Accedi di nuovo.' });
    }
};
const STATO_RICHIESTA = {
    in_attesa: '⏳ In attesa', in_revisione: '🔍 In lavorazione', confermata: '✅ Confermata',
    modificata: '🔄 Modificata', rifiutata: '❌ Non accettata', completata: '🏁 Completata',
};
const STATO_REGISTRAZIONE = {
    in_attesa: '⏳ In attesa', approvata: '✅ Approvata', rifiutata: '❌ Non accettata',
};
const TIPO_PREVENTIVO = {
    preventivo_veloce: 'Preventivo servizi', costo_badante: 'Costo badante',
};
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : undefined;
router.get('/dati', famigliaAuth, async (req, res) => {
    try {
        const email = req.famigliaEmail;
        const [richieste, preventivi, registrazioni] = await Promise.all([
            RichiestaPrenotazione_1.default.find({ richiedenteEmail: email }).sort({ createdAt: -1 }).limit(50).lean(),
            PreventivoInviato_1.default.find({ email }).sort({ createdAt: -1 }).limit(50).lean(),
            RichiestaRegistrazionePaziente_1.default.find({ email }).sort({ createdAt: -1 }).limit(10).lean(),
        ]);
        return res.json({
            email,
            richieste: richieste.map((r) => ({
                id: String(r._id),
                servizio: [r.tipoServizio, r.tipoSpecifico].filter(Boolean).join(' — '),
                categoria: r.categoriaPrivata,
                stato: STATO_RICHIESTA[r.stato] || r.stato,
                dataRichiesta: fmtDate(r.createdAt),
                dataPreferita: fmtDate(r.dataPreferita),
                orarioPreferito: r.orarioPreferito,
                dataConfermata: fmtDate(r.dataConfermata),
                orarioConfermato: r.orarioConfermato,
                risposta: r.noteRisposta || undefined,
            })),
            preventivi: preventivi.map((p) => ({
                id: String(p._id),
                tipo: TIPO_PREVENTIVO[p.tipo] || 'Preventivo',
                totale: p.totale,
                canale: p.canale === 'whatsapp' ? 'WhatsApp' : 'Email',
                data: fmtDate(p.createdAt),
            })),
            registrazioni: registrazioni.map((r) => ({
                id: String(r._id),
                nome: `${r.firstName || ''} ${r.lastName || ''}`.trim(),
                stato: STATO_REGISTRAZIONE[r.stato] || r.stato,
                data: fmtDate(r.createdAt),
            })),
        });
    }
    catch (error) {
        console.error('[Area famiglia] Errore caricamento dati:', error);
        return res.status(500).json({ message: 'Errore nel caricamento dei dati.' });
    }
});
export default router;