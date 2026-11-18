import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import Attivita, { SETTORI_CONSEGNA, SettoreConsegna } from '../models/Attivita';
import ConsegnaAmministrativa from '../models/ConsegnaAmministrativa';
import Staff from '../models/Staff';
import Patient from '../models/Patient';

const router = Router();
const RUOLI_GESTIONE = ['admin', 'coordinator', 'direttore'];
const LIMITE = 800; // salvaguardia: i lavori sono decine/centinaia, mai l'intero DB

// ═══════════════════════════════════════════════════════════════════════════
// HUB CONSEGNE — adattatore di lettura: unisce Attivita + ConsegnaAmministrativa
// in UNA vista per settore/stato/professionista. Non duplica e non migra dati:
// ogni elemento conserva source:id e rimanda alla fonte originale.
// Conteggi, filtri e paginazione sono calcolati sul server con gli stessi filtri.
// Nessun responsabile interno esposto: il professionista collegato è Staff.
// ═══════════════════════════════════════════════════════════════════════════

// Qualifica anagrafica (Staff.category) → settore consegne
const CATEGORIA_SETTORE: Record<string, SettoreConsegna> = {
  'infermieristico': 'infermieristiche-strumentali',
  'oss': 'oss', 'osa': 'oss',
  'badante': 'badanti', 'colf': 'badanti', 'assistente-familiare': 'badanti',
  'medico': 'medici',
  'riabilitativo': 'riabilitazione',
  'sociale': 'altri', 'coordinamento': 'altri', 'direzione': 'altri', 'privato': 'altri',
};

const AREE = [
  { id: 'privato', label: 'Gestione privata' },
  { id: 'convenzione', label: 'Convenzione SIAT' },
  { id: 'consulenza', label: 'Intermediazioni' },
  { id: 'organizzativa', label: 'Back office e organizzazione' },
];

const ROUTE_PRATICA: Record<string, string> = {
  richiesta: '/gestione-richieste',
  paziente: '/patients',
  intermediazione: '/badanti-intermediazione',
  consegna: '/bacheca',
  documento: '/archivio-fatture',
};

interface HubItem {
  source: 'attivita' | 'consegna';
  id: string;
  sectorId: SettoreConsegna;
  area: string;
  title: string;
  workflow: 'new' | 'active' | 'waiting' | 'closed' | 'cancelled';
  outcome?: string;
  commercial?: boolean;
  priority: 'normal' | 'urgent';
  followUpRequired?: boolean;
  professionalIds?: string[];
  professionalLabels?: string[];
  patientId?: string;
  patientLabel?: string;
  referenceLabel?: string;
  dueAt?: string;
  orario?: string;
  lastUpdateAt?: string;
  lastUpdateBy?: string;
  lastUpdateAction?: string;
  nextContactAt?: string;
  waitCheckAt?: string;
  nextAction?: string;
  description?: string;
  assignmentRef?: string;
  sourceRoute: string;
  sortAt: number;
}

function sectorFromProfessionals(ids: mongoose.Types.ObjectId[] | undefined, mappaStaff: Map<string, SettoreConsegna>): SettoreConsegna | undefined {
  if (!ids?.length) return undefined;
  const settori = new Set(ids.map(id => mappaStaff.get(String(id))).filter(Boolean));
  return settori.size === 1 ? [...settori][0] : undefined;
}

