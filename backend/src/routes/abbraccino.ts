// @ts-nocheck
import express from 'express';
import { rateLimitByIP } from '../middleware/rateLimit';
import { authenticateToken } from '../middleware/auth';
import Tariffario from '../models/Tariffario';
import Patient from '../models/Patient';
import Staff from '../models/Staff';
import { CATEGORIE_LISTINO } from './landingPreventivo';
import { caricaParametri, simulaCostoBadante, quotaCafDefault } from '../utils/costoBadante';

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
      // Forma compatta ("Categoria: voce €X; voce €X") — il JSON di oggetti
      // costa ~5K token a richiesta e fa saltare il rate-limit Groq.
      const perCat: Record<string, string[]> = {};
      (voci || []).forEach((v: any) => { (perCat[v.categoria || 'Servizi'] = perCat[v.categoria || 'Servizi'] || []).push(`${v.descrizione} €${v.prezzo}`); });
      const listinoTxt = Object.entries(perCat).map(([c, vs]) => `${c}: ${vs.join('; ')}`).join('\n');
      contestoStr = `\nPAGINA: ${String(contesto.pagina || '').slice(0, 120)}\n${listinoTxt}`;
    } else if (tipo === 'preventivo') {
      contestoStr = JSON.stringify((voci || []).map((v: any) => ({ id: v.id, descrizione: v.descrizione, prezzo: v.prezzo })));
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

    const systemMsg = (tipo === 'sito' ? PROMPT_SITO : tipo === 'preventivo' ? PROMPT_PREVENTIVO : PROMPT_BADANTE) + contestoStr;
    const chiamaGroq = async () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 45000);
      try {
        return await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          signal: ctrl.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
          body: JSON.stringify({
            model: LLM_MODEL,
            temperature: 0.4,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemMsg },
              { role: 'user', content: messaggio },
            ],
          }),
        });
      } finally { clearTimeout(t); }
    };
    let groqRes = await chiamaGroq();
    // Rate-limit Groq (free tier 8K token/min): riprova una volta dopo
    // l'attesa indicata nell'errore invece di fallire subito.
    if (groqRes.status === 429) {
      const txt = await groqRes.text().catch(() => '');
      const waitSec = Math.min(Math.max(parseFloat(txt.match(/try again in ([\d.]+)s/i)?.[1] || '3') || 3, 2), 25);
      await new Promise(r => setTimeout(r, waitSec * 1000));
      groqRes = await chiamaGroq();
      if (!groqRes.ok) console.error('[Abbraccino] Errore Groq:', groqRes.status, txt.slice(0, 300));
    }

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

// ═══════════════════════════════════════════════════════════════════════════
// ABBRACCINO INTERNO — assistente del gestionale (solo utenti autenticati).
// Guida l'operatore tra le schermate e, se cita una persona, apre i link
// diretti al suo dossier (ricerca globale). Le "azioni" sono i bottoni che il
// widget mostra sotto la risposta: il frontend fa navigate(url).
// ═══════════════════════════════════════════════════════════════════════════

