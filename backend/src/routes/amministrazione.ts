import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import DocumentoFatturazione from '../models/DocumentoFatturazione';
import PreventivoInviato from '../models/PreventivoInviato';
import RitenutaAcconto from '../models/RitenutaAcconto';
import FatturaRicevuta from '../models/FatturaRicevuta';
import Attivita from '../models/Attivita';

const router = Router();
const RUOLI_AMM = ['admin', 'coordinator', 'direttore'];

// ═════════════════════════════════════════════════════════════════════════════
// AMMINISTRAZIONE CENTRALE — archivio unico dei documenti economici di tutte
// le aree (privato, intermediazione, convenzione, trasversale).
// Ogni riga conserva: area di provenienza, soggetto, stato documento e stato
// pagamento — distinti: emesso ≠ trasmesso ≠ pagato ≠ archiviato.
// ═════════════════════════════════════════════════════════════════════════════

function areaDiDocumento(doc: any): string {
  const p = doc.patient || {};
  if (doc.riferimentoTipo === 'badante' || p.tipoGestione === 'consulenza' || p.categoriaPrivata === 'intermediazione_badanti') return 'intermediazione';
  if (p.tipoGestione === 'convenzione') return 'convenzione';
  return 'privato';
}

function inPeriodo(data: any, dal?: string, al?: string): boolean {
  if (!data) return false;
  const t = new Date(data).getTime();
  if (dal && t < new Date(dal).getTime()) return false;
  if (al) { const fine = new Date(al); fine.setHours(23, 59, 59, 999); if (t > fine.getTime()) return false; }
  return true;
}