function toHubAttivita(a: any, mappaStaff: Map<string, SettoreConsegna>): HubItem {
  const workflowMap: Record<string, HubItem['workflow']> = {
    da_prendere: 'new', in_lavorazione: 'active', in_attesa: 'waiting', completata: 'closed', annullata: 'cancelled',
  };
  const settore: SettoreConsegna = a.settore
    || sectorFromProfessionals(a.professionistiIds, mappaStaff)
    || (a.praticaTipo === 'intermediazione' ? 'badanti'
      : a.praticaTipo === 'consegna' ? 'backoffice'
      : 'da-classificare');
  return {
    source: 'attivita',
    id: String(a._id),
    sectorId: settore,
    area: a.area || 'organizzativa',
    title: a.titolo,
    workflow: workflowMap[a.stato] || 'new',
    outcome: a.nonInteressato ? 'not-interested' : undefined,
    commercial: a.nonInteressato === true,
    priority: a.priorita === 'urgente' ? 'urgent' : 'normal',
    followUpRequired: a.tipo === 'ricontatto',
    professionalIds: (a.professionistiIds || []).map(String),
    professionalLabels: a.professionistiNomi || [],
    patientId: a.praticaTipo === 'paziente' && a.praticaId ? String(a.praticaId) : undefined,
    patientLabel: a.praticaTipo === 'paziente' ? a.praticaLabel || undefined : undefined,
    referenceLabel: a.praticaLabel || undefined,
    dueAt: a.scadenza ? a.scadenza.toISOString() : undefined,
    orario: a.orarioPromemoria || undefined,
    nextContactAt: a.tipo === 'ricontatto' && a.dataControlloAttesa ? a.dataControlloAttesa.toISOString() : undefined,
    waitCheckAt: a.stato === 'in_attesa' && a.dataControlloAttesa ? a.dataControlloAttesa.toISOString() : undefined,
    nextAction: a.azioneRichiesta || undefined,
    description: [a.azioneRichiesta, a.interlocutoreAttesa ? `In attesa di: ${a.interlocutoreAttesa}` : '', a.esito ? `Esito: ${a.esito}` : '', a.motivoAnnullamento ? `Motivo: ${a.motivoAnnullamento}` : ''].filter(Boolean).join('\n'),
    ...ultimoMovimento(a.storico),
    assignmentRef: a.praticaTipo ? ROUTE_PRATICA[a.praticaTipo] : undefined,
    sourceRoute: '/gestione',
    sortAt: new Date(a.createdAt).getTime(),
  };
}

// Ultimo movimento dello storico → "aggiornata il … alle … da …" visibile in hub
function ultimoMovimento(storico: any[] | undefined) {
  const m = (storico || []).slice(-1)[0];
  if (!m) return {};
  const quando = m.il || m.data;
  return {
    lastUpdateAt: quando ? new Date(quando).toISOString() : undefined,
    lastUpdateBy: m.daNome || m.autoreNome || undefined,
    lastUpdateAction: m.azione || undefined,
  };
}

function toHubConsegna(c: any): HubItem {
  const workflowMap: Record<string, HubItem['workflow']> = {
    da_gestire: 'new', presa_in_carico: 'active', in_attesa_riscontro: 'waiting', gestita: 'closed',
  };
  return {
    source: 'consegna',
    id: String(c._id),
    sectorId: c.settore || 'backoffice',
    area: 'organizzativa',
    title: c.titolo,
    workflow: workflowMap[c.stato] || 'new',
    outcome: c.nonInteressato ? 'not-interested' : undefined,
    commercial: c.nonInteressato === true,
    priority: c.priorita === 'urgente' ? 'urgent' : 'normal',
    followUpRequired: c.stato === 'in_attesa_riscontro',
    professionalIds: (c.professionistiIds || []).map(String),
    professionalLabels: c.professionistiNomi || [],
    patientId: c.paziente ? String(c.paziente) : undefined,
    patientLabel: c.pazienteLabel || undefined,
    referenceLabel: c.riferimento || c.pazienteLabel || undefined,
    dueAt: c.scadenza ? c.scadenza.toISOString() : (c.dataGiornata ? c.dataGiornata.toISOString() : undefined),
    orario: c.orarioPromemoria || undefined,
    nextContactAt: c.stato === 'in_attesa_riscontro' && c.dataControlloAttesa ? c.dataControlloAttesa.toISOString() : undefined,
    waitCheckAt: c.stato === 'in_attesa_riscontro' && c.dataControlloAttesa ? c.dataControlloAttesa.toISOString() : undefined,
    nextAction: undefined,
    description: [c.testo, c.interlocutoreAttesa ? `In attesa di: ${c.interlocutoreAttesa}` : '', c.esito ? `Esito: ${c.esito}` : ''].filter(Boolean).join('\n'),
    ...ultimoMovimento(c.storico),
    sourceRoute: '/bacheca',
    sortAt: new Date(c.createdAt).getTime(),
  };
}

const isOpen = (i: HubItem) => !['closed', 'cancelled'].includes(i.workflow);
const isUrgent = (i: HubItem) => isOpen(i) && i.priority === 'urgent';