// Catalogo delle schermate del gestionale con parole chiave per il match.
// aree: privato = Gestione Privata, consulenza = Intermediazioni, * = entrambe.
const SEZIONI: { url: string; label: string; desc: string; keys: string[]; aree: string[] }[] = [
  { url: '/ricerca', label: 'Ricerca globale', desc: 'cerca pazienti, operatori, preventivi, email, consegne ovunque', keys: ['cerca', 'ricerca', 'trova', 'cerco'], aree: ['*'] },
  { url: '/patients', label: 'Pazienti', desc: 'anagrafiche, documenti, contratti, consenso GDPR, preventivi, storico', keys: ['pazient', 'anagrafic', 'assistit', 'scheda'], aree: ['*'] },
  { url: '/badanti-intermediazione', label: 'Intermediazioni', desc: 'richieste badanti/colf, candidati, colloqui, preventivi consulenza', keys: ['intermediazion', 'badant', 'colf', 'candidat', 'consulenza'], aree: ['consulenza'] },
  { url: '/staff', label: 'Personale', desc: 'operatori, documenti, contratti, disponibilità', keys: ['personale', 'operator', 'staff', 'infermier', 'oss'], aree: ['*'] },
  { url: '/assegnazione-pai', label: 'Assegnazione su mappa', desc: 'assegna operatori ai pazienti dalla mappa', keys: ['assegnazion', 'mappa', 'pai', 'piano'], aree: ['*'] },
  { url: '/gestione-fatturazione', label: 'Fatturazione', desc: 'crea preventivi e fatture, invia per firma', keys: ['fattur', 'preventiv', 'document'], aree: ['*'] },
  { url: '/archivio-preventivi', label: 'Archivio Preventivi', desc: 'tutti i preventivi emessi', keys: ['archivio preventiv', 'preventivi emessi'], aree: ['*'] },
  { url: '/archivio-fatture', label: 'Archivio Fatture', desc: 'tutte le fatture emesse', keys: ['archivio fattur', 'fatture emesse'], aree: ['*'] },
  { url: '/archivi-intermediazione', label: 'Archivi intermediazione', desc: 'contratti pazienti e cronologia invii WhatsApp/email', keys: ['archivi intermediazion', 'cronologia', 'whatsapp'], aree: ['consulenza'] },
  { url: '/archivio-email', label: 'Email gestione', desc: 'email inviate e ricevute', keys: ['email', 'posta', 'mail'], aree: ['*'] },
  { url: '/consegne', label: 'Consegne', desc: 'bacheca passaggio consegne tra ufficio e personale', keys: ['consegn', 'bacheca', 'promemoria'], aree: ['*'] },
  { url: '/gestione-contratti', label: 'Contratti operatori', desc: 'contratti di incarico dei professionisti', keys: ['contratt'], aree: ['*'] },
  { url: '/tariffario', label: 'Tariffario', desc: 'listino prezzi prestazioni', keys: ['tariffar', 'listino', 'prezz'], aree: ['*'] },
  { url: '/preventivo-veloce', label: 'Preventivo veloce', desc: 'preventivo rapido dal listino con invio WhatsApp/email', keys: ['preventivo veloce', 'calcola'], aree: ['*'] },
  { url: '/riunioni-colloquio', label: 'Riunioni Colloquio', desc: 'videocolloqui con candidati e famiglie', keys: ['colloqui', 'riunion', 'video'], aree: ['consulenza'] },
  { url: '/gestione-utenti', label: 'Gestione Utenti', desc: 'utenti gestionale e accettazione candidature', keys: ['utent', 'accett', 'registrazion'], aree: ['*'] },
  { url: '/gestione-richieste', label: 'Gestione Richieste', desc: 'richieste di servizio in arrivo', keys: ['richieste'], aree: ['privato'] },
  { url: '/centro-prenotazioni', label: 'Centro Prenotazioni', desc: 'prenota prestazioni per i pazienti', keys: ['prenotazion', 'prenota', 'appuntament'], aree: ['privato'] },
  { url: '/piani-lavorativi', label: 'Piani lavorativi', desc: 'calendario prestazioni operatori', keys: ['piani lavorativi', 'calendario', 'turni'], aree: ['*'] },
  { url: '/compenso-incarichi', label: 'Compenso incarichi', desc: 'compensi e pagamenti operatori', keys: ['compens', 'pagament'], aree: ['*'] },
  { url: '/gestione-ritenute', label: 'Ritenute professionisti', desc: 'ritenute d\'acconto professionisti', keys: ['ritenut', 'accont'], aree: ['*'] },
  { url: '/telemedicina', label: 'Telemedicina', desc: 'monitoraggio parametri e pacchetti telemedicina', keys: ['telemed', 'monitoragg', 'parametr'], aree: ['privato'] },
  { url: '/gestione-consensi-gdpr', label: 'Consensi GDPR', desc: 'consensi firmati dai pazienti', keys: ['gdpr', 'consens', 'privacy'], aree: ['*'] },
];

