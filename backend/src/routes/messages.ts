import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import Message, { type MessageChannel } from '../models/Message';
import WorkPlan from '../models/WorkPlan';
import Patient from '../models/Patient';
import Staff from '../models/Staff';
import { authenticateToken } from '../middleware/auth';

const router = Router();

const PRIVILEGED_ROLES = ['admin', 'coordinator', 'direttore'];

function isPrivileged(role?: string) {
  return !!role && PRIVILEGED_ROLES.includes(role);
}

function allowedChannels(role?: string): MessageChannel[] {
  if (!role) return [];
  if (['admin', 'direttore'].includes(role)) return ['all', 'coordinators', 'office_admin'];
  if (role === 'coordinator') return ['all', 'coordinators'];
  return ['all'];
}

// ─── Cloudinary / storage locale ─────────────────────────────────────────────
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
        else if (file.mimetype.startsWith('video/')) resourceType = 'video';
        return {
          folder: 'chat',
          resource_type: resourceType,
          public_id: `chat-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
          format: path.extname(file.originalname).replace(/^\./, '') || undefined,
        } as any;
      },
    })
  : null;

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'chat');
if (!useCloudinary && !fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const localDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `chat-${Date.now()}-${Math.round(Math.random() * 1e6)}${path.extname(file.originalname)}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage: useCloudinary ? (cloudinaryStorage as any) : localDiskStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Tipo file non supportato. Sono ammessi solo immagini, video e PDF.') as any);
    }
  },
});

// ─── Helpers ────────────────────────────────────────────────────────────────
async function resolveStaffId(userId: string): Promise<string | undefined> {
  const staff = await Staff.findOne({ userId: new mongoose.Types.ObjectId(userId) }).lean();
  return staff?._id?.toString();
}

async function canAccessPatient(user: any, patientId: string): Promise<boolean> {
  if (isPrivileged(user.role)) return true;
  const userId = user.userId || user.id;
  const staffId = await resolveStaffId(userId);
  if (!staffId) return false;
  const count = await WorkPlan.countDocuments({
    patient: new mongoose.Types.ObjectId(patientId),
    $or: [
      { staff: new mongoose.Types.ObjectId(staffId) },
      { 'prestazioni.staff': new mongoose.Types.ObjectId(staffId) },
    ],
  });
  return count > 0;
}

function serializeMessage(msg: any) {
  return {
    _id: msg._id,
    scope: msg.scope,
    channel: msg.channel,
    patientId: msg.patientId,
    workPlanId: msg.workPlanId,
    senderId: msg.senderId,
    senderRole: msg.senderRole,
    senderName: msg.senderName,
    recipientId: msg.recipientId,
    content: msg.content,
    attachments: msg.attachments || [],
    readBy: msg.readBy || [],
    createdAt: msg.createdAt,
    updatedAt: msg.updatedAt,
  };
}

// ─── GET /api/messages ──────────────────────────────────────────────────────
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { scope, patientId, before, limit = '50' } = req.query;

    if (!scope || !['patient', 'general'].includes(scope as string)) {
      return res.status(400).json({ message: 'scope deve essere "patient" o "general"' });
    }

    const query: any = { scope };

    if (scope === 'general') {
      const requestedChannel = req.query.channel as MessageChannel | undefined;
      if (requestedChannel) {
        if (!allowedChannels(user.role).includes(requestedChannel)) {
          return res.status(403).json({ message: 'Non autorizzato a questo canale' });
        }
        query.channel = requestedChannel;
      } else {
        query.channel = { $in: allowedChannels(user.role) };
      }
    }

    if (scope === 'patient') {
      if (!patientId || typeof patientId !== 'string') {
        return res.status(400).json({ message: 'patientId richiesto per scope patient' });
      }
      const patientExists = await Patient.findById(patientId);
      if (!patientExists) {
        return res.status(404).json({ message: 'Paziente non trovato' });
      }
      const ok = await canAccessPatient(user, patientId);
      if (!ok) {
        return res.status(403).json({ message: 'Non autorizzato a visualizzare questa chat' });
      }
      query.patientId = new mongoose.Types.ObjectId(patientId);
    }

    if (before && typeof before === 'string' && /^[0-9a-fA-F]{24}$/.test(before)) {
      query._id = { $lt: new mongoose.Types.ObjectId(before) };
    }

    const pageSize = Math.min(parseInt(limit as string) || 50, 100);

    const messages = await Message.find(query)
      .sort({ _id: -1 })
      .limit(pageSize)
      .lean();

    // Marca i messaggi come letti da chi li ha richiesti (tranne il mittente)
    const unreadIds = messages
      .filter((m: any) => m.senderId.toString() !== user.userId && !(m.readBy || []).some((r: any) => r.userId.toString() === user.userId))
      .map((m: any) => m._id.toString());

    if (unreadIds.length) {
      await Message.updateMany(
        { _id: { $in: unreadIds.map((id: string) => new mongoose.Types.ObjectId(id)) } },
        { $addToSet: { readBy: { userId: new mongoose.Types.ObjectId(user.userId), at: new Date() } } }
      );
    }

    return res.json({ messages: messages.reverse().map(serializeMessage) });
  } catch (error: any) {
    console.error('[Messages GET] Errore:', error);
    return res.status(500).json({ message: 'Errore nel caricamento messaggi', error: error.message });
  }
});

