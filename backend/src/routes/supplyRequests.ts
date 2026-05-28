import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import SupplyRequest from '../models/SupplyRequest';
import MedicalSupply from '../models/MedicalSupply';

const router = Router();

// ─── Middleware autenticazione ────────────────────────────────────────────────
function auth(req: Request, res: Response, next: Function) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Non autenticato' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Token non valido' });
  }
}

function isAdminOrCoord(req: Request, res: Response, next: Function) {
  const user = (req as any).user;
  if (!user || !['admin', 'coordinator'].includes(user.role)) {
    return res.status(403).json({ message: 'Accesso non autorizzato' });
  }
  next();
}

// ─── GET /api/supply-requests/catalogo ───────────────────────────────────────
// Restituisce l'elenco di presidi e farmaci disponibili (per l'operatore)
router.get('/catalogo', auth, async (req: Request, res: Response) => {
  try {
    const supplies = await (MedicalSupply as any).find({}).lean();
    const catalogo = supplies.map((s: any) => ({
      _id: s._id,
      nome: s.nome,
      categoria: s.category === 'farmaco' ? 'farmaco' : 'presidio',
      unitaMisura: s.unitaMisura || 'pezzi',
      quantitaDisponibile: s.quantita,
      dosaggio: s.dosaggio,
    }));
    return res.json(catalogo);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// ─── GET /api/supply-requests ─────────────────────────────────────────────────
// Admin/coord: tutte le richieste | Operatore: solo le proprie
router.get('/', auth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let query: any = {};
    if (!['admin', 'coordinator'].includes(user.role)) {
      query.operatoreId = user.staffId || user.id;
    }
    const richieste = await SupplyRequest.find(query).sort({ dataRichiesta: -1 }).lean();
    return res.json(richieste);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// ─── POST /api/supply-requests ────────────────────────────────────────────────
// Operatore crea una nuova richiesta
router.post('/', auth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { items, noteOperatore } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Inserire almeno un articolo nella richiesta' });
    }
    const richiesta = new SupplyRequest({
      operatoreId: user.staffId || user.id,
      operatoreNome: user.name || user.email,
      stato: 'in_attesa',
      noteOperatore,
      items: items.map((item: any) => ({
        supplyId: item.supplyId,
        nome: item.nome,
        categoria: item.categoria,
        unitaMisura: item.unitaMisura,
        quantitaRichiesta: item.quantitaRichiesta,
        statoItem: 'in_attesa',
      })),
    });
    await richiesta.save();
    return res.status(201).json(richiesta);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// ─── PATCH /api/supply-requests/:id/gestisci ─────────────────────────────────
// Admin/coord gestisce la richiesta (autorizza/rifiuta ogni item)
router.patch('/:id/gestisci', auth, isAdminOrCoord, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { items, noteAdmin } = req.body;
    // items: array di { supplyId, quantitaAutorizzata, statoItem, noteAdmin }

    const richiesta = await SupplyRequest.findById(req.params.id);
    if (!richiesta) return res.status(404).json({ message: 'Richiesta non trovata' });
    if (richiesta.stato === 'gestita') {
      return res.status(400).json({ message: 'Richiesta già gestita' });
    }

    // Aggiorna ogni item
    if (items && Array.isArray(items)) {
      for (const itemUpdate of items) {
        const item = richiesta.items.find((i: any) => i.supplyId === itemUpdate.supplyId);
        if (item) {
          item.quantitaAutorizzata = itemUpdate.quantitaAutorizzata ?? 0;
          item.statoItem = itemUpdate.statoItem || 'rifiutato';
          item.noteAdmin = itemUpdate.noteAdmin || '';
        }
      }
    }

    richiesta.noteAdmin = noteAdmin || '';
    richiesta.dataGestione = new Date();
    richiesta.gestitaDa = user.name || user.email;

    // Determina stato globale
    const tuttiAutorizzati = richiesta.items.every((i: any) => i.statoItem === 'autorizzato');
    const tuttiRifiutati = richiesta.items.every((i: any) => i.statoItem === 'rifiutato');
    richiesta.stato = tuttiRifiutati ? 'rifiutata' : 'gestita';

    await richiesta.save();
    return res.json(richiesta);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// ─── DELETE /api/supply-requests/:id ─────────────────────────────────────────
// Operatore può eliminare solo richieste proprie in_attesa
router.delete('/:id', auth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const richiesta = await SupplyRequest.findById(req.params.id);
    if (!richiesta) return res.status(404).json({ message: 'Richiesta non trovata' });
    const isOwner = richiesta.operatoreId.toString() === (user.staffId || user.id);
    const isAdmin = ['admin', 'coordinator'].includes(user.role);
    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Non autorizzato' });
    if (!isAdmin && richiesta.stato !== 'in_attesa') {
      return res.status(400).json({ message: 'Non puoi eliminare una richiesta già gestita' });
    }
    await SupplyRequest.findByIdAndDelete(req.params.id);
    return res.json({ message: 'Richiesta eliminata' });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

export default router;
