import TariffaCcnl from '../models/TariffaCcnl';

// ─── Calcolo costo badante CCNL lavoro domestico 2026 ─────────────────────────
// Replica il calcolatore esterno (doemploy.app/calcolo-costo-mensile): dato tipo
// di contratto, livello CCNL e ore, produce il costo mensile completo a carico
// del datore (lorda + contributi INPS + Cassa.Colf + TFR + 13esima) e il netto
// del lavoratore. Stessa struttura risultato del gestionale di riferimento.
//
// Fonti ufficiali 2026 (verificate al centesimo sul caso CS convivente full-time:
// lorda 1.193,84 + contrib. datore 217,62 + Cassa.Colf 9,36 + TFR 109,70 +
// 13esima 113,92 = 1.644,44 €):
// - Minimi retributivi CCNL lavoro domestico, decorrenza 01/01/2026
//   (accordo 11/02/2026, Ministero del Lavoro)
// - Contributi INPS lavoratori domestici 2026 (circolare INPS n. 9/2026)
// - Cassa.Colf: 0,06 €/h (0,04 datore + 0,02 lavoratore)
// - Vitto e alloggio in natura 2026: 6,66 €/giorno (2,33+2,33+2,00)

export type ContrattoSim =
  | 'non_convivente'
  | 'convivente'
  | 'convivente_part_time'
  | 'assistenza_notturna'
  | 'presenza_notturna'
  | 'sostituzione';

export type LivelloCcnl = 'A' | 'AS' | 'B' | 'BS' | 'C' | 'CS' | 'D' | 'DS';

export const CONTRATTI_SIM: { value: ContrattoSim; label: string; livelli: LivelloCcnl[] }[] = [
  { value: 'non_convivente', label: 'Non convivente', livelli: ['A', 'AS', 'B', 'BS', 'C', 'CS', 'D', 'DS'] },
  { value: 'convivente', label: 'Convivente full-time', livelli: ['A', 'AS', 'B', 'BS', 'C', 'CS', 'D', 'DS'] },
  { value: 'convivente_part_time', label: 'Convivente part-time (30 ore)', livelli: ['B', 'BS', 'C'] },
  { value: 'assistenza_notturna', label: 'Convivente - assistenza notturna', livelli: ['BS', 'CS', 'DS'] },
  { value: 'presenza_notturna', label: 'Convivente - presenza notturna', livelli: [] }, // livello unico
  { value: 'sostituzione', label: 'Sostituzione (giorni di riposo)', livelli: ['CS', 'DS'] },
];

// ─── Parametri CCNL/INPS (aggiornabili annualmente da UI → salvati su DB) ─────
// Struttura dei parametri del simulatore. I valori di default sono i minimi 2026
// (accordo 11/02/2026); l'editor "Parametri CCNL" nella pagina Intermediazioni
// permette di aggiornarli senza redeploy (modello TariffaCcnl).

export interface FasciaInps { totale: number; quotaLavoratore: number; limite?: number; }
export interface TabelleInps { fascia1: FasciaInps; fascia2: FasciaInps; fascia3: FasciaInps; sopra24h: FasciaInps; }

export interface ParametriCcnl {
  // Minimi retributivi per tipo di contratto (€/mese o €/ora)
  pagaConvivente: Record<LivelloCcnl, number>;                 // Tabella A — 54h/sett
  pagaPartTime: Partial<Record<LivelloCcnl, number>>;          // Tabella B — 30h
  pagaOraria: Record<LivelloCcnl, number>;                     // Tabella C — non conviventi
  pagaNotturna: Partial<Record<LivelloCcnl, number>>;          // Tabella D — assistenza notturna
  pagaPresenzaNotturna: number;                                // Tabella E — livello unico
  pagaSostituzione: Partial<Record<LivelloCcnl, number>>;      // Tabella G — riposo settim.
  // Indennità
  indennitaPiuAutosuffMensile: number;  // Tabella I — CS/DS più non autosuff.
  indennitaPiuAutosuffOraria: number;   // Tabella I oraria
  indennitaUni11766Mensile: number;     // Tabella L — B/BS/CS certificato UNI 11766
  indennitaBabysitterMensile: number;   // Tabella H — convivente full
  indennitaBabysitterPartTime: number;  // Tabella H — part-time
  indennitaBabysitterOraria: number;    // Tabella H — non convivente oraria
  // Parametri generali
  vittoAlloggioGiorno: number;   // vitto+alloggio in natura €/giorno
  giorniVittoMese: number;       // giorni vitto/mese (base TFR/13a)
  settimaneMesi: number;         // convenzione INPS 52,03/12 → 40h = 173,34 ore/mese
  oreConviventeFull: number;     // ore sett. convivente full-time
  orePartTime: number;           // ore sett. part-time
  ferieGiorniAnno: number;       // giorni ferie/anno
  // Cassa.Colf €/ora retribuita
  cassaColfDatoreOrario: number;
  cassaColfLavoratoreOrario: number;
  // Contributi INPS orari per fascia (indeterminato / determinato +1,40%)
  inpsIndeterminato: TabelleInps;
  inpsDeterminato: TabelleInps;
  // Quota CAF sanitario di default stampata sul preventivo
  cafMensileDefault: number;
}

