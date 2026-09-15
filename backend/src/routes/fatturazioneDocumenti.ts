import { Router, Request, Response } from 'express';
import DocumentoFatturazione from '../models/DocumentoFatturazione';
import Patient from '../models/Patient';
import User from '../models/User';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import { generaDocumentoPDF } from '../utils/fatturazionePdf';
import { inviaEmail } from '../utils/email';
import crypto from 'crypto';

const router = Router();

const RUOLI_GESTIONE = ['admin', 'coordinator', 'direttore'];

// ─── Numerazione progressiva per tipo + anno ───────────────────────────────────
async function generaNumero(tipo: 'preventivo' | 'fattura'): Promise<string> {
  const anno = new Date().getFullYear();
  const prefisso = tipo === 'preventivo' ? 'PREV' : 'FATT';
  const base = `${prefisso}-${anno}-`;
  const count = await DocumentoFatturazione.countDocuments({
    numero: { $regex: `^${base}` },
  });
  let progressivo = count + 1;
  let numero = `${base}${String(progressivo).padStart(5, '0')}`;
  while (await DocumentoFatturazione.exists({ numero })) {
    progressivo++;
    numero = `${base}${String(progressivo).padStart(5, '0')}`;
  }
  return numero;
}

// GET /api/fatturazione-documenti — lista (filtro per paziente opzionale)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { patient, tipo } = req.query;
    const filtro: any = {};
    if (patient) filtro.patient = patient;
    if (tipo) filtro.tipo = tipo;
    const documenti = await DocumentoFatturazione.find(filtro)
      .populate('patient', 'firstName lastName codiceFiscale address email')
      .sort({ data: -1 });
    return res.json(documenti);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel caricamento dei documenti', error: error.message });
  }
});

// GET /api/fatturazione-documenti/:id — dettaglio singolo documento
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const doc = await DocumentoFatturazione.findById(req.params.id).populate('patient', 'firstName lastName codiceFiscale address email');
    if (!doc) return res.status(404).json({ message: 'Documento non trovato' });
    return res.json(doc);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel caricamento del documento', error: error.message });
  }
});

// POST /api/fatturazione-documenti — crea un preventivo o una fattura (solo gestione)
router.post('/', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('fatturazione_documenti', 'CREATE'), async (req: AuthRequest, res: Response) => {
  try {
    const { tipo, patient, prestazioni, riferimentoTipo, riferimentoId, dataPrestazione, note, numero: numeroManuale } = req.body;

    if (!tipo || !['preventivo', 'fattura'].includes(tipo)) {
      return res.status(400).json({ message: "Il campo 'tipo' deve essere 'preventivo' o 'fattura'" });
    }
    if (!patient) return res.status(400).json({ message: 'Paziente obbligatorio' });
    if (!Array.isArray(prestazioni) || prestazioni.length === 0) {
      return res.status(400).json({ message: 'Specificare almeno una prestazione' });
    }

    const pazienteEsiste = await Patient.findById(patient);
    if (!pazienteEsiste) return res.status(404).json({ message: 'Paziente non trovato' });

    const prestazioniNormalizzate = prestazioni.map((p: any) => {
      const quantita = Number(p.quantita) > 0 ? Number(p.quantita) : 1;
      const prezzoUnitario = Number(p.prezzoUnitario) || 0;
      return {
        descrizione: String(p.descrizione || '').trim(),
        quantita,
        prezzoUnitario,
        importo: Math.round(quantita * prezzoUnitario * 100) / 100,
      };
    }).filter((p: any) => p.descrizione);

    if (prestazioniNormalizzate.length === 0) {
      return res.status(400).json({ message: 'Le prestazioni indicate non sono valide' });
    }

    const totale = Math.round(prestazioniNormalizzate.reduce((acc: number, p: any) => acc + p.importo, 0) * 100) / 100;
    const user = req.user as { name?: string; email?: string } | undefined;
    const numero = numeroManuale && numeroManuale.trim() ? String(numeroManuale).trim().toUpperCase() : await generaNumero(tipo);

    const doc = await DocumentoFatturazione.create({
      numero,
      tipo,
      patient,
      riferimentoTipo,
      riferimentoId: riferimentoId || undefined,
      prestazioni: prestazioniNormalizzate,
      totale,
      data: new Date(),
      dataPrestazione: dataPrestazione ? new Date(dataPrestazione) : undefined,
      stato: 'emesso',
      note: note,
      creatoDa: user?.name || user?.email || 'Sistema',
    });

    const docPopolato = await DocumentoFatturazione.findById(doc._id).populate('patient', 'firstName lastName codiceFiscale address email');
    return res.status(201).json(docPopolato);
  } catch (error: any) {
    console.error('[Fatturazione POST] Errore creazione documento:', error);
    return res.status(500).json({ message: `Errore nella creazione del documento: ${error?.message || 'sconosciuto'}`, error: error.message });
  }
});