const PROMPT_INTERNO = `Sei Abbraccino, l'assistente interno del gestionale Abbraccio Cure Domiciliari (software aziendale per OSS, infermieri e amministrazione). Aiuti l'operatore a orientarsi e trovare dati.
Il gestionale ha aree separate: GESTIONE PRIVATA (pazienti privati/convenzione SIAT, visite, telemedicina) e INTERMEDIAZIONI (badanti, colf, assistenti familiari, consulenza famiglie, candidature operatori).
REGOLE:
- Rispondi in italiano, max 70 parole, tono pratico da collega.
- Se l'utente chiede DOVE si fa qualcosa, indica il nome della sezione (i bottoni-link li aggiunge il sistema, non scrivere URL).
- Se cerca una persona e compare in "PERSONE TROVATE", conferma chi hai trovato e che i bottoni sotto aprono il suo profilo completo (anagrafica, preventivi, contratti, email, consegne, operatori assegnati).
- Non inventare dati su pazienti/operatori non presenti in PERSONE TROVATE.
- Se la domanda è fuori ambito gestionale, riporta gentilmente al lavoro.
CALCOLI — se l'utente chiede QUANTO COSTA una prestazione/servizio o un totale (es. "quanto costano 3 flebo + una visita"), aggiungi nel JSON "calcolo":{"voci":[{"nome":"NOME ESATTO dal listino","quantita":N}]} — usa SOLO nomi presenti nel LISTINO sotto, quantità plausibili (1-50). Il totale lo calcola il sistema con i prezzi reali.
Se chiede il COSTO di badante/colf/assistente familiare, aggiungi "calcoloBadante":{"contrattoTipo":"convivente|convivente_part_time|non_convivente|sostituzione|assistenza_notturna|presenza_notturna","livello":"A|AS|B|BS|C|CS|D|DS","oreSettimanali":40}. Se il livello non è detto usa "C" (non autosufficiente) o "BS" (autosufficiente).
Rispondi SOLO con JSON: {"risposta":"...","calcolo":{...},"calcoloBadante":{...}} (gli ultimi due campi solo se servono)`;

