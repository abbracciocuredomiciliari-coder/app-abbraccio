import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import SchedaDimissione from '../models/SchedaDimissione';
import Patient from '../models/Patient';

const router = Router();
router.use(authenticateToken);

router.get('/:patientId', authorizeRole('admin', 'coordinator', 'direttore', 'operatore'), auditLog('scheda_dimissione', 'READ', req => req.params.patientId), async (req: AuthRequest, res: Response) => {
  try {
    return res.json(await SchedaDimissione.find({ patientId: req.params.patientId }).sort({ dataDimissione: -1 }));
  } catch (error: any) { return res.status(500).json({ message: 'Errore nel recupero delle schede', error: error.message }); }
});

router.post('/', authorizeRole('admin', 'coordinator', 'direttore'), auditLog('scheda_dimissione', 'CREATE', req => req.body.patientId), async (req: AuthRequest, res: Response) => {
  try {
    const { patientId, dataInizioServizio, dataDimissione, motivazioni, altroMotivo, relazioneChiusura, firmaCoordinatore } = req.body;
    if (!patientId || !dataDimissione || !Array.isArray(motivazioni) || !motivazioni.length || !relazioneChiusura?.trim() || !firmaCoordinatore) {
      return res.status(400).json({ message: 'Compilare data, motivazione, relazione finale e firma del coordinatore' });
    }
    if (motivazioni.includes('altro') && !altroMotivo?.trim()) return res.status(400).json({ message: 'Specificare la motivazione alternativa' });
    if (!await Patient.findById(patientId)) return res.status(404).json({ message: 'Paziente non trovato' });
    const user = req.user as { userId: string; name?: string; email: string };
    const scheda = await SchedaDimissione.create({ patientId, dataInizioServizio: dataInizioServizio || undefined, dataDimissione, motivazioni, altroMotivo: altroMotivo?.trim(), relazioneChiusura: relazioneChiusura.trim(), firmaCoordinatore, coordinatoreId: user.userId, coordinatoreNome: user.name || user.email });
    return res.status(201).json({ message: 'Scheda dimissione archiviata', scheda });
  } catch (error: any) { return res.status(500).json({ message: 'Errore nel salvataggio della scheda', error: error.message }); }
});

export default router;
