import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import path from 'path';
import fs from 'fs';
import AllegatoCartella from '../models/AllegatoCartella';
import WorkPlan from '../models/WorkPlan';
import Staff from '../models/Staff';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// ─── Configurazione Cloudinary ────────────────────────────────────────────────
// Se le variabili Cloudinary sono presenti usa Cloudinary, altrimenti fallback su disco locale
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
  console.log('✅ Cloudinary configurato per storage allegati');
} else {
  console.warn('⚠️  Variabili Cloudinary non trovate — uso storage locale (non persistente su Render)');
}

// ─── Storage Cloudinary ───────────────────────────────────────────────────────
const cloudinaryStorage = useCloudinary
  ? new CloudinaryStorage({
      cloudinary,
      params: async (_req: any, file: Express.Multer.File) => {
        // Determina il resource_type in base al mimetype
        let resourceType: 'image' | 'video' | 'raw' = 'raw';
        if (file.mimetype.startsWith('image/')) resourceType = 'image';
        // I PDF vanno come 'image' su Cloudinary per poterli visualizzare inline
        if (file.mimetype === 'application/pdf') resourceType = 'image';

        return {
          folder: 'abbraccio/cartelle',
          resource_type: resourceType,
          // Mantieni l'estensione originale
          format: undefined,
          // Nome univoco
          public_id: `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
          // Per i PDF usa fl_attachment:false per aprirli inline
          flags: file.mimetype === 'application/pdf' ? 'attachment:false' : undefined,
        };
      },
    } as any)
  : null;

// ─── Storage locale (fallback) ────────────────────────────────────────────────
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'cartelle');
if (!useCloudinary && !fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const localDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  },
});

// ─── Filtro tipi file ─────────────────────────────────────────────────────────
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo di file non supportato. Sono accettati: immagini, PDF, Word, Excel, testo.'));
  }
};

const upload = multer({
  storage: useCloudinary ? (cloudinaryStorage as any) : localDiskStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter,
});

// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ IMPORTANTE: /file/:allegatoId deve stare PRIMA di /:workPlanId
// altrimenti Express interpreta "file" come workPlanId
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/allegati/file/:allegatoId — Visualizza/scarica un allegato (fallback disco locale)
// Questo endpoint è usato SOLO quando Cloudinary NON è configurato.
// Con Cloudinary, il frontend apre direttamente l'URL Cloudinary.
router.get('/file/:allegatoId', async (req: Request, res: Response) => {
  try {
    // Supporta token sia nell'header Authorization che come query param ?token=...
    const tokenFromQuery = req.query.token as string | undefined;
    const authHeader = req.headers.authorization;
    const token = tokenFromQuery || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined);

    if (!token) {
      return res.status(401).json({ message: 'Token di autenticazione mancante' });
    }

    const jwtSecret = process.env.JWT_SECRET as string;
    let payload: any;
    try {
      const jwt = require('jsonwebtoken');
      payload = jwt.verify(token, jwtSecret);
    } catch {
      return res.status(401).json({ message: 'Token non valido o scaduto' });
    }

    if (!payload) {
      return res.status(401).json({ message: 'Token non valido' });
    }

    const allegato = await AllegatoCartella.findById(req.params.allegatoId);
    if (!allegato) {
      return res.status(404).json({ message: 'Allegato non trovato' });
    }

    // Se l'allegato ha un URL Cloudinary, fai redirect diretto
    if (allegato.urlCloudinary) {
      return res.redirect(allegato.urlCloudinary);
    }

    // Fallback: serve dal disco locale
    const filePath = path.join(UPLOAD_DIR, allegato.nomeFileServer);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File non trovato sul server. Potrebbe essere stato perso dopo un riavvio del server. Ricaricare il file.' });
    }
    const isInline = allegato.mimeType === 'application/pdf' || allegato.mimeType.startsWith('image/');
    res.setHeader('Content-Type', allegato.mimeType);
    res.setHeader('Content-Disposition', `${isInline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(allegato.nomeFile)}"`);
    res.setHeader('Content-Length', fs.statSync(filePath).size);
    return res.sendFile(path.resolve(filePath));
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero del file', error });
  }
});

// GET /api/allegati/:workPlanId — Lista allegati per un piano di lavoro
router.get('/:workPlanId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const allegati = await AllegatoCartella.find({ workPlan: req.params.workPlanId })
      .sort({ dataCaricamento: -1 });
    return res.json(allegati);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero degli allegati', error });
  }
});

