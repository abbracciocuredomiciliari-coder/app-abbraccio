import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import Attivita from '../models/Attivita';
import User from '../models/User';
import ConsegnaAmministrativa from '../models/ConsegnaAmministrativa';
import RichiestaPrenotazione from '../models/RichiestaPrenotazione';
import Patient from '../models/Patient';
import BadanteIntermediazione from '../models/BadanteIntermediazione';
import DocumentoFatturazione from '../models/DocumentoFatturazione';

const router = Router();
const RUOLI_GESTIONE = ['admin', 'coordinator', 'direttore'];

type JwtUser = { userId: string; name?: string; email: string; role: string };
const u = (req: AuthRequest): JwtUser => req.user as JwtUser;

function evento(azione: string, autore: JwtUser, nota?: string) {
  return { azione, data: new Date(), autoreId: new mongoose.Types.ObjectId(autore.userId), autoreNome: autore.name || autore.email, nota };
}

// ═══ GET /api/attivita — viste operative ═══════════════════════════════════
// ?vista=mie | da_prendere | scadute | oggi | ricontatti | in_attesa |
//       senza_responsabile | completate | tutte
// ?area=privato|convenzione|consulenza|organizzativa  ?praticaTipo&praticaId
// ?responsabile=<userId>  ?q=testo
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const me = u(req);
    const vista = String(req.query.vista || 'tutte');
    const oggi = new Date(); oggi.setHours(23, 59, 59, 999);

    const q: any = {};
    if (req.query.area) q.area = String(req.query.area);
    if (req.query.praticaTipo) q.praticaTipo = String(req.query.praticaTipo);
    if (req.query.praticaId && mongoose.isValidObjectId(String(req.query.praticaId))) {
      q.praticaId = new mongoose.Types.ObjectId(String(req.query.praticaId));
    }

    switch (vista) {
      case 'mie':
        q.responsabileId = new mongoose.Types.ObjectId(me.userId);
        q.stato = { $nin: ['completata', 'annullata'] };
        break;
      case 'da_prendere':
        q.stato = 'da_prendere';
        break;
      case 'scadute':
        q.stato = { $nin: ['completata', 'annullata'] };
        q.scadenza = { $lt: new Date() };
        break;
      case 'oggi':
        q.stato = { $nin: ['completata', 'annullata'] };
        q.$or = [
          { scadenza: { $lte: oggi } },
          { dataControlloAttesa: { $lte: oggi } },
        ];
        break;
      case 'ricontatti':
        q.stato = { $nin: ['completata', 'annullata'] };
        q.dataControlloAttesa = { $lte: oggi };
        break;
      case 'in_attesa':
        q.stato = 'in_attesa';
        break;
      case 'senza_responsabile':
        q.stato = { $nin: ['completata', 'annullata'] };
        q.responsabileId = { $exists: false };
        break;
      case 'completate':
        q.stato = { $in: ['completata', 'annullata'] };
        break;
      case 'trasferimenti':
        q['trasferimento.aId'] = new mongoose.Types.ObjectId(me.userId);
        q['trasferimento.accettato'] = false;
        break;
      default:
        q.stato = { $nin: ['completata', 'annullata'] };
    }

    if (req.query.responsabile && mongoose.isValidObjectId(String(req.query.responsabile))) {
      q.responsabileId = new mongoose.Types.ObjectId(String(req.query.responsabile));
    }
    if (req.query.q) {
      const rx = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      q.$and = [{ $or: [{ titolo: rx }, { praticaLabel: rx }, { responsabileNome: rx }] }];
    }

    const attivita = await Attivita.find(q)
      .select('-aggiornamenti.testo -storico.nota')
      .sort({ priorita: -1, scadenza: 1, createdAt: -1 })
      .limit(300)
      .lean();
    return res.json(attivita);
  } catch (error: any) {
    console.error('[Attivita GET] Errore:', error);
    return res.status(500).json({ message: 'Errore nel recupero delle attività', error: error.message });
  }
});

