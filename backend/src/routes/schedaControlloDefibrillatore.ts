import { Router, Request, Response } from 'express';
import SchedaControlloDefibrillatore from '../models/SchedaControlloDefibrillatore';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// ─── GET tutte le schede (ordinate per data compilazione decrescente) ─────────
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const schede = await SchedaControlloDefibrillatore.find().sort({ dataCompilazione: -1 });
    return res.json(schede);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero delle schede', error });
  }
});

// ─── POST crea nuova scheda ───────────────────────────────────────────────────
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  const {
    apparecchio,
    idSN,
    registroInterventi,
    integritaCaviAlimentazione,
    integritaCaviAlimentazioneNote,
    correttoAvvioAutoTest,
    correttoAvvioAutoTestNote,
    puliziaScocca,
    puliziaScoccanote,
    batteriaCarica,
    batteriaCaricaNote,
    compilatoDa,
    dataCompilazione,
  } = req.body;

  if (!dataCompilazione) {
    return res.status(400).json({ message: 'La data di compilazione è obbligatoria' });
  }
  if (!compilatoDa?.trim()) {
    return res.status(400).json({ message: 'Il campo "Compilato da" è obbligatorio' });
  }

  try {
    const scheda = await SchedaControlloDefibrillatore.create({
      apparecchio: apparecchio?.trim() || '',
      idSN: idSN?.trim() || '',
      registroInterventi: registroInterventi || [],
      integritaCaviAlimentazione: integritaCaviAlimentazione || false,
      integritaCaviAlimentazioneNote: integritaCaviAlimentazioneNote?.trim() || '',
      correttoAvvioAutoTest: correttoAvvioAutoTest || false,
      correttoAvvioAutoTestNote: correttoAvvioAutoTestNote?.trim() || '',
      puliziaScocca: puliziaScocca || false,
      puliziaScoccanote: puliziaScoccanote?.trim() || '',
      batteriaCarica: batteriaCarica || false,
      batteriaCaricaNote: batteriaCaricaNote?.trim() || '',
      compilatoDa: compilatoDa.trim(),
      dataCompilazione,
    });
    return res.status(201).json(scheda);
  } catch (error: any) {
    return res.status(400).json({ message: error?.message || 'Errore nella creazione della scheda' });
  }
});

// ─── PUT aggiorna scheda esistente ───────────────────────────────────────────
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const scheda = await SchedaControlloDefibrillatore.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!scheda) {
      return res.status(404).json({ message: 'Scheda non trovata' });
    }
    return res.json(scheda);
  } catch (error: any) {
    return res.status(400).json({ message: error?.message || 'Errore nell\'aggiornamento della scheda' });
  }
});

// ─── DELETE elimina scheda ────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const scheda = await SchedaControlloDefibrillatore.findByIdAndDelete(id);
    if (!scheda) {
      return res.status(404).json({ message: 'Scheda non trovata' });
    }
    return res.json({ message: 'Scheda eliminata' });
  } catch (error) {
    return res.status(500).json({ message: 'Errore durante l\'eliminazione', error });
  }
});

export default router;
