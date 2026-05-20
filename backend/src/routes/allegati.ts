import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import AllegatoCartella from '../models/AllegatoCartella';
import WorkPlan from '../models/WorkPlan';
import Staff from '../models/Staff';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Cartella upload
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'cartelle');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
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
  },
});

// ⚠️ IMPORTANTE: /file/:allegatoId deve stare PRIMA di /:workPlanId
// altrimenti Express interpreta "file" come workPlanId

// GET /api/allegati/file/:allegatoId - Visualizza/scarica un allegato
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
    const filePath = path.join(UPLOAD_DIR, allegato.nomeFileServer);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File non trovato sul server' });
    }
    // PDF e immagini si aprono inline nel browser, gli altri vengono scaricati
    const isInline = allegato.mimeType === 'application/pdf' || allegato.mimeType.startsWith('image/');
    res.setHeader('Content-Type', allegato.mimeType);
    res.setHeader('Content-Disposition', `${isInline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(allegato.nomeFile)}"`);
    res.setHeader('Content-Length', fs.statSync(filePath).size);
    return res.sendFile(path.resolve(filePath));
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero del file', error });
  }
});

// GET /api/allegati/:workPlanId - Lista allegati per un piano di lavoro
router.get('/:workPlanId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const allegati = await AllegatoCartella.find({ workPlan: req.params.workPlanId })
      .sort({ dataCaricamento: -1 });
    return res.json(allegati);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero degli allegati', error });
  }
});

// POST /api/allegati/:workPlanId - Carica un allegato
router.post('/:workPlanId', authenticateToken, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { workPlanId } = req.params;
    const { descrizione } = req.body;
    const user = (req as any).user;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'Nessun file caricato' });
    }

    const workPlan = await WorkPlan.findById(workPlanId);
    if (!workPlan) {
      fs.unlinkSync(file.path);
      return res.status(404).json({ message: 'Piano di lavoro non trovato' });
    }

    const staffMember = await Staff.findOne({ userId: user.id || user._id });

    const allegato = await AllegatoCartella.create({
      workPlan: workPlanId,
      patient: workPlan.patient,
      nomeFile: file.originalname,
      nomeFileServer: file.filename,
      mimeType: file.mimetype,
      dimensione: file.size,
      descrizione: descrizione?.trim() || undefined,
      caricatoDa: user.name || `${staffMember?.firstName} ${staffMember?.lastName}` || 'Operatore',
      caricatoDaId: staffMember?._id || user.id,
      dataCaricamento: new Date(),
    });

    return res.status(201).json(allegato);
  } catch (error: any) {
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    return res.status(500).json({ message: error?.message || 'Errore nel caricamento del file' });
  }
});

// DELETE /api/allegati/:allegatoId - Elimina un allegato
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

    const filePath = path.join(UPLOAD_DIR, allegato.nomeFileServer);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return res.json({ message: 'Allegato eliminato' });
  } catch (error) {
    return res.status(500).json({ message: "Errore nell'eliminazione", error });
  }
});

export default router;