// ═══ GET /api/attivita/conteggi — badge pagina Oggi ════════════════════════
router.get('/conteggi', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const me = u(req);
    const areaQ = req.query.area ? { area: String(req.query.area) } : {};
    const aperte = { stato: { $nin: ['completata', 'annullata'] } };
    const oggi = new Date(); oggi.setHours(23, 59, 59, 999);
    const my = new mongoose.Types.ObjectId(me.userId);

    const [mie, daPrendere, scadute, senzaResp, ricontatti, trasferimenti, consegneAperte, consegneTrasf] = await Promise.all([
      Attivita.countDocuments({ ...areaQ, ...aperte, responsabileId: my } as any),
      Attivita.countDocuments({ ...areaQ, stato: 'da_prendere' } as any),
      Attivita.countDocuments({ ...areaQ, ...aperte, scadenza: { $lt: new Date() } } as any),
      Attivita.countDocuments({ ...areaQ, ...aperte, responsabileId: { $exists: false } } as any),
      Attivita.countDocuments({ ...areaQ, ...aperte, dataControlloAttesa: { $lte: oggi } } as any),
      Attivita.countDocuments({ ...areaQ, 'trasferimento.aId': my, 'trasferimento.accettato': false } as any),
      // Riconciliazione consegne: le consegne aperte contano nel riepilogo
      // operativo senza essere duplicate come attività.
      ConsegnaAmministrativa.countDocuments({ stato: { $ne: 'gestita' } }),
      ConsegnaAmministrativa.countDocuments({ 'trasferimento.aId': my, 'trasferimento.accettato': false, stato: { $ne: 'gestita' } }),
    ]);
    return res.json({ mie, daPrendere, scadute, senzaResp, ricontatti, trasferimenti, consegneAperte, consegneTrasf });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore conteggi attività', error: error.message });
  }
});

// ═══ GET /api/attivita/pratiche — ricerca pratiche reali da collegare ══════
// ?tipo=richiesta|paziente|intermediazione|consegna|documento  ?q=testo
// Sostituisce il campo libero: ogni attività punta a un record reale.
router.get('/pratiche', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tipo = String(req.query.tipo || '');
    const q = String(req.query.q || '').trim();
    const rx = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
    const out: { id: string; tipo: string; label: string }[] = [];

    if (tipo === 'richiesta') {
      const filtro: any = { stato: { $nin: ['rifiutata', 'completata'] } };
      if (rx) filtro.$or = [{ pazienteNome: rx }, { richiedenteNome: rx }, { tipoSpecifico: rx }];
      const rows = await RichiestaPrenotazione.find(filtro).sort({ createdAt: -1 }).limit(20).lean();
      rows.forEach((r: any) => out.push({
        id: String(r._id), tipo,
        label: `Richiesta — ${r.pazienteNome} · ${r.tipoSpecifico || r.tipoServizio} (${r.stato})`,
      }));
    } else if (tipo === 'paziente') {
      const filtro: any = rx ? { $or: [{ firstName: rx }, { lastName: rx }] } : {};
      const rows = await Patient.find(filtro).sort({ lastName: 1 }).limit(20).lean();
      rows.forEach((p: any) => out.push({
        id: String(p._id), tipo,
        label: `Paziente — ${p.lastName} ${p.firstName}`,
      }));
    } else if (tipo === 'intermediazione') {
      const rows = await BadanteIntermediazione.find({ stato: { $nin: ['annullata', 'fatturata'] } })
        .populate('patient', 'firstName lastName').sort({ createdAt: -1 }).limit(40).lean();
      rows.forEach((b: any) => {
        const nome = `${b.patient?.lastName || ''} ${b.patient?.firstName || ''}`.trim() || '—';
        if (rx && !rx.test(nome)) return;
        out.push({ id: String(b._id), tipo, label: `Intermediazione — ${nome} · ${b.livello} (${b.stato})` });
      });
      out.splice(20);
    } else if (tipo === 'consegna') {
      const filtro: any = { stato: { $ne: 'gestita' } };
      if (rx) filtro.$or = [{ titolo: rx }, { riferimento: rx }, { testo: rx }];
      const rows = await ConsegnaAmministrativa.find(filtro).sort({ createdAt: -1 }).limit(20).lean();
      rows.forEach((c: any) => out.push({
        id: String(c._id), tipo,
        label: `Consegna — ${c.titolo} (${c.stato.replace(/_/g, ' ')})`,
      }));
    } else if (tipo === 'documento') {
      const filtro: any = rx ? { numero: rx } : {};
      const docs = await DocumentoFatturazione.find(filtro)
        .populate('patient', 'firstName lastName').sort({ data: -1 }).limit(20).lean();
      docs.forEach((d: any) => {
        const nome = `${d.patient?.lastName || ''} ${d.patient?.firstName || ''}`.trim();
        out.push({
          id: String(d._id), tipo,
          label: `${d.tipo === 'fattura' ? 'Fattura' : 'Preventivo'} ${d.numero}${nome ? ` — ${nome}` : ''}`,
        });
      });
    } else {
      return res.status(400).json({ message: 'Tipo pratica non valido' });
    }
    return res.json(out);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore ricerca pratiche', error: error.message });
  }
});

