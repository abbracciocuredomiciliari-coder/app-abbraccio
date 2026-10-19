// ─── Calcolo costo badante CCNL lavoro domestico ──────────────────────────────
// Replica il motore del calcolatore esterno (es. doemploy.app): dato contratto,
// livello e ore, produce il costo mensile completo a carico della famiglia
// (retribuzione lorda + vitto/alloggio + contributi INPS + TFR + 13esima + ferie).
//
// Fonti ufficiali 2025:
// - Minimi retributivi CCNL lavoro domestico (accordo 29/01/2025, decorrenza 01/01/2025)
// - Tabella contributi INPS lavoratori domestici 2025 (circolare INPS)
// - Indennità vitto e alloggio 2025: €6,60/giorno (pranzo 2,31 + cena 2,31 + alloggio 1,98)

export type ContrattoTipo = 'orario_non_convivente' | 'convivente';
export type LivelloCcnl = 'A' | 'AS' | 'B' | 'BS' | 'C' | 'CS' | 'D' | 'DS';

// Paga minima CCNL 2025 — convivente (valori MENSILI, 54h/sett)
// D/DS includono l'indennità di funzione €197,95 prevista dal CCNL.
export const PAGA_CCNL_CONVIVENTE: Record<LivelloCcnl, number> = {
  A: 736.25,
  AS: 870.13,
  B: 937.06,
  BS: 1003.99,
  C: 1070.94,
  CS: 1137.86,
  D: 1536.60,  // 1.338,65 + 197,95 indennità di funzione
  DS: 1603.53, // 1.405,58 + 197,95 indennità di funzione
};

// Paga minima CCNL 2025 — non convivente (valori ORARI)
export const PAGA_CCNL_ORARIA: Record<LivelloCcnl, number> = {
  A: 5.35,
  AS: 6.30,
  B: 6.68,
  BS: 7.10,
  C: 7.49,
  CS: 7.91,
  D: 9.12,
  DS: 9.50,
};

export const VITTO_ALLOGGIO_GIORNO_2025 = 6.60; // €/giorno, solo conviventi
export const ORE_CONVIVENTE_STANDARD = 54;      // orario pieno convivente CCNL
export const SETTIMANE_MESI = 52 / 12;          // ~4,3333 settimane per mese
export const GIORNI_VITTO_MESE = 26;

// Contributi orari INPS 2025 — tempo INDETERMINATO (con quota CUAF)
// { totale: €/h versati, quotaLavoratore: quota trattenuta in busta paga }
const CONTRIB_INPS_INDETERMINATO = {
  fascia1: { totale: 1.68, quotaLavoratore: 0.42 }, // retrib. effettiva <= 9,48
  fascia2: { totale: 1.89, quotaLavoratore: 0.48 }, // > 9,48 e <= 11,54
  fascia3: { totale: 2.30, quotaLavoratore: 0.58 }, // > 11,54
  sopra24h: { totale: 1.22, quotaLavoratore: 0.31 }, // orario > 24h/sett
};

// Contributi orari INPS 2025 — tempo DETERMINATO (+ addizionale 1,40%)
const CONTRIB_INPS_DETERMINATO = {
  fascia1: { totale: 1.79, quotaLavoratore: 0.42 },
  fascia2: { totale: 2.03, quotaLavoratore: 0.48 },
  fascia3: { totale: 2.47, quotaLavoratore: 0.58 },
  sopra24h: { totale: 1.31, quotaLavoratore: 0.31 },
};

function r2(n: number) { return Math.round(n * 100) / 100; }

export interface SimulazioneInput {
  contrattoTipo: ContrattoTipo;
  livello: LivelloCcnl;
  oreSettimanali?: number;       // ignorato per convivente (usa 54)
  tempoDeterminato?: boolean;    // default false
  pagaPersonalizzata?: number;   // €/mese (convivente) o €/ora (non convivente)
  vittoAlloggio?: boolean;       // convivente: default true
}

export interface SimulazioneCosto {
  pagaOraria?: number;
  retribuzioneLordaMensile: number;
  vittoAlloggioMensile: number;
  oreMensili: number;
  retribuzioneOrariaEffettiva: number; // base contributi (incl. vitto + 13esima)
  contributoOrarioDatore: number;
  contributoOrarioLavoratore: number;
  contributiDatoreMensili: number;
  contributiLavoratoreMensili: number;
  rateoTredicesima: number;
  rateoFerie: number;
  rateoTfr: number;
  totaleCostoMensile: number;  // costo completo famiglia
  nettoStimatoLavoratore: number; // lordo - quota contributi lavoratore
  dettaglio: { voce: string; importo: number }[];
}

