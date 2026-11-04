// @ts-nocheck
import express from 'express';
import { rateLimitByIP } from '../middleware/rateLimit';

const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const LLM_MODEL = process.env.GROQ_LLM_MODEL || 'openai/gpt-oss-120b';

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
Se chiede costi badante: spiega che dipende dal contratto (convivente circa 1.000-1.300 euro/mese lordi, non convivente a ore, sostituzione per ferie) e manda al calcolatore /badante.
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
Contesto attuale del calcolatore: `;

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
    const voci = Array.isArray(contesto.voci)
      ? contesto.voci.slice(0, 200).map((v: any) => ({ id: v.id, descrizione: String(v.descrizione || '').slice(0, 120), prezzo: v.prezzo, categoria: v.categoria }))
      : undefined;
    const contestoStr = tipo === 'sito'
      ? JSON.stringify({ voci, pagina: contesto.pagina })
      : tipo === 'preventivo'
      ? JSON.stringify(voci || [])
      : JSON.stringify({
          contratto: contesto.contratto, livello: contesto.livello,
          oreSettimanali: contesto.oreSettimanali, regione: contesto.regione,
        });

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
