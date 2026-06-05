import { Router, Request, Response } from 'express';
import multer from 'multer';
import Staff from '../models/Staff';
import StaffDocument from '../models/StaffDocument';
import { authenticateToken } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /staff/zona?lat=&lng=&tipoGestione= — operatori disponibili in quella zona
// Restituisce operatori il cui raggio d'azione copre il punto lat/lng
// ─────────────────────────────────────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

router.get('/zona', authenticateToken, authorizeRole('admin', 'coordinator', 'direttore'), async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const tipoGestione = req.query.tipoGestione as string | undefined;

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ message: 'lat e lng sono obbligatori' });
    }

    const query: any = { active: true, 'domicilioCoords.lat': { $exists: true } };
    if (tipoGestione === 'privato') query.modalitaAbilitata = { $in: ['privato', 'entrambi'] };
    if (tipoGestione === 'convenzione') query.modalitaAbilitata = { $in: ['convenzione', 'entrambi'] };

    const tuttiStaff = await Staff.find(query).select(
      'firstName lastName role category domicilioPartenza domicilioCoords raggioAzioneKm modalitaAbilitata active'
    );

    const inZona = tuttiStaff.filter(s => {
      if (!s.domicilioCoords?.lat || !s.domicilioCoords?.lng) return false;
      const dist = haversineKm(s.domicilioCoords.lat, s.domicilioCoords.lng, lat, lng);
      return dist <= (s.raggioAzioneKm || 10);
    }).map(s => ({
      ...s.toObject(),
      distanzaKm: Math.round(haversineKm(s.domicilioCoords!.lat, s.domicilioCoords!.lng, lat, lng) * 10) / 10,
    }));

    inZona.sort((a, b) => a.distanzaKm - b.distanzaKm);
    return res.json(inZona);
  } catch (error) {
    return res.status(500).json({ message: 'Errore ricerca zona', error });
  }
});

// Ottieni tutto il personale (con filtri opzionali)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { category, active } = req.query;
    const query: any = {};
    
    if (category && ['infermieristico', 'oss', 'riabilitativo', 'medico', 'coordinamento', 'direzione'].includes(category as string)) {
      query.category = category;
    }
    
    if (active !== undefined) {
      query.active = active === 'true';
    }

    const staffList = await Staff.find(query).sort({ category: 1, lastName: 1, firstName: 1 });
    return res.json(staffList);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero del personale', error });
  }
});

// Crea nuovo membro dello staff
router.post('/', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  const { firstName, lastName, email, role, category, phone, dataInizioCollaborazione, note, modalitaAbilitata } = req.body;

  if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !role) {
    return res.status(400).json({ message: 'I campi nome, cognome, email e ruolo sono obbligatori' });
  }

  if (!category || !['infermieristico', 'oss', 'riabilitativo', 'medico', 'coordinamento', 'direzione'].includes(category)) {
    return res.status(400).json({ message: 'Categoria non valida. Usare: infermieristico, oss, riabilitativo, medico, coordinamento, direzione' });
  }

  try {
    const staffData: any = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      role,
      category,
      phone: phone?.trim(),
      note: note?.trim(),
      modalitaAbilitata: modalitaAbilitata || 'entrambi',
    };

    if (dataInizioCollaborazione) {
      staffData.dataInizioCollaborazione = new Date(dataInizioCollaborazione);
    } else {
      staffData.dataInizioCollaborazione = new Date();
    }

    const staffMember = await Staff.create(staffData);
    return res.status(201).json(staffMember);
  } catch (error: any) {
    const message = error?.message || 'Errore nella creazione del membro dello staff';
    return res.status(400).json({ message, details: error?.errors || error });
  }
});

// Aggiorna membro dello staff
router.put('/:staffId', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const staffId = req.params.staffId;
    const { firstName, lastName, email, role, category, phone, note, modalitaAbilitata } = req.body;
    
    const updateData: any = {};
    if (firstName) updateData.firstName = firstName.trim();
    if (lastName) updateData.lastName = lastName.trim();
    if (email) updateData.email = email.trim().toLowerCase();
    if (role) updateData.role = role;
    if (category && ['infermieristico', 'oss', 'riabilitativo', 'medico', 'coordinamento', 'direzione'].includes(category)) {
      updateData.category = category;
    }
    if (phone !== undefined) updateData.phone = phone.trim();
    if (note !== undefined) updateData.note = note.trim();
    if (modalitaAbilitata && ['entrambi', 'privato', 'convenzione'].includes(modalitaAbilitata)) {
      updateData.modalitaAbilitata = modalitaAbilitata;
    }

    const staffMember = await Staff.findByIdAndUpdate(staffId, updateData, { new: true });
    if (!staffMember) {
      return res.status(404).json({ message: 'Membro dello staff non trovato' });
    }
    return res.json(staffMember);
  } catch (error) {
    return res.status(500).json({ message: 'Errore durante l\'aggiornamento del personale', error });
  }
});