// POST /api/fatturazione-documenti/:id/converti-in-fattura — genera una fattura a partire da un preventivo accettato
router.post('/:id/converti-in-fattura', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('fatturazione_documenti', 'CREATE'), async (req: AuthRequest, res: Response) => {
  try {
    const preventivo = await DocumentoFatturazione.findById(req.params.id);
    if (!preventivo) return res.status(404).json({ message: 'Preventivo non trovato' });
    if (preventivo.tipo !== 'preventivo') return res.status(400).json({ message: 'Il documento indicato non è un preventivo' });

    const numero = await generaNumero('fattura');
    const user = req.user as { name?: string; email?: string } | undefined;

    const fattura = await DocumentoFatturazione.create({
      numero,
      tipo: 'fattura',
      patient: preventivo.patient,
      riferimentoTipo: preventivo.riferimentoTipo,
      riferimentoId: preventivo.riferimentoId,
      prestazioni: preventivo.prestazioni,
      totale: preventivo.totale,
      data: new Date(),
      dataPrestazione: preventivo.dataPrestazione,
      stato: 'emesso',
      note: preventivo.note,
      creatoDa: user?.name || user?.email || 'Sistema',
      documentoOrigineId: preventivo._id,
      firma: {
        rifiutoRegistro: preventivo.firma?.rifiutoRegistro ?? false,
      },
    });

    const fatturaPopolata = await DocumentoFatturazione.findById(fattura._id).populate('patient', 'firstName lastName codiceFiscale address email');
    return res.status(201).json(fatturaPopolata);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nella conversione in fattura', error: error.message });
  }
});

