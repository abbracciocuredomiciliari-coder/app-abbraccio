import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import EmailLog from '../models/EmailLog';
import EmailAllegato from '../models/EmailAllegato';
import DocumentoFatturazione from '../models/DocumentoFatturazione';
import ContrattoPaziente from '../models/ContrattoPaziente';
import EmailRicevuta from '../models/EmailRicevuta';
import { inviaEmail } from '../utils/email';
import { sincronizzaEmailRicevute, marcaFlagLettaSuServer } from '../utils/imapSync';
import { generaDocumentoPDF } from '../utils/fatturazionePdf';
import { generaContrattoPazientePDF, generaGdprPDF } from '../utils/contrattoPazientePdf';
import { normalizzaPaziente } from '../utils/contrattoInvio';

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

// GET /api/archivio-email/:id/allegato/:index — scarica/visualizza l'allegato inviato.
// Prima cerca il file conservato (EmailAllegato); per le righe STORICO prova a
// rigenerare il PDF dal documento/contratto di origine.
router.get('/:id/allegato/:index', authenticateToken, authorizeRole(...RUOLI_GESTIONE), async (req: AuthRequest, res: Response) => {
  try {
    const log = await EmailLog.findById(req.params.id).lean();
    if (!log) return res.status(404).json({ message: 'Email non trovata' });
    const idx = Math.max(0, parseInt(req.params.index || '0', 10) || 0);

    // 1) Allegato conservato nel log
    const salvati = await EmailAllegato.find({ emailLogId: log._id }).sort({ _id: 1 });
    if (salvati[idx]) {
      const a = salvati[idx];
      res.setHeader('Content-Type', a.contentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${a.filename}"`);
      return res.send(a.data);
    }

    // 2) Rigenerazione per righe storiche senza file conservato
    const storico = (log as any).storico;
    if (!storico) {
      return res.status(404).json({ message: 'Allegato non conservato (email precedente al log allegati)' });
    }

    if ((log.tipo === 'preventivo' || log.tipo === 'fattura') && log.riferimento) {
      const doc = await DocumentoFatturazione.findOne({ numero: log.riferimento })
        .populate('patient', 'firstName lastName codiceFiscale address email');
      if (!doc) return res.status(404).json({ message: 'Documento di origine non trovato' });
      const buffer = await generaDocumentoPDF(doc.toJSON());
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${log.allegati?.[idx] || log.riferimento + '.pdf'}"`);
      return res.send(buffer);
    }

    if (log.tipo === 'contratto' && log.to) {
      // Contratto rigenerato dal record con la stessa email destinatario
      const contratti = await ContrattoPaziente.find({ email: log.to })
        .populate('patient', 'firstName lastName birthDate address contactPhone codiceFiscale email')
        .sort({ data: -1 });
      const contratto = contratti[0];
      if (!contratto) return res.status(404).json({ message: 'Contratto di origine non trovato' });
      const pazienteNorm = normalizzaPaziente(contratto.patient);
      let buffer: Buffer;
      let filename: string;
      let contentType = 'application/pdf';
      if (idx === 0) {
        buffer = await generaContrattoPazientePDF(contratto.toObject(), pazienteNorm);
        filename = `CONTRATTO-${contratto.profilo.toUpperCase().replace(/\s+/g, '-')}.pdf`;
      } else if (idx === 1) {
        buffer = await generaGdprPDF(pazienteNorm, {
          nomeFirmatario: contratto.nome || `${pazienteNorm.firstName} ${pazienteNorm.lastName}`,
          cognomeFirmatario: '',
          finalita: { prestazioneSanitaria: true, fatturazione: true, auditInterno: true, ricercaScientifica: false },
          datiSensibili: { datiSanitari: true, datiEconomici: true, immagini: false },
          accettato: contratto.gdprAccettato || false,
        });
        filename = 'INFORMATIVA-GDPR.pdf';
      } else if (contratto.preventivoId) {
        const docPrev = await DocumentoFatturazione.findById(contratto.preventivoId)
          .populate('patient', 'firstName lastName codiceFiscale address email');
        if (!docPrev) return res.status(404).json({ message: 'Preventivo allegato non trovato' });
        buffer = await generaDocumentoPDF(docPrev.toJSON());
        filename = `PREVENTIVO-${docPrev.numero}.pdf`;
      } else if (contratto.allegatoData) {
        buffer = contratto.allegatoData as Buffer;
        filename = contratto.allegatoFileName || 'allegato';
        contentType = contratto.allegatoContentType || 'application/octet-stream';
      } else {
        return res.status(404).json({ message: 'Allegato non disponibile' });
      }
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      return res.send(buffer);
    }

    return res.status(404).json({ message: 'Allegato non recuperabile per questo tipo di email' });
  } catch (error: any) {
    console.error('[ArchivioEmail allegato] Errore:', error);
    return res.status(500).json({ message: 'Errore scaricamento allegato', error: error.message });
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

// ═══════════════════════════════════════════════════════════════════════════
// EMAIL RICEVUTE — messaggi scaricati via IMAP dalla casella aziendale.
// Stesso archivio visivo delle inviate, tab separata.
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/archivio-email/ricevute — lista (senza corpo) con filtri
router.get('/ricevute', authenticateToken, authorizeRole(...RUOLI_GESTIONE), async (req: AuthRequest, res: Response) => {
  try {
    const query: any = {};
    if (req.query.letta === 'lette') query.letta = true;
    if (req.query.letta === 'non-lette') query.letta = false;
    if (req.query.q) {
      const rx = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ 'from.email': rx }, { 'from.nome': rx }, { subject: rx }];
    }
    if (req.query.dal || req.query.al) {
      query.data = {};
      if (req.query.dal) query.data.$gte = new Date(String(req.query.dal));
      if (req.query.al) {
        const al = new Date(String(req.query.al));
        al.setHours(23, 59, 59, 999);
        query.data.$lte = al;
      }
    }
    const [email, totale, nonLette] = await Promise.all([
      EmailRicevuta.find(query).select('-testo -html -allegati.data').sort({ data: -1 }).limit(400).lean(),
      EmailRicevuta.countDocuments(query),
      EmailRicevuta.countDocuments({ letta: false }),
    ]);
    return res.json({ email, totale, nonLette });
  } catch (error: any) {
    console.error('[ArchivioEmail ricevute] Errore:', error);
    return res.status(500).json({ message: 'Errore nel recupero email ricevute', error: error.message });
  }
});

// POST /api/archivio-email/ricevute/sync — forza sincronizzazione IMAP
router.post('/ricevute/sync', authenticateToken, authorizeRole(...RUOLI_GESTIONE), async (_req: AuthRequest, res: Response) => {
  try {
    const risultato = await sincronizzaEmailRicevute();
    return res.json(risultato);
  } catch (error: any) {
    return res.status(500).json({ ok: false, message: 'Errore sincronizzazione', error: error.message });
  }
});

// GET /api/archivio-email/ricevute/:id — corpo completo
router.get('/ricevute/:id', authenticateToken, authorizeRole(...RUOLI_GESTIONE), async (req: AuthRequest, res: Response) => {
  try {
    const email = await EmailRicevuta.findById(req.params.id).select('-allegati.data').lean();
    if (!email) return res.status(404).json({ message: 'Email non trovata' });
    return res.json(email);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore', error: error.message });
  }
});

// GET /api/archivio-email/ricevute/:id/allegato/:index
router.get('/ricevute/:id/allegato/:index', authenticateToken, authorizeRole(...RUOLI_GESTIONE), async (req: AuthRequest, res: Response) => {
  try {
    const email = await EmailRicevuta.findById(req.params.id).lean();
    if (!email) return res.status(404).json({ message: 'Email non trovata' });
    const idx = Math.max(0, parseInt(req.params.index || '0', 10) || 0);
    const a = email.allegati?.[idx];
    if (!a || !a.data) return res.status(404).json({ message: 'Allegato non conservato (troppo grande)' });
    res.setHeader('Content-Type', a.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${a.filename.replace(/"/g, '')}"`);
    return res.send(a.data);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore scaricamento allegato', error: error.message });
  }
});

// POST /api/archivio-email/ricevute/:id/letta — segna letta/non letta (anche sul server IMAP)
router.post('/ricevute/:id/letta', authenticateToken, authorizeRole(...RUOLI_GESTIONE), async (req: AuthRequest, res: Response) => {
  try {
    const letta = req.body?.letta !== false;
    const email = await EmailRicevuta.findByIdAndUpdate(req.params.id, { letta }, { new: true });
    if (!email) return res.status(404).json({ message: 'Email non trovata' });
    // Best effort: allinea il flag \Seen sulla casella
    marcaFlagLettaSuServer(email.uid, letta).catch(() => {});
    return res.json({ ok: true, letta });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore', error: error.message });
  }
});

export default router;
