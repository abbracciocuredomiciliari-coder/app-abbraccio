import { Router, Request, Response } from 'express';
import multer from 'multer';
import ProcedureDocument from '../models/ProcedureDocument';
import { authenticateToken } from '../middleware/auth';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const router = Router();
const CATEGORIE_DOC = ['procedure', 'protocol', 'modulistica'];

router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const query = category && CATEGORIE_DOC.includes(category) ? { category } : {};
    const documents = await ProcedureDocument.find(query).sort({ createdAt: -1 });
    return res.json(
      documents.map((doc) => ({
        _id: doc._id,
        category: doc.category,
        fileName: doc.fileName,
        displayName: doc.displayName || '',
        contentType: doc.contentType,
        versione: doc.versione ?? 1,
        stato: doc.stato ?? 'vigente',
        autoreNome: doc.autoreNome || '',
        noteVersione: doc.noteVersione || '',
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }))
    );
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero dei documenti procedurali', error });
  }
});

router.post('/', authenticateToken, upload.single('document'), async (req: Request, res: Response) => {
  try {
    const category = req.body.category as string;
    const displayName = (req.body.displayName as string || '').trim();
    const file = (req as any).file;

    if (!file || !category || !CATEGORIE_DOC.includes(category)) {
      return res.status(400).json({ message: 'Categoria o file non valido' });
    }

    const document = await ProcedureDocument.create({
      category,
      fileName: file.originalname,
      displayName: displayName || file.originalname,
      contentType: file.mimetype,
      data: file.buffer,
      autoreNome: (req as any).user?.name || ''
    });

    return res.status(201).json({
      _id: document._id,
      category: document.category,
      fileName: document.fileName,
      displayName: document.displayName || '',
      contentType: document.contentType,
      versione: document.versione ?? 1,
      stato: document.stato ?? 'vigente',
      autoreNome: document.autoreNome || '',
      noteVersione: document.noteVersione || '',
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel caricamento del documento procedurale', error });
  }
});

// PATCH: aggiorna solo il nome visualizzato
router.patch('/:documentId/rename', authenticateToken, async (req: Request, res: Response) => {
  try {
    const documentId = req.params.documentId;
    const displayName = (req.body.displayName as string || '').trim();

    if (!displayName) {
      return res.status(400).json({ message: 'Il nome non può essere vuoto' });
    }

    const document = await ProcedureDocument.findByIdAndUpdate(
      documentId,
      { displayName },
      { new: true }
    );

    if (!document) {
      return res.status(404).json({ message: 'Documento non trovato' });
    }

    return res.json({
      _id: document._id,
      category: document.category,
      fileName: document.fileName,
      displayName: document.displayName || '',
      contentType: document.contentType,
      versione: document.versione ?? 1,
      stato: document.stato ?? 'vigente',
      autoreNome: document.autoreNome || '',
      noteVersione: document.noteVersione || '',
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Errore durante la rinomina del documento', error });
  }
});

// PATCH meta: cambia stato (bozza/vigente/archiviata) e note di versione
router.patch('/:documentId/meta', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { stato, noteVersione } = req.body;
    const update: any = {};
    if (stato && ['bozza', 'vigente', 'archiviata'].includes(stato)) update.stato = stato;
    if (typeof noteVersione === 'string') update.noteVersione = noteVersione.trim();
    const document = await ProcedureDocument.findByIdAndUpdate(req.params.documentId, update, { new: true });
    if (!document) {
      return res.status(404).json({ message: 'Documento non trovato' });
    }
    return res.json({
      _id: document._id,
      category: document.category,
      fileName: document.fileName,
      displayName: document.displayName || '',
      contentType: document.contentType,
      versione: document.versione ?? 1,
      stato: document.stato ?? 'vigente',
      autoreNome: document.autoreNome || '',
      noteVersione: document.noteVersione || '',
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Errore nell\'aggiornamento dei metadati', error });
  }
});

// PUT: sostituisce il file (aggiorna contenuto)
router.put('/:documentId', authenticateToken, upload.single('document'), async (req: Request, res: Response) => {
  try {
    const documentId = req.params.documentId;
    const file = (req as any).file;

    if (!file) {
      return res.status(400).json({ message: 'File non valido o mancante' });
    }

    const existing = await ProcedureDocument.findById(documentId);
    if (!existing) {
      return res.status(404).json({ message: 'Documento non trovato' });
    }

    existing.fileName = file.originalname;
    existing.contentType = file.mimetype;
    existing.data = file.buffer;
    // Sostituzione del file = nuova versione del documento
    existing.versione = (existing.versione || 1) + 1;
    existing.stato = 'vigente';
    if (typeof req.body.noteVersione === 'string' && req.body.noteVersione.trim()) {
      existing.noteVersione = req.body.noteVersione.trim();
    }
    await existing.save();

    return res.json({
      _id: existing._id,
      category: existing.category,
      fileName: existing.fileName,
      displayName: existing.displayName || '',
      contentType: existing.contentType,
      versione: existing.versione ?? 1,
      stato: existing.stato ?? 'vigente',
      autoreNome: existing.autoreNome || '',
      noteVersione: existing.noteVersione || '',
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Errore durante l\'aggiornamento del documento', error });
  }
});

router.get('/:documentId/download', authenticateToken, async (req: Request, res: Response) => {
  try {
    const documentId = req.params.documentId;
    const document = await ProcedureDocument.findById(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Documento non trovato' });
    }

    res.setHeader('Content-Type', document.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.fileName)}"`);
    res.setHeader('Content-Length', document.data.length.toString());
    return res.end(document.data);
  } catch (error) {
    return res.status(500).json({ message: 'Errore durante il download del documento', error });
  }
});

router.delete('/:documentId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const documentId = req.params.documentId;
    const document = await ProcedureDocument.findByIdAndDelete(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Documento non trovato' });
    }
    return res.json({ message: 'Documento eliminato' });
  } catch (error) {
    return res.status(500).json({ message: 'Errore durante l\'eliminazione del documento', error });
  }
});

export default router;
