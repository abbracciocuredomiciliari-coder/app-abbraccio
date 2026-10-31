import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import PreventivoInviato from '../models/PreventivoInviato';
import { generaDocumentoPDF } from '../utils/fatturazionePdf';
import { generaPreventivoBadantePdfBuffer } from '../utils/preventivoBadantePdf';
import { inviaEmail } from '../utils/email';

const router = Router();
const RUOLI_GESTIONE = ['admin', 'coordinator', 'direttore'];
const esc = (v: string) => String(v).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] as string));

// Rigenera il PDF identico a quello inviato (condiviso da /pdf e /reinvia)
async function rigeneraPdfInviato(doc: any): Promise<Buffer> {
  if (doc.tipo === 'costo_badante') {
    const sim = (doc.simulazione || {}) as any;
    if (!sim.risultato) throw new Error('Dati simulazione non disponibili per rigenerare il PDF');
    return generaPreventivoBadantePdfBuffer(sim.risultato, {
      intestatario: doc.nomeCliente || undefined,
      cafMensile: sim.cafMensile,
      escludiTfrTredicesima: !!sim.escludiTfrTredicesima,
    });
  }
  if (!doc.prestazioni?.length) throw new Error('Righe preventivo non disponibili');
  const imponibile = Math.round(doc.prestazioni.reduce((a: number, p: any) => a + p.importo, 0) * 100) / 100;
  const totaleIva = Math.round(doc.prestazioni.reduce((a: number, p: any) => a + p.importo * ((p.aliquotaIva || 0) / 100), 0) * 100) / 100;
  return generaDocumentoPDF({
    numero: 'BOZZA',
    tipo: 'preventivo',
    data: doc.createdAt,
    patient: { firstName: doc.nomeCliente || 'Cliente', lastName: '', codiceFiscale: '', address: '', email: doc.email },
    prestazioni: doc.prestazioni,
    imponibile,
    totaleIva,
    totale: Math.round((imponibile + totaleIva) * 100) / 100,
  } as any);
}

// ═════════════════════════════════════════════════════════════════════════════
// ARCHIVIO PREVENTIVI INVIATI — preventivi/costi inviati via WhatsApp o email
// SENZA paziente in anagrafica. Gli invii email vengono registrati in
// automatico dalle route di invio; WhatsApp viene registrato dal frontend
// prima di aprire wa.me. Il PDF si rigenera dai dati archiviati.
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/preventivi-inviati — registra un invio (usato anche internamente)
router.post('/', authenticateToken, authorizeRole(...RUOLI_GESTIONE), async (req: AuthRequest, res: Response) => {
  try {
    const { area, tipo, canale, nomeCliente, email, telefono, prestazioni, totale, simulazione, testoInviato } = req.body || {};
    if (!['privato', 'intermediazione'].includes(area)) return res.status(400).json({ message: 'Area non valida' });
    if (!['preventivo_veloce', 'costo_badante'].includes(tipo)) return res.status(400).json({ message: 'Tipo non valido' });
    if (!['whatsapp', 'email'].includes(canale)) return res.status(400).json({ message: 'Canale non valido' });

    const righe = (Array.isArray(prestazioni) ? prestazioni : []).map((p: any) => ({
      descrizione: String(p.descrizione || '').trim().slice(0, 300),
      quantita: Number(p.quantita) > 0 ? Math.min(Number(p.quantita), 9999) : 1,
      prezzoUnitario: Math.max(-100000, Math.min(Number(p.prezzoUnitario) || 0, 100000)),
      importo: Math.round((Number(p.quantita) > 0 ? Number(p.quantita) : 1) * (Number(p.prezzoUnitario) || 0) * 100) / 100,
      tipo: p.tipo ? String(p.tipo).slice(0, 60) : undefined,
      aliquotaIva: Number(p.aliquotaIva) >= 0 ? Number(p.aliquotaIva) : 0,
    })).filter((p: any) => p.descrizione).slice(0, 60);

    const doc = await PreventivoInviato.create({
      area,
      tipo,
      canale,
      nomeCliente: nomeCliente ? String(nomeCliente).trim().slice(0, 160) : undefined,
      email: email ? String(email).trim().slice(0, 120) : undefined,
      telefono: telefono ? String(telefono).trim().slice(0, 40) : undefined,
      prestazioni: righe,
      totale: Number.isFinite(Number(totale)) ? Math.round(Number(totale) * 100) / 100 : undefined,
      simulazione: simulazione && typeof simulazione === 'object' ? simulazione : undefined,
      testoInviato: testoInviato ? String(testoInviato).slice(0, 4000) : undefined,
      inviatoDa: (req as any).user?.name || undefined,
    });
    return res.status(201).json(doc);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nella registrazione dell\'invio', error: error.message });
  }
});

// GET /api/preventivi-inviati?area=privato|intermediazione — lista archivio
router.get('/', authenticateToken, authorizeRole(...RUOLI_GESTIONE), async (req: Request, res: Response) => {
  try {
    const area = req.query.area === 'intermediazione' ? 'intermediazione' : 'privato';
    const docs = await PreventivoInviato.find({ area })
      .select('-testoInviato')
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();
    return res.json(docs);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel caricamento degli invii', error: error.message });
  }
});