function matchesStatus(i: HubItem, status: string): boolean {
  switch (status) {
    case 'tutte': return true;
    case 'nuove': return i.workflow === 'new';
    case 'in-corso': return i.workflow === 'active';
    case 'da-ricontattare': return isOpen(i) && i.followUpRequired === true;
    case 'chiuse': return ['closed', 'cancelled'].includes(i.workflow) && !(i.outcome === 'not-interested' && i.commercial === true);
    case 'non-interessati': return i.workflow === 'closed' && i.outcome === 'not-interested' && i.commercial === true;
    case 'urgenti': return isUrgent(i);
    default: return false;
  }
}

function dateInRome(value?: string): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const v = (t: string) => p.find(x => x.type === t)?.value;
  return `${v('year')}-${v('month')}-${v('day')}`;
}
const oggiRoma = () => dateInRome(new Date().toISOString())!;

function matchesTool(i: HubItem, tool: string, today: string): boolean {
  switch (tool) {
    case 'oggi': return isOpen(i) && [i.dueAt, i.nextContactAt, i.waitCheckAt].some(d => dateInRome(d) === today);
    case 'da-prendere': return isOpen(i) && i.workflow === 'new';
    case 'scadute': {
      if (!isOpen(i) || !i.dueAt) return false;
      if (/^\d{4}-\d{2}-\d{2}$/.test(i.dueAt)) return i.dueAt < today;
      const d = Date.parse(i.dueAt); return Number.isFinite(d) && d < Date.now();
    }
    case 'attesa': return isOpen(i) && i.workflow === 'waiting';
    case 'ricontatti': return isOpen(i) && i.followUpRequired === true;
    case 'aperte': return isOpen(i);
    default: return false;
  }
}

const STATUS_IDS = ['tutte', 'nuove', 'in-corso', 'da-ricontattare', 'chiuse', 'non-interessati', 'urgenti'];
const TOOL_IDS = ['oggi', 'da-prendere', 'scadute', 'attesa', 'ricontatti', 'aperte'];
const SECTOR_IDS = SETTORI_CONSEGNA as string[];

// Carica tutte le lavorazioni (limite di sicurezza) e le mappa in HubItem.
async function caricaTutto(): Promise<HubItem[]> {
  const [attivita, consegne] = await Promise.all([
    Attivita.find({}).sort({ _id: -1 }).limit(LIMITE).lean(),
    ConsegnaAmministrativa.find({}).sort({ _id: -1 }).limit(LIMITE).lean(),
  ]);
  // Risolvi i settori dai professionisti collegati (anagrafica Staff)
  const ids = new Set<string>();
  for (const a of attivita) for (const id of a.professionistiIds || []) ids.add(String(id));
  const staffList = ids.size ? await Staff.find({ _id: { $in: [...ids] } }).select('category').lean() : [];
  const mappaStaff = new Map(staffList.map(s => [String(s._id), CATEGORIA_SETTORE[s.category] || 'altri'] as [string, SettoreConsegna]));
  return [
    ...attivita.map(a => toHubAttivita(a, mappaStaff)),
    ...consegne.map(toHubConsegna),
  ];
}