export function calcolaContributoOrario(retribuzioneEffettiva: number, oreSettimanali: number, determinato: boolean) {
  const t = determinato ? CONTRIB_INPS_DETERMINATO : CONTRIB_INPS_INDETERMINATO;
  if (oreSettimanali > 24) return t.sopra24h;
  if (retribuzioneEffettiva <= 9.48) return t.fascia1;
  if (retribuzioneEffettiva <= 11.54) return t.fascia2;
  return t.fascia3;
}

export function simulaCostoBadante(input: SimulazioneInput): SimulazioneCosto {
  const convivente = input.contrattoTipo === 'convivente';
  const determinato = !!input.tempoDeterminato;
  const ore = convivente ? ORE_CONVIVENTE_STANDARD : Math.max(0, Number(input.oreSettimanali) || 0);
  const oreMensili = r2(ore * SETTIMANE_MESI);

  // ── Retribuzione lorda mensile ──
  let retribuzioneLordaMensile: number;
  let pagaOraria: number | undefined;
  if (convivente) {
    retribuzioneLordaMensile = input.pagaPersonalizzata && input.pagaPersonalizzata > 0
      ? input.pagaPersonalizzata
      : PAGA_CCNL_CONVIVENTE[input.livello];
    pagaOraria = r2(retribuzioneLordaMensile / (ORE_CONVIVENTE_STANDARD * SETTIMANE_MESI));
  } else {
    pagaOraria = input.pagaPersonalizzata && input.pagaPersonalizzata > 0
      ? input.pagaPersonalizzata
      : PAGA_CCNL_ORARIA[input.livello];
    retribuzioneLordaMensile = r2(oreMensili * pagaOraria);
  }

  // ── Vitto e alloggio (solo convivente) ──
  const vittoAlloggioMensile = convivente && input.vittoAlloggio !== false
    ? r2(VITTO_ALLOGGIO_GIORNO_2025 * GIORNI_VITTO_MESE)
    : 0;
  const vittoAlloggioOrario = convivente && input.vittoAlloggio !== false && ore > 0
    ? (VITTO_ALLOGGIO_GIORNO_2025 * 6) / ore // 6 giorni lavorativi/sett, ripartito sulle ore
    : 0;

  // ── Retribuzione oraria effettiva per contributi (paga + vitto ripartito + quota 13esima) ──
  const quotaTredicesimaOraria = ((pagaOraria || 0) + vittoAlloggioOrario) / 12;
  const retribuzioneOrariaEffettiva = r2((pagaOraria || 0) + vittoAlloggioOrario + quotaTredicesimaOraria);

  // ── Contributi INPS mensili ──
  const contrib = calcolaContributoOrario(retribuzioneOrariaEffettiva, ore, determinato);
  const contributiDatoreMensili = r2(contrib.totale * oreMensili);
  const contributiLavoratoreMensili = r2(contrib.quotaLavoratore * oreMensili);

  // ── Accantonamenti mensili ──
  const baseAccantonamento = retribuzioneLordaMensile + vittoAlloggioMensile;
  const rateoTredicesima = r2(baseAccantonamento / 12);
  const rateoFerie = r2(baseAccantonamento / 12);            // 26 gg/anno = 1 mensilità
  const rateoTfr = r2((baseAccantonamento * 13) / 13.5 / 12); // retrib. annua (13 mensilità) / 13,5 / 12

  const totaleCostoMensile = r2(
    retribuzioneLordaMensile + vittoAlloggioMensile + contributiDatoreMensili
    + rateoTredicesima + rateoFerie + rateoTfr
  );
  const nettoStimatoLavoratore = r2(retribuzioneLordaMensile + vittoAlloggioMensile - contributiLavoratoreMensili);

  const dettaglio = [
    { voce: 'Retribuzione lorda mensile', importo: retribuzioneLordaMensile },
    ...(vittoAlloggioMensile > 0 ? [{ voce: 'Vitto e alloggio (€6,60 × 26 gg)', importo: vittoAlloggioMensile }] : []),
    { voce: 'Contributi INPS a carico datore', importo: contributiDatoreMensili },
    { voce: 'Accantonamento tredicesima (1/12)', importo: rateoTredicesima },
    { voce: 'Accantonamento ferie (1/12)', importo: rateoFerie },
    { voce: 'Accantonamento TFR', importo: rateoTfr },
  ];

  return {
    pagaOraria,
    retribuzioneLordaMensile: r2(retribuzioneLordaMensile),
    vittoAlloggioMensile,
    oreMensili,
    retribuzioneOrariaEffettiva,
    contributoOrarioDatore: contrib.totale,
    contributoOrarioLavoratore: contrib.quotaLavoratore,
    contributiDatoreMensili,
    contributiLavoratoreMensili,
    rateoTredicesima,
    rateoFerie,
    rateoTfr,
    totaleCostoMensile,
    nettoStimatoLavoratore,
    dettaglio,
  };
}
