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

// Tabella A — conviventi full-time, 54h/sett (valori MENSILI 2026)
// D/DS includono l'indennità di funzione 207,69 € prevista dal CCNL.
export const PAGA_CONVIVENTE_2026: Record<LivelloCcnl, number> = {
  A: 908.10,
  AS: 958.55,
  B: 983.16,
  BS: 1053.39,
  C: 1123.63,
  CS: 1193.84,
  D: 1612.20,  // 1.404,51 + 207,69 indennità di funzione
  DS: 1682.42, // 1.474,73 + 207,69 indennità di funzione
};

// Tabella B — conviventi part-time 30h (valori MENSILI 2026)
export const PAGA_PARTTIME_2026: Partial<Record<LivelloCcnl, number>> = {
  B: 702.25,
  BS: 737.39,
  C: 814.60,
};

// Tabella C — non conviventi (valori ORARI 2026)
export const PAGA_ORARIA_2026: Record<LivelloCcnl, number> = {
  A: 6.51,
  AS: 6.76,
  B: 7.01,
  BS: 7.45,
  C: 7.86,
  CS: 8.30,
  D: 9.57,
  DS: 9.97,
};

// Tabella D — assistenza notturna (valori MENSILI 2026)
export const PAGA_NOTTURNA_2026: Partial<Record<LivelloCcnl, number>> = {
  BS: 1211.38, // autosufficienti
  CS: 1372.91, // non autosufficienti
  DS: 1695.99, // non autosufficienti
};

// Tabella E — presenza notturna, livello unico (mensile 2026)
export const PAGA_PRESENZA_NOTTURNA_2026 = 811.09;

// Tabella G — sostituzione giorni di riposo, non conviventi (valori ORARI 2026)
export const PAGA_SOSTITUZIONE_2026: Partial<Record<LivelloCcnl, number>> = {
  CS: 8.91,
  DS: 10.75,
};

// Indennità 2026
export const INDENNITA_PIU_AUTOSUFF_MENSILE = 119.66; // Tabella I - CS/DS più non autosuff.
export const INDENNITA_PIU_AUTOSUFF_ORARIA = 0.70;    // Tabella I oraria
export const INDENNITA_UNI11766_MENSILE = 30.27;      // Tabella L - B/BS/CS certificato UNI 11766

// Indennità babysitter BS (< 6 anni, Tabella H)
export const INDENNITA_BABYSITTER_MENSILE = 138.54;   // convivente full
export const INDENNITA_BABYSITTER_PARTTIME = 97.06;   // convivente part-time
export const INDENNITA_BABYSITTER_ORARIA = 0.84;      // non convivente oraria

export const VITTO_ALLOGGIO_GIORNO_2026 = 6.66;
export const GIORNI_VITTO_MESE = 26;                  // vitto in natura: 26 gg/mese (base TFR/13a)
export const SETTIMANE_MESI = 4.3334;                 // convenzione INPS (52,03/12): 40h→173,34 ore/mese
export const ORE_CONVIVENTE_FULL = 54;
export const ORE_PARTTIME = 30;
export const FERIE_GIORNI_ANNO = 26;

// Cassa.Colf (contributo assistenza contrattuale, per ora retribuita)
export const CASSA_COLF_DATORE_ORARIO = 0.04;
export const CASSA_COLF_LAVORATORE_ORARIO = 0.02;

// Contributi orari INPS 2026 — tempo INDETERMINATO (con quota CUAF)
const INPS_2026_INDETERMINATO = {
  fascia1: { totale: 1.70, quotaLavoratore: 0.43, limite: 9.61 },
  fascia2: { totale: 1.92, quotaLavoratore: 0.48, limite: 11.70 },
  fascia3: { totale: 2.34, quotaLavoratore: 0.59 },
  sopra24h: { totale: 1.24, quotaLavoratore: 0.31 },
};