const scopeFilter = (i: HubItem, { sectorId, professionalId, patientId, patientName, area, query }: { sectorId?: string | null; professionalId?: string | null; patientId?: string | null; patientName?: string; area?: string; query?: string }) => {
  if (sectorId && i.sectorId !== sectorId) return false;
  if (professionalId && !(i.professionalIds || []).includes(professionalId)) return false;
  // Paziente: match per id reale; per le consegne legacy (solo testo riferimento)
  // si verifica il cognome dentro il riferimento.
  const cognome = (patientName || '').split(/\s+/).pop() || '';
  if (patientId && i.patientId !== patientId
    && !(cognome.length >= 3 && (i.referenceLabel || '').toLowerCase().includes(cognome))) return false;
  if (area && area !== 'all' && i.area !== area) return false;
  const q = (query || '').trim().toLowerCase();
  if (q) {
    const hay = [i.title, i.referenceLabel, i.patientLabel, ...(i.professionalLabels || [])].filter(Boolean).join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
};

// ═══ GET /api/hub-consegne/snapshot ═════════════════════════════════════════
// Vista guidata dai parametri (stesso contratto del renderer hub-ui):
//   ?sectorId&professionalId&status&tool&area&q&page&itemKey
//   Risposta: items paginati + totalResults + summary{sectors,statuses,tools}
//   + professionals (schermata professionisti) + detail (se itemKey)
router.get('/snapshot', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const sectorId = SECTOR_IDS.includes(String(req.query.sectorId)) ? String(req.query.sectorId) : null;
    const professionalId = mongoose.isValidObjectId(String(req.query.professionalId)) ? String(req.query.professionalId) : null;
    const patientId = mongoose.isValidObjectId(String(req.query.patientId)) ? String(req.query.patientId) : null;
    const patientName = String(req.query.patientName || '').trim().toLowerCase().slice(0, 120) || undefined;
    const status = STATUS_IDS.includes(String(req.query.status)) ? String(req.query.status) : 'tutte';
    const tool = TOOL_IDS.includes(String(req.query.tool)) ? String(req.query.tool) : null;
    const area = AREE.some(a => a.id === req.query.area) ? String(req.query.area) : 'all';
    const query = String(req.query.q || '').trim().slice(0, 120);
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const pageSize = 20;
    const screen = String(req.query.screen || '');
    const itemKey = String(req.query.itemKey || '');
    const today = oggiRoma();

    const tutti = (await caricaTutto()).sort((a, b) => b.sortAt - a.sortAt);

    // Conteggi settori (scope: area+query, senza settore/professionista)
    const scopeSettori = { sectorId: null, professionalId: null, patientId: null, area, query };
    const sectors: Record<string, number> = {};
    for (const s of SECTOR_IDS) sectors[s] = tutti.filter(i => scopeFilter(i, scopeSettori) && i.sectorId === s).length;

    // Conteggi stati (scope completo senza status/tool)
    const scopeStati = { sectorId, professionalId, patientId, patientName, area, query };
    const scopeKey = JSON.stringify({ sectorId, professionalId, patientId, area, query });
    const statuses: Record<string, number> = {};
    for (const st of STATUS_IDS) statuses[st] = tutti.filter(i => scopeFilter(i, scopeStati) && matchesStatus(i, st)).length;

    // Conteggi strumenti (scope senza tool)
    const tools: Record<string, number> = {};
    for (const t of TOOL_IDS) tools[t] = tutti.filter(i => scopeFilter(i, scopeStati) && matchesTool(i, t, today)).length;

    // Elenco paginato (status o tool)
    let righe = tutti.filter(i => scopeFilter(i, scopeStati));
    if (tool) righe = righe.filter(i => matchesTool(i, tool, today));
    else righe = righe.filter(i => matchesStatus(i, status));
    const totalResults = righe.length;
    const start = (page - 1) * pageSize;
    const items = righe.slice(start, start + pageSize).map(({ sortAt, ...rest }) => rest);

    // Professionisti (schermata dedicata): tutto lo Staff attivo del settore/area
    let professionals: any[] | undefined;
    if (screen === 'professionals' || screen === 'professional') {
      const q = query.toLowerCase();
      const staff = await Staff.find({ active: true }).select('firstName lastName role category modalitaAbilitata').lean();
      professionals = staff
        .map(s => {
          const sid: string = CATEGORIA_SETTORE[s.category] || 'altri';
          return {
            id: String(s._id),
            label: `${s.firstName} ${s.lastName}`.trim(),
            role: s.role || s.category,
            sectorIds: [sid],
            itemCount: tutti.filter(i => scopeFilter(i, { sectorId, professionalId: String(s._id), area, query: '' })).length,
          };
        })
        .filter(p => (!sectorId || p.sectorIds.includes(sectorId))
          && (!q || `${p.label} ${p.role}`.toLowerCase().includes(q)))
        .sort((a, b) => (b.itemCount - a.itemCount) || a.label.localeCompare(b.label, 'it'));
    }

    // Pazienti (schermata dedicata): tutti i pazienti con conteggio consegne.
    // Il match copre anche le consegne legacy collegate per nome (riferimento).
    let patients: any[] | undefined;
    if (screen === 'patients' || screen === 'patient') {
      const pz = await Patient.find({}).select('firstName lastName tipoGestione').lean();
      const cognomeMatch = (i: HubItem, cognome: string, pid: string) =>
        i.patientId === pid || (cognome.length >= 3 && (i.referenceLabel || '').toLowerCase().includes(cognome));
      patients = pz
        .map(p => {
          const pid = String(p._id);
          const cognome = String(p.lastName || '').toLowerCase();
          return {
            id: pid,
            label: `${p.firstName} ${p.lastName}`.trim(),
            role: p.tipoGestione === 'consulenza' ? 'Intermediazioni' : p.tipoGestione === 'convenzione' ? 'Convenzione SIAT' : 'Privato',
            tipoGestione: p.tipoGestione,
            itemCount: tutti.filter(i => scopeFilter(i, { sectorId, professionalId, area, query: '' }) && cognomeMatch(i, cognome, pid)).length,
          };
        })
        .filter(p => (area !== 'consulenza' || p.tipoGestione === 'consulenza')
          && (area !== 'privato' || p.tipoGestione !== 'consulenza')
          && (!query || p.label.toLowerCase().includes(query.toLowerCase())))
        .sort((a, b) => (b.itemCount - a.itemCount) || a.label.localeCompare(b.label, 'it'));
    }

    // Dettaglio richiesto (itemKey = "source:id")
    let detail: any;
    if (itemKey) {
      const [src, ...rest] = itemKey.split(':');
      const id = rest.join(':');
      if (mongoose.isValidObjectId(id)) {
        if (src === 'attivita') {
          const a = await Attivita.findById(id).lean();
          if (a) {
            const ids = (a.professionistiIds || []).map(String);
            const st = ids.length ? await Staff.find({ _id: { $in: ids } }).select('category').lean() : [];
            const mappa = new Map(st.map(s => [String(s._id), CATEGORIA_SETTORE[s.category] || 'altri'] as [string, SettoreConsegna]));
            const { sortAt, ...d } = toHubAttivita(a, mappa);
            detail = d;
          }
        } else if (src === 'consegna') {
          const c = await ConsegnaAmministrativa.findById(id).lean();
          if (c) { const { sortAt, ...d } = toHubConsegna(c); detail = d; }
        }
      }
    }

    return res.json({
      items,
      totalResults,
      hasPrevious: page > 1,
      hasNext: start + pageSize < totalResults,
      professionals,
      patients,
      authorizedAreas: AREE,
      summary: { sectors, statuses: { [scopeKey]: statuses }, tools },
      detail,
      today,
      complete: false,
    });
  } catch (error: any) {
    console.error('[Hub snapshot] Errore:', error);
    return res.status(500).json({ message: 'Errore nel caricamento delle consegne', error: error.message });
  }
});