export const PARAMETRI_CCN_2026: ParametriCcnl = {
  // Tabella A — conviventi full-time (mensili). D/DS includono indennità di funzione 207,69 €.
  pagaConvivente: { A: 908.10, AS: 958.55, B: 983.16, BS: 1053.39, C: 1123.63, CS: 1193.84, D: 1612.20, DS: 1682.42 },
  // Tabella B — conviventi part-time 30h (mensili)
  pagaPartTime: { B: 702.25, BS: 737.39, C: 814.60 },
  // Tabella C — non conviventi (orari)
  pagaOraria: { A: 6.51, AS: 6.76, B: 7.01, BS: 7.45, C: 7.86, CS: 8.30, D: 9.57, DS: 9.97 },
  // Tabella D — assistenza notturna (mensili)
  pagaNotturna: { BS: 1211.38, CS: 1372.91, DS: 1695.99 },
  pagaPresenzaNotturna: 811.09,
  pagaSostituzione: { CS: 8.91, DS: 10.75 },
  indennitaPiuAutosuffMensile: 119.66,
  indennitaPiuAutosuffOraria: 0.70,
  indennitaUni11766Mensile: 30.27,
  indennitaBabysitterMensile: 138.54,
  indennitaBabysitterPartTime: 97.06,
  indennitaBabysitterOraria: 0.84,
  vittoAlloggioGiorno: 6.66,
  giorniVittoMese: 26,
  settimaneMesi: 4.3334,
  oreConviventeFull: 54,
  orePartTime: 30,
  ferieGiorniAnno: 26,
  cassaColfDatoreOrario: 0.04,
  cassaColfLavoratoreOrario: 0.02,
  inpsIndeterminato: {
    fascia1: { totale: 1.70, quotaLavoratore: 0.43, limite: 9.61 },
    fascia2: { totale: 1.92, quotaLavoratore: 0.48, limite: 11.70 },
    fascia3: { totale: 2.34, quotaLavoratore: 0.59 },
    sopra24h: { totale: 1.24, quotaLavoratore: 0.31 },
  },
  inpsDeterminato: {
    fascia1: { totale: 1.82, quotaLavoratore: 0.43, limite: 9.61 },
    fascia2: { totale: 2.05, quotaLavoratore: 0.48, limite: 11.70 },
    fascia3: { totale: 2.50, quotaLavoratore: 0.59 },
    sopra24h: { totale: 1.32, quotaLavoratore: 0.31 },
  },
  cafMensileDefault: 150,
};

function r2(n: number) { return Math.round(n * 100) / 100; }

export interface SimulazioneInput {
  contrattoTipo: ContrattoSim;
  livello?: LivelloCcnl;
  oreSettimanali?: number;
  tempoDeterminato?: boolean;
  pagaPersonalizzata?: number;   // €/mese o €/ora a seconda del contratto
  indennitaPiuAutosuff?: boolean; // più persone non autosufficienti (CS/DS)
  certificazioneUni?: boolean;    // UNI 11766 (B/BS/CS)
  indennitaBabysitter?: boolean;  // BS babysitter < 6 anni
}

export interface SimulazioneCosto {
  contrattoLabel: string;
  livelloLabel: string;
  oreSettimanali: number;
  oreMensili: number;
  pagaBaseCcnl: number;          // minimo tabellare usato (€/mese o €/h)
  pagaUnitaria: 'mese' | 'ora';
  retribuzioneLordaMensile: number;
  indennitaMensili: number;
  // trattenute lavoratore
  contribInpsLavoratoreOrario: number;
  contribInpsLavoratoreMensili: number;
  cassaColfLavoratoreOrario: number;
  cassaColfLavoratoreMensili: number;
  retribuzioneNetta: number;
  // a carico datore
  contribInpsDatoreOrario: number;
  contribInpsDatoreMensili: number;
  cassaColfDatoreOrario: number;
  cassaColfDatoreMensili: number;
  tfr: number;
  tredicesima: number;
  nettoComplessivo: number;
  totaleCostoMensile: number;
  // dettagli utili
  retribuzioneOrariaTotale: number;
  retribuzioneOrariaEffettiva: number;
  ferieMensiliOre: number;
  vittoAlloggioGiorno: number;
  vittoAlloggioMensileNatura: number; // in natura: solo base TFR/13a, non nel totale
}

