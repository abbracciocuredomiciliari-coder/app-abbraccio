import { Router, Request, Response } from 'express';
import multer from 'multer';
import ProcedureDocument from '../models/ProcedureDocument';
import { authenticateToken } from '../middleware/auth';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const router = Router();

router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const query = category && ['procedure', 'protocol'].includes(category) ? { category } : {};
    const documents = await ProcedureDocument.find(query).sort({ createdAt: -1 });
    return res.json(
      documents.map((doc) => ({
        _id: doc._id,
        category: doc.category,
        fileName: doc.fileName,
        displayName: doc.displayName || '',
        contentType: doc.contentType,
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

    if (!file || !category || !['procedure', 'protocol'].includes(category)) {
      return res.status(400).json({ message: 'Categoria o file non valido' });
    }

    const document = await ProcedureDocument.create({
      category,
      fileName: file.originalname,
      displayName: displayName || file.originalname,
      contentType: file.mimetype,
      data: file.buffer
    });

    return res.status(201).json({
      _id: document._id,
      category: document.category,
      fileName: document.fileName,
      displayName: document.displayName || '',
      contentType: document.contentType,
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
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Errore durante la rinomina del documento', error });
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
    await existing.save();

    return res.json({
      _id: existing._id,
      category: existing.category,
      fileName: existing.fileName,
      displayName: existing.displayName || '',
      contentType: existing.contentType,
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
