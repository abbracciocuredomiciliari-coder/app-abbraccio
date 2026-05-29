import { Router, Request, Response } from 'express';
import MedicalSupply from '../models/MedicalSupply';
import SupplyMovement from '../models/SupplyMovement';
import { authenticateToken } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';

const router = Router();

// Ottieni tutti i presidi (filtrabili per categoria)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    const filter: any = {};
    if (category) {
      filter.category = category;
    } else {
      // Se non specificata la categoria, restituisce solo i presidi (non i farmaci)
      filter.category = { $ne: 'farmaco' };
    }
    const supplies = await MedicalSupply.find(filter).sort({ nome: 1 });
    return res.json(supplies);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero dei presidi', error });
  }
});

// Crea un nuovo presidio o farmaco (tutti gli utenti autenticati)
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  const { nome, quantita, scadenza, unitaMisura, scortaMinima, category, dosaggio } = req.body;

  if (!nome?.trim()) {
    return res.status(400).json({ message: 'Il campo nome è obbligatorio' });
  }

  try {
    const supply = await MedicalSupply.create({
      nome: nome.trim(),
      quantita: quantita || 0,
      scadenza: scadenza || null,
      unitaMisura: unitaMisura || 'pezzi',
      scortaMinima: scortaMinima || 0,
      category: category || 'presidio',
      dosaggio: dosaggio?.trim() || undefined,
    });
    return res.status(201).json(supply);
  } catch (error: any) {
    const message = error?.message || 'Errore nella creazione del presidio';
    return res.status(400).json({ message, details: error?.errors || error });
  }
});

// Aggiorna un presidio (solo metadati, non la quantità)
router.put('/:supplyId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const supplyId = req.params.supplyId;
    const { nome, scadenza, unitaMisura, scortaMinima, dosaggio } = req.body;

    const supply = await MedicalSupply.findByIdAndUpdate(
      supplyId,
      {
        nome: nome?.trim(),
        scadenza: scadenza || null,
        unitaMisura: unitaMisura?.trim(),
        scortaMinima: scortaMinima !== undefined ? scortaMinima : undefined,
        dosaggio: dosaggio?.trim() || undefined,
      },
      { new: true, runValidators: true }
    );

    if (!supply) {
      return res.status(404).json({ message: 'Presidio non trovato' });
    }

    return res.json(supply);
  } catch (error: any) {
    return res.status(400).json({ message: 'Errore nell\'aggiornamento del presidio', details: error?.message });
  }
});

// Elimina un presidio o farmaco
router.delete('/:supplyId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const supplyId = req.params.supplyId;
    if (!supplyId || supplyId.length !== 24) {
      return res.status(400).json({ message: 'ID non valido' });
    }
    const supply = await MedicalSupply.findByIdAndDelete(supplyId);
    
    if (!supply) {
      return res.status(404).json({ message: 'Presidio non trovato' });
    }

    // Elimina tutti i movimenti associati
    await SupplyMovement.deleteMany({ supply: supplyId });
    
    return res.json({ message: 'Eliminato con successo' });
  } catch (error) {
    return res.status(500).json({ message: 'Errore durante l\'eliminazione', error });
  }
});

// Effettua un movimento (carico o scarico)
router.post('/:supplyId/movements', authenticateToken, async (req: Request, res: Response) => {
  try {
    const supplyId = req.params.supplyId;
    const { tipo, quantita, motivazione, nuovaScadenza } = req.body;

    if (!tipo || !['carico', 'scarico'].includes(tipo)) {
      return res.status(400).json({ message: 'Tipo di movimento non valido. Usare: carico, scarico' });
    }

    if (!quantita || quantita <= 0) {
      return res.status(400).json({ message: 'La quantità deve essere maggiore di zero' });
    }

    const supply = await MedicalSupply.findById(supplyId);
    if (!supply) {
      return res.status(404).json({ message: 'Presidio non trovato' });
    }

    const quantitaPrecedente = supply.quantita;
    let quantitaSuccessiva: number;

    if (tipo === 'carico') {
      quantitaSuccessiva = quantitaPrecedente + quantita;
    } else {
      if (quantita > quantitaPrecedente) {
        return res.status(400).json({ 
          message: `Quantità insufficiente. Disponibilità attuale: ${quantitaPrecedente} ${supply.unitaMisura}` 
        });
      }
      quantitaSuccessiva = quantitaPrecedente - quantita;
    }

    // Aggiorna la quantità e, se fornita, la data di scadenza
    supply.quantita = quantitaSuccessiva;
    if (nuovaScadenza !== undefined) {
      supply.scadenza = nuovaScadenza ? new Date(nuovaScadenza) : undefined;
    }
    await supply.save();

    // Crea il movimento
    const movement = await SupplyMovement.create({
      supply: supplyId,
      tipo: tipo as 'carico' | 'scarico',
      quantita,
      motivazione: motivazione?.trim(),
      eseguitoDa: (req as any).user?._id,
      eseguitoDaNome: (req as any).user?.name,
      dataMovimento: new Date(),
      quantitaPrecedente,
      quantitaSuccessiva
    });

    return res.status(201).json({
      supply,
      movement
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nell\'esecuzione del movimento', error: error?.message });
  }
});

// Ottieni lo storico movimenti per un presidio
router.get('/:supplyId/movements', authenticateToken, async (req: Request, res: Response) => {
  try {
    const supplyId = req.params.supplyId;
    const supply = await MedicalSupply.findById(supplyId);
    
    if (!supply) {
      return res.status(404).json({ message: 'Presidio non trovato' });
    }

    const movements = await SupplyMovement.find({ supply: supplyId })
      .sort({ dataMovimento: -1 })
      .limit(50);

    return res.json(movements);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero dei movimenti', error });
  }
});

// Ottieni tutti i movimenti (per reportistica)
router.get('/movements/all', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const { limit = 100, supplyId } = req.query;
    
    const query: any = {};
    if (supplyId) {
      query.supply = supplyId;
    }

    const movements = await SupplyMovement.find(query)
      .sort({ dataMovimento: -1 })
      .limit(parseInt(limit as string))
      .populate('supply', 'nome unitaMisura');

    return res.json(movements);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero dei movimenti', error });
  }
});

export default router;
