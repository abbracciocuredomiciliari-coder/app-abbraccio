import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import RiformulazionePAI from '../models/RiformulazionePAI';
import Patient from '../models/Patient';

const router = Router();
router.use(authenticateToken);

router.get('/:patientId', authorizeRole('admin', 'coordinator', 'direttore', 'operatore'), auditLog('riformulazione_pai', 'READ', req => req.params.patientId), async (req: AuthRequest, res: Response) => {
  try { return res.json(await RiformulazionePAI.find({ patientId: req.params.patientId }).sort({ dataScheda: -1 })); }
  catch (error: any) { return res.status(500).json({ message: 'Errore recupero schede PAI', error: error.message }); }
});

router.post('/', authorizeRole('admin', 'coordinator', 'direttore'), auditLog('riformulazione_pai', 'CREATE', req => req.body.patientId), async (req: AuthRequest, res: Response) => {
  try {
    const { patientId, workPlanId, tipo, tipologiaPrestazione, motivazioni, relazioneVerbale, allegati, firmaCoordinatore } = req.body;
    if (!patientId || !['riformulazione', 'rinnovo'].includes(tipo) || !tipologiaPrestazione?.trim() || !motivazioni?.trim() || !relazioneVerbale?.trim() || !firmaCoordinatore) {
      return res.status(400).json({ message: 'Compilare tipo scheda, prestazione, motivazioni, relazione e firma' });
    }
    if (!await Patient.findById(patientId)) return res.status(404).json({ message: 'Paziente non trovato' });
    const allegatiValidi = Array.isArray(allegati) ? allegati.filter(a => a?.nome && a?.tipo && typeof a?.dati === 'string' && a.dati.startsWith('data:')).slice(0, 5) : [];
    if (allegatiValidi.some(a => a.dati.length > 5_500_000)) return res.status(400).json({ message: 'Ogni allegato deve essere inferiore a 4 MB' });
    if (allegatiValidi.reduce((totale, allegato) => totale + allegato.dati.length, 0) > 8_500_000) return res.status(400).json({ message: 'La dimensione complessiva degli allegati deve essere inferiore a 6 MB' });
    const user = req.user as { userId: string; name?: string; email: string };
    const scheda = await RiformulazionePAI.create({ patientId, workPlanId, tipo, tipologiaPrestazione: tipologiaPrestazione.trim(), motivazioni: motivazioni.trim(), relazioneVerbale: relazioneVerbale.trim(), allegati: allegatiValidi, firmaCoordinatore, coordinatoreId: user.userId, coordinatoreNome: user.name || user.email });
    return res.status(201).json({ message: 'Scheda PAI archiviata', scheda });
  } catch (error: any) { return res.status(500).json({ message: 'Errore salvataggio scheda PAI', error: error.message }); }
});

export default router;
