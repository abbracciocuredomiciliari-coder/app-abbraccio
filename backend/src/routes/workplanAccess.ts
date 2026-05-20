import { Router, Request, Response } from 'express';
import WorkPlan from '../models/WorkPlan';
import WorkPlanAccess from '../models/WorkPlanAccess';
import Staff from '../models/Staff';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// GET /api/workplan-access/:workPlanId - Ottieni tutti gli accessi per un piano di lavoro
router.get('/:workPlanId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { workPlanId } = req.params;
    const accesses = await WorkPlanAccess.find({ workPlan: workPlanId })
      .sort({ oraEntrata: -1 });
    return res.json(accesses);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero degli accessi', error });
  }
});

// POST /api/workplan-access/:workPlanId/entrata - Registra entrata
router.post('/:workPlanId/entrata', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { workPlanId } = req.params;
    const { note } = req.body;
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ message: 'Non autenticato' });
    }

    // Verifica che il piano di lavoro esista
    const workPlan = await WorkPlan.findById(workPlanId)
      .populate('patient', 'firstName lastName')
      .populate('staff', 'firstName lastName role');

    if (!workPlan) {
      return res.status(404).json({ message: 'Piano di lavoro non trovato' });
    }

    // Cerca il profilo staff corrispondente all'utente loggato
    const staffMember = await Staff.findOne({ userId: user.id || user._id });

    // Controlla se c'è già un accesso aperto (entrata senza uscita) per questo utente su questo piano
    const accessoAperto = await WorkPlanAccess.findOne({
      workPlan: workPlanId,
      staffId: staffMember?._id || user.id,
      oraUscita: { $exists: false }
    });

    if (accessoAperto) {
      return res.status(400).json({ 
        message: 'Hai già registrato un\'entrata per questo piano. Registra prima l\'uscita.',
        accessoAperto
      });
    }

    const ipAddress = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '';

    const accesso = await WorkPlanAccess.create({
      workPlan: workPlanId,
      staffId: staffMember?._id || user.id,
      staffName: user.name || `${staffMember?.firstName} ${staffMember?.lastName}` || 'Utente',
      staffRole: user.role || staffMember?.role || 'operatore',
      oraEntrata: new Date(),
      note: note?.trim(),
      firmaLogin: user.name || user.email || 'Utente',
      ipAddress: ipAddress.toString().split(',')[0].trim(),
    });

    return res.status(201).json({ 
      message: 'Entrata registrata con successo',
      accesso,
      workPlan
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nella registrazione dell\'entrata', error: error?.message });
  }
});

// PATCH /api/workplan-access/:accessId/uscita - Registra uscita
router.patch('/:accessId/uscita', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { accessId } = req.params;
    const { note } = req.body;
    const user = (req as any).user;

    const accesso = await WorkPlanAccess.findById(accessId);

    if (!accesso) {
      return res.status(404).json({ message: 'Accesso non trovato' });
    }

    if (accesso.oraUscita) {
      return res.status(400).json({ message: 'L\'uscita è già stata registrata per questo accesso' });
    }

    // Verifica che sia lo stesso utente (o admin/coordinator)
    const staffMember = await Staff.findOne({ userId: user.id || user._id });
    const isOwner = accesso.staffId.toString() === (staffMember?._id?.toString() || user.id);
    const isAdmin = user.role === 'admin' || user.role === 'coordinator';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Non autorizzato a registrare l\'uscita per questo accesso' });
    }

    const oraUscita = new Date();
    const durataMinuti = Math.round((oraUscita.getTime() - accesso.oraEntrata.getTime()) / 60000);

    accesso.oraUscita = oraUscita;
    if (note?.trim()) {
      accesso.note = note.trim();
    }
    await accesso.save();

    return res.json({ 
      message: 'Uscita registrata con successo',
      accesso,
      durataMinuti
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nella registrazione dell\'uscita', error: error?.message });
  }
});

// GET /api/workplan-access/miei-accessi/aperti - Accessi aperti dell'utente corrente
router.get('/miei-accessi/aperti', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const staffMember = await Staff.findOne({ userId: user.id || user._id });

    const accessiAperti = await WorkPlanAccess.find({
      staffId: staffMember?._id || user.id,
      oraUscita: { $exists: false }
    }).populate('workPlan');

    return res.json(accessiAperti);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero degli accessi aperti', error });
  }
});

// GET /api/workplan-access/piano/:workPlanId/info - Info piano + accessi (per pagina remota)
router.get('/piano/:workPlanId/info', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { workPlanId } = req.params;

    const workPlan = await WorkPlan.findById(workPlanId)
      .populate('patient', 'firstName lastName address')
      .populate('staff', 'firstName lastName role');

    if (!workPlan) {
      return res.status(404).json({ message: 'Piano di lavoro non trovato' });
    }

    const accessi = await WorkPlanAccess.find({ workPlan: workPlanId })
      .sort({ oraEntrata: -1 })
      .limit(20);

    const user = (req as any).user;
    const staffMember = await Staff.findOne({ userId: user.id || user._id });

    const accessoApertoUtente = await WorkPlanAccess.findOne({
      workPlan: workPlanId,
      staffId: staffMember?._id || user.id,
      oraUscita: { $exists: false }
    });

    return res.json({
      workPlan,
      accessi,
      accessoApertoUtente: accessoApertoUtente || null,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero delle informazioni', error });
  }
});

export default router;
