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
    const isTipo = tipo === 'privato' || tipo === 'convenzione';
    const patientFilter: any = isTipo ? { tipoGestione: tipo } : {};

    const [
      patientsCount,
      staffCount,
      operatoriSenzaZonaCount,
    ] = await Promise.all([
      Patient.countDocuments(patientFilter),
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

    // Conteggio piani filtrati per gestione del paziente associato
    const workplans = await WorkPlan.find({})
      .populate('patient', 'tipoGestione')
      .lean();

    const workplansFiltrati = isTipo
      ? (workplans as any[]).filter((wp: any) => (wp.patient as any)?.tipoGestione === tipo)
      : (workplans as any[]);

    const workplanCount = workplansFiltrati.length;
    const activeWorkplans = workplansFiltrati.filter((wp: any) => wp.status === 'pending');
    const activeWorkplanCount = activeWorkplans.length;
    const activePatientIds = new Set(
      activeWorkplans
        .map((wp: any) => (wp.patient as any)?._id?.toString())
        .filter(Boolean)
    );
    const activePatientsCount = activePatientIds.size;

    const prelieviOggiCount = await Prelievo.countDocuments({
      dataPrelievo: { $gte: inizioOggi, $lt: fineOggi },
      status: 'pianificato',
      ...(isTipo ? { tipoGestione: tipo } : {}),
    });

    // Scadenze SIAT: visibili solo in modalità convenzione o senza filtro
    let scadenzeImminentiCount = 0;
    let paiInScadenza7gg = 0;
    if (!isTipo || tipo === 'convenzione') {
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
