// @ts-nocheck
import express from 'express';
import { rateLimitByIP } from '../middleware/rateLimit';
import Tariffario from '../models/Tariffario';
import { CATEGORIE_LISTINO } from './landingPreventivo';
import { caricaParametri } from '../utils/costoBadante';

const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const LLM_MODEL = process.env.GROQ_LLM_MODEL || 'openai/gpt-oss-120b';

// Listino reale dal Tariffario (DB), identico a quello servito ai calcolatori.
// Cache 10 min: il listino cambia raramente e le chat sono frequenti.
let vociCache: { data: any[]; at: number } | null = null;
async function vociListino(): Promise<any[]> {
  if (vociCache && Date.now() - vociCache.at < 10 * 60 * 1000) return vociCache.data;
  const voci = await Tariffario.find({ attivo: true, prezzo: { $gt: 0 } })
    .sort({ categoria: 1, ordine: 1, nome: 1 })
    .select('categoria nome prezzo unitaMisura promoAttiva prezzoPromo')
    .lean();
  const data = voci.map((v: any) => ({
    id: String(v._id),
    descrizione: String(v.nome || '').slice(0, 120),
    prezzo: v.promoAttiva && Number(v.prezzoPromo) > 0 && Number(v.prezzoPromo) < v.prezzo ? Number(v.prezzoPromo) : v.prezzo,
    categoria: CATEGORIE_LISTINO[v.categoria]?.label || v.categoria,
  }));
  vociCache = { data, at: Date.now() };
  return data;
}

// Sintesi delle tariffe CCNL reali usate dal calcolatore badante, così
// Abbraccino cita numeri veri e non stime inventate. Cache 10 min.
let ccnlCache: { data: any; at: number } | null = null;
async function tariffeCcnl(): Promise<any> {
  if (ccnlCache && Date.now() - ccnlCache.at < 10 * 60 * 1000) return ccnlCache.data;
  const P = await caricaParametri();
  ccnlCache = {
    data: {
      nota: 'Paga lorda minima CCNL 2026; al lordo si aggiungono contributi INPS, Cassa.Colf, TFR e tredicesima (circa +35-40% sul lordo). Il calcolatore dà il costo esatto.',
      conviventeFullTime54hLordoMensile: P.pagaConvivente,
      conviventePartTime30hLordoMensile: P.pagaPartTime,
      nonConviventeOrarioLordo: P.pagaOraria,
      assistenzaNotturnaLordoMensile: P.pagaNotturna,
      presenzaNotturnaLordoMensile: P.pagaPresenzaNotturna,
      sostituzioneOrarioLordo: P.pagaSostituzione,
      gestioneCafMensileIndicativa: P.cafPerTipo,
    },
    at: Date.now(),
  };
  return ccnlCache.data;
}

const PROMPT_SITO = `Sei Abbraccino, l'assistente virtuale del sito di Abbraccio Cure Domiciliari. Aiuti i visitatori a capire servizi, costi e come prenotare.
SERVIZI DI ABBRACCIO: badanti e colf in convenzione in tutta Italia; a Roma e provincia anche accessi infermieristici, assistenza OSS, visite mediche specialistiche, prelievi, fisioterapia, esami strumentali (ecografie, holter ECG e pressorio, ECG) e telemedicina a domicilio.
COME FUNZIONA: il visitatore puo' calcolare il preventivo online gratis, chiamare il 06 01905242 o scrivere su WhatsApp 351 4175117. Per badanti/colf esiste il calcolatore costo CCNL online. Per lavorare con Abbraccio ci si registra come operatore.
LINK da proporre nel campo "link" (solo quando davvero utili, altrimenti null):
- https://app.abbracciocuredomiciliari.it/preventivo -> preventivo servizi online (label "Calcola il tuo preventivo")
- https://app.abbracciocuredomiciliari.it/badante -> calcolatore costo badante CCNL (label "Calcola il costo badante")
- https://app.abbracciocuredomiciliari.it/iscriviti-intermediazione -> registrarsi come operatore (label "Registrati come operatore Abbraccio")
- https://app.abbracciocuredomiciliari.it/richiesta-servizio -> richiedere un servizio (label "Richiedi un servizio")
- https://www.abbracciocuredomiciliari.it/dove-siamo.html -> dove siamo
Rispondi SEMPRE e SOLO con JSON valido (nessun testo fuori): {"risposta":"messaggio cordiale in italiano, max 90 parole, semplice e rassicurante, con prezzi indicativi se chiede costi e il servizio e' nel listino","link":"URL o null","labelLink":"testo bottone o null"}
Se chiede costi badante: spiega che dipende dal contratto e livello CCNL (lordo convivente da circa 908€/mese livello A fino a 1.682€ livello DS, piu' contributi; non convivente da 6,51 a 9,97 €/ora) e manda al calcolatore /badante per il costo esatto.
Se chiede costi servizi sanitari: cita il prezzo indicativo dal listino e manda al preventivo.
Se non sai o la richiesta e' complessa o urgente: consiglia di chiamare 06 01905242.
LISTINO SERVIZI DISPONIBILI: `;

