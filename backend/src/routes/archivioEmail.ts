import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import EmailLog from '../models/EmailLog';
import { inviaEmail } from '../utils/email';

const router = Router();
const RUOLI_GESTIONE = ['admin', 'coordinator', 'direttore'];

// ═══════════════════════════════════════════════════════════════════════════
// ARCHIVIO EMAIL — registro progressivo di tutte le email inviate dal
// gestionale (Gestione Privata e Intermediazioni, unico archivio condiviso).
// Da qui si può inviare la RETTIFICA: l'email inviata non si può cancellare
// dal server del destinatario, la rettifica chiede di non tenerne conto.
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/archivio-email — lista con filtri (q, area, tipo, dal, al)
router.get('/', authenticateToken, authorizeRole(...RUOLI_GESTIONE), async (_req: AuthRequest, res: Response) => {
  try {
    const req = _req;
    const query: any = {};
    if (req.query.area && req.query.area !== 'tutte') query.area = String(req.query.area);
    if (req.query.tipo && req.query.tipo !== 'tutti') query.tipo = String(req.query.tipo);
    if (req.query.esito && req.query.esito !== 'tutti') query.esito = String(req.query.esito);
    if (req.query.q) {
      const rx = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ to: rx }, { subject: rx }, { riferimento: rx }];
    }
    if (req.query.dal || req.query.al) {
      query.createdAt = {};
      if (req.query.dal) query.createdAt.$gte = new Date(String(req.query.dal));
      if (req.query.al) {
        const al = new Date(String(req.query.al));
        al.setHours(23, 59, 59, 999);
        query.createdAt.$lte = al;
      }
    }
    const [email, totale] = await Promise.all([
      EmailLog.find(query).sort({ createdAt: -1 }).limit(400).lean(),
      EmailLog.countDocuments(query),
    ]);
    return res.json({ email, totale });
  } catch (error: any) {
    console.error('[ArchivioEmail GET] Errore:', error);
    return res.status(500).json({ message: 'Errore nel recupero archivio email', error: error.message });
  }
});

// GET /api/archivio-email/tipi — tipi presenti (per il filtro)
router.get('/tipi', authenticateToken, authorizeRole(...RUOLI_GESTIONE), async (_req: AuthRequest, res: Response) => {
  try {
    const tipi = await EmailLog.distinct('tipo');
    return res.json(tipi.filter(Boolean).sort());
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore', error: error.message });
  }
});

// POST /api/archivio-email/rettifica — invia email "non tenere conto della precedente"
router.post('/rettifica', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('email_log', 'CREATE'), async (req: AuthRequest, res: Response) => {
  try {
    const user: any = req.user;
    const { emailLogId, to, subjectOriginale, testo } = req.body || {};
    const destinatario = String(to || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinatario)) {
      return res.status(400).json({ message: 'Email destinatario non valida' });
    }
    const oggetto = String(subjectOriginale || '').trim().slice(0, 200);
    const motivo = String(testo || '').trim().slice(0, 1000);

    const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
      <div style="text-align:center;border-bottom:2px solid #dc2626;padding-bottom:14px;margin-bottom:18px;">
        <h2 style="color:#dc2626;margin:0;font-size:1.25rem;">⚠️ Rettifica — email da ignorare</h2>
        <p style="color:#6b7280;font-size:0.85rem;margin:4px 0 0;">Abbraccio Cure Domiciliari</p>
      </div>
      <p>Gentile cliente,</p>
      <p>ti chiediamo cortesemente di <strong>non tenere conto dell'email precedente</strong>${oggetto ? ` con oggetto <em>"${oggetto}"</em>` : ''}, inviata per errore.</p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #dc2626;border-radius:8px;padding:14px;margin:16px 0;">
        <strong>Da non considerare valido:</strong> il contenuto e gli eventuali allegati dell'email precedente non hanno valore e devono essere ignorati.
      </div>
      ${motivo ? `<p><strong>Nota:</strong> ${motivo.replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>` : ''}
      <p>Ci scusiamo per l'accaduto e per il disagio. Per qualsiasi chiarimento puoi chiamarci al <strong>06 01905242</strong> o scriverci su WhatsApp al <strong>351 4175117</strong>.</p>
      <p style="margin-top:20px;font-size:12px;color:#888;">Abbraccio Cure Domiciliari — Via di S. Maria Ausiliatrice 4/B, Roma</p>
    </div>`;

    const inviata = await inviaEmail({
      to: destinatario,
      subject: `⚠️ RETTIFICA: ${oggetto || 'email da ignorare'} — Abbraccio Cure Domiciliari`,
      html,
      log: { tipo: 'rettifica', riferimento: oggetto || undefined, inviataDaNome: user?.name },
    });

    if (inviata && emailLogId) {
      try {
        await EmailLog.findByIdAndUpdate(emailLogId, { rettificata: true, rettificaIl: new Date(), rettificaDaNome: user?.name });
      } catch { /* noop */ }
    }

    return res.json({ inviata, destinatario });
  } catch (error: any) {
    console.error('[ArchivioEmail rettifica] Errore:', error);
    return res.status(500).json({ message: 'Errore invio rettifica', error: error.message });
  }
});

export default router;
