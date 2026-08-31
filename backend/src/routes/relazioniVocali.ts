import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { generateProfessionalRelation, isVoiceAiAvailable, transcribeAudio } from '../utils/voiceAi';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 }, fileFilter: (_req, file, cb) => file.mimetype.startsWith('audio/') ? cb(null, true) : cb(new Error('Solo file audio sono accettati') as any) });

router.post('/professionale', authenticateToken, auditLog('relazioni_vocali', 'CREATE'), upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!isVoiceAiAvailable()) return res.status(503).json({ message: 'Voice AI non configurata. Imposta GROQ_API_KEY.' });
    if (!req.file) return res.status(400).json({ message: 'Nessun audio ricevuto' });
    const transcript = await transcribeAudio(req.file.buffer, req.file.originalname, req.file.mimetype);
    const relazione = await generateProfessionalRelation(transcript, String(req.body.contesto || 'Relazione sanitaria'));
    return res.json({ trascrizione: transcript, relazione });
  } catch (error: any) { return res.status(500).json({ message: 'Errore nella trascrizione della relazione', error: error.message }); }
});

router.post('/diaria', authenticateToken, auditLog('relazioni_vocali', 'CREATE'), async (req: Request, res: Response) => {
  try {
    if (!isVoiceAiAvailable()) return res.status(503).json({ message: 'Voice AI non configurata. Imposta GROQ_API_KEY.' });
    const dettatura = typeof req.body.dettatura === 'string' ? req.body.dettatura.trim() : '';
    if (!dettatura) return res.status(400).json({ message: 'Nessuna dettatura fornita' });
    const contesto = typeof req.body.contesto === 'string' ? req.body.contesto.trim() : 'Diaria clinica';
    const relazione = await generateProfessionalRelation(dettatura, contesto);
    return res.json({ relazione });
  } catch (error: any) { return res.status(500).json({ message: 'Errore nella generazione della diaria', error: error.message }); }
});

export default router;
