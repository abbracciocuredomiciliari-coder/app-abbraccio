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
        contentType: doc.contentType,
        createdAt: doc.createdAt
      }))
    );
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero dei documenti procedurali', error });
  }
});

router.post('/', authenticateToken, upload.single('document'), async (req: Request, res: Response) => {
  try {
    const category = req.body.category as string;
    const file = (req as any).file;

    if (!file || !category || !['procedure', 'protocol'].includes(category)) {
      return res.status(400).json({ message: 'Categoria o file non valido' });
    }

    const document = await ProcedureDocument.create({
      category,
      fileName: file.originalname,
      contentType: file.mimetype,
      data: file.buffer
    });

    return res.status(201).json({
      _id: document._id,
      category: document.category,
      fileName: document.fileName,
      contentType: document.contentType,
      createdAt: document.createdAt
    });
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel caricamento del documento procedurale', error });
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
    return res.status(500).json({ message: 'Errore durante l’eliminazione del documento', error });
  }
});

export default router;
