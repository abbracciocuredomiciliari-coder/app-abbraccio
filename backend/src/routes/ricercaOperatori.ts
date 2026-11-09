import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import Staff from '../models/Staff';
import Attivita from '../models/Attivita';
import { authenticateToken } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { decrypt } from '../utils/encryption';

const router = Router();

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ═══ GET /api/ricerca-operatori/senza-posizione — elenco da completare ══════
// Gli operatori senza domicilio di partenza geocodificato: restano ricercabili
// per nome/qualifica, ma serve un elenco per completare le posizioni.
router.get('/senza-posizione', authenticateToken, authorizeRole('admin', 'coordinator', 'direttore'), async (_req: Request, res: Response) => {
  try {
    const staff = await Staff.find({
      active: true,
      $or: [
        { domicilioCoords: { $exists: false } },
        { 'domicilioCoords.lat': { $in: [null, 0] } },
        { 'domicilioCoords.lng': { $in: [null, 0] } },
      ],
    }).select('firstName lastName category role domicilioPartenza cittaResidenza modalitaAbilitata').sort({ lastName: 1 }).limit(500).lean();
    return res.json({
      totale: staff.length,
      operatori: staff.map((s: any) => ({
        _id: s._id,
        nome: `${s.firstName} ${s.lastName}`,
        qualifica: s.category,
        ruolo: s.role,
        zonaDichiarata: s.domicilioPartenza || s.cittaResidenza || '',
        modalitaAbilitata: s.modalitaAbilitata,
      })),
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore elenco posizioni mancanti', error: error.message });
  }
});

// Fascia oraria dichiarata → copertura indicativa del giorno.
// Restituisce solo la COERENZA con la disponibilità dichiarata: la disponibilità
// reale su una data specifica non è tracciata, quindi va sempre confermata.
function fasciaCoperta(disponibilita: string | null, oraInizio?: number, oraFine?: number): 'compatibile' | 'non_compatibile' | 'non_verificata' {
  if (!disponibilita) return 'non_verificata';
  if (oraInizio === undefined || oraFine === undefined) return 'non_verificata';
  if (disponibilita === 'h24') return 'compatibile';
  const diurno = oraInizio >= 7 * 60 && oraFine <= 20 * 60;            // 07:00–20:00
  const notturno = oraInizio >= 20 * 60 || oraFine <= 7 * 60;          // 20:00–07:00
  if (disponibilita === 'diurno') return diurno ? 'compatibile' : 'non_compatibile';
  if (disponibilita === 'notturno') return notturno ? 'compatibile' : 'non_compatibile';
  return 'non_verificata';
}

// ═══ GET /api/ricerca-operatori — motore di ricerca operatori UNIFICATO ══════
// Accessibile da tutte le aree. Filtri: qualifica, area, zona testo o geo,
// disponibilità, tipo lavoro, ricerca libera.
// Chi non ha zona impostata resta trovabile nella ricerca non geografica
// (con avviso); nella ricerca geografica viene escluso e conteggiato.
router.get('/', authenticateToken, authorizeRole('admin', 'coordinator', 'direttore'), async (req: Request, res: Response) => {
  try {
    const { qualifica, area, zona, disponibilita, tipoLavoro, q } = req.query;
    const dataRichiesta = String(req.query.data || '');
    const hhmm = (v: any) => { const m = String(v || '').match(/^(\d{1,2}):(\d{2})$/); return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : undefined; };
    const oraInizio = hhmm(req.query.oraInizio);
    const oraFine = hhmm(req.query.oraFine);
    const richiestaOrario = !!dataRichiesta && oraInizio !== undefined && oraFine !== undefined;
    const lat = parseFloat(String(req.query.lat || ''));
    const lng = parseFloat(String(req.query.lng || ''));
    const raggioKm = parseFloat(String(req.query.raggioKm || ''));
    const geoAttivo = !isNaN(lat) && !isNaN(lng);

    const query: any = { active: true };

    // Area operativa (permessi sul dato, non solo filtro visuale)
    if (area === 'privato') {
      query.modalitaAbilitata = { $in: ['privato', 'entrambi'] };
    } else if (area === 'convenzione') {
      query.modalitaAbilitata = { $in: ['convenzione', 'entrambi'] };
    } else if (area === 'intermediazione') {
      query.$or = [
        { modalitaAbilitata: 'intermediazione' },
        { modalitaAbilitata: { $in: ['privato', 'entrambi'] }, category: { $in: ['privato', 'osa', 'assistente-familiare', 'badante', 'colf', 'sociale'] } },
      ];
    }

    // Qualifica normalizzata: match su category (enum) O ruolo libero (testo parziale)
    if (qualifica && String(qualifica).trim()) {
      const qn = String(qualifica).trim().toLowerCase();
      const CATEGORIE = ['infermieristico', 'oss', 'riabilitativo', 'medico', 'sociale', 'coordinamento', 'direzione', 'privato', 'osa', 'assistente-familiare', 'badante', 'colf'];
      const rx = new RegExp(qn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      if (CATEGORIE.includes(qn)) {
        query.category = qn;
      } else {
        query.$or = [...(query.$or || []), { category: qn }, { role: rx }];
      }
    }

    if (disponibilita && ['diurno', 'notturno', 'h24'].includes(String(disponibilita))) {
      query.disponibilita = String(disponibilita);
    }
    if (tipoLavoro && ['ore', 'convivenza'].includes(String(tipoLavoro))) {
      query.tipoLavoro = String(tipoLavoro);
    }
    if (zona && String(zona).trim()) {
      const zrx = new RegExp(String(zona).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$and = [...(query.$and || []), { $or: [{ domicilioPartenza: zrx }, { cittaResidenza: zrx }, { indirizzoResidenza: zrx }] }];
    }
    if (q && String(q).trim()) {
      const nrx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$and = [...(query.$and || []), { $or: [{ firstName: nrx }, { lastName: nrx }, { email: nrx }] }];
    }

    const staff = await Staff.find(query).select(
      'firstName lastName role category email phone tipoLavoro disponibilita residenzaPressoFamiglia domicilioPartenza cittaResidenza domicilioCoords raggioAzioneKm modalitaAbilitata areaIntermediazione professionista'
    ).limit(400);

    const plain = (s: any) => {
      const o = s.toObject();
      if (o.phone) { try { o.phone = decrypt(o.phone); } catch { /* in chiaro */ } }
      return o;
    };

    let risultati = staff.map(s => {
      const o = plain(s);
      const haZona = !!(o.domicilioCoords?.lat && o.domicilioCoords?.lng);
      let distanzaKm: number | null = null;
      let inZona = true;
      if (geoAttivo && haZona) {
        const dist = haversineKm(o.domicilioCoords.lat, o.domicilioCoords.lng, lat, lng);
        distanzaKm = Math.round(dist * 10) / 10;
        const raggio = !isNaN(raggioKm) && raggioKm > 0 ? raggioKm : (o.raggioAzioneKm || 10);
        inZona = dist <= raggio;
      }
      return {
        _id: o._id,
        nome: `${o.firstName} ${o.lastName}`,
        qualifica: o.category,
        ruolo: o.role,
        email: o.email,
        phone: o.phone || '',
        areeAbilitate: o.modalitaAbilitata === 'entrambi' ? ['privato', 'convenzione'] : [o.modalitaAbilitata],
        areaIntermediazione: !!o.areaIntermediazione,
        zona: o.domicilioPartenza || o.cittaResidenza || '',
        raggioAzioneKm: o.raggioAzioneKm || 10,
        coordinateMancanti: !haZona,
        distanzaKm,
        inZona,
        disponibilita: o.disponibilita || null,
        tipoLavoro: o.tipoLavoro || null,
        residenzaPressoFamiglia: !!o.residenzaPressoFamiglia,
        professionista: !!o.professionista,
        // Disponibilità sulla fascia richiesta: coerenza con quanto DICHIARATO.
        // Mai presentata come confermata: va sempre verificata con l'operatore.
        disponibilitaStato: richiestaOrario ? fasciaCoperta(o.disponibilita || null, oraInizio, oraFine) : (o.disponibilita ? 'non_verificata' : 'non_verificata'),
      };
    });

    let senzaZonaEsclusi = 0;
    if (geoAttivo) {
      senzaZonaEsclusi = risultati.filter(r => r.coordinateMancanti).length;
      risultati = risultati.filter(r => !r.coordinateMancanti && r.inZona);
      risultati.sort((a, b) => (a.distanzaKm ?? 9999) - (b.distanzaKm ?? 9999));
    } else {
      // Senza geo: prima chi ha zona, poi alfabetico — chi manca zona resta trovabile con avviso
      risultati.sort((a, b) => (a.coordinateMancanti === b.coordinateMancanti ? a.nome.localeCompare(b.nome) : a.coordinateMancanti ? 1 : -1));
    }

    return res.json({ risultati, senzaZonaEsclusi, geoAttivo, richiestaOrario });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nella ricerca operatori', error: error.message });
  }
});

// ═══ POST /api/ricerca-operatori/proposta — registra una PROPOSTA ═════════════
// Una proposta NON è un incarico e non invia notifiche: crea un'attività di
// verifica collegata alla pratica (demo: "verificare proposta X per pratica Y").
router.post('/proposta', authenticateToken, authorizeRole('admin', 'coordinator', 'direttore'), async (req: Request, res: Response) => {
  try {
    const { staffId, praticaTipo, praticaId, praticaLabel, area, note } = req.body || {};
    if (!staffId || !mongoose.isValidObjectId(staffId)) {
      return res.status(400).json({ message: 'Operatore non valido' });
    }
    if (!note || !String(note).trim()) {
      return res.status(400).json({ message: 'La nota con le verifiche da eseguire è obbligatoria' });
    }
    const staff = await Staff.findById(staffId).select('firstName lastName category role').lean();
    if (!staff) return res.status(404).json({ message: 'Operatore non trovato' });

    const me = (req as any).user;
    const nome = `${(staff as any).firstName} ${(staff as any).lastName}`;
    const areaAttivita = ['privato', 'convenzione', 'consulenza', 'organizzativa'].includes(area) ? area : 'organizzativa';

    const attivita = await Attivita.create({
      titolo: `Verificare proposta ${nome}`,
      azioneRichiesta: `Verificare qualifica (${(staff as any).category}), area abilitata, documenti e disponibilità effettiva prima di proporre l'incarico.\nNote: ${String(note).trim()}`,
      praticaTipo: ['richiesta', 'paziente', 'intermediazione', 'consegna', 'documento'].includes(praticaTipo) ? praticaTipo : 'generale',
      praticaId: praticaId && mongoose.isValidObjectId(praticaId) ? new mongoose.Types.ObjectId(praticaId) : undefined,
      praticaLabel: String(praticaLabel || '').slice(0, 200) || undefined,
      area: areaAttivita,
      priorita: 'normale',
      autoreId: new mongoose.Types.ObjectId(me.userId),
      autoreNome: me.name || me.email,
      storico: [{ azione: 'creata', data: new Date(), autoreNome: me.name || me.email, nota: `Proposta operatore: ${nome}` }],
    });
    return res.status(201).json({ attivita });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore registrazione proposta', error: error.message });
  }
});

// ═══ POST /api/ricerca-operatori/colloquio — colloquio in agenda/attività ════
// Registra un colloquio programmato come attività con scadenza data/ora.
// Nessun invito esterno inviato.
router.post('/colloquio', authenticateToken, authorizeRole('admin', 'coordinator', 'direttore'), async (req: Request, res: Response) => {
  try {
    const { staffId, dataOra, modalita, praticaTipo, praticaId, praticaLabel, area } = req.body || {};
    if (!staffId || !mongoose.isValidObjectId(staffId)) {
      return res.status(400).json({ message: 'Operatore non valido' });
    }
    const quando = new Date(dataOra);
    if (isNaN(quando.getTime())) {
      return res.status(400).json({ message: 'Data e ora del colloquio obbligatorie' });
    }
    const staff = await Staff.findById(staffId).select('firstName lastName category').lean();
    if (!staff) return res.status(404).json({ message: 'Operatore non trovato' });

    const me = (req as any).user;
    const nome = `${(staff as any).firstName} ${(staff as any).lastName}`;
    const areaAttivita = ['privato', 'convenzione', 'consulenza', 'organizzativa'].includes(area) ? area : 'organizzativa';

    const attivita = await Attivita.create({
      titolo: `Colloquio con ${nome}`,
      azioneRichiesta: `Colloquio programmato${modalita ? ` — ${String(modalita).trim()}` : ''}.`,
      praticaTipo: ['richiesta', 'paziente', 'intermediazione', 'consegna', 'documento'].includes(praticaTipo) ? praticaTipo : 'generale',
      praticaId: praticaId && mongoose.isValidObjectId(praticaId) ? new mongoose.Types.ObjectId(praticaId) : undefined,
      praticaLabel: String(praticaLabel || '').slice(0, 200) || undefined,
      area: areaAttivita,
      priorita: 'normale',
      scadenza: quando,
      autoreId: new mongoose.Types.ObjectId(me.userId),
      autoreNome: me.name || me.email,
      storico: [{ azione: 'creata', data: new Date(), autoreNome: me.name || me.email, nota: 'Colloquio registrato dalla ricerca operatori — nessun invito inviato' }],
    });
    return res.status(201).json({ attivita });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore registrazione colloquio', error: error.message });
  }
});

export default router;
