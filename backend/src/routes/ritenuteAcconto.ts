import { Router, Request, Response } from 'express';
import RitenutaAcconto from '../models/RitenutaAcconto';
import DocumentoProfessionista from '../models/DocumentoProfessionista';
import Staff from '../models/Staff';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import { generaRitenutaPDF } from '../utils/ritenutaPdf';
import { inviaEmail } from '../utils/email';
import crypto from 'crypto';

const router = Router();

const RUOLI_GESTIONE = ['admin', 'coordinator', 'direttore'];

function arrotonda2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function calcolaImporti(importoLordo: number, percentualeRitenuta: number, importoBollo: number) {
  const lordo = arrotonda2(importoLordo);
  const ritenuta = arrotonda2(lordo * (percentualeRitenuta / 100));
  const bollo = arrotonda2(importoBollo);
  const netto = arrotonda2(lordo - ritenuta + bollo);
  return { importoLordo: lordo, percentualeRitenuta, importoRitenuta: ritenuta, importoBollo: bollo, nettoAPagare: netto };
}

async function generaNumero(): Promise<string> {
  const anno = new Date().getFullYear();
  const base = `RIT-${anno}-`;
  const count = await RitenutaAcconto.countDocuments({ numero: { $regex: `^${base}` } });
  let progressivo = count + 1;
  let numero = `${base}${String(progressivo).padStart(5, '0')}`;
  while (await RitenutaAcconto.exists({ numero })) {
    progressivo++;
    numero = `${base}${String(progressivo).padStart(5, '0')}`;
  }
  return numero;
}

function getDatiProfessionista(ritenuta: any) {
  return ritenuta.datiProfessionista || {};
}

// GET /api/ritenute-acconto — lista
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { stato } = req.query;
    const filtro: any = {};
    if (stato) filtro.stato = stato;
    const docs = await RitenutaAcconto.find(filtro)
      .populate('professionistaId', 'firstName lastName email')
      .sort({ data: -1 });
    return res.json(docs);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore caricamento ritenute', error: error.message });
  }
});

// GET /api/ritenute-acconto/:id — dettaglio
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const doc = await RitenutaAcconto.findById(req.params.id).populate('professionistaId', 'firstName lastName email');
    if (!doc) return res.status(404).json({ message: 'Ritenuta non trovata' });
    return res.json(doc);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore caricamento ritenuta', error: error.message });
  }
});

// POST /api/ritenute-acconto — crea
router.post('/', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('ritenuta_acconto', 'CREATE'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      professionistaId,
      datiProfessionista,
      descrizione,
      importoLordo,
      percentualeRitenuta = 20,
      importoBollo = 0,
      numeroDocumentoProfessionista,
    } = req.body;

    if (!datiProfessionista || !datiProfessionista.firstName || !datiProfessionista.lastName) {
      return res.status(400).json({ message: 'Dati professionista obbligatori (nome e cognome)' });
    }
    if (Number(importoLordo) <= 0) {
      return res.status(400).json({ message: 'Importo lordo obbligatorio e maggiore di zero' });
    }

    const calcolati = calcolaImporti(Number(importoLordo), Number(percentualeRitenuta), Number(importoBollo));
    const user = req.user as { name?: string; email?: string } | undefined;
    const numero = await generaNumero();

    const doc = await RitenutaAcconto.create({
      numero,
      professionistaId: professionistaId || undefined,
      datiProfessionista: {
        firstName: String(datiProfessionista.firstName).trim(),
        lastName: String(datiProfessionista.lastName).trim(),
        codiceFiscale: String(datiProfessionista.codiceFiscale || '').trim() || undefined,
        partitaIva: String(datiProfessionista.partitaIva || '').trim() || undefined,
        indirizzo: String(datiProfessionista.indirizzo || '').trim() || undefined,
        citta: String(datiProfessionista.citta || '').trim() || undefined,
        email: String(datiProfessionista.email || '').trim().toLowerCase() || undefined,
      },
      descrizione: String(descrizione || '').trim() || undefined,
      numeroDocumentoProfessionista: String(numeroDocumentoProfessionista || '').trim() || undefined,
      ...calcolati,
      stato: 'emesso',
    });

    const docPopolato = await RitenutaAcconto.findById(doc._id).populate('professionistaId', 'firstName lastName email');
    return res.status(201).json(docPopolato);
  } catch (error: any) {
    console.error('[Ritenuta POST] Errore:', error);
    return res.status(500).json({ message: 'Errore creazione ritenuta', error: error.message });
  }
});