const PROMPT_BADANTE = `Sei Abbraccino, il piccolo assistente di Abbraccio Cure Domiciliari che aiuta le famiglie italiane a capire quale contratto badante conviene, secondo il CCNL badanti/colf.
Rispondi SEMPRE e SOLO con un JSON valido (nessun testo fuori dal JSON):
{"risposta":"messaggio cordiale in italiano, max 90 parole, tono semplice e rassicurante, che spiega cosa hai impostato nel calcolatore e un consiglio utile","suggerimento":{"contrattoTipo":"convivente|convivente_part_time|non_convivente|sostituzione|assistenza_notturna|presenza_notturna","livello":"AS|A|B|BS|C|CS|D|DS","oreSettimanali":40}}
REGOLE CONTRATTO:
- convivente: assistenza continuativa con vitto e alloggio, tipicamente 40-54 ore/settimana. E' il caso piu' comune per anziani non autosufficienti.
- convivente_part_time: vitto e alloggio ma part-time (25-30h).
- non_convivente: senza alloggio, orario diurno, fino a 40h.
- sostituzione: sostituisce la badante titolare durante ferie/riposo (tipicamente weekend).
- assistenza_notturna: notte con compiti assistenziali.
- presenza_notturna: solo presenza/sveglia notturna.
REGOLE LIVELLO:
- AS: solo compagnia/vigilanza a persona autosufficiente.
- B/BS: assistenza a persona autosufficiente (BS con mansioni specifiche).
- C: assistenza a persona NON autosufficiente — e' il livello tipico della badante.
- CS/D/DS: livelli qualificati/super.
Se le informazioni sono insufficienti suggerisci comunque la combinazione piu' probabile (tipicamente convivente, livello C, 40 ore).
Se chiede QUANTO COSTA o cifre: cita i numeri da TARIFFE_REALI_CCNL_2026 nel contesto (paga lorda minima per livello/contratto + contributi ~35-40%), poi precisa che il calcolatore qui sotto dà il totale esatto.
Contesto attuale del calcolatore e tariffe reali: `;

const PROMPT_PREVENTIVO = `Sei Abbraccino, il piccolo assistente di Abbraccio Cure Domiciliari che aiuta le famiglie italiane a capire quali servizi (infermieristici, OSS, visite mediche, esami a domicilio) servono nel loro caso.
Rispondi SEMPRE e SOLO con un JSON valido (nessun testo fuori dal JSON):
{"risposta":"messaggio cordiale in italiano, max 90 parole, che spiega quali servizi hai aggiunto al preventivo e perche', con un consiglio","suggerimento":{"voci":[{"id":"ID_PRESTAZIONE","quantita":1}]}}
REGOLE:
- Scegli SOLO voci presenti nel listino fornito (usa gli id esatti).
- Se la persona descrive un problema (es. "mi serve una flebo", "cambio catetere", "controllo pressione", "visita medica") scegli le prestazioni pertinenti.
- Se menziona pacchetti o ripetizioni (es. "3 volte a settimana", "ciclo di 10") metti la quantita' corretta.
- Se non trovi nulla di adatto, rispondi senza "suggerimento" e consiglia di chiamare il numero dell'assistenza.
LISTINO PRESTAZIONI DISPONIBILI: `;

