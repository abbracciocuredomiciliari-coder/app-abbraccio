import { Router, Request, Response } from 'express';
import Tariffario from '../models/Tariffario';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import { TARIFFARIO_SEED } from '../utils/tariffarioSeed';

const router = Router();

const RUOLI_GESTIONE = ['admin', 'coordinator', 'direttore'];

// ─── Auto-seed idempotente: se il listino è vuoto, popola con i valori di default ───
export async function seedTariffarioSeVuoto() {
  try {
    const count = await Tariffario.countDocuments();
    if (count === 0) {
      await Tariffario.insertMany(TARIFFARIO_SEED.map(v => ({ ...v, attivo: true })));
      console.log(`✅ Tariffario: inserite ${TARIFFARIO_SEED.length} voci di default.`);
    }
  } catch (err) {
    console.error('Errore seed tariffario:', err);
  }
}

// GET /api/tariffario — lista completa (tutti gli utenti autenticati)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { soloAttivi } = req.query;
    const filtro: any = {};
    if (soloAttivi === 'true') filtro.attivo = true;
    const voci = await Tariffario.find(filtro).sort({ categoria: 1, ordine: 1, nome: 1 });
    return res.json(voci);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel caricamento del tariffario', error: error.message });
  }
});

// POST /api/tariffario — crea nuova voce (solo gestione)
router.post('/', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('tariffario', 'CREATE'), async (req: AuthRequest, res: Response) => {
  try {
    const { categoria, nome, prezzo, unitaMisura, note, ordine } = req.body;
    if (!categoria || !nome || prezzo === undefined) {
      return res.status(400).json({ message: 'Campi obbligatori: categoria, nome, prezzo' });
    }
    const user = req.user as { email?: string } | undefined;
    const voce = await Tariffario.create({
      categoria, nome, prezzo, unitaMisura, note,
      ordine: ordine || 0,
      aggiornatoDa: user?.email,
    });
    return res.status(201).json(voce);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nella creazione della voce', error: error.message });
  }
});

// PUT /api/tariffario/:id — modifica voce (prezzo, nome, ecc.) (solo gestione)
router.put('/:id', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('tariffario', 'UPDATE'), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user as { email?: string } | undefined;
    const voce = await Tariffario.findByIdAndUpdate(
      req.params.id,
      { ...req.body, aggiornatoDa: user?.email },
      { new: true, runValidators: true }
    );
    if (!voce) return res.status(404).json({ message: 'Voce non trovata' });
    return res.json(voce);
  } catch (error: any) {
    return res.status(500).json({ message: "Errore nell'aggiornamento della voce", error: error.message });
  }
});

// DELETE /api/tariffario/:id — elimina definitivamente (solo admin)
router.delete('/:id', authenticateToken, authorizeRole('admin'), auditLog('tariffario', 'DELETE'), async (req: Request, res: Response) => {
  try {
    const voce = await Tariffario.findByIdAndDelete(req.params.id);
    if (!voce) return res.status(404).json({ message: 'Voce non trovata' });
    return res.json({ message: 'Voce eliminata' });
  } catch (error: any) {
    return res.status(500).json({ message: "Errore nell'eliminazione della voce", error: error.message });
  }
});

export default router;