// ═══ GET /api/hub-consegne/promemoria — alert del giorno (scadenze, ricontatti, orari) ════
// Restituisce le lavorazioni aperte con scadenza/controllo entro oggi (scadute incluse)
// e le consegne della giornata odierna. Il frontend mostra banner + alert a orario.
router.get('/promemoria', authenticateToken, async (_req: AuthRequest, res: Response) => {
  try {
    const oggi = new Date(); oggi.setHours(23, 59, 59, 999);
    const inizioOggi = new Date(); inizioOggi.setHours(0, 0, 0, 0);
    const [att, con] = await Promise.all([
      Attivita.find({
        stato: { $nin: ['completata', 'annullata'] },
        $or: [{ scadenza: { $lte: oggi } }, { dataControlloAttesa: { $lte: oggi } }],
      }).select('titolo tipo scadenza dataControlloAttesa orarioPromemoria praticaLabel priorita').limit(200).lean(),
      ConsegnaAmministrativa.find({
        stato: { $ne: 'gestita' },
        $or: [{ scadenza: { $lte: oggi } }, { dataControlloAttesa: { $lte: oggi } }, { dataGiornata: { $gte: inizioOggi, $lte: oggi } }],
      }).select('titolo scadenza dataControlloAttesa dataGiornata orarioPromemoria pazienteLabel riferimento priorita').limit(200).lean(),
    ]);
    const items = [
      ...att.map((a: any) => ({
        id: String(a._id), source: 'attivita', titolo: a.titolo, tipo: a.tipo || 'attivita',
        quando: a.scadenza || a.dataControlloAttesa, orario: a.orarioPromemoria,
        paziente: a.praticaLabel, urgente: a.priorita === 'urgente',
      })),
      ...con.map((c: any) => ({
        id: String(c._id), source: 'consegna', titolo: c.titolo, tipo: 'consegna',
        quando: c.scadenza || c.dataControlloAttesa || c.dataGiornata, orario: c.orarioPromemoria,
        paziente: c.pazienteLabel || c.riferimento, urgente: c.priorita === 'urgente',
      })),
    ].sort((a, b) => String(a.orario || '99:99').localeCompare(String(b.orario || '99:99')));
    return res.json({ items });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore promemoria', error: error.message });
  }
});

