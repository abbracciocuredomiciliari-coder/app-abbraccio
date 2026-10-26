import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import ConsegnaAmministrativa from '../models/ConsegnaAmministrativa';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════
// CONSEGNE AMMINISTRATIVE — bacheca condivisa ufficio ↔ personale esterno.
// Tutti gli utenti autenticati (operatori, admin, coordinator, direttore)
// possono leggere e scrivere: le consegne sono visibili da entrambe le aree
// (Gestione Privata e Intermediazioni condividono la stessa bacheca).
// Solo l'autore o admin/coordinator/direttore possono eliminare.
// ═══════════════════════════════════════════════════════════════════════════

const RUOLI_GESTIONE = ['admin', 'coordinator', 'direttore'];
const STATI_VALIDI = ['da_gestire', 'presa_in_carico', 'in_attesa_riscontro', 'gestita'];

// GET /api/consegne-amministrative — lista (default: tutte, ?aperte=1 solo non gestite)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const query: any = {};
    if (req.query.aperte === '1') query.stato = { $ne: 'gestita' };
    if (req.query.stato && STATI_VALIDI.includes(String(req.query.stato))) query.stato = String(req.query.stato);
    const consegne = await ConsegnaAmministrativa.find(query).sort({ priorita: -1, createdAt: -1 }).limit(300).lean();
    return res.json(consegne);
  } catch (error: any) {
    console.error('[Consegne GET] Errore:', error);
    return res.status(500).json({ message: 'Errore nel recupero delle consegne', error: error.message });
  }
});

// GET /api/consegne-amministrative/conteggio — badge: quante NON gestite
router.get('/conteggio', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const aperte = await ConsegnaAmministrativa.countDocuments({ stato: { $ne: 'gestita' } });
    const daGestire = await ConsegnaAmministrativa.countDocuments({ stato: 'da_gestire' });
    return res.json({ aperte, daGestire });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore conteggio consegne', error: error.message });
  }
});

// POST /api/consegne-amministrative — nuova consegna
router.post('/', authenticateToken, auditLog('consegne_amministrative', 'CREATE'), async (req: AuthRequest, res: Response) => {
  try {
    const user: any = req.user;
    const titolo = String(req.body?.titolo || '').trim().slice(0, 140);
    const testo = String(req.body?.testo || '').trim().slice(0, 4000);
    const tipo = ['giornata', 'pratica', 'generale'].includes(req.body?.tipo) ? req.body.tipo : 'generale';
    const priorita = req.body?.priorita === 'urgente' ? 'urgente' : 'normale';
    const riferimento = String(req.body?.riferimento || '').trim().slice(0, 160) || undefined;
    const dataGiornata = req.body?.dataGiornata ? new Date(req.body.dataGiornata) : undefined;

    if (!titolo || !testo) {
      return res.status(400).json({ message: 'Titolo e testo della consegna sono obbligatori' });
    }

    const userId = user.userId || user.id;
    const consegna = await ConsegnaAmministrativa.create({
      titolo,
      testo,
      tipo,
      priorita,
      riferimento,
      dataGiornata: dataGiornata && !isNaN(dataGiornata.getTime()) ? dataGiornata : undefined,
      autoreId: new mongoose.Types.ObjectId(userId),
      autoreNome: user.name || 'Utente',
      storico: [{ azione: 'creata', da: new mongoose.Types.ObjectId(userId), daNome: user.name || 'Utente', il: new Date() }],
    });
    return res.status(201).json(consegna);
  } catch (error: any) {
    console.error('[Consegne POST] Errore:', error);
    return res.status(500).json({ message: 'Errore nella creazione della consegna', error: error.message });
  }
});

// PATCH /api/consegne-amministrative/:id/stato — avanza il ciclo di vita
router.patch('/:id/stato', authenticateToken, auditLog('consegne_amministrative', 'UPDATE'), async (req: AuthRequest, res: Response) => {
  try {
    const user: any = req.user;
    const nuovoStato = String(req.body?.stato || '');
    if (!STATI_VALIDI.includes(nuovoStato)) {
      return res.status(400).json({ message: 'Stato non valido' });
    }
    const nota = String(req.body?.nota || '').trim().slice(0, 500) || undefined;

    const consegna = await ConsegnaAmministrativa.findById(req.params.id);
    if (!consegna) return res.status(404).json({ message: 'Consegna non trovata' });

    const userId = user.userId || user.id;
    const userNome = user.name || 'Utente';
    consegna.stato = nuovoStato as any;

    if (nuovoStato === 'presa_in_carico') {
      consegna.presaInCaricoDaId = new mongoose.Types.ObjectId(userId);
      consegna.presaInCaricoDaNome = userNome;
      consegna.presaInCaricoIl = new Date();
    }
    if (nuovoStato === 'gestita') {
      consegna.gestitaDaNome = userNome;
      consegna.gestitaIl = new Date();
    }
    consegna.storico.push({ azione: nuovoStato, da: new mongoose.Types.ObjectId(userId), daNome: userNome, il: new Date(), nota });
    await consegna.save();
    return res.json(consegna);
  } catch (error: any) {
    console.error('[Consegne PATCH stato] Errore:', error);
    return res.status(500).json({ message: 'Errore aggiornamento consegna', error: error.message });
  }
});

// POST /api/consegne-amministrative/:id/nota — aggiunge una nota allo storico
router.post('/:id/nota', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user: any = req.user;
    const nota = String(req.body?.nota || '').trim().slice(0, 500);
    if (!nota) return res.status(400).json({ message: 'Nota vuota' });
    const consegna = await ConsegnaAmministrativa.findById(req.params.id);
    if (!consegna) return res.status(404).json({ message: 'Consegna non trovata' });
    consegna.storico.push({ azione: 'nota', da: new mongoose.Types.ObjectId(user.userId || user.id), daNome: user.name || 'Utente', il: new Date(), nota });
    await consegna.save();
    return res.json(consegna);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore aggiunta nota', error: error.message });
  }
});

// DELETE /api/consegne-amministrative/:id — autore o ruoli di gestione
router.delete('/:id', authenticateToken, auditLog('consegne_amministrative', 'DELETE'), async (req: AuthRequest, res: Response) => {
  try {
    const user: any = req.user;
    const consegna = await ConsegnaAmministrativa.findById(req.params.id);
    if (!consegna) return res.status(404).json({ message: 'Consegna non trovata' });
    const userId = String(user.userId || user.id);
    const isAutore = consegna.autoreId?.toString() === userId;
    if (!isAutore && !RUOLI_GESTIONE.includes(user.role)) {
      return res.status(403).json({ message: 'Solo l\'autore o la gestione può eliminare una consegna' });
    }
    await consegna.deleteOne();
    return res.json({ message: 'Consegna eliminata' });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore eliminazione consegna', error: error.message });
  }
});

export default router;