// PUT /api/ritenute-acconto/:id — modifica solo in stato emesso
router.put('/:id', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('ritenuta_acconto', 'UPDATE'), async (req: AuthRequest, res: Response) => {
  try {
    const doc = await RitenutaAcconto.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Ritenuta non trovata' });
    if (doc.stato !== 'emesso') return res.status(400).json({ message: 'Solo le ritenute emesse possono essere modificate' });

    const { professionistaId, datiProfessionista, descrizione, importoLordo, percentualeRitenuta, importoBollo, numeroDocumentoProfessionista } = req.body;

    if (datiProfessionista) {
      doc.datiProfessionista = {
        firstName: String(datiProfessionista.firstName || doc.datiProfessionista.firstName).trim(),
        lastName: String(datiProfessionista.lastName || doc.datiProfessionista.lastName).trim(),
        codiceFiscale: String(datiProfessionista.codiceFiscale || doc.datiProfessionista.codiceFiscale || '').trim() || undefined,
        partitaIva: String(datiProfessionista.partitaIva || doc.datiProfessionista.partitaIva || '').trim() || undefined,
        indirizzo: String(datiProfessionista.indirizzo || doc.datiProfessionista.indirizzo || '').trim() || undefined,
        citta: String(datiProfessionista.citta || doc.datiProfessionista.citta || '').trim() || undefined,
        email: String(datiProfessionista.email || doc.datiProfessionista.email || '').trim().toLowerCase() || undefined,
      };
    }
    if (professionistaId !== undefined) doc.professionistaId = professionistaId || undefined;
    if (descrizione !== undefined) doc.descrizione = String(descrizione).trim() || undefined;
    if (numeroDocumentoProfessionista !== undefined) doc.numeroDocumentoProfessionista = String(numeroDocumentoProfessionista).trim() || undefined;

    const lordo = importoLordo !== undefined ? Number(importoLordo) : doc.importoLordo;
    const perc = percentualeRitenuta !== undefined ? Number(percentualeRitenuta) : doc.percentualeRitenuta;
    const bollo = importoBollo !== undefined ? Number(importoBollo) : doc.importoBollo;

    const calcolati = calcolaImporti(lordo, perc, bollo);
    doc.importoLordo = calcolati.importoLordo;
    doc.percentualeRitenuta = calcolati.percentualeRitenuta;
    doc.importoRitenuta = calcolati.importoRitenuta;
    doc.importoBollo = calcolati.importoBollo;
    doc.nettoAPagare = calcolati.nettoAPagare;

    await doc.save();
    const docPopolato = await RitenutaAcconto.findById(doc._id).populate('professionistaId', 'firstName lastName email');
    return res.json(docPopolato);
  } catch (error: any) {
    console.error('[Ritenuta PUT] Errore:', error);
    return res.status(500).json({ message: 'Errore modifica ritenuta', error: error.message });
  }
});

// POST /api/ritenute-acconto/:id/invia-email — invia al professionista per firma
router.post('/:id/invia-email', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('ritenuta_acconto', 'UPDATE'), async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email obbligatoria' });

    const docMongoose = await RitenutaAcconto.findById(req.params.id);
    if (!docMongoose) return res.status(404).json({ message: 'Ritenuta non trovata' });
    if (docMongoose.stato !== 'emesso') return res.status(400).json({ message: 'Ritenuta già firmata o annullata' });

    const token = crypto.randomBytes(32).toString('hex');
    docMongoose.firma = {
      ...(docMongoose.firma || {}),
      token,
      firmato: false,
      email,
      nome: `${docMongoose.datiProfessionista.firstName || ''} ${docMongoose.datiProfessionista.lastName || ''}`.trim(),
    };
    await docMongoose.save();

    const doc: any = docMongoose.toJSON();
    const buffer = await generaRitenutaPDF(doc);
    const filename = `RITENUTA-${doc.numero}.pdf`;
    const frontendUrl = process.env.FRONTEND_URL || 'https://app.abbracciocuredomiciliari.it';
    const aziendaPec = process.env.AZIENDA_PEC || 'abbracciocuredomiciliari@facilepec.com';
    const nomeProf = `${doc.datiProfessionista.firstName} ${doc.datiProfessionista.lastName}`.trim();

    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
      <h2 style="color:#1e4d8c;margin-top:0;">Ritenuta d'acconto n. ${doc.numero}</h2>
      <p>Spett.le <strong>${nomeProf}</strong>,</p>
      <p>in allegato trovi la ritenuta d'acconto relativa al compenso da te dichiarato.</p>
      <p style="margin:16px 0;padding:16px;background:#eff6ff;border-left:4px solid #1e4d8c;border-radius:6px;">
        Per firmare il documento <strong>online con dito o penna</strong> clicca qui:<br/>
        <a href="${frontendUrl}/firma-ritenuta?token=${token}" style="display:inline-block;margin-top:8px;background:#1e4d8c;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Firma ritenuta</a>
      </p>
      <p>Per qualsiasi informazione puoi contattarci all'indirizzo PEC ${aziendaPec}.</p>
      <p style="margin-top:24px;font-size:12px;color:#888;">Abbraccio Cure Domiciliari S.R.L.S.</p>
    </div>`;

    await inviaEmail({
      to: email,
      subject: `Ritenuta d'acconto n. ${doc.numero} — Abbraccio Cure Domiciliari`,
      html,
      attachments: [{ filename, content: buffer, contentType: 'application/pdf' }],
    });

    return res.json({ message: `Ritenuta inviata con successo a ${email}` });
  } catch (error: any) {
    console.error('[Ritenuta invia-email] Errore:', error);
    return res.status(500).json({ message: "Errore nell'invio dell'email", error: error.message });
  }
});

