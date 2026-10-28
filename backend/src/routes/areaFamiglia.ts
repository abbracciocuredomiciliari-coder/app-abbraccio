import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import OtpFamiglia from '../models/OtpFamiglia';
import RichiestaPrenotazione from '../models/RichiestaPrenotazione';
import PreventivoInviato from '../models/PreventivoInviato';
import RichiestaRegistrazionePaziente from '../models/RichiestaRegistrazionePaziente';
import { inviaEmail } from '../utils/email';
import { rateLimitByIP } from '../middleware/rateLimit';

// ═══════════════════════════════════════════════════════════════════════════
// AREA RISERVATA FAMIGLIE — accesso senza password: la famiglia inserisce
// l'email usata nelle richieste/preventivi, riceve un codice a 6 cifre e
// vede in sola lettura richieste, prenotazioni e preventivi a lei intestati.
// I dati restituiti sono solo quelli del richiedente: niente note interne,
// niente dati di altri pazienti.
// ═══════════════════════════════════════════════════════════════════════════

const router = Router();
const jwtSecret = process.env.JWT_SECRET as string;
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_TENTATIVI = 5;

const normEmail = (v: any) => String(v ?? '').trim().toLowerCase();
const hashCodice = (email: string, codice: string) =>
  crypto.createHash('sha256').update(`${email}:${codice}`).digest('hex');

const MSG_OK = 'Se questa email è collegata a una richiesta, riceverai un codice di accesso entro pochi minuti.';

// ─── POST /richiedi-codice — invia OTP via email (risposta sempre generica) ─
router.post('/richiedi-codice', rateLimitByIP(8, 60 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const email = normEmail(req.body?.email);
    if (!email || !email.includes('@')) return res.status(400).json({ message: 'Inserisci un indirizzo email valido.' });

    const [nRichieste, nPreventivi, nRegistrazioni] = await Promise.all([
      RichiestaPrenotazione.countDocuments({ richiedenteEmail: email }),
      PreventivoInviato.countDocuments({ email }),
      RichiestaRegistrazionePaziente.countDocuments({ email }),
    ]);

    if (nRichieste + nPreventivi + nRegistrazioni > 0) {
      const codice = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
      await OtpFamiglia.deleteMany({ email });
      await OtpFamiglia.create({ email, codeHash: hashCodice(email, codice), expiresAt: new Date(Date.now() + OTP_TTL_MS) });

      inviaEmail({
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
      }).catch(() => {});
    }

    return res.json({ message: MSG_OK });
  } catch (error) {
    console.error('[Area famiglia] Errore richiesta codice:', error);
    return res.status(500).json({ message: 'Errore nell\'invio del codice. Riprova.' });
  }
});

// ─── POST /verifica-codice — OTP corretto → token JWT 24h ───────────────────
router.post('/verifica-codice', rateLimitByIP(20, 60 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const email = normEmail(req.body?.email);
    const codice = String(req.body?.codice ?? '').trim();
    if (!email || !codice) return res.status(400).json({ message: 'Email e codice sono necessari.' });

    const otp = await OtpFamiglia.findOne({ email }).sort({ createdAt: -1 });
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

    await OtpFamiglia.deleteMany({ email });
    const token = jwt.sign({ area: 'famiglia', email }, jwtSecret, { expiresIn: '24h' });
    return res.json({ token });
  } catch (error) {
    console.error('[Area famiglia] Errore verifica codice:', error);
    return res.status(500).json({ message: 'Errore nella verifica. Riprova.' });
  }
});

// ─── auth famiglia ──────────────────────────────────────────────────────────
interface FamigliaRequest extends Request { famigliaEmail?: string }
const famigliaAuth = (req: FamigliaRequest, res: Response, next: NextFunction) => {
  const token = (req.headers.authorization || '').startsWith('Bearer ')
    ? req.headers.authorization!.slice(7) : undefined;
  if (!token) return res.status(401).json({ message: 'Accesso non autorizzato.' });
  try {
    const payload = jwt.verify(token, jwtSecret) as any;
    if (payload?.area !== 'famiglia' || !payload?.email) throw new Error('bad');
    req.famigliaEmail = payload.email;
    next();
  } catch {
    return res.status(401).json({ message: 'Sessione scaduta. Accedi di nuovo.' });
  }
};

const STATO_RICHIESTA: Record<string, string> = {
  in_attesa: '⏳ In attesa', in_revisione: '🔍 In lavorazione', confermata: '✅ Confermata',
  modificata: '🔄 Modificata', rifiutata: '❌ Non accettata', completata: '🏁 Completata',
};
const STATO_REGISTRAZIONE: Record<string, string> = {
  in_attesa: '⏳ In attesa', approvata: '✅ Approvata', rifiutata: '❌ Non accettata',
};
const TIPO_PREVENTIVO: Record<string, string> = {
  preventivo_veloce: 'Preventivo servizi', costo_badante: 'Costo badante',
};
const fmtDate = (d?: Date | string) => d ? new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : undefined;

// ─── GET /dati — dashboard in sola lettura del richiedente ──────────────────
router.get('/dati', famigliaAuth, async (req: FamigliaRequest, res: Response) => {
  try {
    const email = req.famigliaEmail!;

    const [richieste, preventivi, registrazioni] = await Promise.all([
      RichiestaPrenotazione.find({ richiedenteEmail: email }).sort({ createdAt: -1 }).limit(50).lean(),
      PreventivoInviato.find({ email }).sort({ createdAt: -1 }).limit(50).lean(),
      RichiestaRegistrazionePaziente.find({ email }).sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    return res.json({
      email,
      richieste: richieste.map((r: any) => ({
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
      preventivi: preventivi.map((p: any) => ({
        id: String(p._id),
        tipo: TIPO_PREVENTIVO[p.tipo] || 'Preventivo',
        totale: p.totale,
        canale: p.canale === 'whatsapp' ? 'WhatsApp' : 'Email',
        data: fmtDate(p.createdAt),
      })),
      registrazioni: registrazioni.map((r: any) => ({
        id: String(r._id),
        nome: `${r.firstName || ''} ${r.lastName || ''}`.trim(),
        stato: STATO_REGISTRAZIONE[r.stato] || r.stato,
        data: fmtDate(r.createdAt),
      })),
    });
  } catch (error) {
    console.error('[Area famiglia] Errore caricamento dati:', error);
    return res.status(500).json({ message: 'Errore nel caricamento dei dati.' });
  }
});

export default router;
