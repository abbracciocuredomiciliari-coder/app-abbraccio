import { Router, Request, Response } from 'express';
import EventoAvverso from '../models/EventoAvverso';
import { authenticateToken } from '../middleware/auth';
import { getStaffByUser } from '../utils/staffHelper';

const router = Router();

// POST /api/eventi-avversi — Crea segnalazione evento avverso
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const {
      patientId, workPlanId,
      ruoloOperatore, ruoloOperatoreAltro, direzioneDiArea,
      pazienteNomeCognome, pazienteCSTV, pazienteEta, pazienteSesso,
      dataEvento, oraEvento, luogoEvento,
      descrizioneEvento, svolgimentoFatti,
      fattoriPaziente, fattoriStaff, fattoriComunicazione, fattoriAmbiente,
      suggerimenti, dannoRiscontrato, firmaOperatore,
    } = req.body;

    if (!patientId || !dataEvento || !luogoEvento || !ruoloOperatore || !descrizioneEvento) {
      return res.status(400).json({ message: 'Campi obbligatori mancanti (paziente, data, luogo, ruolo operatore, descrizione)' });
    }

    const evento = await EventoAvverso.create({
      patient:              patientId,
      workPlan:             workPlanId || undefined,
      segnalatoDA:          user.userId || user.id,
      segnalatoDANome:      user.name || user.email || 'Operatore',
      ruoloOperatore,
      ruoloOperatoreAltro:  ruoloOperatoreAltro || undefined,
      direzioneDiArea:      direzioneDiArea || undefined,
      pazienteNomeCognome:  pazienteNomeCognome || undefined,
      pazienteCSTV:         pazienteCSTV || undefined,
      pazienteEta:          pazienteEta ? Number(pazienteEta) : undefined,
      pazienteSesso:        pazienteSesso || undefined,
      dataEvento:           new Date(dataEvento),
      oraEvento:            oraEvento || undefined,
      luogoEvento,
      descrizioneEvento,
      svolgimentoFatti:     svolgimentoFatti || undefined,
      fattoriPaziente:      Array.isArray(fattoriPaziente) ? fattoriPaziente : [],
      fattoriStaff:         Array.isArray(fattoriStaff) ? fattoriStaff : [],
      fattoriComunicazione: Array.isArray(fattoriComunicazione) ? fattoriComunicazione : [],
      fattoriAmbiente:      Array.isArray(fattoriAmbiente) ? fattoriAmbiente : [],
      suggerimenti:         suggerimenti || undefined,
      dannoRiscontrato:     dannoRiscontrato || 'nessuno',
      firmaOperatore:       firmaOperatore || undefined,
    });

    const populated = await EventoAvverso.findById(evento._id)
      .populate('patient', 'firstName lastName');

    return res.status(201).json(populated);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nella creazione dell\'evento avverso', error: error?.message });
  }
});

// GET /api/eventi-avversi — Lista eventi (operatore vede i propri, admin/coordinator tutti)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isPrivileged = ['admin', 'coordinator', 'direttore'].includes(user.role);

    let filter: any = {};
    if (!isPrivileged) {
      filter.segnalatoDA = user.userId || user.id;
    }

    const { patientId } = req.query;
    if (patientId) filter.patient = patientId;

    const eventi = await EventoAvverso.find(filter)
      .populate('patient', 'firstName lastName')
      .sort({ dataEvento: -1 });

    return res.json(eventi);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel recupero degli eventi avversi', error: error?.message });
  }
});

// GET /api/eventi-avversi/:id — Dettaglio singolo evento
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const evento = await EventoAvverso.findById(req.params.id)
      .populate('patient', 'firstName lastName birthDate address')
      .populate('workPlan', 'task type');
    if (!evento) return res.status(404).json({ message: 'Evento non trovato' });
    return res.json(evento);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore', error: error?.message });
  }
});

// PATCH /api/eventi-avversi/:id/stato — Aggiorna stato (admin/coordinator)
router.patch('/:id/stato', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isPrivileged = ['admin', 'coordinator', 'direttore'].includes(user.role);
    if (!isPrivileged) return res.status(403).json({ message: 'Non autorizzato' });

    const { stato } = req.body;
    if (!['aperto', 'in_revisione', 'chiuso'].includes(stato)) {
      return res.status(400).json({ message: 'Stato non valido' });
    }
    const evento = await EventoAvverso.findByIdAndUpdate(req.params.id, { stato }, { new: true })
      .populate('patient', 'firstName lastName');
    return res.json(evento);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore', error: error?.message });
  }
});

export default router;
