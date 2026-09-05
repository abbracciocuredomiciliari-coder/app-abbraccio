import { Router, Request, Response } from 'express';
import multer from 'multer';
import Patient from '../models/Patient';
import PatientDocument, { DocumentCategory } from '../models/PatientDocument';
import { authenticateToken } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const router = Router();

// Ottieni tutti i documenti per un paziente
router.get('/patients/:patientId/documents', authenticateToken, async (req: Request, res: Response) => {
  try {
    const patientId = req.params.patientId;
    const { category } = req.query;
    
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Paziente non trovato' });
    }

    const query: any = { patient: patientId };
    if (category && ['cartella_clinica', 'esame', 'risultato_analisi', 'consulenza', 'contratto_incarico'].includes(category as string)) {
      query.category = category;
    }

    const documents = await PatientDocument.find(query)
      .sort({ createdAt: -1 })
      .populate('uploadedBy', 'name email');

    return res.json(
      documents.map((doc) => ({
        _id: doc._id,
        patient: doc.patient,
        category: doc.category,
        title: doc.title,
        description: doc.description,
        fileName: doc.fileName,
        contentType: doc.contentType,
        uploadedByNome: doc.uploadedByNome,
        dataCaricamento: doc.dataCaricamento,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
      }))
    );
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero dei documenti', error });
  }
});

// Carica un documento per un paziente
router.post('/patients/:patientId/documents', authenticateToken, authorizeRole('admin', 'coordinator'), upload.single('document'), async (req: Request, res: Response) => {
  try {
    const patientId = req.params.patientId;
    const { category, title, description } = req.body;
    const file = (req as any).file;

    if (!file) {
      return res.status(400).json({ message: 'File non valido o mancante' });
    }

    const validCategories: DocumentCategory[] = ['cartella_clinica', 'esame', 'risultato_analisi', 'consulenza', 'contratto_incarico'];
    if (!validCategories.includes(category as DocumentCategory)) {
      return res.status(400).json({ message: 'Categoria non valida. Usare: cartella_clinica, esame, risultato_analisi, consulenza' });
    }

    if (!title?.trim()) {
      return res.status(400).json({ message: 'Il titolo è obbligatorio' });
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Paziente non trovato' });
    }

    const document = await PatientDocument.create({
      patient: patientId,
      category: category as DocumentCategory,
      title: title.trim(),
      description: description?.trim(),
      fileName: file.originalname,
      contentType: file.mimetype,
      data: file.buffer,
      uploadedBy: (req as any).user?._id,
      uploadedByNome: (req as any).user?.name
    });

    return res.status(201).json(document);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel salvataggio della documentazione', error: error?.message });
  }
});

// Scarica un documento specifico
router.get('/documents/:documentId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const documentId = req.params.documentId;
    const document = await PatientDocument.findById(documentId);
    
    if (!document) {
      return res.status(404).json({ message: 'Documento non trovato' });
    }

    res.setHeader('Content-Type', document.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
    return res.send(document.data);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel download del documento', error });
  }
});

// Elimina un documento specifico
router.delete('/documents/:documentId', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const documentId = req.params.documentId;
    const document = await PatientDocument.findByIdAndDelete(documentId);
    
    if (!document) {
      return res.status(404).json({ message: 'Documento non trovato' });
    }

    return res.json({ message: 'Documento eliminato' });
  } catch (error) {
    return res.status(500).json({ message: 'Errore nell\'eliminazione del documento', error });
  }
});

export default router;