// Dimetti membro dello staff (imposta data fine collaborazione e active: false)
router.post('/:staffId/dimissioni', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const staffId = req.params.staffId;
    const { dataFineCollaborazione, motivazione } = req.body;
    
    const updateData: any = {
      active: false,
      dataFineCollaborazione: dataFineCollaborazione ? new Date(dataFineCollaborazione) : new Date(),
    };

    if (motivazione) {
      updateData.note = motivazione;
    }

    const staffMember = await Staff.findByIdAndUpdate(staffId, updateData, { new: true });
    if (!staffMember) {
      return res.status(404).json({ message: 'Membro dello staff non trovato' });
    }
    return res.json({ message: 'Dimissione registrata con successo', staff: staffMember });
  } catch (error) {
    return res.status(500).json({ message: 'Errore durante la registrazione della dimissione', error });
  }
});

// Riattiva membro dello staff
router.post('/:staffId/riattiva', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const staffId = req.params.staffId;
    const staffMember = await Staff.findByIdAndUpdate(
      staffId, 
      { active: true, dataFineCollaborazione: undefined }, 
      { new: true }
    );
    if (!staffMember) {
      return res.status(404).json({ message: 'Membro dello staff non trovato' });
    }
    return res.json({ message: 'Membro dello staff riattivato', staff: staffMember });
  } catch (error) {
    return res.status(500).json({ message: 'Errore durante la riattivazione del personale', error });
  }
});

// Elimina membro dello staff
router.delete('/:staffId', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const staffId = req.params.staffId;
    const staffMember = await Staff.findByIdAndDelete(staffId);
    if (!staffMember) {
      return res.status(404).json({ message: 'Membro dello staff non trovato' });
    }
    await StaffDocument.deleteMany({ staff: staffId });
    return res.json({ message: 'Membro dello staff eliminato' });
  } catch (error) {
    return res.status(500).json({ message: 'Errore durante l\'eliminazione del personale', error });
  }
});

// Carica documento per membro dello staff
router.post('/:staffId/documents', authenticateToken, authorizeRole('admin', 'coordinator'), upload.single('document'), async (req: Request, res: Response) => {
  try {
    const staffId = req.params.staffId;
    const { documentType, title, description } = req.body;
    const file = (req as any).file;

    if (!file) {
      return res.status(400).json({ message: 'File non valido o mancante' });
    }

    if (!documentType) {
      return res.status(400).json({ message: 'Tipo di documento obbligatorio' });
    }

    const staffMember = await Staff.findById(staffId);
    if (!staffMember) {
      return res.status(404).json({ message: 'Membro dello staff non trovato' });
    }

    const document = await StaffDocument.create({
      staff: staffId,
      documentType,
      title: title?.trim() || file.originalname,
      description: description?.trim(),
      fileName: file.originalname,
      contentType: file.mimetype,
      data: file.buffer
    });

    return res.status(201).json(document);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel salvataggio della documentazione', error });
  }
});

// Ottieni documenti per membro dello staff
router.get('/:staffId/documents', authenticateToken, async (req: Request, res: Response) => {
  try {
    const staffId = req.params.staffId;
    const staffMember = await Staff.findById(staffId);
    if (!staffMember) {
      return res.status(404).json({ message: 'Membro dello staff non trovato' });
    }

    const documents = await StaffDocument.find({ staff: staffId }).sort({ createdAt: -1 });
    return res.json(
      documents.map((doc) => ({
        _id: doc._id,
        staff: doc.staff,
        documentType: doc.documentType,
        title: doc.title,
        description: doc.description,
        fileName: doc.fileName,
        contentType: doc.contentType,
        createdAt: doc.createdAt
      }))
    );
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero dei documenti', error });
  }
});

// Scarica documento
router.get('/documents/:documentId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const documentId = req.params.documentId;
    const document = await StaffDocument.findById(documentId);
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

// Elimina documento
router.delete('/documents/:documentId', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const documentId = req.params.documentId;
    const document = await StaffDocument.findByIdAndDelete(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Documento non trovato' });
    }
    return res.json({ message: 'Documento eliminato' });
  } catch (error) {
    return res.status(500).json({ message: 'Errore nell\'eliminazione del documento', error });
  }
});

export default router;