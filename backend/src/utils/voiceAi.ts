/**
 * Voice AI utilities — STT + structured extraction via Groq.
 *
 * Uses the native fetch / FormData available in Node 18+.
 * No extra npm dependency required.
 */

export interface VoiceExtractedData {
  testo: string;
  parametriVitali?: Record<string, number>;
  scaleValutazione?: Record<string, number>;
  terapiaFarmacologica?: Array<{
    farmaco: string;
    dosaggio: string;
    mattina?: boolean;
    pomeriggio?: boolean;
    sera?: boolean;
    notte?: boolean;
  }>;
  note?: string;
}

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const STT_MODEL = process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo';
const LLM_MODEL = process.env.GROQ_LLM_MODEL || 'llama-3.3-70b-versatile';

export function isVoiceAiAvailable(): boolean {
  return Boolean(GROQ_API_KEY && GROQ_API_KEY.trim().length > 0);
}

/**
 * Send raw audio bytes to Groq Whisper and return the Italian transcript.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string,
  mimeType: string = 'audio/webm'
): Promise<string> {
  if (!isVoiceAiAvailable()) {
    throw new Error('GROQ_API_KEY non configurata');
  }

  const ext = filename.split('.').pop()?.toLowerCase() || 'webm';
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_') || `audio.${ext}`;

  const form = new FormData();
  form.append('file', new Blob([audioBuffer], { type: mimeType }), safeName);
  form.append('model', STT_MODEL);
  form.append('language', 'it');
  form.append('response_format', 'text');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Groq STT error ${res.status}: ${text}`);
  }

  const text = await res.text();
  return text.trim();
}

const EXTRACTION_SYSTEM_PROMPT = `Sei un assistente per operatori sanitari che lavorano con App Abbraccio, una piattaforma per cure domiciliari.
L'operatore ha dettato una voce di diario clinico, eventuali parametri vitali, scale di valutazione e terapia farmacologica.

Il tuo compito è estrarre i dati dalla trascrizione e restituire ESCLUSIVAMENTE un oggetto JSON valido con questa struttura esatta:

{
  "testo": "stringa con la narrazione clinica rielaborata in modo professionale, pulita e senza ripetere i parametri numerici già strutturati",
  "parametriVitali": {
    "pressioneSistolica": number,
    "pressioneDiastolica": number,
    "frequenzaCardiaca": number,
    "frequenzaRespiratoria": number,
    "temperatura": number,
    "saturazione": number,
    "glicemia": number,
    "peso": number,
    "dolore": number
  },
  "scaleValutazione": {
    "braden": number,
    "barthel": number,
    "conley": number
  },
  "terapiaFarmacologica": [
    {"farmaco": "nome farmaco", "dosaggio": "dose", "mattina": true, "pomeriggio": false, "sera": true, "notte": false}
  ],
  "note": "eventuali note libere"
}

REGOLE:
1. Includi nel JSON SOLO i campi per cui hai trovato un valore. Se un campo non è presente, omettilo o non metterlo a null.
2. Pressione: se senti valori come "120/80", inserisci pressioneSistolica=120 e pressioneDiastolica=80.
3. Scala del dolore (0-10) va in parametriVitali.dolore.
4. Braden valido 6-23. Barthel valido 0-100. Conley valido 0-8. Se il numero non rientra, non includerlo.
5. Per la terapia, se l'operatore elenca farmaci e orari, popola correttamente i booleani mattina/pomeriggio/sera/notte.
6. Se non ci sono parametri/scale/terapia, restituisci gli oggetti vuoti {} o array vuoto [].
7. Non aggiungere spiegazioni prima o dopo il JSON. Restituisci SOLO JSON valido.`;

/**
 * Extract structured clinical data from an Italian transcript.
 */
export async function extractDiarioData(
  transcript: string,
  context?: { patientName?: string; workPlanType?: string }
): Promise<VoiceExtractedData> {
  if (!isVoiceAiAvailable()) {
    throw new Error('GROQ_API_KEY non configurata');
  }

  let ctx = '';
  if (context?.patientName) ctx += `Paziente: ${context.patientName}\n`;
  if (context?.workPlanType) ctx += `Tipo piano: ${context.workPlanType}\n`;

  const userContent = `${ctx}Trascrizione:\n"""${transcript}"""`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      temperature: 0.1,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Groq LLM error ${res.status}: ${text}`);
  }

  const data: any = await res.json();
  const raw = data.choices?.[0]?.message?.content || '';
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

  let parsed: Partial<VoiceExtractedData>;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error('La risposta del LLM non è un JSON valido');
  }

  if (!parsed.testo || typeof parsed.testo !== 'string') {
    throw new Error('Il JSON restituito non contiene il campo testo');
  }

  return {
    testo: parsed.testo.trim(),
    parametriVitali: cleanNumericRecord(parsed.parametriVitali),
    scaleValutazione: cleanNumericRecord(parsed.scaleValutazione),
    terapiaFarmacologica: Array.isArray(parsed.terapiaFarmacologica)
      ? parsed.terapiaFarmacologica.filter(isValidFarmaco)
      : undefined,
    note: typeof parsed.note === 'string' && parsed.note.trim() ? parsed.note.trim() : undefined,
  };
}

export async function generateMeetingMinutes(transcript: string, context: { titolo: string; ordineDelGiorno: string }): Promise<string> {
  if (!isVoiceAiAvailable()) throw new Error('GROQ_API_KEY non configurata');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LLM_MODEL,
      temperature: 0.2,
      max_tokens: 3000,
      messages: [
        { role: 'system', content: 'Redigi un verbale professionale di riunione di équipe sanitaria in italiano. Riporta sinteticamente: oggetto, punti discussi, decisioni, azioni assegnate e criticità. Non inventare informazioni e non includere dati non presenti nella trascrizione.' },
        { role: 'user', content: `Titolo: ${context.titolo}\nOrdine del giorno: ${context.ordineDelGiorno}\n\nTrascrizione:\n${transcript}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq LLM error ${res.status}: ${await res.text()}`);
  const data: any = await res.json();
  return String(data.choices?.[0]?.message?.content || '').trim();
}

function cleanNumericRecord(input: unknown): Record<string, number> | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      out[key] = value;
    } else if (typeof value === 'string') {
      const n = parseFloat(value.replace(',', '.'));
      if (!Number.isNaN(n)) out[key] = n;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function isValidFarmaco(item: unknown): item is VoiceExtractedData['terapiaFarmacologica'][number] {
  if (!item || typeof item !== 'object') return false;
  const f = item as Record<string, unknown>;
  return typeof f.farmaco === 'string' && f.farmaco.trim().length > 0;
}