router.post('/chat', rateLimitByIP(20, 10 * 60 * 1000), async (req: any, res: any) => {
  try {
    if (!GROQ_API_KEY) return res.status(503).json({ message: 'Abbraccino non è configurato.' });
    const messaggio = String(req.body?.messaggio || '').trim().slice(0, 1000);
    const tipo = req.body?.tipo === 'preventivo' || req.body?.tipo === 'sito' ? req.body.tipo : 'badante';
    if (!messaggio) return res.status(400).json({ message: 'Scrivi una domanda.' });

    const contesto = req.body?.contesto ?? {};
    let voci = Array.isArray(contesto.voci)
      ? contesto.voci.filter((v: any) => v && (v.descrizione || v.nome)).slice(0, 200).map((v: any) => ({ id: v.id, descrizione: String(v.descrizione || v.nome || '').slice(0, 120), prezzo: v.prezzo, categoria: v.categoria }))
      : undefined;
    // Se il client non ha mandato il listino (o l'ha caricato male), usiamo
    // il Tariffario reale dal DB: le tariffe citate devono essere quelle vere.
    if ((tipo === 'sito' || tipo === 'preventivo') && (!voci || voci.length === 0)) {
      try { voci = await vociListino(); } catch { /* senza listino il prompt guida comunque al telefono */ }
    }
    let contestoStr: string;
    if (tipo === 'sito') {
      contestoStr = JSON.stringify({ voci, pagina: contesto.pagina });
    } else if (tipo === 'preventivo') {
      contestoStr = JSON.stringify(voci || []);
    } else {
      let tariffe: any;
      try { tariffe = await tariffeCcnl(); } catch { tariffe = undefined; }
      contestoStr = JSON.stringify({
        calcolatore: {
          contratto: contesto.contrattoTipo || contesto.contratto, livello: contesto.livello,
          oreSettimanali: contesto.oreSettimanali, regione: contesto.regione,
        },
        TARIFFE_REALI_CCNL_2026: tariffe,
      });
    }

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 45000);
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: LLM_MODEL,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: (tipo === 'sito' ? PROMPT_SITO : tipo === 'preventivo' ? PROMPT_PREVENTIVO : PROMPT_BADANTE) + contestoStr },
          { role: 'user', content: messaggio },
        ],
      }),
    }).finally(() => clearTimeout(t));

    if (!groqRes.ok) {
      const txt = await groqRes.text().catch(() => '');
      console.error('[Abbraccino] Errore Groq:', groqRes.status, txt.slice(0, 300));
      return res.status(502).json({ message: 'Abbraccino è impegnato, riprova tra poco.' });
    }
    const data = await groqRes.json();
    let parsed: any = {};
    try { parsed = JSON.parse(data?.choices?.[0]?.message?.content || '{}'); } catch { parsed = { risposta: data?.choices?.[0]?.message?.content || '' }; }
    return res.json({
      risposta: String(parsed.risposta || 'Ho qualche difficoltà a rispondere ora: puoi usare il calcolatore qui sotto o chiamarci al 06 01905242.').slice(0, 1200),
      suggerimento: parsed.suggerimento && typeof parsed.suggerimento === 'object' ? parsed.suggerimento : undefined,
      link: typeof parsed.link === 'string' && parsed.link.startsWith('http') ? parsed.link : undefined,
      labelLink: typeof parsed.labelLink === 'string' ? parsed.labelLink.slice(0, 60) : undefined,
    });
  } catch (e: any) {
    console.error('[Abbraccino] Errore:', e?.message);
    return res.status(502).json({ message: 'Abbraccino è impegnato, riprova tra poco.' });
  }
});

export default router;
