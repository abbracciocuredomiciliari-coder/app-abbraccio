import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import CustomerSatisfaction from '../models/CustomerSatisfaction';
import Patient from '../models/Patient';

const router = Router();
router.use(authenticateToken);

router.get('/:patientId', authorizeRole('admin', 'coordinator', 'direttore', 'operatore'), auditLog('customer_satisfaction', 'READ', req => req.params.patientId), async (req: AuthRequest, res: Response) => {
  try {
    const schede = await CustomerSatisfaction.find({ patientId: req.params.patientId }).sort({ dataCompilazione: -1 });
    return res.json(schede);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel recupero dei questionari', error: error.message });
  }
});

router.post('/', authorizeRole('admin', 'coordinator'), auditLog('customer_satisfaction', 'CREATE', req => req.body.patientId), async (req: AuthRequest, res: Response) => {
  try {
    const { patientId, firmatarioTipo, nomeFirmatario, cognomeFirmatario, risposte, suggerimenti, firmaFirmatario, firmaCoordinatore } = req.body;
    if (!patientId || !nomeFirmatario?.trim() || !cognomeFirmatario?.trim() || !firmaFirmatario || !firmaCoordinatore) {
      return res.status(400).json({ message: 'Paziente, firmatario e le due firme sono obbligatori' });
    }
    const campi = ['cortesiaProfessionalita', 'puntualitaOrganizzazione', 'chiarezzaInformazioni', 'qualitaAssistenza', 'soddisfazioneComplessiva'];
    if (!risposte || campi.some(campo => !Number.isInteger(risposte[campo]) || risposte[campo] < 1 || risposte[campo] > 5)) {
      return res.status(400).json({ message: 'Rispondere a tutte le domande con un valore da 1 a 5' });
    }
    const patient = await Patient.findById(patientId);
    if (!patient) return res.status(404).json({ message: 'Paziente non trovato' });
    const user = req.user as { userId: string; name?: string; email: string };
    const scheda = await CustomerSatisfaction.create({
      patientId,
      firmatarioTipo: firmatarioTipo === 'caregiver' ? 'caregiver' : 'paziente',
      nomeFirmatario: nomeFirmatario.trim(),
      cognomeFirmatario: cognomeFirmatario.trim(),
      risposte,
      suggerimenti: suggerimenti?.trim(),
      firmaFirmatario,
      firmaCoordinatore,
      coordinatoreId: user.userId,
      coordinatoreNome: user.name || user.email,
    });
    return res.status(201).json({ message: 'Questionario archiviato', scheda });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel salvataggio del questionario', error: error.message });
  }
});

export default router;