// ─── POST /api/messages ─────────────────────────────────────────────────────
router.post(
  '/',
  authenticateToken,
  (req: Request, res: Response, next: any) => {
    upload.array('attachments', 5)(req, res, (err: any) => {
      if (err) {
        console.error('[Messages Upload] Errore upload allegato:', err);
        const message = err instanceof multer.MulterError
          ? `Errore upload: ${err.message}`
          : `Errore upload allegato: ${err.message || err}`;
        return res.status(400).json({ message });
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { scope, patientId, workPlanId, content, recipientId, channel } = req.body;

      if (!scope || !['patient', 'general'].includes(scope)) {
        return res.status(400).json({ message: 'scope deve essere "patient" o "general"' });
      }

      const msgChannel: MessageChannel = ['all', 'coordinators', 'office_admin'].includes(channel) ? channel : 'all';

      if (scope === 'patient') {
        if (!patientId) {
          return res.status(400).json({ message: 'patientId richiesto per scope patient' });
        }
        const ok = await canAccessPatient(user, patientId);
        if (!ok) {
          return res.status(403).json({ message: 'Non autorizzato a scrivere in questa chat' });
        }
      }

      const text = typeof content === 'string' ? content.trim() : '';
      const files = (req.files || []) as Express.Multer.File[];

      if (!text && files.length === 0) {
        return res.status(400).json({ message: 'Messaggio vuoto' });
      }

      const attachments = files.map(file => ({
        url: useCloudinary ? file.path : `${process.env.API_BASE_URL || ''}/uploads/chat/${file.filename}`,
        type: file.mimetype,
        name: file.originalname,
        publicId: useCloudinary ? (file as any).filename : undefined,
      }));

      const message = await Message.create({
        scope,
        channel: msgChannel,
        patientId: patientId ? new mongoose.Types.ObjectId(patientId) : undefined,
        workPlanId: workPlanId ? new mongoose.Types.ObjectId(workPlanId) : undefined,
        senderId: new mongoose.Types.ObjectId(user.userId || user.id),
        senderRole: user.role || 'unknown',
        senderName: user.name || 'Utente',
        recipientId: recipientId ? new mongoose.Types.ObjectId(recipientId) : undefined,
        content: text,
        attachments,
        readBy: [{ userId: new mongoose.Types.ObjectId(user.userId || user.id), at: new Date() }],
      });

      return res.status(201).json({ message: serializeMessage(message) });
    } catch (error: any) {
      console.error('[Messages POST] Errore:', error);
      return res.status(500).json({ message: 'Errore nell\'invio del messaggio', error: error.message });
    }
  }
);

// ─── GET /api/messages/unread-count ─────────────────────────────────────────
router.get('/unread-count', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user.userId || user.id;

    // Conta messaggi general non letti sui canali visibili
    const generalCount = await Message.countDocuments({
      scope: 'general',
      channel: { $in: allowedChannels(user.role) },
      senderId: { $ne: new mongoose.Types.ObjectId(userId) },
      'readBy.userId': { $ne: new mongoose.Types.ObjectId(userId) },
    });

    // Per i messaggi patient, li conta se l'utente ha accesso al paziente.
    // Per efficienza: recuperiamo solo i patientId dei messaggi non letti e filtriamo.
    const unreadPatientMessages = await Message.find({
      scope: 'patient',
      senderId: { $ne: new mongoose.Types.ObjectId(userId) },
      'readBy.userId': { $ne: new mongoose.Types.ObjectId(userId) },
    }).select('patientId').lean();

    const patientIds = [...new Set(unreadPatientMessages.map((m: any) => m.patientId?.toString()).filter(Boolean))];
    let patientCount = 0;
    for (const pid of patientIds) {
      if (await canAccessPatient(user, pid)) {
        patientCount += unreadPatientMessages.filter((m: any) => m.patientId?.toString() === pid).length;
      }
    }

    return res.json({ general: generalCount, patient: patientCount, total: generalCount + patientCount });
  } catch (error: any) {
    console.error('[Messages unread-count] Errore:', error);
    return res.status(500).json({ message: 'Errore nel conteggio messaggi', error: error.message });
  }
});

// ─── POST /api/messages/:messageId/read ───────────────────────────────────────
router.post('/:messageId/read', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { messageId } = req.params;

    await Message.updateOne(
      { _id: new mongoose.Types.ObjectId(messageId) },
      { $addToSet: { readBy: { userId: new mongoose.Types.ObjectId(user.userId || user.id), at: new Date() } } }
    );

    return res.json({ ok: true });
  } catch (error: any) {
    console.error('[Messages read] Errore:', error);
    return res.status(500).json({ message: 'Errore', error: error.message });
  }
});

export default router;
