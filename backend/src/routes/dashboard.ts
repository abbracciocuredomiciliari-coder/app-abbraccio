import { Router, Request, Response } from 'express';
import Patient from '../models/Patient';
import Staff from '../models/Staff';
import WorkPlan from '../models/WorkPlan';
import { authenticateToken } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import Prelievo from '../models/Prelievo';

const router = Router();

router.get('/', authenticateToken, authorizeRole('admin', 'coordinator', 'direttore'), async (req: Request, res: Response) => {
  try {
    const oggi = new Date();
    const inizioOggi = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
    const fineOggi = new Date(inizioOggi.getTime() + 24 * 60 * 60 * 1000);
    const tra30giorni = new Date(oggi.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      patientsCount,
      staffCount,
      workplanCount,
      activePatientsCount,
      activeWorkplanCount,
      prelieviOggiCount,
      operatoriSenzaZonaCount,
      scadenzeImminentiCount,
    ] = await Promise.all([
      Patient.countDocuments(),
      Staff.countDocuments({ active: true }),
      WorkPlan.countDocuments(),
      WorkPlan.distinct('patient', { status: 'pending' }).then(ids => ids.length),
      WorkPlan.countDocuments({ status: 'pending' }),
      // Prelievi pianificati oggi
      Prelievo.countDocuments({
        dataPrelievo: { $gte: inizioOggi, $lt: fineOggi },
        status: 'pianificato',
      }),
      // Operatori attivi senza zona impostata (non trovabili nell'assegnazione)
      Staff.countDocuments({
        active: true,
        $or: [
          { domicilioPartenza: { $exists: false } },
          { domicilioPartenza: '' },
          { 'domicilioCoords.lat': { $exists: false } },
        ],
      }),
      // Pazienti SIAT con autorizzazione in scadenza entro 30 giorni
      Patient.countDocuments({
        tipoGestione: 'convenzione',
        'siat.dataScadenzaAutorizzazione': { $gte: oggi, $lte: tra30giorni },
      }),
    ]);

    return res.json({
      patientsCount,
      staffCount,
      workplanCount,
      activePatientsCount,
      activeWorkplanCount,
      prelieviOggiCount,
      operatoriSenzaZonaCount,
      scadenzeImminentiCount,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero dei dati della dashboard', error });
  }
});

export default router;