// ═══ GET /api/hub-consegne/professionisti — ricerca per filtro nel form ═════
router.get('/professionisti', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase().slice(0, 80);
    const staff = await Staff.find({ active: true }).select('firstName lastName role category').lean();
    const out = staff
      .map(s => ({ id: String(s._id), label: `${s.firstName} ${s.lastName}`.trim(), role: s.role || s.category, sectorId: CATEGORIA_SETTORE[s.category] || 'altri' }))
      .filter(p => !q || `${p.label} ${p.role}`.toLowerCase().includes(q))
      .sort((a, b) => a.label.localeCompare(b.label, 'it'))
      .slice(0, 30);
    return res.json(out);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore ricerca professionisti', error: error.message });
  }
});

// ═══ PATCH /api/hub-consegne/settore — classificazione manuale tracciata ════
router.patch('/settore', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const me = req.user as any;
    if (!RUOLI_GESTIONE.includes(me.role)) return res.status(403).json({ message: 'Permessi insufficienti' });
    const { source, id, settore } = req.body || {};
    if (!SETTORI_CONSEGNA.includes(settore)) return res.status(400).json({ message: 'Settore non valido' });
    if (!mongoose.isValidObjectId(String(id))) return res.status(400).json({ message: 'ID non valido' });

    const userId = new mongoose.Types.ObjectId(me.userId || me.id);
    const nome = me.name || me.email || 'Utente';
    if (source === 'attivita') {
      const a = await Attivita.findById(id);
      if (!a) return res.status(404).json({ message: 'Attività non trovata' });
      a.settore = settore;
      a.storico.push({ azione: 'settore_assegnato', data: new Date(), autoreId: userId, autoreNome: nome, nota: `Settore: ${settore}` } as any);
      await a.save();
    } else if (source === 'consegna') {
      const c = await ConsegnaAmministrativa.findById(id);
      if (!c) return res.status(404).json({ message: 'Consegna non trovata' });
      c.settore = settore;
      c.storico.push({ azione: 'settore_assegnato', da: userId, daNome: nome, il: new Date(), nota: `Settore: ${settore}` });
      await c.save();
    } else {
      return res.status(400).json({ message: 'Fonte non valida' });
    }
    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore classificazione', error: error.message });
  }
});