// GET /api/amministrazione/documenti — archivio unico normalizzato
// filtri: area, origine, statoDoc, statoPagamento, dal, al, q
router.get('/documenti', authenticateToken, authorizeRole(...RUOLI_AMM), async (req: Request, res: Response) => {
  try {
    const { area, origine, dal, al } = req.query as Record<string, string>;
    const q = String(req.query.q || '').trim().toLowerCase();
    const statoDoc = String(req.query.statoDoc || '');
    const statoPag = String(req.query.statoPagamento || '');
    const righe: any[] = [];

    if (!origine || origine === 'fattura' || origine === 'preventivo' || origine === 'nota_credito') {
      const docs = await DocumentoFatturazione.find()
        .populate('patient', 'firstName lastName codiceFiscale tipoGestione categoriaPrivata')
        .sort({ data: -1 }).limit(600).lean();
      docs.forEach((d: any) => {
        const orig = d.tipoDocumentoFiscale === 'nota_credito' ? 'nota_credito' : d.tipo;
        if (origine && orig !== origine) return;
        righe.push({
          id: String(d._id), origine: orig, area: areaDiDocumento(d),
          numero: d.numero, soggetto: `${d.patient?.firstName || ''} ${d.patient?.lastName || ''}`.trim() || '—',
          data: d.data, totale: d.totale,
          statoDoc: d.stato, dataTrasmissione: d.dataTrasmissione,
          statoPagamento: d.pagamento?.stato || (d.tipo === 'fattura' ? 'da_incassare' : undefined),
          scadenzaPagamento: d.pagamento?.scadenza,
          incassato: (d.pagamento?.incassi || []).reduce((s: number, i: any) => s + (i.importo || 0), 0),
          praticaTipo: 'paziente', praticaId: String(d.patient?._id || ''),
          collegato: d.documentoOrigineId ? String(d.documentoOrigineId) : undefined,
          aggiornatoIl: d.updatedAt,
        });
      });
    }

    if (!origine || origine === 'invio') {
      const invii = await PreventivoInviato.find().sort({ createdAt: -1 }).limit(400).lean();
      invii.forEach((i: any) => {
        if (origine && origine !== 'invio') return;
        righe.push({
          id: String(i._id), origine: 'invio', area: i.area === 'intermediazione' ? 'intermediazione' : 'privato',
          numero: `INV-${String(i._id).slice(-6)}`, soggetto: i.nomeCliente || i.email || i.telefono || '—',
          data: i.createdAt, totale: i.totale,
          statoDoc: i.stato || 'inviato', statoPagamento: undefined,
          praticaTipo: undefined, praticaId: undefined,
          nota: `${i.tipo === 'costo_badante' ? 'Costo badante' : i.tipo === 'contratto_firma' ? 'Contratto per firma' : 'Preventivo veloce'} · ${i.canale}`,
          aggiornatoIl: i.updatedAt,
        });
      });
    }

    if (!origine || origine === 'ritenuta') {
      const ritenute = await RitenutaAcconto.find().sort({ data: -1 }).limit(300).lean();
      ritenute.forEach((r: any) => {
        righe.push({
          id: String(r._id), origine: 'ritenuta', area: 'trasversale',
          numero: r.numero, soggetto: `${r.datiProfessionista?.firstName || ''} ${r.datiProfessionista?.lastName || ''}`.trim() || '—',
          data: r.data, totale: r.nettoAPagare,
          statoDoc: r.stato, statoPagamento: undefined,
          nota: `Ritenuta ${r.percentualeRitenuta}% · lordo €${(r.importoLordo || 0).toFixed(2)}`,
          aggiornatoIl: (r as any).updatedAt,
        });
      });
    }

    if (!origine || origine === 'fattura_ricevuta') {
      const ricevute = await FatturaRicevuta.find().select('-allegato.contenuto').sort({ data: -1 }).limit(300).lean();
      ricevute.forEach((f: any) => {
        righe.push({
          id: String(f._id), origine: 'fattura_ricevuta', area: f.area,
          numero: f.numero, soggetto: f.fornitore?.nome || '—',
          data: f.data, totale: f.totale,
          statoDoc: 'ricevuta', statoPagamento: f.pagamento?.stato || 'da_pagare',
          scadenzaPagamento: f.scadenzaPagamento,
          pagato: (f.pagamento?.pagamenti || []).reduce((s: number, p: any) => s + (p.importo || 0), 0),
          praticaTipo: f.praticaTipo, praticaId: f.praticaId ? String(f.praticaId) : undefined,
          nota: f.descrizione, hasAllegato: !!f.allegato?.fileName,
          aggiornatoIl: f.updatedAt,
        });
      });
    }

    // Filtri applicati alla vista unificata
    let out = righe;
    if (area && area !== 'tutte') out = out.filter(r => r.area === area);
    if (dal || al) out = out.filter(r => inPeriodo(r.data, dal, al));
    if (statoDoc) out = out.filter(r => r.statoDoc === statoDoc);
    if (statoPag) out = out.filter(r => r.statoPagamento === statoPag);
    if (q) out = out.filter(r =>
      r.soggetto.toLowerCase().includes(q) || String(r.numero).toLowerCase().includes(q) ||
      (r.nota || '').toLowerCase().includes(q));
    out.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    return res.json(out.slice(0, 500));
  } catch (error: any) {
    console.error('[Amministrazione documenti] Errore:', error);
    return res.status(500).json({ message: 'Errore caricamento archivio amministrativo', error: error.message });
  }
});

