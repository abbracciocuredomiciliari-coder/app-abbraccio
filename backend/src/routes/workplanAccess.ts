import { Router, Request, Response } from 'express';
import WorkPlan from '../models/WorkPlan';
import WorkPlanAccess from '../models/WorkPlanAccess';
import { authenticateToken } from '../middleware/auth';
import { getStaffByUser } from '../utils/staffHelper';

const router = Router();

// Funzione helper: ricalcola compensoTotale sul WorkPlan sommando tutti gli accessi completati
async function ricalcolaCompensoTotale(workPlanId: string): Promise<void> {
  const workplan = await WorkPlan.findById(workPlanId);
  if (!workplan) return;

  const accessi = await WorkPlanAccess.find({ workPlan: workPlanId, oraUscita: { $exists: true } });

  if (workplan.tipoCompenso === 'nessuno' || !workplan.tariffa) {
    workplan.compensoTotale = 0;
  } else if (workplan.tipoCompenso === 'orario') {
    // Somma i compensi maturati da ogni accesso
    let totale = 0;
    for (const acc of accessi) {
      totale += acc.compensoMaturato || 0;
    }
    workplan.compensoTotale = Math.round(totale * 100) / 100;
  } else if (workplan.tipoCompenso === 'fisso') {
    // Compenso fisso: vale per ogni accesso completato
    workplan.compensoTotale = Math.round(accessi.length * (workplan.tariffa || 0) * 100) / 100;
  }

  await workplan.save();
}

// Funzione helper: calcola compenso per un singolo accesso
function calcolaCompensoAccesso(
  tipoCompenso: string | undefined,
  tariffa: number | undefined,
  durataMinuti: number
): number {
  if (!tipoCompenso || tipoCompenso === 'nessuno' || !tariffa) return 0;
  if (tipoCompenso === 'orario') {
    return Math.round((durataMinuti / 60) * tariffa * 100) / 100;
  }
  if (tipoCompenso === 'fisso') {
    return tariffa; // ogni accesso vale la tariffa fissa
  }
  return 0;
}

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
    const { note, firmaOperatore } = req.body;
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
    const staffMember = await getStaffByUser(user.userId, user.email);

    // Controlla se c'è già un accesso aperto (entrata senza uscita) per questo utente su questo piano
    const accessoAperto = await WorkPlanAccess.findOne({
      workPlan: workPlanId,
      staffId: staffMember?._id || user.userId,
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
      staffId: staffMember?._id || user.userId,
      staffName: user.name || `${staffMember?.firstName} ${staffMember?.lastName}` || 'Utente',
      staffRole: user.role || staffMember?.role || 'operatore',
      oraEntrata: new Date(),
      note: note?.trim(),
      firmaLogin: user.name || user.email || 'Utente',
      ipAddress: ipAddress.toString().split(',')[0].trim(),
      durataMinuti: 0,
      compensoMaturato: 0,
      firmaOperatore: firmaOperatore || undefined,
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

// PATCH /api/workplan-access/:accessId/uscita - Registra uscita + calcola compenso maturato
router.patch('/:accessId/uscita', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { accessId } = req.params;
    const { note, firmaOperatore, firmaPaziente, nomeFirmatarioPaziente, ruoloFirmatario } = req.body;
    const user = (req as any).user;

    const accesso = await WorkPlanAccess.findById(accessId);

    if (!accesso) {
      return res.status(404).json({ message: 'Accesso non trovato' });
    }

    if (accesso.oraUscita) {
      return res.status(400).json({ message: 'L\'uscita è già stata registrata per questo accesso' });
    }

    // Verifica che sia lo stesso utente (o admin/coordinator)
    const staffMember = await getStaffByUser(user.userId, user.email);
    const isOwner = accesso.staffId.toString() === (staffMember?._id?.toString() || user.userId);
    const isAdmin = user.role === 'admin' || user.role === 'coordinator';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Non autorizzato a registrare l\'uscita per questo accesso' });
    }

    const oraUscita = new Date();
    const durataMinuti = Math.round((oraUscita.getTime() - accesso.oraEntrata.getTime()) / 60000);

    // Recupera il piano di lavoro per calcolare il compenso
    const workplan = await WorkPlan.findById(accesso.workPlan);
    const compensoMaturato = workplan
      ? calcolaCompensoAccesso(workplan.tipoCompenso, workplan.tariffa, durataMinuti)
      : 0;

    accesso.oraUscita = oraUscita;
    accesso.durataMinuti = durataMinuti;
    accesso.compensoMaturato = compensoMaturato;
    if (note?.trim()) accesso.note = note.trim();
    if (firmaOperatore) accesso.firmaOperatore = firmaOperatore;
    if (firmaPaziente) {
      accesso.firmaPaziente = firmaPaziente;
      accesso.nomeFirmatarioPaziente = nomeFirmatarioPaziente?.trim() || 'Paziente';
      accesso.ruoloFirmatario = ruoloFirmatario || 'paziente';
      accesso.firmatoAllaPartenza = true;
    }
    await accesso.save();

    // Aggiorna il compensoTotale sul WorkPlan sommando tutti gli accessi
    await ricalcolaCompensoTotale(accesso.workPlan.toString());

    // Ricarica il workplan aggiornato
    const workplanAggiornato = await WorkPlan.findById(accesso.workPlan);

    return res.json({ 
      message: 'Uscita registrata con successo',
      accesso,
      durataMinuti,
      compensoMaturato,
      compensoTotaleAggiornato: workplanAggiornato?.compensoTotale || 0,
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nella registrazione dell\'uscita', error: error?.message });
  }
});

// PATCH /api/workplan-access/:accessId/firma-operatore - Aggiunge/aggiorna firma operatore
router.patch('/:accessId/firma-operatore', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { accessId } = req.params;
    const { firmaOperatore } = req.body;

    if (!firmaOperatore) {
      return res.status(400).json({ message: 'Firma operatore richiesta' });
    }

    const accesso = await WorkPlanAccess.findByIdAndUpdate(
      accessId,
      { firmaOperatore },
      { new: true }
    );

    if (!accesso) return res.status(404).json({ message: 'Accesso non trovato' });

    return res.json({ message: 'Firma operatore salvata', accesso });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore salvataggio firma', error: error?.message });
  }
});

// GET /api/workplan-access/miei-accessi/aperti - Accessi aperti dell'utente corrente
router.get('/miei-accessi/aperti', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const staffMember = await getStaffByUser(user.userId, user.email);

    const accessiAperti = await WorkPlanAccess.find({
      staffId: staffMember?._id || user.userId,
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
    const staffMember = await getStaffByUser(user.userId, user.email);

    const accessoApertoUtente = await WorkPlanAccess.findOne({
      workPlan: workPlanId,
      staffId: staffMember?._id || user.userId,
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