// GET /api/fatturazione-documenti/firma/:token — verifica link firma
router.get('/firma/:token', async (req: Request, res: Response) => {
  try {
    const doc = await DocumentoFatturazione.findOne({ 'firma.token': req.params.token })
      .populate('patient', 'firstName lastName codiceFiscale address email')
      .lean();
    if (!doc) return res.status(404).json({ message: 'Link non valido o scaduto' });
    if (doc.firma?.firmato) return res.status(400).json({ message: 'Documento già firmato', giaFirmato: true });
    return res.json({
      tipo: doc.tipo,
      numero: doc.numero,
      totale: doc.totale,
      data: doc.data,
      dataPrestazione: doc.dataPrestazione,
      patient: doc.patient,
      note: doc.note,
      giaFirmato: false,
      rifiutoRegistro: doc.firma?.rifiutoRegistro ?? null,
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore verifica link', error: error.message });
  }
});

// GET /api/fatturazione-documenti/firma/:token/pdf — scarica PDF del link firma (pubblico con token)
router.get('/firma/:token/pdf', async (req: Request, res: Response) => {
  try {
    const doc = await DocumentoFatturazione.findOne({ 'firma.token': req.params.token })
      .populate('patient', 'firstName lastName codiceFiscale address email')
      .lean();
    if (!doc) {
      res.setHeader('Content-Type', 'text/plain');
      return res.status(404).end('Documento non trovato');
    }

    const buffer = await generaDocumentoPDF(doc);
    const filename = `${doc.tipo === 'fattura' ? 'FATTURA' : 'PREVENTIVO'}-${doc.numero}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.send(buffer);
  } catch (error: any) {
    console.error('[Fatturazione firma PDF] Errore:', error);
    res.setHeader('Content-Type', 'text/plain');
    return res.status(500).end('Errore nella generazione del PDF');
  }
});

// POST /api/fatturazione-documenti/firma/:token — salva firma e rifiuto
router.post('/firma/:token', async (req: Request, res: Response) => {
  try {
    const { firmaImg, rifiutoRegistro, nome } = req.body;
    if (!firmaImg) return res.status(400).json({ message: 'Firma obbligatoria' });

    const docMongoose = await DocumentoFatturazione.findOne({ 'firma.token': req.params.token })
      .populate('patient', 'firstName lastName codiceFiscale address email');
    if (!docMongoose) return res.status(404).json({ message: 'Link non valido o scaduto' });
    if (docMongoose.firma?.firmato) return res.status(400).json({ message: 'Documento già firmato' });

    docMongoose.firma = {
      ...((docMongoose.firma as any) || {}),
      firmato: true,
      firmatoIl: new Date(),
      firmaImg,
      rifiutoRegistro: rifiutoRegistro !== undefined ? !!rifiutoRegistro : (docMongoose.firma?.rifiutoRegistro ?? false),
      nome: nome || docMongoose.firma?.nome,
    };
    docMongoose.stato = 'firmato';
    await docMongoose.save();

    const doc: any = docMongoose.toJSON();
    const unsignedDoc = { ...doc, firma: { ...doc.firma, firmato: false, firmaImg: undefined } };
    const unsignedBuffer = await generaDocumentoPDF(unsignedDoc);
    const label = doc.tipo === 'fattura' ? 'Fattura' : 'Preventivo';
    const filename = `${label.toUpperCase()}-${doc.numero}.pdf`;
    const nomeDestinatario = doc.firma?.nome || 'Cliente';

    if (doc.firma?.email) {
      const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
        <h2 style="color:#1e4d8c;margin-top:0;">${label} ${doc.numero}</h2>
        <p>Gentile <strong>${nomeDestinatario}</strong>,</p>
        <p>in allegato trovi la copia del <strong>${label.toLowerCase()}</strong> n. ${doc.numero} del ${new Date(doc.data).toLocaleDateString('it-IT')}.</p>
        <p style="margin-top:24px;font-size:12px;color:#888;">Abbraccio Cure Domiciliari S.R.L.S.</p>
      </div>`;

      await inviaEmail({
        to: doc.firma.email,
        subject: `Copia ${label} ${doc.numero} — Abbraccio Cure Domiciliari`,
        html,
        attachments: [{ filename, content: unsignedBuffer, contentType: 'application/pdf' }],
      });
    }

    // Notifica operatore: contratto arrivato e firmato
    let operatoreEmail = doc.creatoDa && doc.creatoDa.includes('@') ? doc.creatoDa : '';
    if (!operatoreEmail && doc.creatoDa) {
      const userDoc = await User.findOne({ name: doc.creatoDa });
      if (userDoc) operatoreEmail = userDoc.email;
    }
    if (operatoreEmail) {
      const nomePaziente = doc.patient?.firstName && doc.patient?.lastName
        ? `${doc.patient.firstName} ${doc.patient.lastName}`
        : 'Paziente';
      const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
        <h2 style="color:#16a34a;margin-top:0;">Contratto arrivato — ${label} ${doc.numero}</h2>
        <p>Il ${label.toLowerCase()} n. <strong>${doc.numero}</strong> relativo a <strong>${nomePaziente}</strong> è stato firmato ed archiviato.</p>
        <p>Totale: <strong>€${Number(doc.totale).toFixed(2)}</strong></p>
        <p style="margin-top:24px;font-size:12px;color:#888;">Abbraccio Cure Domiciliari S.R.L.S.</p>
      </div>`;
      await inviaEmail({
        to: operatoreEmail,
        subject: `Contratto arrivato — ${label} ${doc.numero} firmato`,
        html,
      });
    }

    return res.json({ message: 'Documento firmato con successo' });
  } catch (error: any) {
    console.error('[Fatturazione firma] Errore:', error);
    return res.status(500).json({ message: 'Errore salvataggio firma', error: error.message });
  }
});

// GET /api/fatturazione-documenti/:id/pdf — scarica il PDF
router.get('/:id/pdf', authenticateToken, async (req: Request, res: Response) => {
  try {
    const doc = await DocumentoFatturazione.findById(req.params.id)
      .populate('patient', 'firstName lastName codiceFiscale address email')
      .lean();
    if (!doc) return res.status(404).json({ message: 'Documento non trovato' });

    const buffer = await generaDocumentoPDF(doc);
    const filename = `${doc.tipo === 'fattura' ? 'FATTURA' : 'PREVENTIVO'}-${doc.numero}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (error: any) {
    console.error('[Fatturazione PDF] Errore:', error);
    return res.status(500).json({ message: 'Errore nella generazione del PDF', error: error.message });
  }
});

// GET /api/fatturazione-documenti/:id/firmato — scarica il PDF firmato
router.get('/:id/firmato', authenticateToken, async (req: Request, res: Response) => {
  try {
    const doc = await DocumentoFatturazione.findById(req.params.id)
      .populate('patient', 'firstName lastName codiceFiscale address email')
      .lean();
    if (!doc) return res.status(404).json({ message: 'Documento non trovato' });
    if (!doc.firma?.firmato) return res.status(400).json({ message: 'Documento non ancora firmato' });

    const buffer = await generaDocumentoPDF(doc);
    const filename = `${doc.tipo === 'fattura' ? 'FATTURA' : 'PREVENTIVO'}-${doc.numero}-firmato.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (error: any) {
    console.error('[Fatturazione firmato] Errore:', error);
    return res.status(500).json({ message: 'Errore nella generazione del PDF firmato', error: error.message });
  }
});

// POST /api/fatturazione-documenti/:id/invia-email — invia PDF a paziente/caregiver
router.post('/:id/invia-email', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('fatturazione_documenti', 'UPDATE'), async (req: AuthRequest, res: Response) => {
  try {
    const { email, nome } = req.body;
    if (!email) return res.status(400).json({ message: 'Email obbligatoria' });

    const docMongoose = await DocumentoFatturazione.findById(req.params.id)
      .populate('patient', 'firstName lastName codiceFiscale address email');
    if (!docMongoose) return res.status(404).json({ message: 'Documento non trovato' });

    const token = crypto.randomBytes(32).toString('hex');
    docMongoose.firma = {
      ...(docMongoose.firma || {}),
      token,
      firmato: false,
      email,
      nome: nome || `${(docMongoose.patient as any)?.firstName || ''} ${(docMongoose.patient as any)?.lastName || ''}`.trim() || 'Cliente',
    };
    await docMongoose.save();

    const doc: any = docMongoose.toJSON();
    const buffer = await generaDocumentoPDF(doc);
    const filename = `${doc.tipo === 'fattura' ? 'FATTURA' : 'PREVENTIVO'}-${doc.numero}.pdf`;
    const label = doc.tipo === 'fattura' ? 'Fattura' : 'Preventivo';
    const nomeDestinatario = doc.firma?.nome || 'Cliente';
    const frontendUrl = process.env.FRONTEND_URL || 'https://app.abbracciocuredomiciliari.it';
    const aziendaPec = process.env.AZIENDA_PEC || 'abbracciocuredomiciliari@facilepec.com';
    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
      <h2 style="color:#1e4d8c;margin-top:0;">${label} ${doc.numero}</h2>
      <p>Gentile <strong>${nomeDestinatario}</strong>,</p>
      <p>in allegato trovi la copia del <strong>${label.toLowerCase()}</strong> emesso il ${new Date(doc.data).toLocaleDateString('it-IT')}.</p>
      <p style="margin:16px 0;padding:16px;background:#eff6ff;border-left:4px solid #1e4d8c;border-radius:6px;">
        Per firmare il documento <strong>online con dito o penna</strong> clicca qui:<br/>
        <a href="${frontendUrl}/firma-documento?token=${token}" style="display:inline-block;margin-top:8px;background:#1e4d8c;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Firma ${label}</a>
      </p>
      <p>Per qualsiasi informazione puoi contattarci all'indirizzo PEC ${aziendaPec}.</p>
      <p style="margin-top:24px;font-size:12px;color:#888;">Abbraccio Cure Domiciliari S.R.L.S.</p>
    </div>`;

    await inviaEmail({
      to: email,
      subject: `${label} ${doc.numero} — Abbraccio Cure Domiciliari`,
      html,
      attachments: [{ filename, content: buffer, contentType: 'application/pdf' }],
    });

    return res.json({ message: `${label} inviata con successo a ${email}` });
  } catch (error: any) {
    console.error('[Fatturazione invia-email] Errore:', error);
    return res.status(500).json({ message: "Errore nell'invio dell'email", error: error.message });
  }
});

// POST /api/fatturazione-documenti/:id/rinvia-email — rispedisce la copia senza firma
router.post('/:id/rinvia-email', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('fatturazione_documenti', 'UPDATE'), async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body;
    const docMongoose = await DocumentoFatturazione.findById(req.params.id)
      .populate('patient', 'firstName lastName codiceFiscale address email');
    if (!docMongoose) return res.status(404).json({ message: 'Documento non trovato' });

    const toEmail = email || docMongoose.firma?.email;
    if (!toEmail) return res.status(400).json({ message: 'Email destinatario obbligatoria' });

    const doc: any = docMongoose.toJSON();
    const unsignedDoc = { ...doc, firma: { ...doc.firma, firmato: false, firmaImg: undefined } };
    const buffer = await generaDocumentoPDF(unsignedDoc);
    const label = doc.tipo === 'fattura' ? 'Fattura' : 'Preventivo';
    const filename = `${label.toUpperCase()}-${doc.numero}.pdf`;
    const nomeDestinatario = doc.firma?.nome || 'Cliente';

    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
      <h2 style="color:#1e4d8c;margin-top:0;">${label} ${doc.numero}</h2>
      <p>Gentile <strong>${nomeDestinatario}</strong>,</p>
      <p>in allegato trovi la copia del <strong>${label.toLowerCase()}</strong> n. ${doc.numero} del ${new Date(doc.data).toLocaleDateString('it-IT')}.</p>
      <p style="margin-top:24px;font-size:12px;color:#888;">Abbraccio Cure Domiciliari S.R.L.S.</p>
    </div>`;

    await inviaEmail({
      to: toEmail,
      subject: `Copia ${label} ${doc.numero} — Abbraccio Cure Domiciliari`,
      html,
      attachments: [{ filename, content: buffer, contentType: 'application/pdf' }],
    });

    return res.json({ message: `${label} rispedita con successo a ${toEmail}` });
  } catch (error: any) {
    console.error('[Fatturazione rinvia-email] Errore:', error);
    return res.status(500).json({ message: "Errore nell'invio dell'email", error: error.message });
  }
});

// PATCH /api/fatturazione-documenti/:id/numero — modifica il numero progressivo
router.patch('/:id/numero', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('fatturazione_documenti', 'UPDATE'), async (req: Request, res: Response) => {
  try {
    const { numero } = req.body;
    if (!numero || !String(numero).trim()) {
      return res.status(400).json({ message: 'Numero obbligatorio' });
    }
    const nuovoNumero = String(numero).trim().toUpperCase();
    const esiste = await DocumentoFatturazione.findOne({ numero: nuovoNumero, _id: { $ne: req.params.id } });
    if (esiste) {
      return res.status(409).json({ message: 'Numero già in uso' });
    }
    const doc = await DocumentoFatturazione.findByIdAndUpdate(req.params.id, { numero: nuovoNumero }, { new: true });
    if (!doc) return res.status(404).json({ message: 'Documento non trovato' });
    return res.json(doc);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nella modifica del numero', error: error.message });
  }
});

// PUT /api/fatturazione-documenti/:id — modifica voci e totale (solo gestione, documento emesso)
router.put('/:id', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('fatturazione_documenti', 'UPDATE'), async (req: Request, res: Response) => {
  try {
    const { prestazioni, note } = req.body;
    const doc = await DocumentoFatturazione.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Documento non trovato' });
    if (doc.stato !== 'emesso') {
      return res.status(400).json({ message: 'Solo i documenti emessi possono essere modificati' });
    }
    if (!Array.isArray(prestazioni) || prestazioni.length === 0) {
      return res.status(400).json({ message: 'Specificare almeno una prestazione' });
    }
    const prestazioniNormalizzate = prestazioni.map((p: any) => {
      const quantita = Number(p.quantita) > 0 ? Number(p.quantita) : 1;
      const prezzoUnitario = Number(p.prezzoUnitario) || 0;
      return {
        descrizione: String(p.descrizione || '').trim(),
        quantita,
        prezzoUnitario,
        importo: Math.round(quantita * prezzoUnitario * 100) / 100,
      };
    }).filter((p: any) => p.descrizione);
    if (prestazioniNormalizzate.length === 0) {
      return res.status(400).json({ message: 'Le prestazioni indicate non sono valide' });
    }
    const totale = Math.round(prestazioniNormalizzate.reduce((acc: number, p: any) => acc + p.importo, 0) * 100) / 100;
    doc.prestazioni = prestazioniNormalizzate;
    doc.totale = totale;
    if (note !== undefined) doc.note = note;
    await doc.save();
    const docPopolato = await DocumentoFatturazione.findById(doc._id).populate('patient', 'firstName lastName codiceFiscale address email');
    return res.json(docPopolato);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nella modifica del documento', error: error.message });
  }
});

// PATCH /api/fatturazione-documenti/:id/annulla — annulla un documento (solo gestione)
router.patch('/:id/annulla', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('fatturazione_documenti', 'UPDATE'), async (req: Request, res: Response) => {
  try {
    const doc = await DocumentoFatturazione.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Documento non trovato' });
    if (doc.stato !== 'emesso' && doc.stato !== 'firmato') {
      return res.status(400).json({ message: 'Documento non annullabile: stato non valido' });
    }
    doc.stato = 'annullato';
    await doc.save();
    return res.json(doc);
  } catch (error: any) {
    return res.status(500).json({ message: "Errore nell'annnullamento del documento", error: error.message });
  }
});

// DELETE /api/fatturazione-documenti/:id — elimina fisicamente un documento (solo admin)
router.delete('/:id', authenticateToken, authorizeRole('admin'), auditLog('fatturazione_documenti', 'DELETE'), async (req: Request, res: Response) => {
  try {
    const doc = await DocumentoFatturazione.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Documento non trovato' });
    await DocumentoFatturazione.findByIdAndDelete(req.params.id);
    return res.json({ message: 'Documento eliminato definitivamente' });
  } catch (error: any) {
    return res.status(500).json({ message: "Errore nell'eliminazione del documento", error: error.message });
  }
});

export default router;
