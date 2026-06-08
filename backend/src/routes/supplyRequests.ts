import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import SupplyRequest from '../models/SupplyRequest';
import MedicalSupply from '../models/MedicalSupply';
import User from '../models/User';

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
      query.operatoreId = user.staffId || user.userId || user.id;
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
    // Il JWT contiene { userId, email, role } — recupera l'utente dal DB tramite email come fallback sicuro
    let operatoreId = user.staffId || user.userId || user.id;
    let dbUser: any = null;
    if (operatoreId && mongoose.Types.ObjectId.isValid(operatoreId)) {
      dbUser = await User.findById(operatoreId).select('name email').lean();
    }
    // Fallback: cerca per email (sempre presente nel JWT)
    if (!dbUser && user.email) {
      dbUser = await User.findOne({ email: user.email }).select('_id name email').lean();
      if (dbUser) operatoreId = dbUser._id;
    }
    if (!operatoreId) {
      return res.status(400).json({ message: 'Impossibile identificare l\'operatore. Effettua nuovamente il login.' });
    }
    const operatoreNome = dbUser?.name || user.email;
    const richiesta = new SupplyRequest({
      operatoreId,
      operatoreNome,
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
    // Recupera il nome reale dal DB (il JWT contiene solo userId/email/role)
    const dbAdmin = await User.findById(user.userId || user.id).select('name email').lean();
    richiesta.gestitaDa = (dbAdmin as any)?.name || user.email;

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

// ─── PATCH /api/supply-requests/:id/consegna ─────────────────────────────────
// Admin/coord segna la richiesta come consegnata e scarica dal magazzino
router.patch('/:id/consegna', auth, isAdminOrCoord, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const richiesta = await SupplyRequest.findById(req.params.id);
    if (!richiesta) return res.status(404).json({ message: 'Richiesta non trovata' });
    if (richiesta.stato !== 'gestita') {
      return res.status(400).json({ message: 'Solo le richieste gestite possono essere segnate come consegnate' });
    }

    // Recupera nome admin
    const dbAdmin = await User.findById(user.userId || user.id).select('name email').lean();
    const adminNome = (dbAdmin as any)?.name || user.email;

    // Scarica dal magazzino per ogni item autorizzato/parziale
    for (const item of richiesta.items) {
      if (item.statoItem === 'autorizzato' || item.statoItem === 'parziale') {
        const qtaScaricare = item.quantitaAutorizzata ?? 0;
        if (qtaScaricare <= 0) continue;
        try {
          const supply = await MedicalSupply.findById(item.supplyId);
          if (supply) {
            const qtaPrecedente = supply.quantita;
            const qtaNuova = Math.max(0, qtaPrecedente - qtaScaricare);
            supply.quantita = qtaNuova;
            await supply.save();
            // Registra movimento scarico
            try {
              const SupplyMovement = (await import('../models/SupplyMovement')).default;
              await SupplyMovement.create({
                supply: supply._id,
                tipo: 'scarico',
                quantita: qtaScaricare,
                motivazione: `Consegna a ${richiesta.operatoreNome} (richiesta #${richiesta._id})`,
                eseguitoDa: user.userId || user.id,
                eseguitoDaNome: adminNome,
                quantitaPrecedente: qtaPrecedente,
                quantitaSuccessiva: qtaNuova,
              });
            } catch (_) { /* SupplyMovement opzionale */ }
          }
        } catch (_) { /* supply non trovato, continua */ }
      }
    }

    richiesta.stato = 'consegnata';
    richiesta.dataConsegna = new Date();
    richiesta.consegnataDa = adminNome;
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
    const isOwner = richiesta.operatoreId.toString() === (user.staffId || user.userId || user.id);
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

// ─── GET /api/supply-requests/consegne ───────────────────────────────────────
// Restituisce le richieste consegnate per il report
router.get('/consegne', auth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isAdmin = ['admin', 'coordinator', 'direttore'].includes(user.role);
    
    // Costruisci filtro
    const filtro: any = { stato: 'consegnata' };
    
    // Se non è admin, filtra per operatore
    if (!isAdmin && (user.staffId || user.userId || user.id)) {
      filtro.operatoreId = user.staffId || user.userId || user.id;
    }
    
    // Filtri per data
    if (req.query.dataInizio || req.query.dataFine) {
      filtro.dataConsegna = {};
      if (req.query.dataInizio) {
        filtro.dataConsegna.$gte = new Date(req.query.dataInizio as string);
      }
      if (req.query.dataFine) {
        filtro.dataConsegna.$lte = new Date(req.query.dataFine as string + 'T23:59:59.999Z');
      }
    }
    
    const consegne = await SupplyRequest.find(filtro)
      .sort({ dataConsegna: -1 })
      .lean();
    
    // Trasforma nel formato atteso dal frontend
    const result = consegne.map((c: any) => ({
      _id: c._id,
      operatoreId: c.operatoreId,
      operatoreNome: c.operatoreNome,
      dataConsegna: c.dataConsegna,
      consegnataDa: c.consegnataDa,
      items: c.items.filter((item: any) => item.statoItem === 'autorizzato' || item.statoItem === 'parziale').map((item: any) => ({
        nome: item.nome,
        categoria: item.categoria,
        unitaMisura: item.unitaMisura || 'pezzi',
        quantita: item.quantitaAutorizzata || item.quantitaRichiesta,
        note: item.noteAdmin
      }))
    }));
    
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

export default router;