// ═══ PATCH /api/hub-consegne/elemento — modifica contenuti, priorità, scadenza ════
// Aggiorna titolo/testo/priorità/scadenza/orario sia su Attivita che su
// ConsegnaAmministrativa (fonte dichiarata). Stato e note restano sulle
// route originali; ogni modifica finisce nello storico della lavorazione.
router.patch('/elemento', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const me = req.user as any;
    const userId = me.userId || me.id;
    const nome = me.name || me.email || 'Utente';
    const { source, id, titolo, testo, priorita, scadenza, orarioPromemoria } = req.body || {};
    if (!mongoose.isValidObjectId(String(id))) return res.status(400).json({ message: 'ID non valido' });
    const orarioOk = (v: any) => /^\d{1,2}:\d{2}$/.test(String(v || '')) ? String(v) : undefined;
    const cambi: string[] = [];

    if (source === 'consegna') {
      const c = await ConsegnaAmministrativa.findById(id);
      if (!c) return res.status(404).json({ message: 'Consegna non trovata' });
      if (titolo !== undefined) {
        const t = String(titolo).trim().slice(0, 200);
        if (!t) return res.status(400).json({ message: 'Titolo vuoto' });
        if (t !== c.titolo) { c.titolo = t; cambi.push('titolo'); }
      }
      if (testo !== undefined && String(testo).trim() !== String(c.testo || '').trim()) {
        c.testo = String(testo).trim().slice(0, 4000); cambi.push('testo');
      }
      if (priorita !== undefined) {
        if (!['normale', 'urgente'].includes(priorita)) return res.status(400).json({ message: 'Priorità non valida' });
        if (priorita !== c.priorita) { c.priorita = priorita as any; cambi.push(`priorità ${priorita}`); }
      }
      if ('scadenza' in req.body) {
        const d = scadenza ? new Date(scadenza) : undefined;
        c.scadenza = d && !isNaN(d.getTime()) ? d : undefined; cambi.push('scadenza');
      }
      if ('orarioPromemoria' in req.body) { c.orarioPromemoria = orarioOk(orarioPromemoria); cambi.push('orario promemoria'); }
      if (cambi.length) {
        c.storico.push({ azione: 'modificata', da: new mongoose.Types.ObjectId(userId), daNome: nome, il: new Date(), nota: `Modifiche: ${cambi.join(', ')}` });
        await c.save();
      }
    } else if (source === 'attivita') {
      const a = await Attivita.findById(id);
      if (!a) return res.status(404).json({ message: 'Attività non trovata' });
      if (titolo !== undefined) {
        const t = String(titolo).trim().slice(0, 200);
        if (!t) return res.status(400).json({ message: 'Titolo vuoto' });
        if (t !== a.titolo) { a.titolo = t; cambi.push('titolo'); }
      }
      if (testo !== undefined && String(testo).trim() !== String(a.azioneRichiesta || '').trim()) {
        a.azioneRichiesta = String(testo).trim().slice(0, 2000); cambi.push('dettagli');
      }
      if (priorita !== undefined) {
        if (!['bassa', 'normale', 'alta', 'urgente'].includes(priorita)) return res.status(400).json({ message: 'Priorità non valida' });
        if (priorita !== a.priorita) { a.priorita = priorita as any; cambi.push(`priorità ${priorita}`); }
      }
      if ('scadenza' in req.body) {
        const d = scadenza ? new Date(scadenza) : undefined;
        a.scadenza = d && !isNaN(d.getTime()) ? d : undefined; cambi.push('scadenza');
      }
      if ('orarioPromemoria' in req.body) { a.orarioPromemoria = orarioOk(orarioPromemoria); cambi.push('orario promemoria'); }
      if (cambi.length) {
        a.storico.push({ azione: 'modificata', data: new Date(), autoreId: new mongoose.Types.ObjectId(userId), autoreNome: nome, nota: `Modifiche: ${cambi.join(', ')}` } as any);
        await a.save();
      }
    } else {
      return res.status(400).json({ message: 'Fonte non valida' });
    }
    return res.json({ ok: true, modifiche: cambi });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore modifica', error: error.message });
  }
});

// ═══ PATCH /api/hub-consegne/paziente — collega paziente (anche a consegne vecchie) ════
router.patch('/paziente', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const me = req.user as any;
    if (!RUOLI_GESTIONE.includes(me.role)) return res.status(403).json({ message: 'Permessi insufficienti' });
    const { source, id, pazienteId } = req.body || {};
    if (!mongoose.isValidObjectId(String(id)) || !mongoose.isValidObjectId(String(pazienteId))) {
      return res.status(400).json({ message: 'ID non valido' });
    }
    const paziente = await Patient.findById(pazienteId).select('firstName lastName');
    if (!paziente) return res.status(404).json({ message: 'Paziente non trovato' });
    const label = `${paziente.lastName} ${paziente.firstName}`.trim();
    const userId = new mongoose.Types.ObjectId(me.userId || me.id);
    const nome = me.name || me.email || 'Utente';
    if (source === 'attivita') {
      const a = await Attivita.findById(id);
      if (!a) return res.status(404).json({ message: 'Attività non trovata' });
      a.praticaTipo = 'paziente';
      a.praticaId = paziente._id as any;
      a.praticaLabel = label;
      a.storico.push({ azione: 'paziente_collegato', data: new Date(), autoreId: userId, autoreNome: nome, nota: `Paziente collegato: ${label}` } as any);
      await a.save();
    } else if (source === 'consegna') {
      const c = await ConsegnaAmministrativa.findById(id);
      if (!c) return res.status(404).json({ message: 'Consegna non trovata' });
      c.paziente = paziente._id as any;
      c.pazienteLabel = label;
      c.storico.push({ azione: 'paziente_collegato', da: userId, daNome: nome, il: new Date(), nota: `Paziente collegato: ${label}` });
      await c.save();
    } else {
      return res.status(400).json({ message: 'Fonte non valida' });
    }
    return res.json({ ok: true, pazienteLabel: label });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore collegamento paziente', error: error.message });
  }
});

export default router;
