import { Router, Request, Response } from 'express';
import multer from 'multer';
import MedicalEquipment from '../models/MedicalEquipment';
import EquipmentDocument, { DocumentType } from '../models/EquipmentDocument';
import { authenticateToken } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const router = Router();

// Ottieni tutte le apparecchiature
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const equipmentList = await MedicalEquipment.find().sort({ createdAt: -1 });
    return res.json(equipmentList);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero delle apparecchiature', error });
  }
});

// Crea una nuova apparecchiatura (tutti gli utenti autenticati)
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  const { tipo, matricola, controlloEseguito, dataControllo } = req.body;

  if (!tipo?.trim() || !matricola?.trim()) {
    return res.status(400).json({ message: 'I campi tipo e matricola sono obbligatori' });
  }

  try {
    const equipment = await MedicalEquipment.create({
      tipo: tipo.trim(),
      matricola: matricola.trim(),
      controlloEseguito: controlloEseguito || false,
      dataControllo: dataControllo || null
    });
    return res.status(201).json(equipment);
  } catch (error: any) {
    const message = error?.message || 'Errore nella creazione dell\'apparecchiatura';
    return res.status(400).json({ message, details: error?.errors || error });
  }
});

// Aggiorna un'apparecchiatura
router.put('/:equipmentId', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const equipmentId = req.params.equipmentId;
    const { tipo, matricola, controlloEseguito, dataControllo } = req.body;

    const equipment = await MedicalEquipment.findByIdAndUpdate(
      equipmentId,
      {
        tipo: tipo?.trim(),
        matricola: matricola?.trim(),
        controlloEseguito,
        dataControllo
      },
      { new: true, runValidators: true }
    );

    if (!equipment) {
      return res.status(404).json({ message: 'Apparecchiatura non trovata' });
    }

    return res.json(equipment);
  } catch (error: any) {
    return res.status(400).json({ message: 'Errore nell\'aggiornamento dell\'apparecchiatura', details: error?.message });
  }
});

// Elimina un'apparecchiatura
router.delete('/:equipmentId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const equipmentId = req.params.equipmentId;
    if (!equipmentId || equipmentId.length !== 24) {
      return res.status(400).json({ message: 'ID apparecchiatura non valido' });
    }
    const equipment = await MedicalEquipment.findByIdAndDelete(equipmentId);
    
    if (!equipment) {
      return res.status(404).json({ message: 'Apparecchiatura non trovata' });
    }

    // Elimina tutti i documenti associati
    await EquipmentDocument.deleteMany({ equipment: equipmentId });
    
    return res.json({ message: 'Apparecchiatura eliminata' });
  } catch (error) {
    return res.status(500).json({ message: 'Errore durante l\'eliminazione dell\'apparecchiatura', error });
  }
});

// Carica un documento per un'apparecchiatura
router.post('/:equipmentId/documents', authenticateToken, authorizeRole('admin', 'coordinator'), upload.single('document'), async (req: Request, res: Response) => {
  try {
    const equipmentId = req.params.equipmentId;
    const { documentType } = req.body;
    const file = (req as any).file;

    if (!file) {
      return res.status(400).json({ message: 'File non valido o mancante' });
    }

    const validTypes: DocumentType[] = ['conformita', 'manutenzione', 'manuale'];
    if (!validTypes.includes(documentType as DocumentType)) {
      return res.status(400).json({ message: 'Tipo di documento non valido. Usare: conformita, manutenzione, manuale' });
    }

    const equipment = await MedicalEquipment.findById(equipmentId);
    if (!equipment) {
      return res.status(404).json({ message: 'Apparecchiatura non trovata' });
    }

    // Se esiste già un documento dello stesso tipo, lo sostituisce
    const existingDocument = await EquipmentDocument.findOne({ 
      equipment: equipmentId, 
      documentType: documentType as DocumentType 
    });

    if (existingDocument) {
      await EquipmentDocument.findByIdAndDelete(existingDocument._id);
    }

    const document = await EquipmentDocument.create({
      equipment: equipmentId,
      documentType: documentType as DocumentType,
      fileName: file.originalname,
      contentType: file.mimetype,
      data: file.buffer,
      uploadedBy: (req as any).user?._id
    });

    return res.status(201).json(document);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel salvataggio della documentazione', error: error?.message });
  }
});

// Ottieni tutti i documenti per un'apparecchiatura
router.get('/:equipmentId/documents', authenticateToken, async (req: Request, res: Response) => {
  try {
    const equipmentId = req.params.equipmentId;
    const equipment = await MedicalEquipment.findById(equipmentId);
    
    if (!equipment) {
      return res.status(404).json({ message: 'Apparecchiatura non trovata' });
    }

    const documents = await EquipmentDocument.find({ equipment: equipmentId }).sort({ createdAt: -1 });
    
    return res.json(
      documents.map((doc) => ({
        _id: doc._id,
        equipment: doc.equipment,
        documentType: doc.documentType,
        fileName: doc.fileName,
        contentType: doc.contentType,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
      }))
    );
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero dei documenti', error });
  }
});

// Scarica un documento specifico
router.get('/documents/:documentId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const documentId = req.params.documentId;
    const document = await EquipmentDocument.findById(documentId);
    
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
router.delete('/documents/:documentId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const documentId = req.params.documentId;
    const document = await EquipmentDocument.findByIdAndDelete(documentId);
    
    if (!document) {
      return res.status(404).json({ message: 'Documento non trovato' });
    }

    return res.json({ message: 'Documento eliminato' });
  } catch (error) {
    return res.status(500).json({ message: 'Errore nell\'eliminazione del documento', error });
  }
});

export default router;