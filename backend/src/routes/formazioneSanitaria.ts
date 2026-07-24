import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import FormazioneSanitaria from '../models/FormazioneSanitaria';
import Patient from '../models/Patient';

const router = Router();
router.use(authenticateToken);

router.get('/:patientId', authorizeRole('admin', 'coordinator', 'direttore', 'operatore'), auditLog('formazione_sanitaria', 'READ', req => req.params.patientId), async (req: AuthRequest, res: Response) => {
  try { return res.json(await FormazioneSanitaria.find({ patientId: req.params.patientId }).sort({ dataIntervento: -1 })); }
  catch (error: any) { return res.status(500).json({ message: 'Errore recupero schede formazione', error: error.message }); }
});

router.post('/', authorizeRole('admin', 'coordinator', 'direttore', 'operatore'), auditLog('formazione_sanitaria', 'CREATE', req => req.body.patientId), async (req: AuthRequest, res: Response) => {
  try {
    const { patientId, workPlanId, tipoScheda, personaFormata, ruoloPersonaFormata, argomento, relazione, dataIntervento, firmaOperatore } = req.body;
    if (!patientId || !['formazione_educazione', 'valutazione_formazione'].includes(tipoScheda) || !personaFormata?.trim() || !argomento?.trim() || !relazione?.trim() || !dataIntervento || !firmaOperatore) {
      return res.status(400).json({ message: 'Compilare tutti i campi e la firma dell’operatore' });
    }
    if (!await Patient.findById(patientId)) return res.status(404).json({ message: 'Paziente non trovato' });
    const user = req.user as { userId: string; name?: string; email: string };
    const scheda = await FormazioneSanitaria.create({ patientId, workPlanId, tipoScheda, personaFormata: personaFormata.trim(), ruoloPersonaFormata: ['paziente', 'caregiver', 'familiare', 'altro'].includes(ruoloPersonaFormata) ? ruoloPersonaFormata : 'altro', argomento: argomento.trim(), relazione: relazione.trim(), dataIntervento, firmaOperatore, operatoreId: user.userId, operatoreNome: user.name || user.email });
    return res.status(201).json({ message: 'Scheda formazione sanitaria archiviata', scheda });
  } catch (error: any) { return res.status(500).json({ message: 'Errore salvataggio scheda formazione', error: error.message }); }
});

export default router;