// ═══ GET /api/attivita/:id — dettaglio completo (segna anche letta) ════════
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'ID non valido' });
    const me = u(req);
    const attivita = await Attivita.findById(req.params.id);
    if (!attivita) return res.status(404).json({ message: 'Attività non trovata' });

    // Lettura registrata ma separata dallo stato: leggere non chiude il compito
    const giaLetta = (attivita.lettaDa || []).some(l => String(l.userId) === me.userId);
    if (!giaLetta) {
      attivita.lettaDa = attivita.lettaDa || [];
      attivita.lettaDa.push({ userId: new mongoose.Types.ObjectId(me.userId), nome: me.name || me.email, il: new Date() } as any);
      attivita.storico.push(evento('letta', me) as any);
      await attivita.save();
    }
    return res.json(attivita);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel recupero attività', error: error.message });
  }
});

// ═══ POST /api/attivita — nuova attività ═══════════════════════════════════
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const me = u(req);
    const b = req.body || {};
    const titolo = String(b.titolo || '').trim().slice(0, 200);
    if (!titolo) return res.status(400).json({ message: 'Il titolo è obbligatorio' });

    let responsabileNome = String(b.responsabileNome || '').trim() || undefined;
    let responsabileId: mongoose.Types.ObjectId | undefined;
    if (b.responsabileId && mongoose.isValidObjectId(String(b.responsabileId))) {
      const usr = await User.findById(String(b.responsabileId)).select('name').lean();
      if (usr) { responsabileId = usr._id as mongoose.Types.ObjectId; responsabileNome = (usr as any).name || responsabileNome; }
    }

    const attivita = await Attivita.create({
      titolo,
      azioneRichiesta: String(b.azioneRichiesta || '').trim().slice(0, 2000) || undefined,
      praticaTipo: ['richiesta', 'paziente', 'intermediazione', 'consegna', 'documento', 'checklist', 'magazzino', 'generale'].includes(b.praticaTipo) ? b.praticaTipo : undefined,
      praticaId: b.praticaId && mongoose.isValidObjectId(String(b.praticaId)) ? new mongoose.Types.ObjectId(String(b.praticaId)) : undefined,
      praticaLabel: String(b.praticaLabel || '').trim().slice(0, 200) || undefined,
      area: ['privato', 'convenzione', 'consulenza', 'organizzativa'].includes(b.area) ? b.area : undefined,
      priorita: ['bassa', 'normale', 'alta', 'urgente'].includes(b.priorita) ? b.priorita : 'normale',
      scadenza: b.scadenza ? new Date(b.scadenza) : undefined,
      stato: responsabileId ? 'in_lavorazione' : 'da_prendere',
      responsabileId,
      responsabileNome,
      autoreId: new mongoose.Types.ObjectId(me.userId),
      autoreNome: me.name || me.email,
      storico: [evento(responsabileId ? 'assegnata' : 'creata', me)],
    });
    return res.status(201).json(attivita);
  } catch (error: any) {
    console.error('[Attivita POST] Errore:', error);
    return res.status(500).json({ message: 'Errore nella creazione attività', error: error.message });
  }
});

