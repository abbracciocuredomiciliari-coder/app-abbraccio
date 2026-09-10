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
    const tra7giorni = new Date(oggi.getTime() + 7 * 24 * 60 * 60 * 1000);

    const { tipo } = req.query;
    const isConvenzione = tipo === 'convenzione';
    const isPrivato = tipo === 'privato';
    const isTipo = isConvenzione || isPrivato;

    let patientFilter: any = {};
    if (isConvenzione) patientFilter = { tipoGestione: 'convenzione' };
    else if (isPrivato) patientFilter = { $or: [{ tipoGestione: 'privato' }, { tipoGestione: { $exists: false } }] };

    const [
      patientsCount,
      staffCount,
      operatoriSenzaZonaCount,
    ] = await Promise.all([
      Patient.countDocuments(isTipo ? patientFilter : {}),
      Staff.countDocuments({ active: true }),
      Staff.countDocuments({
        active: true,
        $or: [
          { domicilioPartenza: { $exists: false } },
          { domicilioPartenza: '' },
          { 'domicilioCoords.lat': { $exists: false } },
        ],
      }),
    ]);

    // Conteggio piani e pazienti attivi per gestione
    let workplanCount = 0;
    let activeWorkplanCount = 0;
    let activePatientsCount = 0;
    if (isTipo) {
      const pazientiIds = (await Patient.find(patientFilter).select('_id')).map(p => p._id);
      [
        workplanCount,
        activeWorkplanCount,
        activePatientsCount,
      ] = await Promise.all([
        WorkPlan.countDocuments({ patient: { $in: pazientiIds } }),
        WorkPlan.countDocuments({ patient: { $in: pazientiIds }, status: 'pending' }),
        WorkPlan.distinct('patient', { patient: { $in: pazientiIds }, status: 'pending' }).then(ids => ids.length),
      ]);
    } else {
      [
        workplanCount,
        activeWorkplanCount,
        activePatientsCount,
      ] = await Promise.all([
        WorkPlan.countDocuments(),
        WorkPlan.countDocuments({ status: 'pending' }),
        WorkPlan.distinct('patient', { status: 'pending' }).then(ids => ids.length),
      ]);
    }

    const prelieviOggiCount = await Prelievo.countDocuments({
      dataPrelievo: { $gte: inizioOggi, $lt: fineOggi },
      status: 'pianificato',
      ...(isTipo ? { tipoGestione: tipo } : {}),
    });

    // Scadenze SIAT: visibili solo in modalità convenzione o senza filtro
    let scadenzeImminentiCount = 0;
    let paiInScadenza7gg = 0;
    if (!isTipo || isConvenzione) {
      scadenzeImminentiCount = await Patient.countDocuments({
        tipoGestione: 'convenzione',
        'siat.dataScadenzaAutorizzazione': { $gte: oggi, $lte: tra30giorni },
      });
      paiInScadenza7gg = await Patient.find({
        tipoGestione: 'convenzione',
        'siat.dataScadenzaAutorizzazione': { $lte: tra7giorni },
      }).select('siat.dataScadenzaAutorizzazione alertPaiVisto').then(pazienti =>
        pazienti.filter(p => {
          const scadenza = p.siat?.dataScadenzaAutorizzazione;
          if (!scadenza) return false;
          if (p.alertPaiVisto?.vistoIl) {
            const vistoIl = new Date(p.alertPaiVisto.vistoIl);
            const scadenzaDate = new Date(scadenza);
            if (scadenzaDate < oggi && vistoIl < scadenzaDate) return true;
            return false;
          }
          return true;
        }).length
      );
    }

    return res.json({
      patientsCount,
      staffCount,
      workplanCount,
      activePatientsCount,
      activeWorkplanCount,
      prelieviOggiCount,
      operatoriSenzaZonaCount,
      scadenzeImminentiCount,
      paiInScadenza7gg,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero dei dati della dashboard', error });
  }
});

export default router;