function contribOrario(effettiva: number, oreSett: number, determinato: boolean, P: ParametriCcnl) {
  const t = determinato ? P.inpsDeterminato : P.inpsIndeterminato;
  if (oreSett > 24) return t.sopra24h;
  if (effettiva <= (t.fascia1.limite ?? Infinity)) return t.fascia1;
  if (effettiva <= (t.fascia2.limite ?? Infinity)) return t.fascia2;
  return t.fascia3;
}

export function simulaCostoBadante(input: SimulazioneInput, params: ParametriCcnl = PARAMETRI_CCN_2026): SimulazioneCosto {
  const P = params;
  const tipo = input.contrattoTipo;
  const livello = input.livello as LivelloCcnl;
  const cfg = CONTRATTI_SIM.find(c => c.value === tipo);
  if (!cfg) throw new Error('Tipo contratto non valido');
  if (cfg.livelli.length > 0 && (!livello || !cfg.livelli.includes(livello))) {
    throw new Error(`Livello non valido per ${cfg.label}`);
  }
  // Sostituzione: addizionale tempo determinato NON prevista (INPS circ. 9/2026)
  const determinato = !!input.tempoDeterminato && tipo !== 'sostituzione';
  const orario = tipo === 'non_convivente' || tipo === 'sostituzione';
  const conviventeTipo = !orario;

  // ── Ore settimanali ──
  let oreSett: number;
  if (tipo === 'convivente') oreSett = P.oreConviventeFull;
  else if (tipo === 'convivente_part_time') oreSett = P.orePartTime;
  else if (orario) oreSett = Math.max(1, Math.min(40, Number(input.oreSettimanali) || 0));
  else oreSett = P.oreConviventeFull; // notturne: full convivente
  const oreMensili = oreSett * P.settimaneMesi; // grezze: arrotondate solo in output

  // ── Paga base tabellare ──
  let pagaBase: number;
  if (tipo === 'convivente') pagaBase = P.pagaConvivente[livello];
  else if (tipo === 'convivente_part_time') pagaBase = P.pagaPartTime[livello] || 0;
  else if (tipo === 'assistenza_notturna') pagaBase = P.pagaNotturna[livello] || 0;
  else if (tipo === 'presenza_notturna') pagaBase = P.pagaPresenzaNotturna;
  else if (tipo === 'sostituzione') pagaBase = P.pagaSostituzione[livello] || 0;
  else pagaBase = P.pagaOraria[livello];

  // ── Indennità applicabili ──
  let indennitaMensili = 0;
  let indennitaOraria = 0;
  if (input.indennitaPiuAutosuff && (livello === 'CS' || livello === 'DS') && tipo !== 'sostituzione') {
    if (orario) indennitaOraria += P.indennitaPiuAutosuffOraria;
    else indennitaMensili += P.indennitaPiuAutosuffMensile;
  }
  if (input.certificazioneUni && (livello === 'B' || livello === 'BS' || livello === 'CS')) {
    indennitaMensili += P.indennitaUni11766Mensile;
  }
  if (input.indennitaBabysitter && livello === 'BS' && tipo !== 'sostituzione') {
    if (orario) indennitaOraria += P.indennitaBabysitterOraria;
    else if (tipo === 'convivente_part_time') indennitaMensili += P.indennitaBabysitterPartTime;
    else indennitaMensili += P.indennitaBabysitterMensile;
  }

  // ── Retribuzione lorda mensile ──
  let retribuzioneLorda: number;
  if (orario) {
    const pagaOraria = input.pagaPersonalizzata && input.pagaPersonalizzata > 0
      ? input.pagaPersonalizzata
      : pagaBase;
    retribuzioneLorda = r2(oreMensili * (pagaOraria + indennitaOraria));
  } else {
    retribuzioneLorda = input.pagaPersonalizzata && input.pagaPersonalizzata > 0
      ? input.pagaPersonalizzata + indennitaMensili
      : pagaBase + indennitaMensili;
    retribuzioneLorda = r2(retribuzioneLorda);
  }
  const retribuzioneOrariaTotale = retribuzioneLorda / oreMensili; // grezza per i calcoli

  // ── Vitto/alloggio in natura (conviventi): non costo in €, solo base TFR/13a ──
  const vittoMensileNatura = conviventeTipo ? r2(P.vittoAlloggioGiorno * P.giorniVittoMese) : 0;
  const vittoOrario = conviventeTipo ? (P.vittoAlloggioGiorno * 6) / oreSett : 0;

  // ── Retribuzione oraria effettiva (come il gestionale: oraria + vitto + 13a su paga) ──
  const retribuzioneOrariaEffettiva = r2(retribuzioneOrariaTotale + vittoOrario + retribuzioneOrariaTotale / 12);

  // ── Contributi INPS ──
  const contrib = contribOrario(retribuzioneOrariaEffettiva, oreSett, determinato, P);
  const contribInpsLavoratoreMensili = r2(contrib.quotaLavoratore * oreMensili);
  const contribInpsDatoreOrario = r2(contrib.totale - contrib.quotaLavoratore);
  const contribInpsDatoreMensili = r2(contribInpsDatoreOrario * oreMensili);

  // ── Cassa.Colf ──
  const cassaColfLavoratoreMensili = r2(P.cassaColfLavoratoreOrario * oreMensili);
  const cassaColfDatoreMensili = r2(P.cassaColfDatoreOrario * oreMensili);

  // ── Netto lavoratore ──
  const retribuzioneNetta = r2(retribuzioneLorda - contribInpsLavoratoreMensili - cassaColfLavoratoreMensili);

  // ── Accantonamenti: base = lorda + vitto in natura ──
  const baseAccantonamento = retribuzioneLorda + vittoMensileNatura;
  const tredicesima = r2(baseAccantonamento / 12);
  const tfr = r2((baseAccantonamento * 13) / 13.5 / 12);

  const nettoComplessivo = r2(retribuzioneNetta + tfr + tredicesima);
  const totaleCostoMensile = r2(
    retribuzioneLorda + contribInpsDatoreMensili + cassaColfDatoreMensili + tfr + tredicesima
  );

  const ferieMensiliOre = r2(oreSett * P.ferieGiorniAnno / 6 / 12 * 10) / 10; // ore/mese
  const livelloLabel = tipo === 'presenza_notturna' ? 'Livello unico' : `Livello ${livello}`;

  return {
    contrattoLabel: cfg.label,
    livelloLabel,
    oreSettimanali: oreSett,
    oreMensili: r2(oreMensili),
    pagaBaseCcnl: pagaBase,
    pagaUnitaria: orario ? 'ora' : 'mese',
    retribuzioneLordaMensile: retribuzioneLorda,
    indennitaMensili: r2(orario ? indennitaOraria * oreMensili : indennitaMensili),
    contribInpsLavoratoreOrario: contrib.quotaLavoratore,
    contribInpsLavoratoreMensili,
    cassaColfLavoratoreOrario: P.cassaColfLavoratoreOrario,
    cassaColfLavoratoreMensili,
    retribuzioneNetta,
    contribInpsDatoreOrario,
    contribInpsDatoreMensili,
    cassaColfDatoreOrario: P.cassaColfDatoreOrario,
    cassaColfDatoreMensili,
    tfr,
    tredicesima,
    nettoComplessivo,
    totaleCostoMensile,
    retribuzioneOrariaTotale: r2(retribuzioneOrariaTotale),
    retribuzioneOrariaEffettiva,
    ferieMensiliOre,
    vittoAlloggioGiorno: conviventeTipo ? P.vittoAlloggioGiorno : 0,
    vittoAlloggioMensileNatura: vittoMensileNatura,
  };
}

// ─── Tariffe CCNL/INPS: merge delle override salvate su DB sopra i default ────
// Accetta solo chiavi presenti nei default e solo valori numerici: chiavi
// sconosciute o non numeriche vengono ignorate (i default restano). Così il
// motore può aggiungere parametri nuovi senza rompere i record esistenti.
export function mergeParametri(override: any): ParametriCcnl {
  const merge = (def: any, ovr: any): any => {
    if (typeof def === 'number') {
      const n = Number(ovr);
      return Number.isFinite(n) ? n : def;
    }
    if (typeof def !== 'object' || def === null) return def;
    const out: any = { ...def };
    if (ovr && typeof ovr === 'object') {
      for (const k of Object.keys(def)) {
        if (k in ovr) out[k] = merge(def[k], ovr[k]);
      }
    }
    return out;
  };
  if (!override || typeof override !== 'object') return PARAMETRI_CCN_2026;
  return merge(PARAMETRI_CCN_2026, override);
}

// Parametri attivi = default 2026 + eventuali override salvati su DB
export async function caricaParametri(): Promise<ParametriCcnl> {
  const doc = await TariffaCcnl.findOne({ key: 'ccnl' }).lean();
  return mergeParametri(doc?.parametri);
}
