import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import path from 'path';
import fs from 'fs';
import Prelievo from '../models/Prelievo';
import Staff from '../models/Staff';
import Patient from '../models/Patient';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// ─── Storage ──────────────────────────────────────────────────────────────────
const useCloudinary = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (useCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const cloudinaryStorage = useCloudinary
  ? new CloudinaryStorage({
      cloudinary,
      params: async (_req: any, file: Express.Multer.File) => {
        let resourceType: 'image' | 'video' | 'raw' = 'raw';
        if (file.mimetype.startsWith('image/')) resourceType = 'image';
        if (file.mimetype === 'application/pdf') resourceType = 'image';
        return {
          folder: 'abbraccio/prelievi',
          resource_type: resourceType,
          format: undefined,
          public_id: `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
        };
      },
    } as any)
  : null;

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'prelievi');
if (!useCloudinary && !fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const localDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Tipo di file non supportato.'));
};

const upload = multer({
  storage: useCloudinary ? (cloudinaryStorage as any) : localDiskStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function getStaffByUser(userId: string, userEmail?: string) {
  let staff = await Staff.findOne({ userId });
  if (!staff && userEmail) {
    staff = await Staff.findOne({ email: userEmail });
    if (staff) { staff.userId = userId as any; await staff.save(); }
  }
  return staff;
}

function isPrivilegiato(role: string) {
  return ['admin', 'coordinator', 'direttore'].includes(role);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/prelievi
// Privilegiati: tutti; Operatore: solo i propri
// Query: tipoGestione, data (YYYY-MM-DD), stato, archiviati
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { tipoGestione, data, stato, archiviati, paziente } = req.query;
    const filter: any = {};

    if (!isPrivilegiato(user.role)) {
      const staffMember = await getStaffByUser(user.id || user.userId, user.email);
      if (!staffMember) return res.json([]);
      filter.staff = staffMember._id;
    }

    if (tipoGestione === 'privato' || tipoGestione === 'convenzione') {
      filter.tipoGestione = tipoGestione;
    }

    if (data) {
      const giorno = new Date(data as string);
      const fine = new Date(giorno);
      fine.setHours(23, 59, 59, 999);
      filter.dataPrelievo = { $gte: giorno, $lte: fine };
    }

    if (stato) filter.status = stato;
    if (paziente) filter.patient = paziente;

    if (archiviati === 'true') {
      filter.archiviato = true;
    } else if (archiviati !== 'all') {
      filter.archiviato = { $ne: true };
    }

    const prelievi = await Prelievo.find(filter)
      .populate('patient', 'firstName lastName tipoGestione siat')
      .populate('staff', 'firstName lastName role')
      .sort({ dataPrelievo: 1 });

    return res.json(prelievi);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero dei prelievi', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/prelievi/miei-oggi — prelievi dell'operatore per oggi
// ─────────────────────────────────────────────────────────────────────────────
router.get('/miei-oggi', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const staffMember = await getStaffByUser(user.id || user.userId, user.email);
    if (!staffMember) return res.json([]);

    const { data, tipoGestione } = req.query;
    const giornoStr = (data as string) || new Date().toISOString().split('T')[0];
    const giorno = new Date(giornoStr);
    const fine = new Date(giorno);
    fine.setHours(23, 59, 59, 999);

    const filter: any = {
      staff: staffMember._id,
      dataPrelievo: { $gte: giorno, $lte: fine },
      archiviato: { $ne: true },
    };

    if (tipoGestione === 'privato' || tipoGestione === 'convenzione') {
      filter.tipoGestione = tipoGestione;
    }

    const prelievi = await Prelievo.find(filter)
      .populate('patient', 'firstName lastName birthDate address contactPhone tipoGestione siat')
      .populate('staff', 'firstName lastName role')
      .sort({ orario: 1 });

    return res.json(prelievi);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero dei prelievi', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/prelievi/:id — dettaglio
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const prelievo = await Prelievo.findById(req.params.id)
      .populate('patient', 'firstName lastName birthDate address contactPhone tipoGestione siat')
      .populate('staff', 'firstName lastName role');
    if (!prelievo) return res.status(404).json({ message: 'Prelievo non trovato' });
    return res.json(prelievo);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero del prelievo', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/prelievi — crea prelievo (solo privilegiati)
// Eredita tipoGestione dal paziente automaticamente
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!isPrivilegiato(user.role)) {
      return res.status(403).json({ message: 'Non autorizzato a creare prelievi' });
    }

    const { patient, staff, dataPrelievo, orario, tipoPrelievo, note } = req.body;
    if (!patient || !staff || !dataPrelievo || !tipoPrelievo) {
      return res.status(400).json({ message: 'Campi obbligatori: patient, staff, dataPrelievo, tipoPrelievo' });
    }

    // Eredita tipoGestione dal paziente
    const paziente = await Patient.findById(patient);
    if (!paziente) return res.status(404).json({ message: 'Paziente non trovato' });
    const tipoGestione = paziente.tipoGestione || 'privato';

    const prelievo = await Prelievo.create({
      patient, staff, dataPrelievo, orario, tipoPrelievo, note, tipoGestione,
    });

    const populated = await Prelievo.findById(prelievo._id)
      .populate('patient', 'firstName lastName tipoGestione')
      .populate('staff', 'firstName lastName role');

    return res.status(201).json(populated);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nella creazione del prelievo', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/prelievi/:id — aggiorna (privilegiati o operatore assegnato)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const prelievo = await Prelievo.findById(req.params.id);
    if (!prelievo) return res.status(404).json({ message: 'Prelievo non trovato' });

    if (!isPrivilegiato(user.role)) {
      const staffMember = await getStaffByUser(user.id || user.userId, user.email);
      if (!staffMember || prelievo.staff.toString() !== staffMember._id.toString()) {
        return res.status(403).json({ message: 'Non autorizzato' });
      }
    }

    const aggiornamenti: any = {};
    const campiConsentiti = ['staff', 'dataPrelievo', 'orario', 'tipoPrelievo', 'note', 'status',
      'dataEsecuzione', 'eseguitoDa', 'eseguitoDaId', 'noteEsecuzione'];
    for (const campo of campiConsentiti) {
      if (req.body[campo] !== undefined) aggiornamenti[campo] = req.body[campo];
    }

    const updated = await Prelievo.findByIdAndUpdate(req.params.id, aggiornamenti, { new: true })
      .populate('patient', 'firstName lastName tipoGestione siat')
      .populate('staff', 'firstName lastName role');

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nell\'aggiornamento del prelievo', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/prelievi/:id/esegui — registra esecuzione
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/esegui', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const prelievo = await Prelievo.findById(req.params.id);
    if (!prelievo) return res.status(404).json({ message: 'Prelievo non trovato' });

    const staffMember = await getStaffByUser(user.id || user.userId, user.email);
    const nomeOperatore = staffMember
      ? `${staffMember.firstName} ${staffMember.lastName}`
      : (user.name || user.email);

    const { noteEsecuzione } = req.body;

    await Prelievo.findByIdAndUpdate(req.params.id, {
      status: 'eseguito',
      dataEsecuzione: new Date(),
      eseguitoDa: nomeOperatore,
      eseguitoDaId: staffMember?._id,
      noteEsecuzione: noteEsecuzione || '',
    });

    const updated = await Prelievo.findById(req.params.id)
      .populate('patient', 'firstName lastName tipoGestione')
      .populate('staff', 'firstName lastName role');

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nella registrazione esecuzione', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/prelievi/:id/diaria — aggiunge voce diaria
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/diaria', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const prelievo = await Prelievo.findById(req.params.id);
    if (!prelievo) return res.status(404).json({ message: 'Prelievo non trovato' });

    const staffMember = await getStaffByUser(user.id || user.userId, user.email);
    const autore = staffMember
      ? `${staffMember.firstName} ${staffMember.lastName}`
      : (user.name || user.email);
    const autoreId = staffMember?._id;
    const ruoloAutore = staffMember?.role || user.role;

    const { testo } = req.body;
    if (!testo?.trim()) return res.status(400).json({ message: 'Testo obbligatorio' });

    const entry = { data: new Date(), autore, autoreId, ruoloAutore, testo: testo.trim(), firmato: false };
    prelievo.diaria.push(entry as any);
    await prelievo.save();

    return res.json(prelievo.diaria[prelievo.diaria.length - 1]);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nell\'aggiunta della diaria', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/prelievi/:id/diaria/:diariaId/firma — firma voce diaria
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/diaria/:diariaId/firma', authenticateToken, async (req: Request, res: Response) => {
  try {
    const prelievo = await Prelievo.findById(req.params.id);
    if (!prelievo) return res.status(404).json({ message: 'Prelievo non trovato' });

    const entry = prelievo.diaria.find(d => d._id?.toString() === req.params.diariaId);
    if (!entry) return res.status(404).json({ message: 'Voce diaria non trovata' });

    entry.firmato = true;
    entry.dataFirma = new Date();
    await prelievo.save();

    return res.json(entry);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nella firma', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/prelievi/:id/allegati — carica allegato (es. referto lab)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/allegati', authenticateToken, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const prelievo = await Prelievo.findById(req.params.id);
    if (!prelievo) return res.status(404).json({ message: 'Prelievo non trovato' });

    const file = req.file as any;
    if (!file) return res.status(400).json({ message: 'File obbligatorio' });

    const staffMember = await getStaffByUser(user.id || user.userId, user.email);
    const caricatoDa = staffMember
      ? `${staffMember.firstName} ${staffMember.lastName}`
      : (user.name || user.email);

    const allegato: any = {
      nomeFile: file.originalname,
      nomeFileServer: file.filename || file.path,
      mimeType: file.mimetype,
      dimensione: file.size,
      descrizione: req.body.descrizione || '',
      caricatoDa,
      caricatoDaId: staffMember?._id,
      dataCaricamento: new Date(),
    };

    if (useCloudinary && file.path) {
      allegato.urlCloudinary = file.path;
      allegato.publicIdCloudinary = file.filename;
      allegato.nomeFileServer = file.filename;
    }

    prelievo.allegati.push(allegato);
    await prelievo.save();

    return res.json(prelievo.allegati[prelievo.allegati.length - 1]);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel caricamento allegato', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/prelievi/:id — elimina (solo privilegiati)
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!isPrivilegiato(user.role)) {
      return res.status(403).json({ message: 'Non autorizzato' });
    }
    await Prelievo.findByIdAndDelete(req.params.id);
    return res.json({ message: 'Prelievo eliminato' });
  } catch (error) {
    return res.status(500).json({ message: 'Errore nell\'eliminazione', error });
  }
});

export default router;
