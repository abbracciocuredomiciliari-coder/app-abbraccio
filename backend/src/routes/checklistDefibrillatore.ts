import { Router, Request, Response } from 'express';
import CheckListDefibrillatore from '../models/CheckListDefibrillatore';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Ottieni tutte le checklist (ordinate per data decrescente)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const lista = await CheckListDefibrillatore.find().sort({ data: -1 });
    return res.json(lista);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero delle checklist', error });
  }
});

// Crea una nuova checklist giornaliera
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  const {
    data,
    nSerieAED,
    ubicazioneAED,
    unitaAccessoriNonDanneggiati,
    batterieElettrodiScorta,
    batterieElettrodiScortaNonScaduti,
    asiLampeggiaVerde,
    commenti,
    ispezionatoDa,
  } = req.body;

  if (!data) {
    return res.status(400).json({ message: 'La data è obbligatoria' });
  }
  if (!ispezionatoDa?.trim()) {
    return res.status(400).json({ message: 'Il campo "Ispezionato da" è obbligatorio' });
  }

  try {
    const checklist = await CheckListDefibrillatore.create({
      data,
      nSerieAED: nSerieAED?.trim() || '',
      ubicazioneAED: ubicazioneAED?.trim() || '',
      unitaAccessoriNonDanneggiati: unitaAccessoriNonDanneggiati || false,
      batterieElettrodiScorta: batterieElettrodiScorta || false,
      batterieElettrodiScortaNonScaduti: batterieElettrodiScortaNonScaduti || false,
      asiLampeggiaVerde: asiLampeggiaVerde || false,
      commenti: commenti?.trim() || '',
      ispezionatoDa: ispezionatoDa.trim(),
    });
    return res.status(201).json(checklist);
  } catch (error: any) {
    return res.status(400).json({ message: error?.message || 'Errore nella creazione della checklist' });
  }
});

// Elimina una checklist
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const checklist = await CheckListDefibrillatore.findByIdAndDelete(id);
    if (!checklist) {
      return res.status(404).json({ message: 'Checklist non trovata' });
    }
    return res.json({ message: 'Checklist eliminata' });
  } catch (error) {
    return res.status(500).json({ message: 'Errore durante l\'eliminazione', error });
  }
});

export default router;