// ═══ POST /api/attivita/:id/prendi — presa in carico ═══════════════════════
router.post('/:id/prendi', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const me = u(req);
    const attivita = await Attivita.findById(req.params.id);
    if (!attivita) return res.status(404).json({ message: 'Attività non trovata' });
    if (['completata', 'annullata'].includes(attivita.stato)) {
      return res.status(400).json({ message: 'Attività già chiusa: riaprila prima' });
    }
    attivita.responsabileId = new mongoose.Types.ObjectId(me.userId);
    attivita.responsabileNome = me.name || me.email;
    attivita.stato = 'in_lavorazione';
    attivita.storico.push(evento('presa', me) as any);
    await attivita.save();
    return res.json(attivita);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore presa in carico', error: error.message });
  }
});

// ═══ POST /api/attivita/:id/assegna — assegna responsabile (gestione) ══════
router.post('/:id/assegna', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const me = u(req);
    if (!RUOLI_GESTIONE.includes(me.role)) return res.status(403).json({ message: 'Permessi insufficienti' });
    const { responsabileId } = req.body || {};
    if (!mongoose.isValidObjectId(String(responsabileId))) return res.status(400).json({ message: 'Responsabile non valido' });
    const usr = await User.findById(String(responsabileId)).select('name role').lean();
    if (!usr) return res.status(404).json({ message: 'Utente non trovato' });

    const attivita = await Attivita.findById(req.params.id);
    if (!attivita) return res.status(404).json({ message: 'Attività non trovata' });
    attivita.responsabileId = usr._id as mongoose.Types.ObjectId;
    attivita.responsabileNome = (usr as any).name;
    if (attivita.stato === 'da_prendere') attivita.stato = 'in_lavorazione';
    attivita.storico.push(evento('assegnata', me, `a ${(usr as any).name}`) as any);
    await attivita.save();
    return res.json(attivita);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore assegnazione', error: error.message });
  }
});

// ═══ PATCH /api/attivita/:id/stato — cambio stato con regole ═══════════════
router.patch('/:id/stato', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const me = u(req);
    const { stato, esito, motivo, interlocutore, dataControllo } = req.body || {};
    const attivita = await Attivita.findById(req.params.id);
    if (!attivita) return res.status(404).json({ message: 'Attività non trovata' });

    switch (stato) {
      case 'in_lavorazione':
        if (!attivita.responsabileId) {
          attivita.responsabileId = new mongoose.Types.ObjectId(me.userId);
          attivita.responsabileNome = me.name || me.email;
        }
        attivita.stato = 'in_lavorazione';
        attivita.storico.push(evento('presa', me) as any);
        break;
      case 'in_attesa':
        if (!interlocutore || !dataControllo) {
          return res.status(400).json({ message: 'In attesa richiede interlocutore e data di controllo' });
        }
        attivita.stato = 'in_attesa';
        attivita.interlocutoreAttesa = String(interlocutore).trim().slice(0, 120);
        attivita.dataControlloAttesa = new Date(dataControllo);
        attivita.storico.push(evento('in_attesa', me, `${interlocutore} — controllo ${new Date(dataControllo).toLocaleDateString('it-IT')}`) as any);
        break;
      case 'completata':
        if (!esito || !String(esito).trim()) {
          return res.status(400).json({ message: 'Il completamento richiede un esito' });
        }
        attivita.stato = 'completata';
        attivita.esito = String(esito).trim().slice(0, 2000);
        attivita.completataIl = new Date();
        attivita.completataDa = me.name || me.email;
        attivita.storico.push(evento('completata', me, String(esito).slice(0, 200)) as any);
        break;
      case 'annullata':
        if (!motivo || !String(motivo).trim()) {
          return res.status(400).json({ message: "L'annullamento richiede un motivo" });
        }
        attivita.stato = 'annullata';
        attivita.motivoAnnullamento = String(motivo).trim().slice(0, 500);
        attivita.storico.push(evento('annullata', me, String(motivo).slice(0, 200)) as any);
        break;
      case 'riaperta':
        attivita.stato = attivita.responsabileId ? 'in_lavorazione' : 'da_prendere';
        attivita.esito = undefined;
        attivita.completataIl = undefined;
        attivita.completataDa = undefined;
        attivita.storico.push(evento('riaperta', me, motivo ? String(motivo).slice(0, 200) : undefined) as any);
        break;
      default:
        return res.status(400).json({ message: 'Stato non valido' });
    }
    await attivita.save();
    return res.json(attivita);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore cambio stato', error: error.message });
  }
});