// POST /api/allegati/:workPlanId — Carica un allegato
router.post('/:workPlanId', authenticateToken, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { workPlanId } = req.params;
    const { descrizione } = req.body;
    const user = (req as any).user;
    const file = req.file as any;

    if (!file) {
      return res.status(400).json({ message: 'Nessun file caricato' });
    }

    const workPlan = await WorkPlan.findById(workPlanId);
    if (!workPlan) {
      // Se Cloudinary, elimina il file appena caricato
      if (useCloudinary && file.public_id) {
        try { await cloudinary.uploader.destroy(file.public_id); } catch {}
      } else if (file.path && fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch {}
      }
      return res.status(404).json({ message: 'Piano di lavoro non trovato' });
    }

    const staffMember = await Staff.findOne({ userId: user.id || user._id });

    // Determina i campi in base allo storage usato
    let nomeFileServer: string;
    let urlCloudinary: string | undefined;
    let publicIdCloudinary: string | undefined;

    if (useCloudinary && file.path) {
      // Con Cloudinary: file.path = URL, file.filename = public_id
      urlCloudinary = file.path;
      publicIdCloudinary = file.filename;
      nomeFileServer = file.filename;
    } else {
      // Disco locale
      nomeFileServer = file.filename;
    }

    const allegato = await AllegatoCartella.create({
      workPlan: workPlanId,
      patient: workPlan.patient,
      nomeFile: file.originalname,
      nomeFileServer,
      mimeType: file.mimetype,
      dimensione: file.size,
      descrizione: descrizione?.trim() || undefined,
      caricatoDa: user.name || `${staffMember?.firstName} ${staffMember?.lastName}` || 'Operatore',
      caricatoDaId: staffMember?._id || user.id,
      dataCaricamento: new Date(),
      urlCloudinary,
      publicIdCloudinary,
    });

    return res.status(201).json(allegato);
  } catch (error: any) {
    // Pulizia in caso di errore
    const file = req.file as any;
    if (file) {
      if (useCloudinary && file.public_id) {
        try { await cloudinary.uploader.destroy(file.public_id); } catch {}
      } else if (file.path && fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch {}
      }
    }
    return res.status(500).json({ message: error?.message || 'Errore nel caricamento del file' });
  }
});

// DELETE /api/allegati/:allegatoId — Elimina un allegato
router.delete('/:allegatoId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'admin' && user.role !== 'direttore' && user.role !== 'coordinator') {
      return res.status(403).json({ message: 'Non autorizzato a eliminare allegati' });
    }

    const allegato = await AllegatoCartella.findByIdAndDelete(req.params.allegatoId);
    if (!allegato) {
      return res.status(404).json({ message: 'Allegato non trovato' });
    }

    // Elimina da Cloudinary se presente
    if (allegato.publicIdCloudinary) {
      try {
        const resourceType = allegato.mimeType.startsWith('image/') || allegato.mimeType === 'application/pdf'
          ? 'image'
          : 'raw';
        await cloudinary.uploader.destroy(allegato.publicIdCloudinary, { resource_type: resourceType });
      } catch (err) {
        console.warn('Impossibile eliminare file da Cloudinary:', err);
      }
    } else {
      // Elimina dal disco locale
      const filePath = path.join(UPLOAD_DIR, allegato.nomeFileServer);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch {}
      }
    }

    return res.json({ message: 'Allegato eliminato' });
  } catch (error) {
    return res.status(500).json({ message: "Errore nell'eliminazione", error });
  }
});

export default router;
