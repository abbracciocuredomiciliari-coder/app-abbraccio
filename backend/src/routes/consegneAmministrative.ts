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

// POST /api/consegne-amministrative/pubblica — consegna dal link esterno
// (personale sul territorio che apre /scrivi-consegna dal telefono senza
// entrare nel gestionale). L'autore è dichiarato nel form, non autenticato.
router.post('/pubblica', async (req: Request, res: Response) => {
  try {
    const autoreNome = String(req.body?.autoreNome || '').trim().slice(0, 80);
    const titolo = String(req.body?.titolo || '').trim().slice(0, 140);
    const testo = String(req.body?.testo || '').trim().slice(0, 4000);
    const tipo = ['giornata', 'pratica', 'generale'].includes(req.body?.tipo) ? req.body.tipo : 'generale';
    const priorita = req.body?.priorita === 'urgente' ? 'urgente' : 'normale';
    const riferimento = String(req.body?.riferimento || '').trim().slice(0, 160) || undefined;
    const dataGiornata = req.body?.dataGiornata ? new Date(req.body.dataGiornata) : undefined;

    if (!autoreNome || !titolo || !testo) {
      return res.status(400).json({ message: 'Nome, titolo e testo della consegna sono obbligatori' });
    }

    const consegna = await ConsegnaAmministrativa.create({
      titolo,
      testo,
      tipo,
      priorita,
      riferimento,
      dataGiornata: dataGiornata && !isNaN(dataGiornata.getTime()) ? dataGiornata : undefined,
      autoreNome: `${autoreNome} (da remoto)`,
      origine: 'esterna',
      storico: [{ azione: 'creata', daNome: `${autoreNome} (da remoto)`, il: new Date() }],
    });
    return res.status(201).json({ message: 'Consegna registrata', id: consegna._id });
  } catch (error: any) {
    console.error('[Consegne pubblica POST] Errore:', error);
    return res.status(500).json({ message: 'Errore nella registrazione della consegna', error: error.message });
  }
});

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
    const scadenza = req.body?.scadenza ? new Date(req.body.scadenza) : undefined;

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
      scadenza: scadenza && !isNaN(scadenza.getTime()) ? scadenza : undefined,
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

    // Regola: il completamento richiede un esito
    if (nuovoStato === 'gestita') {
      const esito = String(req.body?.esito || '').trim().slice(0, 2000);
      if (!esito) {
        return res.status(400).json({ message: "Per segnare la consegna come gestita serve un esito (cosa è stato fatto / risposto)", richiedeEsito: true });
      }
      consegna.esito = esito;
      consegna.gestitaDaNome = userNome;
      consegna.gestitaIl = new Date();
    }
    if (nuovoStato === 'in_attesa_riscontro') {
      const interlocutore = String(req.body?.interlocutore || '').trim().slice(0, 120);
      const dataControllo = req.body?.dataControllo ? new Date(req.body.dataControllo) : undefined;
      if (!interlocutore || !dataControllo || isNaN(dataControllo.getTime())) {
        return res.status(400).json({ message: 'In attesa di riscontro richiede interlocutore e data di controllo' });
      }
      consegna.interlocutoreAttesa = interlocutore;
      consegna.dataControlloAttesa = dataControllo;
    }
    consegna.stato = nuovoStato as any;

    if (nuovoStato === 'presa_in_carico') {
      consegna.presaInCaricoDaId = new mongoose.Types.ObjectId(userId);
      consegna.presaInCaricoDaNome = userNome;
      consegna.presaInCaricoIl = new Date();
    }
    consegna.storico.push({ azione: nuovoStato, da: new mongoose.Types.ObjectId(userId), daNome: userNome, il: new Date(), nota });
    await consegna.save();
    return res.json(consegna);
  } catch (error: any) {
    console.error('[Consegne PATCH stato] Errore:', error);
    return res.status(500).json({ message: 'Errore aggiornamento consegna', error: error.message });
  }
});

