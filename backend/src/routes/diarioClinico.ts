import { Router, Request, Response } from 'express';
import DiarioClinico from '../models/DiarioClinico';
import WorkPlan from '../models/WorkPlan';
import Staff from '../models/Staff';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// GET /api/diario/:workPlanId - Ottieni diario clinico per un piano di lavoro
router.get('/:workPlanId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { workPlanId } = req.params;
    const entries = await DiarioClinico.find({ workPlan: workPlanId })
      .sort({ dataRegistrazione: -1 });
    return res.json(entries);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero del diario', error });
  }
});

// GET /api/diario/paziente/:patientId - Diario clinico completo del paziente (storico cartelle)
router.get('/paziente/:patientId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const entries = await DiarioClinico.find({ patient: patientId })
      .populate('workPlan', 'task date type category status')
      .sort({ dataRegistrazione: -1 });
    return res.json(entries);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero del diario', error });
  }
});

// POST /api/diario/:workPlanId - Aggiungi voce al diario (non firmata, modificabile)
router.post('/:workPlanId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { workPlanId } = req.params;
    const { testo, parametriVitali, workPlanAccess } = req.body;
    const user = (req as any).user;

    if (!testo?.trim()) {
      return res.status(400).json({ message: 'Il testo del diario è obbligatorio' });
    }

    const workPlan = await WorkPlan.findById(workPlanId);
    if (!workPlan) {
      return res.status(404).json({ message: 'Piano di lavoro non trovato' });
    }

    const staffMember = await Staff.findOne({ userId: user.id || user._id });

    const entry = await DiarioClinico.create({
      workPlan: workPlanId,
      workPlanAccess: workPlanAccess || undefined,
      patient: workPlan.patient,
      staff: staffMember?._id || user.id,
      staffName: user.name || `${staffMember?.firstName} ${staffMember?.lastName}` || 'Operatore',
      dataRegistrazione: new Date(),
      testo: testo.trim(),
      parametriVitali: parametriVitali || undefined,
      firmaLogin: user.name || user.email || 'Operatore',
      firmato: false,
    });

    return res.status(201).json(entry);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel salvataggio del diario', error: error?.message });
  }
});

// POST /api/diario/firma/:entryId - Firma una voce del diario (blocca definitivamente)
router.post('/firma/:entryId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { entryId } = req.params;
    const user = (req as any).user;

    const entry = await DiarioClinico.findById(entryId);
    if (!entry) {
      return res.status(404).json({ message: 'Voce non trovata' });
    }

    if (entry.firmato) {
      return res.status(400).json({ message: 'Questa voce è già stata firmata e non può essere modificata' });
    }

    entry.firmato = true;
    entry.dataFirma = new Date();
    entry.firmaLogin = user.name || user.email || 'Operatore';
    await entry.save();

    return res.json(entry);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nella firma', error: error?.message });
  }
});

// DELETE /api/diario/entry/:entryId - Elimina voce (solo admin o direttore sanitario)
router.delete('/entry/:entryId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { entryId } = req.params;
    const user = (req as any).user;

    // Solo admin o direttore sanitario possono eliminare
    if (user.role !== 'admin' && user.role !== 'direttore') {
      return res.status(403).json({ message: 'Solo l\'amministratore o il direttore sanitario possono eliminare voci del diario' });
    }

    const entry = await DiarioClinico.findByIdAndDelete(entryId);
    if (!entry) {
      return res.status(404).json({ message: 'Voce non trovata' });
    }

    return res.json({ message: 'Voce eliminata' });
  } catch (error) {
    return res.status(500).json({ message: 'Errore nell\'eliminazione', error });
  }
});

// GET /api/diario/storico/tutti - Storico cartelle cliniche (tutti i pazienti, solo admin/coord/direttore)
router.get('/storico/tutti', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'admin' && user.role !== 'coordinator' && user.role !== 'direttore') {
      return res.status(403).json({ message: 'Non autorizzato' });
    }

    const { paziente } = req.query;

    // Raggruppa per paziente + piano di lavoro
    const matchStage: any = {};
    if (paziente) {
      // Cerca i pazienti per nome
      const Patient = (await import('../models/Patient')).default;
      const pazienti = await Patient.find({
        $or: [
          { firstName: { $regex: paziente as string, $options: 'i' } },
          { lastName: { $regex: paziente as string, $options: 'i' } },
        ]
      }).select('_id');
      matchStage.patient = { $in: pazienti.map(p => p._id) };
    }

    const cartelle = await DiarioClinico.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { patient: '$patient', workPlan: '$workPlan' },
          entries: { $push: '$$ROOT' },
          ultimaRegistrazione: { $max: '$dataRegistrazione' },
          primaRegistrazione: { $min: '$dataRegistrazione' },
          totaleVoci: { $sum: 1 },
          vociFirmate: { $sum: { $cond: ['$firmato', 1, 0] } },
        }
      },
      { $sort: { ultimaRegistrazione: -1 } },
      {
        $lookup: {
          from: 'patients',
          localField: '_id.patient',
          foreignField: '_id',
          as: 'pazienteInfo'
        }
      },
      {
        $lookup: {
          from: 'workplans',
          localField: '_id.workPlan',
          foreignField: '_id',
          as: 'workPlanInfo'
        }
      },
      {
        $project: {
          paziente: { $arrayElemAt: ['$pazienteInfo', 0] },
          workPlan: { $arrayElemAt: ['$workPlanInfo', 0] },
          ultimaRegistrazione: 1,
          primaRegistrazione: 1,
          totaleVoci: 1,
          vociFirmate: 1,
        }
      }
    ]);

    return res.json(cartelle);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel recupero dello storico', error: error?.message });
  }
});

export default router;
