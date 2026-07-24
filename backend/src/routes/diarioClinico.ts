import { Router, Request, Response } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import DiarioClinico from '../models/DiarioClinico';
import WorkPlan from '../models/WorkPlan';
import Staff from '../models/Staff';
import { authenticateToken } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { addTimestampToDocument } from '../utils/timestamp';
import { transcribeAudio, extractDiarioData, isVoiceAiAvailable } from '../utils/voiceAi';

const router = Router();

// GET /api/diario/:workPlanId - Ottieni diario clinico per un piano di lavoro
router.get('/:workPlanId', authenticateToken, auditLog('diario', 'READ', req => req.params.workPlanId), async (req: Request, res: Response) => {
  try {
    const { workPlanId } = req.params;
    const entries = await DiarioClinico.find({ workPlan: workPlanId })
      .sort({ dataRegistrazione: -1 });
    return res.json(entries);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero del diario', error });
  }
});

// GET /api/diario/paziente/:patientId - Diario clinico completo del paziente (storico cartelle)
router.get('/paziente/:patientId', authenticateToken, auditLog('diario-paziente', 'READ', req => req.params.patientId), async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const entries = await DiarioClinico.find({ patient: patientId })
      .populate('workPlan', 'task date type category status')
      .sort({ dataRegistrazione: -1 });
    return res.json(entries);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero del diario', error });
  }
});

// POST /api/diario/:workPlanId - Aggiungi voce al diario (non firmata, modificabile)
router.post('/:workPlanId', authenticateToken, auditLog('diario', 'CREATE', req => req.params.workPlanId), async (req: Request, res: Response) => {
  try {
    const { workPlanId } = req.params;
    const { testo, parametriVitali, scaleValutazione, terapiaFarmacologica, workPlanAccess } = req.body;
    const user = (req as any).user;

    if (!testo?.trim()) {
      return res.status(400).json({ message: 'Il testo del diario è obbligatorio' });
    }

    const workPlan = await WorkPlan.findById(workPlanId);
    if (!workPlan) {
      return res.status(404).json({ message: 'Piano di lavoro non trovato' });
    }

    const userId = user.userId || user.id;
    const staffMember = await Staff.findOne({ userId: new mongoose.Types.ObjectId(userId) });

    if (!staffMember) {
      return res.status(403).json({ message: 'Operatore non collegato a uno staff: impossibile salvare la voce di diario' });
    }

    const entry = await DiarioClinico.create({
      workPlan: workPlanId,
      workPlanAccess: workPlanAccess || undefined,
      patient: workPlan.patient,
      staff: staffMember._id,
      staffName: user.name || `${staffMember.firstName} ${staffMember.lastName}` || 'Operatore',
      dataRegistrazione: new Date(),
      testo: testo.trim(),
      parametriVitali: parametriVitali || undefined,
      scaleValutazione: scaleValutazione || undefined,
      terapiaFarmacologica: terapiaFarmacologica?.length ? terapiaFarmacologica : undefined,
      firmaLogin: user.name || user.email || 'Operatore',
      firmato: false,
    });

    return res.status(201).json(entry);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel salvataggio del diario', error: error?.message });
  }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB, limite Groq Whisper
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo file audio sono accettati') as any);
    }
  },
});

