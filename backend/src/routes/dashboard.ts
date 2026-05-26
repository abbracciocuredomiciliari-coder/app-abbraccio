import { Router, Request, Response } from 'express';
import Patient from '../models/Patient';
import Staff from '../models/Staff';
import WorkPlan from '../models/WorkPlan';
import { authenticateToken } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';

const router = Router();

router.get('/', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const [patientsCount, staffCount, workplanCount, activePatientsCount, activeWorkplanCount] = await Promise.all([
      Patient.countDocuments(),
      Staff.countDocuments({ active: true }),
      WorkPlan.countDocuments(),
      // Pazienti con almeno un piano attivo (pending)
      WorkPlan.distinct('patient', { status: 'pending' }).then(ids => ids.length),
      // Incarichi attivi
      WorkPlan.countDocuments({ status: 'pending' }),
    ]);

    return res.json({
      patientsCount,
      staffCount,
      workplanCount,
      activePatientsCount,
      activeWorkplanCount,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero dei dati della dashboard', error });
  }
});

export default router;
