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
const email_1 = require("../utils/email");
const fatturazionePdf_1 = require("../utils/fatturazionePdf");
const PreventivoInviato_1 = __importDefault(require("../models/PreventivoInviato"));
const router = (0, express_1.Router)();
const RUOLI_GESTIONE = ['admin', 'coordinator', 'direttore'];
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function costruisciDocumentoBozza(body) {
    const nome = String(body?.nome || '').trim().slice(0, 80);
    const cognome = String(body?.cognome || '').trim().slice(0, 80);
    const righe = Array.isArray(body?.prestazioni) ? body.prestazioni : [];
    if (righe.length === 0 || righe.length > 60)
        return { error: 'Prestazioni non valide' };
    const prestazioni = righe.map((p) => {
        const quantita = Number(p.quantita) > 0 ? Math.min(Number(p.quantita), 9999) : 1;
        const prezzoUnitario = Math.max(-100000, Math.min(Number(p.prezzoUnitario) || 0, 100000));
        return {
            descrizione: String(p.descrizione || '').trim().slice(0, 300),
            quantita,
            prezzoUnitario,
            importo: Math.round(quantita * prezzoUnitario * 100) / 100,
            tipo: p.tipo ? String(p.tipo).slice(0, 60) : undefined,
            aliquotaIva: Number(p.aliquotaIva) >= 0 ? Number(p.aliquotaIva) : 0,
        };
    }).filter(p => p.descrizione);
    if (prestazioni.length === 0)
        return { error: 'Prestazioni non valide' };
    const imponibile = Math.round(prestazioni.reduce((a, p) => a + p.importo, 0) * 100) / 100;
    const totaleIva = Math.round(prestazioni.reduce((a, p) => a + p.importo * ((p.aliquotaIva || 0) / 100), 0) * 100) / 100;
    const nomePaziente = `${nome} ${cognome}`.trim() || 'Cliente';
    const doc = {
        numero: 'BOZZA',
        tipo: 'preventivo',
        data: new Date(),
        patient: {
            firstName: nomePaziente,
            lastName: '',
            codiceFiscale: '',
            address: '',
            email: String(body?.email || '').trim().slice(0, 120) || undefined,
        },
        prestazioni,
        imponibile,
        totaleIva,
        totale: Math.round((imponibile + totaleIva) * 100) / 100,
        note: body?.note ? String(body.note).trim().slice(0, 500) : undefined,
    };
    return { doc };
}
router.post('/pdf', auth_1.authenticateToken, (0, roles_1.authorizeRole)(...RUOLI_GESTIONE), (0, audit_1.auditLog)('fatturazione_documenti', 'READ'), async (req, res) => {
    try {
        const { doc, error } = costruisciDocumentoBozza(req.body);
        if (error || !doc)
            return res.status(400).json({ message: error || 'Dati non validi' });
        const buffer = await (0, fatturazionePdf_1.generaDocumentoPDF)(doc);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="PREVENTIVO-BOZZA.pdf"`);
        return res.send(buffer);
    }
    catch (error) {
        console.error('[Preventivo veloce PDF] Errore:', error);
        return res.status(500).json({ message: 'Errore nella generazione del PDF', error: error.message });
    }
});
router.post('/email', auth_1.authenticateToken, (0, roles_1.authorizeRole)(...RUOLI_GESTIONE), (0, audit_1.auditLog)('fatturazione_documenti', 'UPDATE'), async (req, res) => {
    try {
        const destinatario = String(req.body?.emailDestinatario || req.body?.email || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinatario)) {
            return res.status(400).json({ message: 'Email destinatario non valida' });
        }
        const { doc, error } = costruisciDocumentoBozza(req.body);
        if (error || !doc)
            return res.status(400).json({ message: error || 'Dati non validi' });
        const buffer = await (0, fatturazionePdf_1.generaDocumentoPDF)(doc);
        const nomeCliente = doc.patient.firstName;
        const righeHtml = doc.prestazioni.map((p, i) => `<tr><td style="padding:6px;background:${i % 2 ? '#fff' : '#f8fafc'};">${esc(p.descrizione)}</td><td style="padding:6px;text-align:center;">${p.quantita}</td><td style="padding:6px;text-align:right;">€${p.prezzoUnitario.toFixed(2)}</td><td style="padding:6px;text-align:right;font-weight:bold;">€${p.importo.toFixed(2)}</td></tr>`).join('');
        const inviata = await (0, email_1.inviaEmail)({
            to: destinatario,
            subject: `Preventivo prestazioni a domicilio — Abbraccio Cure Domiciliari`,
            html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
        <h2 style="color:#1e4d8c;margin-top:0;">Il tuo preventivo</h2>
        <p>Gentile <strong>${esc(nomeCliente)}</strong>,</p>
        <p>in allegato trovi il preventivo delle prestazioni a domicilio richieste. Riepilogo:</p>
        <table style="width:100%;border-collapse:collapse;font-size:0.9rem;margin:12px 0;">
          <tr style="background:#1e4d8c;color:#fff;"><th style="padding:6px;text-align:left;">Prestazione</th><th style="padding:6px;">Q.tà</th><th style="padding:6px;text-align:right;">Prezzo</th><th style="padding:6px;text-align:right;">Importo</th></tr>
          ${righeHtml}
          <tr><td colspan="3" style="padding:8px;text-align:right;font-weight:bold;">TOTALE</td><td style="padding:8px;text-align:right;font-weight:bold;font-size:1.05rem;color:#166534;">€${doc.totale.toFixed(2)}</td></tr>
        </table>
        <p style="font-size:0.85rem;color:#64748b;">Per confermare o per qualsiasi informazione puoi chiamarci al <strong>06 01905242</strong> o scriverci su WhatsApp al <strong>351 4175117</strong>.</p>
        <p style="margin-top:20px;font-size:12px;color:#888;">Abbraccio Cure Domiciliari — Via di S. Maria Ausiliatrice 4/B, Roma</p>
      </div>`,
            attachments: [{ filename: `PREVENTIVO-${nomeCliente.replace(/\s+/g, '_')}.pdf`, content: buffer, contentType: 'application/pdf' }],
            log: { tipo: 'preventivo_veloce', area: 'privato', riferimento: nomeCliente, inviataDaNome: req.user?.name },
        });
        if (inviata) {
            try {
                await PreventivoInviato_1.default.create({
                    area: 'privato',
                    tipo: 'preventivo_veloce',
                    canale: 'email',
                    nomeCliente,
                    email: destinatario,
                    prestazioni: doc.prestazioni,
                    totale: doc.totale,
                    inviatoDa: req.user?.name,
                });
            }
            catch (e) {
                console.error('[Preventivo veloce] Archiviazione invio fallita:', e);
            }
        }
        return res.json({ inviata, destinatario });
    }
    catch (error) {
        console.error('[Preventivo veloce email] Errore:', error);
        return res.status(500).json({ message: 'Errore nell\'invio dell\'email', error: error.message });
    }
});
export default router;