// POST /api/diario/:workPlanId/voice - Crea voce diario da audio (STT + LLM)
router.post(
  '/:workPlanId/voice',
  authenticateToken,
  auditLog('diario-voice', 'CREATE', req => req.params.workPlanId),
  upload.single('audio'),
  async (req: Request, res: Response) => {
    try {
      if (!isVoiceAiAvailable()) {
        return res.status(503).json({ message: 'Voice AI non configurata. Imposta GROQ_API_KEY.' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'Nessun file audio ricevuto' });
      }

      const { workPlanId } = req.params;
      const workPlan = await WorkPlan.findById(workPlanId);
      if (!workPlan) {
        return res.status(404).json({ message: 'Piano di lavoro non trovato' });
      }

      const user = (req as any).user;
      const userId = user.userId || user.id;
      const staffMember = await Staff.findOne({ userId: new mongoose.Types.ObjectId(userId) });

      if (!staffMember) {
        return res.status(403).json({ message: 'Operatore non collegato a uno staff: impossibile creare voce diario da audio' });
      }

      const transcript = await transcribeAudio(req.file.buffer, req.file.originalname, req.file.mimetype);
      const extracted = await extractDiarioData(transcript, {
        workPlanType: workPlan.type,
      });

      const entry = await DiarioClinico.create({
        workPlan: workPlanId,
        patient: workPlan.patient,
        staff: staffMember._id,
        staffName: user.name || `${staffMember.firstName} ${staffMember.lastName}` || 'Operatore',
        dataRegistrazione: new Date(),
        testo: extracted.testo,
        parametriVitali: extracted.parametriVitali || undefined,
        scaleValutazione: extracted.scaleValutazione || undefined,
        terapiaFarmacologica: extracted.terapiaFarmacologica?.length ? extracted.terapiaFarmacologica : undefined,
        firmaLogin: user.name || user.email || 'Operatore',
        firmato: false,
      });

      return res.status(201).json({
        entry,
        transcript,
        extracted,
        message: 'Voce diario registrata da audio',
      });
    } catch (error: any) {
      console.error('[Diario Voice] Errore:', error);
      return res.status(500).json({ message: 'Errore nella trascrizione audio', error: error?.message });
    }
  }
);

// POST /api/diario/firma/:entryId - Firma una voce del diario (blocca definitivamente) con marcatura temporale
router.post('/firma/:entryId', authenticateToken, auditLog('diario', 'UPDATE', req => req.params.entryId), async (req: Request, res: Response) => {
  try {
    const { entryId } = req.params;
    const { firmaGrafometrica } = req.body;
    const user = (req as any).user;

    if (!firmaGrafometrica || typeof firmaGrafometrica !== 'string' || !firmaGrafometrica.startsWith('data:image/')) {
      return res.status(400).json({ message: 'La firma eseguita con dito o penna è obbligatoria' });
    }

    const entry = await DiarioClinico.findById(entryId);
    if (!entry) {
      return res.status(404).json({ message: 'Voce non trovata' });
    }

    if (entry.firmato) {
      return res.status(400).json({ message: 'Questa voce è già stata firmata e non può essere modificata' });
    }

    // Prepara documento per marcatura temporale
    const docContent = {
      _id: entry._id.toString(),
      workPlan: entry.workPlan.toString(),
      patient: entry.patient.toString(),
      staff: entry.staff.toString(),
      staffName: entry.staffName,
      dataRegistrazione: entry.dataRegistrazione,
      testo: entry.testo,
      parametriVitali: entry.parametriVitali,
      firmaGrafometrica,
    };

    // Genera marcatura temporale e prepara firma digitale futura
    const { hash, timestamp, signaturePlaceholder } = await addTimestampToDocument(
      docContent,
      { includeSignature: true }
    );

    // Aggiorna entry con firma semplice + marcatura temporale
    entry.firmato = true;
    entry.dataFirma = new Date();
    entry.firmaLogin = user.name || user.email || 'Operatore';
    entry.documentHash = hash;
    entry.timestamp = {
      timestamp: timestamp.timestamp,
      timestampToken: timestamp.timestampToken,
      serialNumber: timestamp.serialNumber,
      tsaName: timestamp.tsaName,
      hashAlgorithm: timestamp.hashAlgorithm,
      hashValue: timestamp.hashValue,
    };
    entry.firmaDigitale = {
      tipo: 'FEA',
      hashToSign: signaturePlaceholder,
      signatureValue: firmaGrafometrica,
      signedAt: entry.dataFirma,
    };

    await entry.save();

    return res.json({
      entry,
      message: 'Voce firmata con marcatura temporale',
      timestampInfo: {
        tsa: timestamp.tsaName,
        serialNumber: timestamp.serialNumber,
        timestamp: timestamp.timestamp,
      },
    });
  } catch (error: any) {
    console.error('[Diario] Errore firma con timestamp:', error);
    return res.status(500).json({ message: 'Errore nella firma', error: error?.message });
  }
});