// Contributi orari INPS 2026 — tempo DETERMINATO (+ addizionale 1,40%)
const INPS_2026_DETERMINATO = {
  fascia1: { totale: 1.82, quotaLavoratore: 0.43, limite: 9.61 },
  fascia2: { totale: 2.05, quotaLavoratore: 0.48, limite: 11.70 },
  fascia3: { totale: 2.50, quotaLavoratore: 0.59 },
  sopra24h: { totale: 1.32, quotaLavoratore: 0.31 },
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

function contribOrario(effettiva: number, oreSett: number, determinato: boolean) {
  const t = determinato ? INPS_2026_DETERMINATO : INPS_2026_INDETERMINATO;
  if (oreSett > 24) return t.sopra24h;
  if (effettiva <= t.fascia1.limite) return t.fascia1;
  if (effettiva <= t.fascia2.limite) return t.fascia2;
  return t.fascia3;
}

export function simulaCostoBadante(input: SimulazioneInput): SimulazioneCosto {
  const tipo = input.contrattoTipo;
  const livello = input.livello as LivelloCcnl;
  const cfg = CONTRATTI_SIM.find(c => c.value === tipo);
  if (!cfg) throw new Error('Tipo contratto non valido');
  if (cfg.livelli.length > 0 && (!livello || !cfg.livelli.includes(livello))) {
    throw new Error(`Livello non valido per ${cfg.label}`);
  }
  const determinato = !!input.tempoDeterminato;
  const orario = tipo === 'non_convivente' || tipo === 'sostituzione';
  const conviventeTipo = !orario;

  // ── Ore settimanali ──
  let oreSett: number;
  if (tipo === 'convivente') oreSett = ORE_CONVIVENTE_FULL;
  else if (tipo === 'convivente_part_time') oreSett = ORE_PARTTIME;
  else if (orario) oreSett = Math.max(1, Math.min(40, Number(input.oreSettimanali) || 0));
  else oreSett = ORE_CONVIVENTE_FULL; // notturne: full convivente
  const oreMensili = oreSett * SETTIMANE_MESI; // grezze: arrotondate solo in output

  // ── Paga base tabellare ──
  let pagaBase: number;
  if (tipo === 'convivente') pagaBase = PAGA_CONVIVENTE_2026[livello];
  else if (tipo === 'convivente_part_time') pagaBase = PAGA_PARTTIME_2026[livello] || 0;
  else if (tipo === 'assistenza_notturna') pagaBase = PAGA_NOTTURNA_2026[livello] || 0;
  else if (tipo === 'presenza_notturna') pagaBase = PAGA_PRESENZA_NOTTURNA_2026;
  else if (tipo === 'sostituzione') pagaBase = PAGA_SOSTITUZIONE_2026[livello] || 0;
  else pagaBase = PAGA_ORARIA_2026[livello];

  // ── Indennità applicabili ──
  let indennitaMensili = 0;
  let indennitaOraria = 0;
  if (input.indennitaPiuAutosuff && (livello === 'CS' || livello === 'DS') && tipo !== 'sostituzione') {
    if (orario) indennitaOraria += INDENNITA_PIU_AUTOSUFF_ORARIA;
    else indennitaMensili += INDENNITA_PIU_AUTOSUFF_MENSILE;
  }
  if (input.certificazioneUni && (livello === 'B' || livello === 'BS' || livello === 'CS')) {
    indennitaMensili += INDENNITA_UNI11766_MENSILE;
  }
  if (input.indennitaBabysitter && livello === 'BS' && tipo !== 'sostituzione') {
    if (orario) indennitaOraria += INDENNITA_BABYSITTER_ORARIA;
    else if (tipo === 'convivente_part_time') indennitaMensili += INDENNITA_BABYSITTER_PARTTIME;
    else indennitaMensili += INDENNITA_BABYSITTER_MENSILE;
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
  const vittoMensileNatura = conviventeTipo ? r2(VITTO_ALLOGGIO_GIORNO_2026 * GIORNI_VITTO_MESE) : 0;
  const vittoOrario = conviventeTipo ? (VITTO_ALLOGGIO_GIORNO_2026 * 6) / oreSett : 0;

  // ── Retribuzione oraria effettiva (come il gestionale: oraria + vitto + 13a su paga) ──
  const retribuzioneOrariaEffettiva = r2(retribuzioneOrariaTotale + vittoOrario + retribuzioneOrariaTotale / 12);

  // ── Contributi INPS ──
  const contrib = contribOrario(retribuzioneOrariaEffettiva, oreSett, determinato);
  const contribInpsLavoratoreMensili = r2(contrib.quotaLavoratore * oreMensili);
  const contribInpsDatoreOrario = r2(contrib.totale - contrib.quotaLavoratore);
  const contribInpsDatoreMensili = r2(contribInpsDatoreOrario * oreMensili);

  // ── Cassa.Colf ──
  const cassaColfLavoratoreMensili = r2(CASSA_COLF_LAVORATORE_ORARIO * oreMensili);
  const cassaColfDatoreMensili = r2(CASSA_COLF_DATORE_ORARIO * oreMensili);

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

  const ferieMensiliOre = r2(oreSett * FERIE_GIORNI_ANNO / 6 / 12 * 10) / 10; // ore/mese
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
    cassaColfLavoratoreOrario: CASSA_COLF_LAVORATORE_ORARIO,
    cassaColfLavoratoreMensili,
    retribuzioneNetta,
    contribInpsDatoreOrario,
    contribInpsDatoreMensili,
    cassaColfDatoreOrario: CASSA_COLF_DATORE_ORARIO,
    cassaColfDatoreMensili,
    tfr,
    tredicesima,
    nettoComplessivo,
    totaleCostoMensile,
    retribuzioneOrariaTotale: r2(retribuzioneOrariaTotale),
    retribuzioneOrariaEffettiva,
    ferieMensiliOre,
    vittoAlloggioGiorno: conviventeTipo ? VITTO_ALLOGGIO_GIORNO_2026 : 0,
    vittoAlloggioMensileNatura: vittoMensileNatura,
  };
}