// GET /api/amministrazione/conteggi — widget direzione
router.get('/conteggi', authenticateToken, authorizeRole(...RUOLI_AMM), async (_req: Request, res: Response) => {
  try {
    const adesso = new Date();
    const [fatture, ricevute] = await Promise.all([
      DocumentoFatturazione.find({ tipo: 'fattura', stato: { $nin: ['annullato'] } })
        .select('totale pagamento.scadenza pagamento.stato pagamento.incassi').lean(),
      FatturaRicevuta.find().select('totale scadenzaPagamento pagamento').lean(),
    ]);
    let daIncassare = 0, scadute = 0;
    fatture.forEach((f: any) => {
      const incassato = (f.pagamento?.incassi || []).reduce((s: number, i: any) => s + (i.importo || 0), 0);
      const residuo = Math.max(0, (f.totale || 0) - incassato);
      daIncassare += residuo;
      if (residuo > 0 && f.pagamento?.scadenza && new Date(f.pagamento.scadenza) < adesso) scadute++;
    });
    let daPagare = 0;
    ricevute.forEach((f: any) => {
      const pagato = (f.pagamento?.pagamenti || []).reduce((s: number, p: any) => s + (p.importo || 0), 0);
      daPagare += Math.max(0, (f.totale || 0) - pagato);
    });
    return res.json({
      daIncassare: Math.round(daIncassare * 100) / 100,
      daPagare: Math.round(daPagare * 100) / 100,
      fattureScadute: scadute,
      fattureRicevute: ricevute.length,
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore conteggi', error: error.message });
  }
});

// ─── Incassi sui documenti emessi ────────────────────────────────────────────

// PATCH /api/amministrazione/documenti-emessi/:id — trasmissione, scadenza,
// tipo fiscale (nota_credito), collegamento nota di credito
router.patch('/documenti-emessi/:id', authenticateToken, authorizeRole(...RUOLI_AMM), async (req: AuthRequest, res: Response) => {
  try {
    const doc = await DocumentoFatturazione.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Documento non trovato' });
    const b = req.body || {};
    if (b.dataTrasmissione !== undefined) {
      const d = b.dataTrasmissione ? new Date(b.dataTrasmissione) : undefined;
      doc.dataTrasmissione = d && !isNaN(d.getTime()) ? d : undefined;
    }
    if (b.scadenzaPagamento !== undefined) {
      const d = b.scadenzaPagamento ? new Date(b.scadenzaPagamento) : undefined;
      doc.pagamento = doc.pagamento || {};
      doc.pagamento.scadenza = d && !isNaN(d.getTime()) ? d : undefined;
    }
    if (b.tipoDocumentoFiscale && ['standard', 'nota_credito', 'acconto'].includes(b.tipoDocumentoFiscale)) {
      doc.tipoDocumentoFiscale = b.tipoDocumentoFiscale;
    }
    if (b.notaCreditoDiId && mongoose.isValidObjectId(b.notaCreditoDiId)) {
      doc.notaCreditoDiId = new mongoose.Types.ObjectId(b.notaCreditoDiId);
    }
    await doc.save();
    return res.json(doc);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore aggiornamento amministrativo', error: error.message });
  }
});

// POST /api/amministrazione/documenti-emessi/:id/incasso — registra un incasso
// (totale o acconto). Lo stato pagamento si ricalcola da solo.
router.post('/documenti-emessi/:id/incasso', authenticateToken, authorizeRole(...RUOLI_AMM), auditLog('amministrazione', 'UPDATE', req => req.params.id), async (req: AuthRequest, res: Response) => {
  try {
    const doc = await DocumentoFatturazione.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Documento non trovato' });
    const importo = Number(req.body?.importo);
    if (!Number.isFinite(importo) || importo <= 0 || importo > 1000000) {
      return res.status(400).json({ message: 'Importo incasso non valido' });
    }
    doc.pagamento = doc.pagamento || { stato: 'da_incassare', incassi: [] };
    doc.pagamento.incassi = doc.pagamento.incassi || [];
    doc.pagamento.incassi.push({
      data: req.body?.data ? new Date(req.body.data) : new Date(),
      importo: Math.round(importo * 100) / 100,
      metodo: String(req.body?.metodo || '').trim().slice(0, 60) || undefined,
      nota: String(req.body?.nota || '').trim().slice(0, 300) || undefined,
      registratoDa: (req as any).user?.name || undefined,
    });
    const incassato = doc.pagamento.incassi.reduce((s, i) => s + (i.importo || 0), 0);
    doc.pagamento.stato = incassato >= (doc.totale || 0) - 0.005 ? 'saldato' : 'parziale';
    await doc.save();
    return res.json(doc);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore registrazione incasso', error: error.message });
  }
});

// ─── Fatture ricevute (fornitori / professionisti generici) ──────────────────

// POST /api/amministrazione/fatture-ricevute — registrazione con allegato base64
router.post('/fatture-ricevute', authenticateToken, authorizeRole(...RUOLI_AMM), auditLog('amministrazione', 'CREATE'), async (req: AuthRequest, res: Response) => {
  try {
    const b = req.body || {};
    const nomeFornitore = String(b.fornitore?.nome || '').trim().slice(0, 160);
    const numero = String(b.numero || '').trim().slice(0, 60);
    const totale = Number(b.totale);
    if (!nomeFornitore || !numero || !Number.isFinite(totale) || totale < 0) {
      return res.status(400).json({ message: 'Obbligatori: fornitore, numero documento, totale' });
    }
    // Guardia duplicati: stesso fornitore + stesso numero
    const duplicata = await FatturaRicevuta.findOne({ 'fornitore.nome': nomeFornitore, numero });
    if (duplicata && !b.confermaDuplicato) {
      return res.status(409).json({ message: `Esiste già una fattura n. ${numero} di ${nomeFornitore} (${new Date(duplicata.data).toLocaleDateString('it-IT')})`, duplicato: true });
    }
    let allegato: any;
    if (b.allegato?.dataBase64 && b.allegato?.fileName) {
      const buf = Buffer.from(String(b.allegato.dataBase64), 'base64');
      if (buf.length > 7 * 1024 * 1024) return res.status(400).json({ message: 'Allegato troppo grande (max 7 MB)' });
      allegato = { fileName: String(b.allegato.fileName).slice(0, 200), contentType: String(b.allegato.contentType || 'application/pdf'), contenuto: buf };
    }
    const d = b.data ? new Date(b.data) : new Date();
    const scad = b.scadenzaPagamento ? new Date(b.scadenzaPagamento) : undefined;
    const doc = await FatturaRicevuta.create({
      fornitore: {
        nome: nomeFornitore,
        partitaIva: String(b.fornitore?.partitaIva || '').trim().slice(0, 20) || undefined,
        codiceFiscale: String(b.fornitore?.codiceFiscale || '').trim().slice(0, 20) || undefined,
        email: String(b.fornitore?.email || '').trim().slice(0, 120) || undefined,
      },
      numero, data: isNaN(d.getTime()) ? new Date() : d,
      imponibile: Number.isFinite(Number(b.imponibile)) ? Number(b.imponibile) : undefined,
      iva: Number.isFinite(Number(b.iva)) ? Number(b.iva) : undefined,
      totale, descrizione: String(b.descrizione || '').trim().slice(0, 500) || undefined,
      area: ['privato', 'intermediazione', 'convenzione', 'trasversale'].includes(b.area) ? b.area : 'trasversale',
      praticaLabel: String(b.praticaLabel || '').trim().slice(0, 200) || undefined,
      scadenzaPagamento: scad && !isNaN(scad.getTime()) ? scad : undefined,
      pagamento: { stato: 'da_pagare', pagamenti: [] },
      allegato,
      creatoDa: (req as any).user?.name || undefined,
    });
    return res.status(201).json(doc);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore registrazione fattura ricevuta', error: error.message });
  }
});

// GET /api/amministrazione/fatture-ricevute/:id/allegato
router.get('/fatture-ricevute/:id/allegato', authenticateToken, authorizeRole(...RUOLI_AMM), async (req: Request, res: Response) => {
  try {
    const doc = await FatturaRicevuta.findById(req.params.id).select('allegato');
    if (!doc?.allegato?.contenuto) return res.status(404).json({ message: 'Allegato non trovato' });
    res.setHeader('Content-Type', doc.allegato.contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${doc.allegato.fileName || 'allegato.pdf'}"`);
    return res.send(doc.allegato.contenuto);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore allegato', error: error.message });
  }
});

// POST /api/amministrazione/fatture-ricevute/:id/pagamento — registra pagamento
router.post('/fatture-ricevute/:id/pagamento', authenticateToken, authorizeRole(...RUOLI_AMM), auditLog('amministrazione', 'UPDATE', req => req.params.id), async (req: AuthRequest, res: Response) => {
  try {
    const doc = await FatturaRicevuta.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Documento non trovato' });
    const importo = Number(req.body?.importo);
    if (!Number.isFinite(importo) || importo <= 0 || importo > 1000000) {
      return res.status(400).json({ message: 'Importo pagamento non valido' });
    }
    doc.pagamento = doc.pagamento || { stato: 'da_pagare', pagamenti: [] };
    doc.pagamento.pagamenti = doc.pagamento.pagamenti || [];
    doc.pagamento.pagamenti.push({
      data: req.body?.data ? new Date(req.body.data) : new Date(),
      importo: Math.round(importo * 100) / 100,
      metodo: String(req.body?.metodo || '').trim().slice(0, 60) || undefined,
      nota: String(req.body?.nota || '').trim().slice(0, 300) || undefined,
      registratoDa: (req as any).user?.name || undefined,
    });
    const pagato = doc.pagamento.pagamenti.reduce((s, p) => s + (p.importo || 0), 0);
    doc.pagamento.stato = pagato >= (doc.totale || 0) - 0.005 ? 'pagata' : 'parziale';
    await doc.save();
    return res.json(doc);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore registrazione pagamento', error: error.message });
  }
});

// PATCH /api/amministrazione/fatture-ricevute/:id — correzione dati (no allegato)
router.patch('/fatture-ricevute/:id', authenticateToken, authorizeRole(...RUOLI_AMM), async (req: AuthRequest, res: Response) => {
  try {
    const b = req.body || {};
    const update: any = {};
    if (b.scadenzaPagamento !== undefined) {
      const d = b.scadenzaPagamento ? new Date(b.scadenzaPagamento) : undefined;
      update.scadenzaPagamento = d && !isNaN(d.getTime()) ? d : undefined;
    }
    if (b.descrizione !== undefined) update.descrizione = String(b.descrizione).trim().slice(0, 500);
    if (b.area && ['privato', 'intermediazione', 'convenzione', 'trasversale'].includes(b.area)) update.area = b.area;
    if (b.praticaLabel !== undefined) update.praticaLabel = String(b.praticaLabel).trim().slice(0, 200);
    const doc = await FatturaRicevuta.findByIdAndUpdate(req.params.id, update, { new: true }).select('-allegato.contenuto');
    if (!doc) return res.status(404).json({ message: 'Documento non trovato' });
    return res.json(doc);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore aggiornamento', error: error.message });
  }
});

// POST /api/amministrazione/documenti-emessi/:id/apri-attivita — crea lavorazione
// back office collegata al documento (verifica dati, incasso, anomalia…)
router.post('/documenti-emessi/:id/apri-attivita', authenticateToken, authorizeRole(...RUOLI_AMM), async (req: AuthRequest, res: Response) => {
  try {
    const user: any = req.user;
    const doc = await DocumentoFatturazione.findById(req.params.id).populate('patient', 'firstName lastName');
    if (!doc) return res.status(404).json({ message: 'Documento non trovato' });
    const paziente: any = doc.patient;
    const attivita = await Attivita.create({
      titolo: String(req.body?.titolo || `Verifica ${doc.numero}`).slice(0, 200),
      azioneRichiesta: String(req.body?.azioneRichiesta || '').slice(0, 2000) || undefined,
      praticaTipo: 'documento',
      praticaId: doc._id,
      praticaLabel: `${doc.numero} — ${paziente?.firstName || ''} ${paziente?.lastName || ''}`.trim(),
      area: 'organizzativa',
      priorita: ['bassa', 'normale', 'alta', 'urgente'].includes(req.body?.priorita) ? req.body.priorita : 'normale',
      scadenza: req.body?.scadenza ? new Date(req.body.scadenza) : undefined,
      autoreId: new mongoose.Types.ObjectId(user.userId || user.id),
      autoreNome: user.name || 'Utente',
      storico: [{ azione: 'creata', data: new Date(), autoreNome: user.name || 'Utente' }],
    });
    return res.status(201).json(attivita);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore creazione attività', error: error.message });
  }
});

export default router;
