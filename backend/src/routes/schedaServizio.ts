import { Router, Request, Response } from 'express';
import SchedaServizio from '../models/SchedaServizio';
import PatientDocument from '../models/PatientDocument';
import Patient from '../models/Patient';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/scheda-servizio — Invia nuova scheda (paziente_registrato o pubblico)
// ═══════════════════════════════════════════════════════════════════════════
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const {
      nomeCognomePaziente,
      dataNascita,
      tipoPrestazione,
      frequenzaPrestazione,
      giorniContinuata,
      operatoreIncaricato,
      costoPrestazione,
      ivaPercentuale,
      metodoPagamento,
      frequenzaPagamento,
      pagamentoEffettuato,
      firmaBase64,
      nomeFirmatario,
      ruoloFirmatario,
      pazienteId,
    } = req.body;

    if (!nomeCognomePaziente || !dataNascita || !tipoPrestazione || !frequenzaPrestazione ||
        !metodoPagamento || !frequenzaPagamento || !firmaBase64 || !nomeFirmatario || !ruoloFirmatario) {
      return res.status(400).json({ message: 'Tutti i campi obbligatori devono essere compilati' });
    }
    if (costoPrestazione === undefined || costoPrestazione === null) {
      return res.status(400).json({ message: 'Il costo della prestazione è obbligatorio' });
    }

    const scheda = await SchedaServizio.create({
      pazienteId: pazienteId || undefined,
      compilataDa: user.userId,
      nomeCognomePaziente: nomeCognomePaziente.trim(),
      dataNascita: dataNascita.trim(),
      tipoPrestazione: tipoPrestazione.trim(),
      frequenzaPrestazione,
      giorniContinuata: giorniContinuata || undefined,
      operatoreIncaricato: operatoreIncaricato?.trim() || undefined,
      costoPrestazione: Number(costoPrestazione),
      ivaPercentuale: Number(ivaPercentuale) || 0,
      metodoPagamento,
      frequenzaPagamento,
      pagamentoEffettuato: !!pagamentoEffettuato,
      firmaBase64,
      nomeFirmatario: nomeFirmatario.trim(),
      ruoloFirmatario,
      stato: 'inviata',
    });

    return res.status(201).json({ message: 'Scheda inviata con successo', scheda });
  } catch (err: any) {
    return res.status(500).json({ message: 'Errore invio scheda', error: err?.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/scheda-servizio — Tutte le schede (admin/coordinator)
// ═══════════════════════════════════════════════════════════════════════════
router.get('/', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const { stato } = req.query;
    const filter: any = {};
    if (stato) filter.stato = stato;
    const schede = await SchedaServizio.find(filter)
      .populate('pazienteId', 'firstName lastName')
      .populate('compilataDa', 'name email')
      .sort({ createdAt: -1 });
    return res.json(schede);
  } catch (err: any) {
    return res.status(500).json({ message: 'Errore recupero schede', error: err?.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/scheda-servizio/mie — Schede del paziente loggato
// ═══════════════════════════════════════════════════════════════════════════
router.get('/mie', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const schede = await SchedaServizio.find({ compilataDa: user.userId })
      .sort({ createdAt: -1 });
    return res.json(schede);
  } catch (err: any) {
    return res.status(500).json({ message: 'Errore recupero schede', error: err?.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /api/scheda-servizio/:id/accetta — Admin accetta la scheda
// ═══════════════════════════════════════════════════════════════════════════
router.patch('/:id/accetta', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const scheda = await SchedaServizio.findById(req.params.id);
    if (!scheda) return res.status(404).json({ message: 'Scheda non trovata' });
    scheda.stato = 'accettata';
    scheda.noteAdmin = req.body.noteAdmin?.trim() || undefined;
    await scheda.save();
    return res.json({ message: 'Scheda accettata', scheda });
  } catch (err: any) {
    return res.status(500).json({ message: 'Errore accettazione scheda', error: err?.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /api/scheda-servizio/:id/archivia — Admin archivia nella doc paziente
// ═══════════════════════════════════════════════════════════════════════════
router.patch('/:id/archivia', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { pazienteId, noteAdmin } = req.body;

    const scheda = await SchedaServizio.findById(req.params.id);
    if (!scheda) return res.status(404).json({ message: 'Scheda non trovata' });

    // Verifica che il paziente esista
    const targetPazienteId = pazienteId || scheda.pazienteId;
    if (!targetPazienteId) {
      return res.status(400).json({ message: 'Specificare il paziente a cui archiviare la scheda' });
    }
    const paziente = await Patient.findById(targetPazienteId);
    if (!paziente) return res.status(404).json({ message: 'Paziente non trovato' });

    // Genera PDF come HTML → Buffer di testo (conserviamo come text/html per visualizzazione)
    const htmlContent = generaHtmlScheda(scheda, paziente);
    const htmlBuffer = Buffer.from(htmlContent, 'utf-8');

    // Archivia come PatientDocument nella categoria cartella_clinica
    const documento = await PatientDocument.create({
      patient: targetPazienteId,
      category: 'cartella_clinica',
      title: `Scheda Servizi Assistenza Domiciliare — ${scheda.nomeCognomePaziente}`,
      description: `Prestazione: ${scheda.tipoPrestazione} | Firmato da: ${scheda.nomeFirmatario} (${scheda.ruoloFirmatario})`,
      fileName: `scheda-servizio-${scheda._id}.html`,
      contentType: 'text/html',
      data: htmlBuffer,
      uploadedBy: user.userId,
      uploadedByNome: user.name || user.email,
      dataCaricamento: new Date(),
    });

    scheda.stato = 'archiviata';
    scheda.pazienteId = targetPazienteId;
    scheda.archiviataDa = user.userId;
    scheda.dataArchiviazione = new Date();
    scheda.documentoArchiviatoId = documento._id as any;
    if (noteAdmin?.trim()) scheda.noteAdmin = noteAdmin.trim();
    await scheda.save();

    return res.json({ message: 'Scheda archiviata nella documentazione del paziente', scheda, documentoId: documento._id });
  } catch (err: any) {
    return res.status(500).json({ message: 'Errore archiviazione scheda', error: err?.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /api/scheda-servizio/:id/rifiuta — Admin rifiuta la scheda
// ═══════════════════════════════════════════════════════════════════════════
router.patch('/:id/rifiuta', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const scheda = await SchedaServizio.findById(req.params.id);
    if (!scheda) return res.status(404).json({ message: 'Scheda non trovata' });
    scheda.stato = 'rifiutata';
    scheda.noteAdmin = req.body.noteAdmin?.trim() || undefined;
    await scheda.save();
    return res.json({ message: 'Scheda rifiutata', scheda });
  } catch (err: any) {
    return res.status(500).json({ message: 'Errore rifiuto scheda', error: err?.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Helper: genera HTML della scheda per archiviazione
// ═══════════════════════════════════════════════════════════════════════════
function generaHtmlScheda(scheda: any, paziente: any): string {
  const freq: Record<string, string> = {
    singola: 'Singola', multipla: 'Multipla', continuata: 'Continuata'
  };
  const metodo: Record<string, string> = {
    contanti: 'Contanti', carta_credito: 'Carta di Credito', bonifico: 'Bonifico', altro: 'Altro'
  };
  const freqPag: Record<string, string> = {
    giornaliera: 'Giornaliera', settimanale: 'Settimanale', ogni_10_giorni: 'Ogni 10 giorni', mensile: 'Mensile'
  };
  const dataFirma = new Date(scheda.dataFirma).toLocaleDateString('it-IT');

  return `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">
  <title>Scheda Servizi Assistenza Domiciliare</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:13px;color:#111;margin:30px;max-width:750px}
    h1{font-size:20px;color:#1e4d8c;margin-bottom:4px;text-align:center}
    h2{font-size:11px;color:#6b7280;text-align:center;margin:0 0 24px;text-transform:uppercase;letter-spacing:1px}
    .section{margin-bottom:20px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}
    .section-title{background:#1e4d8c;color:white;padding:8px 14px;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.5px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:14px}
    .field label{font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:3px}
    .field span{font-size:13px;color:#111;font-weight:600}
    .firma-box{padding:14px;border-top:1px solid #e2e8f0}
    .firma-box img{max-width:220px;max-height:80px;border:1px solid #d1d5db;display:block;margin-top:8px}
    .badge{display:inline-block;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#dcfce7;color:#166534}
    .footer{margin-top:24px;font-size:10px;color:#9ca3af;border-top:1px solid #e2e8f0;padding-top:12px;text-align:center}
  </style></head><body>
  <h1>Scheda Servizi Assistenza Domiciliare</h1>
  <h2>Abbraccio Cure Domiciliari</h2>

  <div class="section">
    <div class="section-title">1. Dati del Paziente</div>
    <div class="grid">
      <div class="field"><label>Nome e Cognome</label><span>${scheda.nomeCognomePaziente}</span></div>
      <div class="field"><label>Data di nascita</label><span>${scheda.dataNascita}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">2. Dettagli della Prestazione</div>
    <div class="grid">
      <div class="field"><label>Tipo di prestazione</label><span>${scheda.tipoPrestazione}</span></div>
      <div class="field"><label>Frequenza</label><span>${freq[scheda.frequenzaPrestazione] || scheda.frequenzaPrestazione}${scheda.giorniContinuata ? ` — per ${scheda.giorniContinuata} giorni` : ''}</span></div>
      <div class="field"><label>Operatore incaricato</label><span>${scheda.operatoreIncaricato || '—'}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">3. Tariffa e Pagamento</div>
    <div class="grid">
      <div class="field"><label>Costo prestazione</label><span>€ ${Number(scheda.costoPrestazione).toFixed(2)}${scheda.ivaPercentuale ? ` + IVA ${scheda.ivaPercentuale}%` : ''}</span></div>
      <div class="field"><label>Metodo di pagamento</label><span>${metodo[scheda.metodoPagamento] || scheda.metodoPagamento}</span></div>
      <div class="field"><label>Frequenza pagamento</label><span>${freqPag[scheda.frequenzaPagamento] || scheda.frequenzaPagamento}</span></div>
      <div class="field"><label>Pagamento effettuato</label><span>${scheda.pagamentoEffettuato ? '✅ Sì' : '❌ No'}</span></div>
    </div>
    <div style="padding:8px 14px;font-size:11px;color:#6b7280;border-top:1px solid #f3f4f6">
      Intestato a: <strong>Abbraccio Cure Domiciliari</strong>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Firma del ${scheda.ruoloFirmatario === 'caregiver' ? 'Caregiver' : 'Paziente'}</div>
    <div class="firma-box">
      <div class="field"><label>Nome firmatario</label><span>${scheda.nomeFirmatario} (${scheda.ruoloFirmatario})</span></div>
      <div class="field" style="margin-top:10px"><label>Data firma</label><span>${dataFirma}</span></div>
      <img src="${scheda.firmaBase64}" alt="Firma" />
    </div>
  </div>

  <div class="footer">
    Documento generato automaticamente — App Abbraccio Cure Domiciliari — ${new Date().toLocaleString('it-IT')}
  </div>
  </body></html>`;
}

export default router;