// GET /api/preventivi-inviati/:id/testo — testo del messaggio inviato (WhatsApp/email)
router.get('/:id/testo', authenticateToken, authorizeRole(...RUOLI_GESTIONE), async (req: Request, res: Response) => {
  try {
    const doc = await PreventivoInviato.findById(req.params.id).select('testoInviato').lean();
    if (!doc) return res.status(404).json({ message: 'Invio non trovato' });
    return res.json({ testoInviato: doc.testoInviato || '' });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore', error: error.message });
  }
});

// GET /api/preventivi-inviati/:id/pdf — rigenera il PDF identico a quello inviato
router.get('/:id/pdf', authenticateToken, authorizeRole(...RUOLI_GESTIONE), async (req: Request, res: Response) => {
  try {
    const doc = await PreventivoInviato.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Invio non trovato' });
    const buffer = await rigeneraPdfInviato(doc);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="preventivo-inviato-${doc._id}.pdf"`);
    return res.send(buffer);
  } catch (error: any) {
    console.error('[Preventivi inviati PDF] Errore:', error);
    return res.status(500).json({ message: 'Errore nella rigenerazione del PDF', error: error.message });
  }
});

// POST /api/preventivi-inviati/:id/reinvia — rimanda lo STESSO preventivo via
// email con il PDF rigenerato in allegato. Registra un nuovo record d'archivio
// così resta traccia di ogni invio.
router.post('/:id/reinvia', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('preventivi_inviati', 'UPDATE', req => req.params.id), async (req: AuthRequest, res: Response) => {
  try {
    const doc = await PreventivoInviato.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Invio non trovato' });
    const destinatario = String(req.body?.email || doc.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinatario)) {
      return res.status(400).json({ message: 'Serve un indirizzo email valido del destinatario' });
    }
    const buffer = await rigeneraPdfInviato(doc);
    const nome = doc.nomeCliente || 'Cliente';
    const sim = (doc.simulazione?.risultato || {}) as any;
    const riepilogo = doc.tipo === 'costo_badante'
      ? `<p style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;">📋 ${esc(sim.contrattoLabel || 'Contratto')} — livello ${esc(sim.livelloLabel || '—')}${sim.oreSettimanali ? `, ${sim.oreSettimanali}h/settimanali` : ''}<br>💶 Totale: <strong>€ ${Number(doc.totale || 0).toFixed(2)}/mese</strong></p>`
      : `<p style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;">💶 Totale: <strong>€ ${Number(doc.totale || 0).toFixed(2)}</strong></p>`;
    const inviata = await inviaEmail({
      to: destinatario,
      subject: `Il tuo preventivo — Abbraccio Cure Domiciliari`,
      html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
        <h2 style="color:#1e4d8c;margin-top:0;">Il tuo preventivo</h2>
        <p>Gentile <strong>${esc(nome)}</strong>,</p>
        <p>le reinoltriamo il preventivo richiesto, in allegato in formato PDF.</p>
        ${riepilogo}
        <p style="font-size:0.85rem;color:#64748b;">Per confermare o per qualsiasi informazione puoi chiamarci al <strong>06 01905242</strong> o scriverci su WhatsApp al <strong>351 4175117</strong>.</p>
        <p style="margin-top:20px;font-size:12px;color:#888;">Abbraccio Cure Domiciliari — Via di S. Maria Ausiliatrice 4/B, Roma</p>
      </div>`,
      attachments: [{ filename: `PREVENTIVO-${nome.replace(/\s+/g, '_')}.pdf`, content: buffer, contentType: 'application/pdf' }],
      log: { tipo: 'preventivo', area: doc.area, riferimento: nome, inviataDaNome: (req as any).user?.name },
    });
    if (inviata) {
      try {
        await PreventivoInviato.create({
          area: doc.area, tipo: doc.tipo, canale: 'email',
          nomeCliente: doc.nomeCliente, email: destinatario, telefono: doc.telefono,
          prestazioni: doc.prestazioni, totale: doc.totale, simulazione: doc.simulazione,
          testoInviato: doc.testoInviato, inviatoDa: (req as any).user?.name,
        });
      } catch (e) { console.error('[Preventivi inviati] Archiviazione reinvio fallita:', e); }
    }
    return res.json({ inviata, destinatario });
  } catch (error: any) {
    console.error('[Preventivi inviati] Errore reinvio:', error);
    return res.status(500).json({ message: 'Errore nel reinvio del preventivo', error: error.message });
  }
});

// DELETE /api/preventivi-inviati/:id — elimina record (solo admin)
router.delete('/:id', authenticateToken, authorizeRole('admin'), async (req: Request, res: Response) => {
  try {
    const eliminato = await PreventivoInviato.findByIdAndDelete(req.params.id);
    if (!eliminato) return res.status(404).json({ message: 'Invio non trovato' });
    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore eliminazione', error: error.message });
  }
});

export default router;
