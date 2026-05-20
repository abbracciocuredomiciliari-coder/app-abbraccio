import { Router, Request, Response } from 'express';
import ObiettivoWorkPlan from '../models/ObiettivoWorkPlan';
import WorkPlan from '../models/WorkPlan';
import { authenticateToken } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';

const router = Router();

// GET /api/obiettivi/:workPlanId - Ottieni obiettivi per un piano di lavoro
router.get('/:workPlanId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { workPlanId } = req.params;
    const obiettivi = await ObiettivoWorkPlan.find({ workPlan: workPlanId })
      .sort({ dataInizio: -1 });
    return res.json(obiettivi);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero degli obiettivi', error });
  }
});

// POST /api/obiettivi/:workPlanId - Crea nuovo obiettivo (admin/coordinator)
router.post('/:workPlanId', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const { workPlanId } = req.params;
    const { descrizione, dataRivalutazione } = req.body;
    const user = (req as any).user;

    if (!descrizione?.trim()) {
      return res.status(400).json({ message: 'La descrizione dell\'obiettivo è obbligatoria' });
    }

    const workPlan = await WorkPlan.findById(workPlanId);
    if (!workPlan) {
      return res.status(404).json({ message: 'Piano di lavoro non trovato' });
    }

    const obiettivo = await ObiettivoWorkPlan.create({
      workPlan: workPlanId,
      patient: workPlan.patient,
      descrizione: descrizione.trim(),
      stato: 'attivo',
      dataInizio: new Date(),
      dataRivalutazione: dataRivalutazione ? new Date(dataRivalutazione) : undefined,
      valutazioni: [],
      createdBy: user.name || user.email || 'Coordinatore',
    });

    return res.status(201).json(obiettivo);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nella creazione dell\'obiettivo', error: error?.message });
  }
});

// POST /api/obiettivi/valuta/:obiettivoId - Valuta/rivaluta un obiettivo
router.post('/valuta/:obiettivoId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { obiettivoId } = req.params;
    const { stato, note, dataRivalutazione } = req.body;
    const user = (req as any).user;

    const statiValidi = ['attivo', 'raggiunto', 'parziale', 'non_raggiunto', 'rivalutato'];
    if (!stato || !statiValidi.includes(stato)) {
      return res.status(400).json({ message: 'Stato non valido' });
    }

    const obiettivo = await ObiettivoWorkPlan.findById(obiettivoId);
    if (!obiettivo) {
      return res.status(404).json({ message: 'Obiettivo non trovato' });
    }

    // Aggiungi valutazione allo storico
    obiettivo.valutazioni.push({
      data: new Date(),
      stato,
      note: note?.trim(),
      valutatoDa: user.name || user.email || 'Operatore',
    });

    // Aggiorna stato corrente
    obiettivo.stato = stato;

    // Se rivalutato, aggiorna la data di rivalutazione
    if (stato === 'rivalutato' && dataRivalutazione) {
      obiettivo.dataRivalutazione = new Date(dataRivalutazione);
    }

    await obiettivo.save();
    return res.json(obiettivo);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nella valutazione', error: error?.message });
  }
});

// DELETE /api/obiettivi/:obiettivoId - Elimina obiettivo (admin/coordinator)
router.delete('/:obiettivoId', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const { obiettivoId } = req.params;
    const obiettivo = await ObiettivoWorkPlan.findByIdAndDelete(obiettivoId);
    if (!obiettivo) {
      return res.status(404).json({ message: 'Obiettivo non trovato' });
    }
    return res.json({ message: 'Obiettivo eliminato' });
  } catch (error) {
    return res.status(500).json({ message: 'Errore nell\'eliminazione', error });
  }
});

export default router;