// POST /api/consegne-amministrative/:id/letta — segna come letta (NON gestita)
router.post('/:id/letta', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user: any = req.user;
    const userId = String(user.userId || user.id);
    const consegna = await ConsegnaAmministrativa.findById(req.params.id);
    if (!consegna) return res.status(404).json({ message: 'Consegna non trovata' });
    consegna.lettaDa = consegna.lettaDa || [];
    if (!consegna.lettaDa.some(l => String(l.userId) === userId)) {
      consegna.lettaDa.push({ userId: new mongoose.Types.ObjectId(userId), nome: user.name || 'Utente', il: new Date() } as any);
      consegna.storico.push({ azione: 'letta', da: new mongoose.Types.ObjectId(userId), daNome: user.name || 'Utente', il: new Date() });
      await consegna.save();
    }
    return res.json({ ok: true, lettaDaCount: consegna.lettaDa.length });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore lettura consegna', error: error.message });
  }
});

// PATCH /api/consegne-amministrative/:id/scadenza — imposta prossima azione datata
router.patch('/:id/scadenza', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user: any = req.user;
    const consegna = await ConsegnaAmministrativa.findById(req.params.id);
    if (!consegna) return res.status(404).json({ message: 'Consegna non trovata' });
    const d = req.body?.scadenza ? new Date(req.body.scadenza) : undefined;
    consegna.scadenza = d && !isNaN(d.getTime()) ? d : undefined;
    consegna.storico.push({ azione: 'scadenza', da: new mongoose.Types.ObjectId(user.userId || user.id), daNome: user.name || 'Utente', il: new Date(), nota: consegna.scadenza ? `Scadenza: ${consegna.scadenza.toLocaleDateString('it-IT')}` : 'Scadenza rimossa' });
    await consegna.save();
    return res.json(consegna);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore aggiornamento scadenza', error: error.message });
  }
});

// POST /api/consegne-amministrative/:id/trasferisci — passaggio turno:
// il destinatario deve accettare; fino ad allora responsabilità al cedente.
router.post('/:id/trasferisci', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user: any = req.user;
    const aId = String(req.body?.aId || '');
    if (!mongoose.isValidObjectId(aId)) return res.status(400).json({ message: 'Destinatario non valido' });
    const User = (await import('../models/User')).default;
    const dest = await User.findById(aId).select('name').lean();
    if (!dest) return res.status(404).json({ message: 'Utente destinatario non trovato' });
    const consegna = await ConsegnaAmministrativa.findById(req.params.id);
    if (!consegna) return res.status(404).json({ message: 'Consegna non trovata' });
    if (consegna.stato === 'gestita') return res.status(400).json({ message: 'Consegna già gestita' });
    consegna.trasferimento = {
      aId: dest._id as any,
      aNome: (dest as any).name,
      daNome: consegna.presaInCaricoDaNome || user.name || 'Utente',
      richiestoIl: new Date(),
      accettato: false,
    } as any;
    consegna.storico.push({ azione: 'trasferita', da: new mongoose.Types.ObjectId(user.userId || user.id), daNome: user.name || 'Utente', il: new Date(), nota: `verso ${(dest as any).name} — in attesa di accettazione` });
    await consegna.save();
    return res.json(consegna);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore trasferimento', error: error.message });
  }
});

// POST /api/consegne-amministrative/:id/accetta-trasferimento
router.post('/:id/accetta-trasferimento', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user: any = req.user;
    const userId = String(user.userId || user.id);
    const consegna = await ConsegnaAmministrativa.findById(req.params.id);
    if (!consegna) return res.status(404).json({ message: 'Consegna non trovata' });
    if (!consegna.trasferimento || consegna.trasferimento.accettato) {
      return res.status(400).json({ message: 'Nessun trasferimento in sospeso' });
    }
    if (String(consegna.trasferimento.aId) !== userId) {
      return res.status(403).json({ message: 'Solo il destinatario può accettare' });
    }
    consegna.presaInCaricoDaId = new mongoose.Types.ObjectId(userId);
    consegna.presaInCaricoDaNome = user.name || 'Utente';
    consegna.presaInCaricoIl = new Date();
    consegna.trasferimento.accettato = true;
    consegna.trasferimento.accettatoIl = new Date();
    if (consegna.stato === 'da_gestire') consegna.stato = 'presa_in_carico';
    consegna.storico.push({ azione: 'trasferimento_accettato', da: new mongoose.Types.ObjectId(userId), daNome: user.name || 'Utente', il: new Date() });
    await consegna.save();
    return res.json(consegna);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore accettazione trasferimento', error: error.message });
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