router.post('/interno', authenticateToken, rateLimitByIP(40, 10 * 60 * 1000), async (req: any, res: any) => {
  try {
    const messaggio = String(req.body?.messaggio || '').trim().slice(0, 600);
    const area = String(req.body?.area || '');
    if (!messaggio) return res.status(400).json({ message: 'Scrivi una domanda.' });

    const azioni: { label: string; url: string }[] = [];
    const msgLow = messaggio.toLowerCase();

    // 1) Match sul catalogo sezioni → bottoni "Apri sezione"
    const sezioniOk = SEZIONI.filter((s) => s.aree.includes('*') || !area || s.aree.includes(area));
    const sezioniHit = sezioniOk
      .map((s) => ({ s, score: s.keys.reduce((n, k) => n + (msgLow.includes(k) ? k.length : 0), 0) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => x.s);
    sezioniHit.forEach((s) => azioni.push({ label: `📂 ${s.label}`, url: s.url }));

    // 2) Possibili nomi propri nel messaggio → cerca pazienti/operatori.
    //    Parole con iniziale maiuscola, anche a inizio frase (es. "mario rossi"
    //    viene gestito dal fallback: se nessun maiuscolo, tenta le ultime 2 parole).
    const parole = messaggio.replace(/[.,!?;:()"']/g, ' ').split(/\s+/).filter(Boolean);
    const maiuscole = parole.filter((w, i) => /^[A-ZÀÈÉÌÒÙ]/.test(w) && w.length > 2 && (i > 0 || parole.length > 1));
    // Un solo nome proprio conta comunque ("mostrami Rossi"): senza questo il
    // testo diceva "usa i pulsanti" ma non veniva generato nessun bottone.
    const candidatiNome = maiuscole.length >= 2 ? maiuscole.slice(0, 3)
      : maiuscole.length === 1 && (parole.length <= 4 || /cerca|trova|mostrami|apri|scheda|dossier|paziente|operatore|info|storic/i.test(msgLow))
        ? maiuscole
      : parole.length >= 2 && /paziente|sig\.?|signor|dott|professionista|operatore|cerca|trova|scheda|dossier|info/i.test(msgLow)
        ? parole.slice(-2) : [];
    let personeTxt = '';
    if (candidatiNome.length) {
      const rxParts = candidatiNome.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const rxAll = new RegExp(rxParts.join('|'), 'i');
      const filtroPaz = area === 'consulenza' ? { tipoGestione: 'consulenza' } : area === 'privato' ? { tipoGestione: { $ne: 'consulenza' } } : {};
      const [pz, st] = await Promise.all([
        Patient.find({ ...filtroPaz, $or: [{ firstName: rxAll }, { lastName: rxAll }] }).limit(5)
          .select('firstName lastName tipoGestione email').lean(),
        Staff.find({ $or: [{ firstName: rxAll }, { lastName: rxAll }] }).limit(5)
          .select('firstName lastName role category cittaResidenza').lean(),
      ]);
      const righe: string[] = [];
      pz.slice(0, 2).forEach((p: any) => {
        const n = `${p.firstName} ${p.lastName}`;
        righe.push(`Paziente ${n} (${p.tipoGestione === 'consulenza' ? 'intermediazione' : p.tipoGestione === 'convenzione' ? 'convenzione SIAT' : 'privato'})`);
        // Link SEMPRE filtrati sul paziente specifico: mai archivi generici
        azioni.unshift({ label: `👤 ${n} — storico completo`, url: `/ricerca?paziente=${p._id}` });
        azioni.push({ label: `📄 Preventivi/fatture di ${p.lastName}`, url: `/archivio-preventivi?paziente=${p._id}` });
        if (p.email) azioni.push({ label: `📧 Email a ${p.lastName}`, url: `/archivio-email?q=${encodeURIComponent(p.email)}` });
      });
      st.forEach((s: any) => {
        righe.push(`Operatore ${s.firstName} ${s.lastName} (${s.role || s.category || 'ruolo n/d'}, ${s.cittaResidenza || 'zona n/d'})`);
        azioni.push({ label: `🧑‍⚕️ ${s.firstName} ${s.lastName} — personale`, url: '/staff' });
      });
      if (righe.length) personeTxt = `\nPERSONE TROVATE: ${righe.join(' | ')}`;
      else if (candidatiNome.length >= 2) {
        azioni.push({ label: `🔎 Cerca "${candidatiNome.join(' ')}"`, url: `/ricerca?q=${encodeURIComponent(candidatiNome.join(' '))}` });
      }
    }

    // 3) Risposta testuale via Groq, con fallback deterministico se non disponibile.
    // Il listino reale entra nel prompt SOLO per domande sui costi — contiene
    // molte voci e mandarlo sempre brucerebbe il rate-limit Groq.
    const chiedeCosti = /cost|prezz|quant|euro|€|preventiv|tariff|pag/i.test(msgLow);
    const chiedeBadante = /badant|colf|assistente familiare|convivent|ccnl|notturn/i.test(msgLow);
    const catalogo = sezioniOk.map((s) => `${s.label}: ${s.desc}`).join('\n');
    let contestoExtra = '';
    if (chiedeCosti && area !== 'consulenza') {
      try {
        const voci = await vociListino();
        const perCat: Record<string, string[]> = {};
        voci.forEach((v: any) => { (perCat[v.categoria || 'Servizi'] = perCat[v.categoria || 'Servizi'] || []).push(`${v.descrizione} €${v.prezzo}`); });
        contestoExtra += `\nLISTINO REALE (usa nomi esatti per "calcolo"):\n${Object.entries(perCat).map(([c, vs]) => `${c}: ${vs.join('; ')}`).join('\n')}`;
      } catch { /* senza listino */ }
    }
    if (chiedeBadante || (chiedeCosti && area === 'consulenza')) {
      try {
        const t = await tariffeCcnl();
        contestoExtra += `\nTARIFFE CCNL 2026: ${JSON.stringify(t)}`;
      } catch { /* senza ccnl */ }
    }
    let risposta = '';
    let parsed: any = {};
    if (GROQ_API_KEY) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
          body: JSON.stringify({
            model: LLM_MODEL,
            temperature: 0.3,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: `${PROMPT_INTERNO}\nSEZIONI DEL GESTIONALE:\n${catalogo}${personeTxt}${contestoExtra}` },
              { role: 'user', content: messaggio },
            ],
          }),
        });
        const data = await groqRes.json();
        try { parsed = JSON.parse(data?.choices?.[0]?.message?.content || '{}'); } catch { /* ignora */ }
        risposta = String(parsed.risposta || '').trim();
      } catch { risposta = ''; }
      if (!risposta) risposta = fallbackInterno(sezioniHit, personeTxt);
    } else {
      risposta = fallbackInterno(sezioniHit, personeTxt);
    }

    // 4) Calcoli reali lato server — mai fidarsi dell'aritmetica dell'LLM.
    //    a) listino: matcha le voci per nome nel Tariffario e somma i prezzi veri
    //    b) badante: gira il calcolatore CCNL vero (simulaCostoBadante)
    let calcolo: any = null;
    try {
      const vociChieste = Array.isArray(parsed?.calcolo?.voci) ? parsed.calcolo.voci : [];
      if (vociChieste.length) {
        const norm = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
        const tariffe = await Tariffario.find({ attivo: true }).select('nome prezzo unitaMisura promoAttiva prezzoPromo').lean();
        const righe: any[] = [];
        vociChieste.slice(0, 8).forEach((v: any) => {
          const nomeCercato = norm(v.nome);
          if (!nomeCercato) return;
          const voce = tariffe.find((t: any) => norm(t.nome) === nomeCercato)
            || tariffe.find((t: any) => norm(t.nome).includes(nomeCercato) || nomeCercato.includes(norm(t.nome)));
          if (!voce) return;
          const qty = Math.min(Math.max(parseInt(v.quantita, 10) || 1, 1), 50);
          const prezzo = voce.promoAttiva && Number(voce.prezzoPromo) > 0 && Number(voce.prezzoPromo) < voce.prezzo ? Number(voce.prezzoPromo) : Number(voce.prezzo);
          righe.push({ nome: voce.nome, quantita: qty, prezzo, subtotale: Math.round(prezzo * qty * 100) / 100 });
        });
        if (righe.length) {
          const totale = Math.round(righe.reduce((s, r) => s + r.subtotale, 0) * 100) / 100;
          calcolo = { tipo: 'listino', righe, totale };
        }
      }
      if (!calcolo && parsed?.calcoloBadante && typeof parsed.calcoloBadante === 'object') {
        const cb = parsed.calcoloBadante;
        const tipiOk = ['convivente', 'convivente_part_time', 'non_convivente', 'sostituzione', 'assistenza_notturna', 'presenza_notturna'];
        const livelliOk = ['A', 'AS', 'B', 'BS', 'C', 'CS', 'D', 'DS'];
        const P = await caricaParametri();
        const tipoContr = tipiOk.includes(cb.contrattoTipo) ? cb.contrattoTipo : 'convivente';
        const oreSett = Math.min(Math.max(parseInt(cb.oreSettimanali, 10) || 40, 4), 60);
        const sim = simulaCostoBadante({
          contrattoTipo: tipoContr,
          livello: livelliOk.includes(cb.livello) ? cb.livello : 'C',
          oreSettimanali: oreSett,
          tempoDeterminato: !!cb.tempoDeterminato,
          indennitaPiuAutosuff: !!cb.indennitaPiuAutosuff,
          certificazioneUni: !!cb.certificazioneUni,
          indennitaBabysitter: !!cb.indennitaBabysitter,
        }, P);
        const caf = quotaCafDefault(tipoContr, oreSett, P);
        calcolo = {
          tipo: 'ccnl',
          titolo: `${sim.contrattoLabel} — livello ${sim.livelloLabel}, ${oreSett}h/sett`,
          righe: [
            { nome: `Retribuzione lorda ${sim.pagaUnitaria === 'ora' ? 'oraria effettiva' : 'mensile'}`, valore: sim.pagaUnitaria === 'ora' ? sim.retribuzioneOrariaEffettiva : sim.retribuzioneLordaMensile },
            { nome: 'Contributi INPS + Cassa.Colf (datore)', valore: Math.round((sim.contribInpsDatoreMensili + sim.cassaColfDatoreMensili) * 100) / 100 },
            { nome: 'Rateo TFR + tredicesima', valore: Math.round((sim.tfr + sim.tredicesima) * 100) / 100 },
            { nome: 'Gestione CAF', valore: caf },
          ],
          totale: Math.round((sim.totaleCostoMensile + caf) * 100) / 100,
          netto: sim.retribuzioneNetta,
        };
      }
    } catch (calcErr: any) {
      console.warn('[Abbraccino interno] calcolo fallito:', calcErr?.message);
    }

    return res.json({ risposta: risposta.slice(0, 800), azioni: azioni.slice(0, 5), calcolo });
  } catch (e: any) {
    console.error('[Abbraccino interno] Errore:', e?.message);
    return res.status(502).json({ message: 'Abbraccino è impegnato, riprova tra poco.' });
  }
});

function fallbackInterno(sezioniHit: { label: string }[], personeTxt: string): string {
  if (personeTxt) return `Ho trovato chi cercavi 💛 Sotto hai i bottoni per aprire la sua scheda completa: anagrafica, preventivi, contratti, email, consegne e operatori assegnati.`;
  if (sezioniHit.length) return `Ecco dove andare: ti ho messo sotto il bottone per aprire "${sezioniHit[0].label}".`;
  return 'Dimmi cosa cerchi — una persona (es. "paziente Rossi"), una funzione (es. "fatturazione", "assegnazione") — e ti porto lì. Oppure usa la Ricerca globale dal menu.';
}

export default router;
