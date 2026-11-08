import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import DocumentoFatturazione from '../models/DocumentoFatturazione';
import PreventivoInviato from '../models/PreventivoInviato';
import RitenutaAcconto from '../models/RitenutaAcconto';
import FatturaRicevuta from '../models/FatturaRicevuta';
import ConsegnaCommercialista from '../models/ConsegnaCommercialista';
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

// Raccolta unificata dei documenti economici di tutte le aree — usata sia
// dall'archivio sia dalla preparazione commercialista.
async function raccogliRighe(filtroOrigine?: string): Promise<any[]> {
    const origine = filtroOrigine || '';
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
          cfMancante: d.tipo === 'fattura' && !d.patient?.codiceFiscale,
          aggiornatoIl: d.updatedAt, creatoIl: d.createdAt,
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
          aggiornatoIl: i.updatedAt, creatoIl: i.createdAt,
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
          aggiornatoIl: (r as any).updatedAt, creatoIl: (r as any).createdAt,
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
          aggiornatoIl: f.updatedAt, creatoIl: f.createdAt,
        });
      });
    }

    righe.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    return righe;
}

// GET /api/amministrazione/documenti — archivio unico normalizzato
// filtri: area, origine, statoDoc, statoPagamento, dal, al, q
router.get('/documenti', authenticateToken, authorizeRole(...RUOLI_AMM), async (req: Request, res: Response) => {
  try {
    const { area, origine, dal, al } = req.query as Record<string, string>;
    const q = String(req.query.q || '').trim().toLowerCase();
    const statoDoc = String(req.query.statoDoc || '');
    const statoPag = String(req.query.statoPagamento || '');
    const righe = await raccogliRighe(origine);

    // Filtri applicati alla vista unificata
    let out = righe;
    if (area && area !== 'tutte') out = out.filter(r => r.area === area);
    if (dal || al) out = out.filter(r => inPeriodo(r.data, dal, al));
    if (statoDoc) out = out.filter(r => r.statoDoc === statoDoc);
    if (statoPag) out = out.filter(r => r.statoPagamento === statoPag);
    if (q) out = out.filter(r =>
      r.soggetto.toLowerCase().includes(q) || String(r.numero).toLowerCase().includes(q) ||
      (r.nota || '').toLowerCase().includes(q));
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

// ─── Preparazione documenti per il commercialista ────────────────────────────
// L'esportazione non è un invio: la consegna va marcata esplicitamente.

function calcolaAnomalie(righe: any[]): string[] {
  const anomalie: string[] = [];

  // 1. Buchi nella numerazione fatture per serie + anno
  const perSerie = new Map<string, Set<number>>();
  righe.filter(r => r.origine === 'fattura').forEach(r => {
    const m = String(r.numero).match(/^(FATT(?:-CF)?)-(\d{4})-(\d+)$/);
    if (!m) return;
    const chiave = `${m[1]}-${m[2]}`;
    if (!perSerie.has(chiave)) perSerie.set(chiave, new Set());
    perSerie.get(chiave)!.add(parseInt(m[3], 10));
  });
  perSerie.forEach((numeri, serie) => {
    const max = Math.max(...numeri);
    for (let n = 1; n <= max; n++) {
      if (!numeri.has(n)) anomalie.push(`Numerazione ${serie}: manca il progressivo ${String(n).padStart(5, '0')}`);
    }
  });

  // 2. Fatture senza codice fiscale intestatario
  righe.filter(r => r.origine === 'fattura' && r.cfMancante).forEach(r => {
    anomalie.push(`${r.numero}: intestatario senza codice fiscale (${r.soggetto})`);
  });

  // 3. Possibili duplicati: stesso soggetto + totale + giorno
  const visti = new Map<string, string>();
  righe.filter(r => ['fattura', 'preventivo'].includes(r.origine)).forEach(r => {
    const chiave = `${r.soggetto}|${r.totale}|${new Date(r.data).toISOString().slice(0, 10)}`;
    if (visti.has(chiave)) anomalie.push(`Possibile duplicato: ${visti.get(chiave)} e ${r.numero} (${r.soggetto}, €${(r.totale || 0).toFixed(2)})`);
    else visti.set(chiave, r.numero);
  });

  // 4. Documenti a importo zero
  righe.filter(r => ['fattura', 'fattura_ricevuta'].includes(r.origine) && !(r.totale > 0)).forEach(r => {
    anomalie.push(`${r.numero}: totale a zero (${r.soggetto})`);
  });

  return anomalie.slice(0, 100);
}

// GET /api/amministrazione/commercialista/anteprima?dal&al — riepilogo + anomalie
router.get('/commercialista/anteprima', authenticateToken, authorizeRole(...RUOLI_AMM), async (req: Request, res: Response) => {
  try {
    const { dal, al } = req.query as Record<string, string>;
    const righe = (await raccogliRighe()).filter(r => inPeriodo(r.data, dal, al));
    const perOrigine: Record<string, number> = {};
    righe.forEach(r => { perOrigine[r.origine] = (perOrigine[r.origine] || 0) + 1; });
    return res.json({
      totaleDocumenti: righe.length,
      perOrigine,
      anomalie: calcolaAnomalie(righe),
      ultimaConsegna: await ConsegnaCommercialista.findOne().sort({ preparataIl: -1 }).select('preparataIl stato periodoDal periodoAl').lean(),
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore anteprima', error: error.message });
  }
});

// POST /api/amministrazione/commercialista/consegne — registra una preparazione
router.post('/commercialista/consegne', authenticateToken, authorizeRole(...RUOLI_AMM), auditLog('amministrazione', 'CREATE'), async (req: AuthRequest, res: Response) => {
  try {
    const b = req.body || {};
    const dal = b.dal ? String(b.dal) : undefined;
    const al = b.al ? String(b.al) : undefined;
    const righe = (await raccogliRighe()).filter(r => inPeriodo(r.data, dal, al));
    if (righe.length === 0) return res.status(400).json({ message: 'Nessun documento nel periodo selezionato' });
    const tipologie = [...new Set(righe.map(r => r.origine))];
    const consegna = await ConsegnaCommercialista.create({
      periodoDal: dal ? new Date(dal) : undefined,
      periodoAl: al ? new Date(al) : undefined,
      tipologie,
      documenti: righe.map(r => ({ origine: r.origine, rifId: r.id, numero: r.numero, soggetto: r.soggetto, data: r.data, totale: r.totale, aggiornatoIl: r.aggiornatoIl })),
      anomalie: calcolaAnomalie(righe),
      preparataDa: (req as any).user?.name || undefined,
      note: String(b.note || '').trim().slice(0, 1000) || undefined,
    });
    return res.status(201).json(consegna);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore registrazione preparazione', error: error.message });
  }
});

// GET /api/amministrazione/commercialista/consegne — registro consegne
router.get('/commercialista/consegne', authenticateToken, authorizeRole(...RUOLI_AMM), async (_req: Request, res: Response) => {
  try {
    const consegne = await ConsegnaCommercialista.find().select('-documenti').sort({ preparataIl: -1 }).limit(50).lean();
    return res.json(consegne);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore caricamento consegne', error: error.message });
  }
});

// PATCH /api/amministrazione/commercialista/consegne/:id — marca consegna/verifica
router.patch('/commercialista/consegne/:id', authenticateToken, authorizeRole(...RUOLI_AMM), auditLog('amministrazione', 'UPDATE', req => req.params.id), async (req: AuthRequest, res: Response) => {
  try {
    const consegna = await ConsegnaCommercialista.findById(req.params.id);
    if (!consegna) return res.status(404).json({ message: 'Consegna non trovata' });
    const stato = String(req.body?.stato || '');
    if (!['consegnata', 'verificata'].includes(stato)) {
      return res.status(400).json({ message: 'Stato non valido (consegnata | verificata)' });
    }
    consegna.stato = stato as any;
    if (stato === 'consegnata') {
      consegna.consegnataIl = new Date();
      consegna.consegnataDa = (req as any).user?.name || undefined;
      consegna.modalitaConsegna = String(req.body?.modalitaConsegna || '').trim().slice(0, 120) || undefined;
    }
    await consegna.save();
    return res.json(consegna);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore aggiornamento consegna', error: error.message });
  }
});

// GET /api/amministrazione/commercialista/consegne/:id/differenze — documenti
// aggiunti o modificati DOPO questa preparazione (stesso periodo)
router.get('/commercialista/consegne/:id/differenze', authenticateToken, authorizeRole(...RUOLI_AMM), async (req: Request, res: Response) => {
  try {
    const consegna = await ConsegnaCommercialista.findById(req.params.id);
    if (!consegna) return res.status(404).json({ message: 'Consegna non trovata' });
    const dal = consegna.periodoDal ? consegna.periodoDal.toISOString() : undefined;
    const al = consegna.periodoAl ? consegna.periodoAl.toISOString() : undefined;
    const righe = (await raccogliRighe()).filter(r => inPeriodo(r.data, dal, al));
    const snapshot = new Map(consegna.documenti.map(d => [d.rifId, d]));
    const nuovi: any[] = [];
    const modificati: any[] = [];
    righe.forEach(r => {
      const s = snapshot.get(r.id);
      if (!s) { if (r.creatoIl && new Date(r.creatoIl) > consegna.preparataIl) nuovi.push(r); }
      else if (r.aggiornatoIl && s.aggiornatoIl && new Date(r.aggiornatoIl) > new Date(s.aggiornatoIl)) modificati.push(r);
    });
    return res.json({ nuovi: nuovi.slice(0, 100), modificati: modificati.slice(0, 100) });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore confronto consegna', error: error.message });
  }
});

// GET /api/amministrazione/commercialista/consegne/:id/csv — riepilogo CSV
// (formato base concordabile col commercialista; i PDF restano scaricabili
// dalle gestioni dedicate o dagli allegati)
router.get('/commercialista/consegne/:id/csv', authenticateToken, authorizeRole(...RUOLI_AMM), async (req: Request, res: Response) => {
  try {
    const consegna = await ConsegnaCommercialista.findById(req.params.id).lean();
    if (!consegna) return res.status(404).json({ message: 'Consegna non trovata' });
    const escCsv = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const righe = consegna.documenti.map(d =>
      [d.origine, d.numero, d.soggetto, d.data ? new Date(d.data).toLocaleDateString('it-IT') : '', (d.totale ?? '').toString().replace('.', ',')]
        .map(escCsv).join(';'));
    const csv = ['"origine";"numero";"soggetto";"data";"totale"', ...righe].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="commercialista-${consegna._id}.csv"`);
    return res.send('﻿' + csv);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore esportazione CSV', error: error.message });
  }
});

export default router;
