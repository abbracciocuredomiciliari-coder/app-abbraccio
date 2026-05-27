import { Router, Request, Response } from 'express';
import CheckListGlucometro from '../models/CheckListGlucometro';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// GET tutte le checklist glucometro (ordinate per data decrescente)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const lista = await CheckListGlucometro.find().sort({ dataControllo: -1 });
    return res.json(lista);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero delle checklist glucometro', error });
  }
});

// POST crea nuova checklist glucometro
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  const {
    dataControllo,
    idGlucometro,
    operatore,
    livelloBasso,
    livelloNormale,
    livelloAlto,
    controlloSuperato,
    note,
  } = req.body;

  if (!dataControllo) {
    return res.status(400).json({ message: 'La data di controllo è obbligatoria' });
  }
  if (!operatore?.trim()) {
    return res.status(400).json({ message: 'Il campo "Operatore" è obbligatorio' });
  }

  try {
    const checklist = await CheckListGlucometro.create({
      dataControllo,
      idGlucometro: idGlucometro?.trim() || '',
      operatore: operatore.trim(),
      livelloBasso: livelloBasso || { risultato: '', passato: false, note: '' },
      livelloNormale: livelloNormale || { risultato: '', passato: false, note: '' },
      livelloAlto: livelloAlto || { risultato: '', passato: false, note: '' },
      controlloSuperato: controlloSuperato || false,
      note: note?.trim() || '',
    });
    return res.status(201).json(checklist);
  } catch (error: any) {
    return res.status(400).json({ message: error?.message || 'Errore nella creazione della checklist' });
  }
});

// DELETE elimina checklist glucometro
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const checklist = await CheckListGlucometro.findByIdAndDelete(id);
    if (!checklist) {
      return res.status(404).json({ message: 'Checklist non trovata' });
    }
    return res.json({ message: 'Checklist eliminata' });
  } catch (error) {
    return res.status(500).json({ message: "Errore durante l'eliminazione", error });
  }
});

export default router;
