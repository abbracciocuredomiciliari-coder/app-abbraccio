// @ts-nocheck
// Ripristinato dalla build deployata su Aruba (codice non committato in precedenza)
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const roles_1 = require("../middleware/roles");
const audit_1 = require("../middleware/audit");
const EmailLog_1 = __importDefault(require("../models/EmailLog"));
const EmailAllegato_1 = __importDefault(require("../models/EmailAllegato"));
const DocumentoFatturazione_1 = __importDefault(require("../models/DocumentoFatturazione"));
const ContrattoPaziente_1 = __importDefault(require("../models/ContrattoPaziente"));
const EmailRicevuta_1 = __importDefault(require("../models/EmailRicevuta"));
const email_1 = require("../utils/email");
const imapSync_1 = require("../utils/imapSync");
const fatturazionePdf_1 = require("../utils/fatturazionePdf");
const contrattoPazientePdf_1 = require("../utils/contrattoPazientePdf");
const contrattoInvio_1 = require("../utils/contrattoInvio");
const router = (0, express_1.Router)();
const RUOLI_GESTIONE = ['admin', 'coordinator', 'direttore'];
router.get('/', auth_1.authenticateToken, (0, roles_1.authorizeRole)(...RUOLI_GESTIONE), async (_req, res) => {
    try {
        const req = _req;
        const query = {};
        if (req.query.area && req.query.area !== 'tutte')
            query.area = String(req.query.area);
        if (req.query.tipo && req.query.tipo !== 'tutti')
            query.tipo = String(req.query.tipo);
        if (req.query.esito && req.query.esito !== 'tutti')
            query.esito = String(req.query.esito);
        if (req.query.q) {
            const rx = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            query.$or = [{ to: rx }, { subject: rx }, { riferimento: rx }];
        }
        if (req.query.dal || req.query.al) {
            query.createdAt = {};
            if (req.query.dal)
                query.createdAt.$gte = new Date(String(req.query.dal));
            if (req.query.al) {
                const al = new Date(String(req.query.al));
                al.setHours(23, 59, 59, 999);
                query.createdAt.$lte = al;
            }
        }
        const [email, totale] = await Promise.all([
            EmailLog_1.default.find(query).sort({ createdAt: -1 }).limit(400).lean(),
            EmailLog_1.default.countDocuments(query),
        ]);
        return res.json({ email, totale });
    }
    catch (error) {
        console.error('[ArchivioEmail GET] Errore:', error);
        return res.status(500).json({ message: 'Errore nel recupero archivio email', error: error.message });
    }
});
router.get('/tipi', auth_1.authenticateToken, (0, roles_1.authorizeRole)(...RUOLI_GESTIONE), async (_req, res) => {
    try {
        const tipi = await EmailLog_1.default.distinct('tipo');
        return res.json(tipi.filter(Boolean).sort());
    }
    catch (error) {
        return res.status(500).json({ message: 'Errore', error: error.message });
    }
});
router.get('/:id/allegato/:index', auth_1.authenticateToken, (0, roles_1.authorizeRole)(...RUOLI_GESTIONE), async (req, res) => {
    try {
        const log = await EmailLog_1.default.findById(req.params.id).lean();
        if (!log)
            return res.status(404).json({ message: 'Email non trovata' });
        const idx = Math.max(0, parseInt(req.params.index || '0', 10) || 0);
        const salvati = await EmailAllegato_1.default.find({ emailLogId: log._id }).sort({ _id: 1 });
        if (salvati[idx]) {
            const a = salvati[idx];
            res.setHeader('Content-Type', a.contentType || 'application/octet-stream');
            res.setHeader('Content-Disposition', `inline; filename="${a.filename}"`);
            return res.send(a.data);
        }
        const storico = log.storico;
        if (!storico) {
            return res.status(404).json({ message: 'Allegato non conservato (email precedente al log allegati)' });
        }
        if ((log.tipo === 'preventivo' || log.tipo === 'fattura') && log.riferimento) {
            const doc = await DocumentoFatturazione_1.default.findOne({ numero: log.riferimento })
                .populate('patient', 'firstName lastName codiceFiscale address email');
            if (!doc)
                return res.status(404).json({ message: 'Documento di origine non trovato' });
            const buffer = await (0, fatturazionePdf_1.generaDocumentoPDF)(doc.toJSON());
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${log.allegati?.[idx] || log.riferimento + '.pdf'}"`);
            return res.send(buffer);
        }
        if (log.tipo === 'contratto' && log.to) {
            const contratti = await ContrattoPaziente_1.default.find({ email: log.to })
                .populate('patient', 'firstName lastName birthDate address contactPhone codiceFiscale email')
                .sort({ data: -1 });
            const contratto = contratti[0];
            if (!contratto)
                return res.status(404).json({ message: 'Contratto di origine non trovato' });
            const pazienteNorm = (0, contrattoInvio_1.normalizzaPaziente)(contratto.patient);
            let buffer;
            let filename;
            let contentType = 'application/pdf';
            if (idx === 0) {
                buffer = await (0, contrattoPazientePdf_1.generaContrattoPazientePDF)(contratto.toObject(), pazienteNorm);
                filename = `CONTRATTO-${contratto.profilo.toUpperCase().replace(/\s+/g, '-')}.pdf`;
            }
            else if (idx === 1) {
                buffer = await (0, contrattoPazientePdf_1.generaGdprPDF)(pazienteNorm, {
                    nomeFirmatario: contratto.nome || `${pazienteNorm.firstName} ${pazienteNorm.lastName}`,
                    cognomeFirmatario: '',
                    finalita: { prestazioneSanitaria: true, fatturazione: true, auditInterno: true, ricercaScientifica: false },
                    datiSensibili: { datiSanitari: true, datiEconomici: true, immagini: false },
                    accettato: contratto.gdprAccettato || false,
                });
                filename = 'INFORMATIVA-GDPR.pdf';
            }
            else if (contratto.preventivoId) {
                const docPrev = await DocumentoFatturazione_1.default.findById(contratto.preventivoId)
                    .populate('patient', 'firstName lastName codiceFiscale address email');
                if (!docPrev)
                    return res.status(404).json({ message: 'Preventivo allegato non trovato' });
                buffer = await (0, fatturazionePdf_1.generaDocumentoPDF)(docPrev.toJSON());
                filename = `PREVENTIVO-${docPrev.numero}.pdf`;
            }
            else if (contratto.allegatoData) {
                buffer = contratto.allegatoData;
                filename = contratto.allegatoFileName || 'allegato';
                contentType = contratto.allegatoContentType || 'application/octet-stream';
            }
            else {
                return res.status(404).json({ message: 'Allegato non disponibile' });
            }
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
            return res.send(buffer);
        }
        return res.status(404).json({ message: 'Allegato non recuperabile per questo tipo di email' });
    }
    catch (error) {
        console.error('[ArchivioEmail allegato] Errore:', error);
        return res.status(500).json({ message: 'Errore scaricamento allegato', error: error.message });
    }
});
router.post('/rettifica', auth_1.authenticateToken, (0, roles_1.authorizeRole)(...RUOLI_GESTIONE), (0, audit_1.auditLog)('email_log', 'CREATE'), async (req, res) => {
    try {
        const user = req.user;
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
        const inviata = await (0, email_1.inviaEmail)({
            to: destinatario,
            subject: `⚠️ RETTIFICA: ${oggetto || 'email da ignorare'} — Abbraccio Cure Domiciliari`,
            html,
            log: { tipo: 'rettifica', riferimento: oggetto || undefined, inviataDaNome: user?.name },
        });
        if (inviata && emailLogId) {
            try {
                await EmailLog_1.default.findByIdAndUpdate(emailLogId, { rettificata: true, rettificaIl: new Date(), rettificaDaNome: user?.name });
            }
            catch { }
        }
        return res.json({ inviata, destinatario });
    }
    catch (error) {
        console.error('[ArchivioEmail rettifica] Errore:', error);
        return res.status(500).json({ message: 'Errore invio rettifica', error: error.message });
    }
});
router.get('/ricevute', auth_1.authenticateToken, (0, roles_1.authorizeRole)(...RUOLI_GESTIONE), async (req, res) => {
    try {
        const query = {};
        if (req.query.letta === 'lette')
            query.letta = true;
        if (req.query.letta === 'non-lette')
            query.letta = false;
        if (req.query.q) {
            const rx = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            query.$or = [{ 'from.email': rx }, { 'from.nome': rx }, { subject: rx }];
        }
        if (req.query.dal || req.query.al) {
            query.data = {};
            if (req.query.dal)
                query.data.$gte = new Date(String(req.query.dal));
            if (req.query.al) {
                const al = new Date(String(req.query.al));
                al.setHours(23, 59, 59, 999);
                query.data.$lte = al;
            }
        }
        const limit = Math.min(Math.max(1, parseInt(String(req.query.limit || '400'), 10) || 400), 400);
        const [email, totale, nonLette] = await Promise.all([
            EmailRicevuta_1.default.find(query).select('-testo -html -allegati.data').sort({ data: -1 }).limit(limit).lean(),
            EmailRicevuta_1.default.countDocuments(query),
            EmailRicevuta_1.default.countDocuments({ letta: false }),
        ]);
        return res.json({ email, totale, nonLette });
    }
    catch (error) {
        console.error('[ArchivioEmail ricevute] Errore:', error);
        return res.status(500).json({ message: 'Errore nel recupero email ricevute', error: error.message });
    }
});
router.post('/ricevute/sync', auth_1.authenticateToken, (0, roles_1.authorizeRole)(...RUOLI_GESTIONE), async (_req, res) => {
    try {
        const risultato = await (0, imapSync_1.sincronizzaEmailRicevute)();
        return res.json(risultato);
    }
    catch (error) {
        return res.status(500).json({ ok: false, message: 'Errore sincronizzazione', error: error.message });
    }
});
router.get('/ricevute/non-lette', auth_1.authenticateToken, (0, roles_1.authorizeRole)(...RUOLI_GESTIONE), async (_req, res) => {
    try {
        const nonLette = await EmailRicevuta_1.default.countDocuments({ letta: false });
        return res.json({ nonLette });
    }
    catch (error) {
        return res.status(500).json({ message: 'Errore', error: error.message });
    }
});
router.get('/ricevute/:id', auth_1.authenticateToken, (0, roles_1.authorizeRole)(...RUOLI_GESTIONE), async (req, res) => {
    try {
        const email = await EmailRicevuta_1.default.findById(req.params.id).select('-allegati.data').lean();
        if (!email)
            return res.status(404).json({ message: 'Email non trovata' });
        return res.json(email);
    }
    catch (error) {
        return res.status(500).json({ message: 'Errore', error: error.message });
    }
});
router.get('/ricevute/:id/allegato/:index', auth_1.authenticateToken, (0, roles_1.authorizeRole)(...RUOLI_GESTIONE), async (req, res) => {
    try {
        const email = await EmailRicevuta_1.default.findById(req.params.id).lean();
        if (!email)
            return res.status(404).json({ message: 'Email non trovata' });
        const idx = Math.max(0, parseInt(req.params.index || '0', 10) || 0);
        const a = email.allegati?.[idx];
        if (!a || !a.data)
            return res.status(404).json({ message: 'Allegato non conservato (troppo grande)' });
        res.setHeader('Content-Type', a.contentType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${a.filename.replace(/"/g, '')}"`);
        return res.send(a.data);
    }
    catch (error) {
        return res.status(500).json({ message: 'Errore scaricamento allegato', error: error.message });
    }
});
router.post('/ricevute/:id/letta', auth_1.authenticateToken, (0, roles_1.authorizeRole)(...RUOLI_GESTIONE), async (req, res) => {
    try {
        const letta = req.body?.letta !== false;
        const email = await EmailRicevuta_1.default.findByIdAndUpdate(req.params.id, { letta }, { new: true });
        if (!email)
            return res.status(404).json({ message: 'Email non trovata' });
        (0, imapSync_1.marcaFlagLettaSuServer)(email.uid, letta).catch(() => { });
        return res.json({ ok: true, letta });
    }
    catch (error) {
        return res.status(500).json({ message: 'Errore', error: error.message });
    }
});
export default router;