router.delete('/entry/:entryId', authenticateToken, auditLog('diario', 'DELETE', req => req.params.entryId), async (req: Request, res: Response) => {
  try {
    const { entryId } = req.params;
    const user = (req as any).user;
    const entry = await DiarioClinico.findById(entryId);
    if (!entry) return res.status(404).json({ message: 'Voce non trovata' });
    if (entry.firmato) return res.status(400).json({ message: 'La voce firmata e bloccata non può essere eliminata' });

    const userId = user.userId || user.id;
    const staffMember = userId ? await Staff.findOne({ userId: new mongoose.Types.ObjectId(userId) }) : null;
    const autore = !!staffMember && entry.staff.toString() === staffMember._id.toString();
    if (!autore && user.role !== 'admin' && user.role !== 'direttore') {
      return res.status(403).json({ message: 'Puoi eliminare solo le tue voci non firmate' });
    }

    await entry.deleteOne();
    return res.json({ message: 'Voce non firmata eliminata' });
  } catch (error) {
    return res.status(500).json({ message: 'Errore nell\'eliminazione', error });
  }
});

// GET /api/diario/storico/tutti - Storico cartelle cliniche (tutti i pazienti, solo admin/coord/direttore)
router.get('/storico/tutti', authenticateToken, auditLog('diario-storico', 'READ'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'admin' && user.role !== 'coordinator' && user.role !== 'direttore') {
      return res.status(403).json({ message: 'Non autorizzato' });
    }

    const { paziente } = req.query;

    // Raggruppa per paziente + piano di lavoro
    const matchStage: any = {};
    if (paziente) {
      // Cerca i pazienti per nome
      const Patient = (await import('../models/Patient')).default;
      const pazienti = await Patient.find({
        $or: [
          { firstName: { $regex: paziente as string, $options: 'i' } },
          { lastName: { $regex: paziente as string, $options: 'i' } },
        ]
      }).select('_id');
      matchStage.patient = { $in: pazienti.map(p => p._id) };
    }

    const cartelle = await DiarioClinico.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { patient: '$patient', workPlan: '$workPlan' },
          entries: { $push: '$$ROOT' },
          ultimaRegistrazione: { $max: '$dataRegistrazione' },
          primaRegistrazione: { $min: '$dataRegistrazione' },
          totaleVoci: { $sum: 1 },
          vociFirmate: { $sum: { $cond: ['$firmato', 1, 0] } },
        }
      },
      { $sort: { ultimaRegistrazione: -1 } },
      {
        $lookup: {
          from: 'patients',
          localField: '_id.patient',
          foreignField: '_id',
          as: 'pazienteInfo'
        }
      },
      {
        $lookup: {
          from: 'workplans',
          localField: '_id.workPlan',
          foreignField: '_id',
          as: 'workPlanInfo'
        }
      },
      // Escludi cartelle di piani eliminati (workPlanInfo vuoto)
      { $match: { workPlanInfo: { $not: { $size: 0 } } } },
      {
        $project: {
          paziente: { $arrayElemAt: ['$pazienteInfo', 0] },
          workPlan: { $arrayElemAt: ['$workPlanInfo', 0] },
          ultimaRegistrazione: 1,
          primaRegistrazione: 1,
          totaleVoci: 1,
          vociFirmate: 1,
        }
      }
    ]);

    return res.json(cartelle);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel recupero dello storico', error: error?.message });
  }
});

export default router;