// GET /api/ritenute-acconto/firma/:token — verifica link firma
router.get('/firma/:token', async (req: Request, res: Response) => {
  try {
    const doc = await RitenutaAcconto.findOne({ 'firma.token': req.params.token }).lean();
    if (!doc) return res.status(404).json({ message: 'Link non valido o scaduto' });
    if (doc.firma?.firmato) return res.status(400).json({ message: 'Documento già firmato', giaFirmato: true });
    return res.json({
      numero: doc.numero,
      data: doc.data,
      datiProfessionista: doc.datiProfessionista,
      importoLordo: doc.importoLordo,
      percentualeRitenuta: doc.percentualeRitenuta,
      importoRitenuta: doc.importoRitenuta,
      importoBollo: doc.importoBollo,
      nettoAPagare: doc.nettoAPagare,
      descrizione: doc.descrizione,
      numeroDocumentoProfessionista: doc.numeroDocumentoProfessionista,
      giaFirmato: false,
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore verifica link', error: error.message });
  }
});

// GET /api/ritenute-acconto/firma/:token/pdf — scarica PDF firma (pubblico)
router.get('/firma/:token/pdf', async (req: Request, res: Response) => {
  try {
    const doc = await RitenutaAcconto.findOne({ 'firma.token': req.params.token }).lean();
    if (!doc) return res.status(404).end('Documento non trovato');
    const buffer = await generaRitenutaPDF(doc, doc.firma?.firmato || false);
    const filename = `RITENUTA-${doc.numero}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.send(buffer);
  } catch (error: any) {
    console.error('[Ritenuta firma PDF] Errore:', error);
    return res.status(500).end('Errore nella generazione del PDF');
  }
});

// POST /api/ritenute-acconto/firma/:token — salva firma, archivia e invia copia
router.post('/firma/:token', async (req: Request, res: Response) => {
  try {
    const { firmaImg, nome } = req.body;
    if (!firmaImg) return res.status(400).json({ message: 'Firma obbligatoria' });

    const docMongoose = await RitenutaAcconto.findOne({ 'firma.token': req.params.token });
    if (!docMongoose) return res.status(404).json({ message: 'Link non valido o scaduto' });
    if (docMongoose.firma?.firmato) return res.status(400).json({ message: 'Documento già firmato' });

    docMongoose.firma = {
      ...((docMongoose.firma as any) || {}),
      firmato: true,
      firmatoIl: new Date(),
      firmaImg,
      nome: nome || docMongoose.firma?.nome,
    };
    docMongoose.stato = 'firmato';
    await docMongoose.save();

    const doc: any = docMongoose.toJSON();
    const signedBuffer = await generaRitenutaPDF(doc, true);

    // Archivia i documenti contabili
    const baseNum = doc.numero;
    const common = {
      ritenutaAccontoId: docMongoose._id,
      professionistaId: doc.professionistaId || undefined,
      datiProfessionista: doc.datiProfessionista,
      descrizione: doc.descrizione,
      importoLordo: doc.importoLordo,
      importoRitenuta: doc.importoRitenuta,
      importoBollo: doc.importoBollo,
      nettoAPagare: doc.nettoAPagare,
      contentType: 'application/pdf',
      data: doc.data,
      creatoDa: 'Sistema',
    };

    await DocumentoProfessionista.create({
      ...common,
      tipo: 'ritenuta_acconto',
      numero: baseNum,
      fileName: `RITENUTA-${baseNum}.pdf`,
      contenuto: signedBuffer,
    });
    await DocumentoProfessionista.create({
      ...common,
      tipo: 'ricevuta',
      numero: `RIC-${baseNum}`,
      fileName: `RICEVUTA-${baseNum}.pdf`,
      contenuto: signedBuffer,
    });
    await DocumentoProfessionista.create({
      ...common,
      tipo: 'fattura_ricevuta',
      numero: `FR-${baseNum}`,
      fileName: `FATTURA-RICEVUTA-${baseNum}.pdf`,
      contenuto: signedBuffer,
    });

    // Invia copia firmata al professionista
    if (doc.firma?.email || doc.datiProfessionista?.email) {
      const toEmail = doc.firma?.email || doc.datiProfessionista?.email;
      const nomeProf = `${doc.datiProfessionista.firstName || ''} ${doc.datiProfessionista.lastName || ''}`.trim();
      const htmlCopia = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
        <h2 style="color:#16a34a;margin-top:0;">Ritenuta d'acconto firmata</h2>
        <p>Spett.le <strong>${nomeProf}</strong>,</p>
        <p>in allegato trovi la copia firmata della ritenuta d'acconto n. <strong>${doc.numero}</strong>.</p>
        <p style="margin-top:24px;font-size:12px;color:#888;">Abbraccio Cure Domiciliari S.R.L.S.</p>
      </div>`;
      await inviaEmail({
        to: toEmail,
        subject: `Copia firmata — Ritenuta n. ${doc.numero}`,
        html: htmlCopia,
        attachments: [{ filename: `RITENUTA-${baseNum}-firmata.pdf`, content: signedBuffer, contentType: 'application/pdf' }],
      });
    }

    return res.json({ message: 'Ritenuta firmata e archiviata con successo' });
  } catch (error: any) {
    console.error('[Ritenuta firma] Errore:', error);
    return res.status(500).json({ message: 'Errore salvataggio firma', error: error.message });
  }
});

// GET /api/ritenute-acconto/:id/pdf — PDF non firmato
router.get('/:id/pdf', authenticateToken, async (req: Request, res: Response) => {
  try {
    const doc = await RitenutaAcconto.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Ritenuta non trovata' });
    const buffer = await generaRitenutaPDF(doc, false);
    const filename = `RITENUTA-${doc.numero}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (error: any) {
    console.error('[Ritenuta PDF] Errore:', error);
    return res.status(500).json({ message: 'Errore generazione PDF', error: error.message });
  }
});

// GET /api/ritenute-acconto/:id/firmato — PDF firmato
router.get('/:id/firmato', authenticateToken, async (req: Request, res: Response) => {
  try {
    const doc = await RitenutaAcconto.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Ritenuta non trovata' });
    if (!doc.firma?.firmato) return res.status(400).json({ message: 'Ritenuta non ancora firmata' });
    const buffer = await generaRitenutaPDF(doc, true);
    const filename = `RITENUTA-${doc.numero}-firmata.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (error: any) {
    console.error('[Ritenuta firmato] Errore:', error);
    return res.status(500).json({ message: 'Errore generazione PDF firmato', error: error.message });
  }
});

// PATCH /api/ritenute-acconto/:id/annulla
router.patch('/:id/annulla', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('ritenuta_acconto', 'UPDATE'), async (req: Request, res: Response) => {
  try {
    const doc = await RitenutaAcconto.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Ritenuta non trovata' });
    if (doc.stato !== 'emesso') return res.status(400).json({ message: 'Solo le ritenute emesse possono essere annullate' });
    doc.stato = 'annullato';
    await doc.save();
    return res.json(doc);
  } catch (error: any) {
    return res.status(500).json({ message: "Errore nell'annullamento", error: error.message });
  }
});

// DELETE /api/ritenute-acconto/:id — admin
router.delete('/:id', authenticateToken, authorizeRole('admin'), auditLog('ritenuta_acconto', 'DELETE'), async (req: Request, res: Response) => {
  try {
    const doc = await RitenutaAcconto.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Ritenuta non trovata' });
    await RitenutaAcconto.findByIdAndDelete(req.params.id);
    return res.json({ message: 'Ritenuta eliminata' });
  } catch (error: any) {
    return res.status(500).json({ message: "Errore nell'eliminazione", error: error.message });
  }
});

export default router;