// ═══ POST /api/attivita/:id/aggiornamento — nota di avanzamento ════════════
router.post('/:id/aggiornamento', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const me = u(req);
    const testo = String(req.body?.testo || '').trim().slice(0, 2000);
    if (!testo) return res.status(400).json({ message: 'Il testo è obbligatorio' });
    const attivita = await Attivita.findById(req.params.id);
    if (!attivita) return res.status(404).json({ message: 'Attività non trovata' });
    attivita.aggiornamenti.push({
      data: new Date(),
      autoreId: new mongoose.Types.ObjectId(me.userId),
      autoreNome: me.name || me.email,
      testo,
    } as any);
    await attivita.save();
    return res.json(attivita);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore aggiornamento', error: error.message });
  }
});

// ═══ POST /api/attivita/:id/trasferisci — passaggio turno ══════════════════
// Il destinatario deve accettare: fino ad allora la responsabilità resta
// al cedente (regola del documento).
router.post('/:id/trasferisci', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const me = u(req);
    const { aId } = req.body || {};
    if (!mongoose.isValidObjectId(String(aId))) return res.status(400).json({ message: 'Destinatario non valido' });
    const dest = await User.findById(String(aId)).select('name').lean();
    if (!dest) return res.status(404).json({ message: 'Utente destinatario non trovato' });

    const attivita = await Attivita.findById(req.params.id);
    if (!attivita) return res.status(404).json({ message: 'Attività non trovata' });
    if (['completata', 'annullata'].includes(attivita.stato)) {
      return res.status(400).json({ message: 'Attività chiusa' });
    }
    attivita.trasferimento = {
      aId: dest._id as mongoose.Types.ObjectId,
      aNome: (dest as any).name,
      daNome: attivita.responsabileNome || me.name || me.email,
      richiestoIl: new Date(),
      accettato: false,
    } as any;
    attivita.storico.push(evento('trasferita', me, `verso ${(dest as any).name} — in attesa di accettazione`) as any);
    await attivita.save();
    return res.json(attivita);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore trasferimento', error: error.message });
  }
});

// ═══ POST /api/attivita/:id/accetta-trasferimento ══════════════════════════
router.post('/:id/accetta-trasferimento', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const me = u(req);
    const attivita = await Attivita.findById(req.params.id);
    if (!attivita) return res.status(404).json({ message: 'Attività non trovata' });
    if (!attivita.trasferimento || attivita.trasferimento.accettato) {
      return res.status(400).json({ message: 'Nessun trasferimento in sospeso' });
    }
    if (String(attivita.trasferimento.aId) !== me.userId) {
      return res.status(403).json({ message: 'Solo il destinatario può accettare' });
    }
    attivita.responsabileId = new mongoose.Types.ObjectId(me.userId);
    attivita.responsabileNome = me.name || me.email;
    attivita.trasferimento.accettato = true;
    attivita.trasferimento.accettatoIl = new Date();
    if (attivita.stato === 'da_prendere') attivita.stato = 'in_lavorazione';
    attivita.storico.push(evento('accettata', me) as any);
    await attivita.save();
    return res.json(attivita);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore accettazione trasferimento', error: error.message });
  }
});

export default router;
