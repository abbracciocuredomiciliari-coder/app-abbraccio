import { Router, Request, Response } from 'express';
import WorkPlan from '../models/WorkPlan';
import WorkPlanAccess from '../models/WorkPlanAccess';
import { authenticateToken } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';

const router = Router();

// Get all workplan items (operatore vede solo i propri, admin/coordinator vedono tutti)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isAdminOrCoord = user.role === 'admin' || user.role === 'coordinator';

    let filter: any = {};

    if (!isAdminOrCoord) {
      // Operatore: trova il suo profilo Staff tramite userId
      const staffMember = await (await import('../models/Staff')).default.findOne({ userId: user.id || user._id });
      if (staffMember) {
        filter.staff = staffMember._id;
      } else {
        // Se non ha profilo staff, non vede nulla
        return res.json([]);
      }
    }

    const workplans = await WorkPlan.find(filter)
      .populate('patient', 'firstName lastName')
      .populate('staff', 'firstName lastName role category active')
      .sort({ date: 1 });
    return res.json(workplans);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero del piano di lavoro', error });
  }
});

// Create new workplan item
router.post('/', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const workplan = await WorkPlan.create(req.body);
    return res.status(201).json(workplan);
  } catch (error) {
    return res.status(400).json({ message: 'Errore nella creazione dell incarico', error });
  }
});

// Update workplan item
router.patch('/:id', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const workplan = await WorkPlan.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!workplan) {
      return res.status(404).json({ message: 'Incarico non trovato' });
    }
    return res.json(workplan);
  } catch (error) {
    return res.status(400).json({ message: 'Errore nell aggiornamento dell incarico', error });
  }
});

// Delete workplan item
router.delete('/:id', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const workplan = await WorkPlan.findByIdAndDelete(id);
    if (!workplan) {
      return res.status(404).json({ message: 'Incarico non trovato' });
    }
    return res.json({ message: 'Incarico eliminato con successo' });
  } catch (error) {
    return res.status(500).json({ message: 'Errore nell eliminazione dell incarico', error });
  }
});

// GET /api/workplan/:id/accessi - Storico accessi per un incarico
router.get('/:id/accessi', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const workplan = await WorkPlan.findById(id)
      .populate('patient', 'firstName lastName')
      .populate('staff', 'firstName lastName role');

    if (!workplan) {
      return res.status(404).json({ message: 'Incarico non trovato' });
    }

    const accessi = await WorkPlanAccess.find({ workPlan: id }).sort({ oraEntrata: -1 });

    // Calcola ore totali lavorate
    let minutiTotali = 0;
    for (const acc of accessi) {
      if (acc.oraUscita) {
        minutiTotali += Math.round((acc.oraUscita.getTime() - acc.oraEntrata.getTime()) / 60000);
      }
    }
    const oreTotali = minutiTotali / 60;

    // Calcola compenso in base al tipo
    let compensoCalcolato = 0;
    if (workplan.tipoCompenso === 'orario' && workplan.tariffa) {
      compensoCalcolato = Math.round(oreTotali * workplan.tariffa * 100) / 100;
    } else if (workplan.tipoCompenso === 'fisso' && workplan.tariffa) {
      compensoCalcolato = workplan.tariffa;
    }

    return res.json({
      workplan,
      accessi,
      riepilogo: {
        totaleAccessi: accessi.length,
        accessiCompletati: accessi.filter(a => a.oraUscita).length,
        accessiAperti: accessi.filter(a => !a.oraUscita).length,
        minutiTotali,
        oreTotali: Math.round(oreTotali * 100) / 100,
        compensoCalcolato,
        compensoSalvato: workplan.compensoTotale || 0,
        compensoPagato: workplan.compensoPagato || false,
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero degli accessi', error });
  }
});

// PATCH /api/workplan/:id/compenso - Aggiorna compenso (calcola o imposta manualmente)
router.patch('/:id/compenso', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tipoCompenso, tariffa, compensoTotale, compensoPagato, ricalcola } = req.body;

    const workplan = await WorkPlan.findById(id);
    if (!workplan) {
      return res.status(404).json({ message: 'Incarico non trovato' });
    }

    // Aggiorna i campi compenso
    if (tipoCompenso !== undefined) workplan.tipoCompenso = tipoCompenso;
    if (tariffa !== undefined) workplan.tariffa = tariffa;
    if (compensoPagato !== undefined) workplan.compensoPagato = compensoPagato;

    // Se ricalcola=true, calcola automaticamente dagli accessi
    if (ricalcola || compensoTotale === undefined) {
      const accessi = await WorkPlanAccess.find({ workPlan: id });
      let minutiTotali = 0;
      for (const acc of accessi) {
        if (acc.oraUscita) {
          minutiTotali += Math.round((acc.oraUscita.getTime() - acc.oraEntrata.getTime()) / 60000);
        }
      }
      const oreTotali = minutiTotali / 60;

      if (workplan.tipoCompenso === 'orario' && workplan.tariffa) {
        workplan.compensoTotale = Math.round(oreTotali * workplan.tariffa * 100) / 100;
      } else if (workplan.tipoCompenso === 'fisso' && workplan.tariffa) {
        workplan.compensoTotale = workplan.tariffa;
      }
    } else if (compensoTotale !== undefined) {
      workplan.compensoTotale = compensoTotale;
    }

    await workplan.save();
    return res.json(workplan);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nell\'aggiornamento del compenso', error: error?.message });
  }
});

export default router;
