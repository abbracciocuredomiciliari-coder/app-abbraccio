import mongoose from 'mongoose';
import Patient from '../models/Patient';
import DiarioClinico from '../models/DiarioClinico';
import WorkPlan from '../models/WorkPlan';
import WorkPlanAccess from '../models/WorkPlanAccess';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const LLM_MODEL = process.env.GROQ_LLM_MODEL || 'openai/gpt-oss-120b';

export function isReportAiAvailable(): boolean {
  return Boolean(GROQ_API_KEY && GROQ_API_KEY.trim().length > 0);
}

async function callGroqChat(messages: { role: string; content: string }[], maxTokens = 4096): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      temperature: 0.3,
      max_tokens: maxTokens,
      messages,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Groq LLM error ${res.status}: ${text}`);
  }

  const json = await res.json() as any;
  return json.choices?.[0]?.message?.content?.trim() || '';
}

function safeString(v: any): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

export async function generatePatientReport(
  patientId: string,
  options: {
    fromDate?: Date;
    toDate?: Date;
    scope?: 'all' | 'category';
    category?: string;
    workPlanType?: string;
    assignedToStaffId?: string;
  } = {}
) {
  if (!isReportAiAvailable()) {
    throw new Error('GROQ_API_KEY non configurata');
  }

  const patient = await Patient.findById(patientId).lean();
  if (!patient) throw new Error('Paziente non trovato');

  const { fromDate, toDate, scope = 'all', category, workPlanType, assignedToStaffId } = options;

  // Costruisci filtro workPlan
  const workPlanQuery: any = { patient: patientId };
  if (assignedToStaffId) {
    workPlanQuery.$or = [
      { staff: new mongoose.Types.ObjectId(assignedToStaffId) },
      { 'prestazioni.staff': new mongoose.Types.ObjectId(assignedToStaffId) },
    ];
  }
  if (scope === 'category' && category) {
    if (category === 'assistenziale') {
      const orConditions: any[] = [{ type: 'assistenziale' }];
      if (!workPlanQuery.$or) workPlanQuery.$or = orConditions;
      else workPlanQuery.$or = [...workPlanQuery.$or, { 'prestazioni.categoria': 'assistenziale' }];
    } else {
      workPlanQuery['prestazioni.categoria'] = category;
    }
  }
  if (workPlanType && scope === 'category') {
    workPlanQuery.type = workPlanType;
  }

  const workplans = await WorkPlan.find(workPlanQuery).sort({ date: -1 }).lean();
  const workPlanIds = workplans.map(w => w._id.toString());

  // Costruisci filtro diario
  const diarioQuery: any = { patient: patientId, workPlan: { $in: workPlanIds } };
  if (fromDate || toDate) {
    diarioQuery.createdAt = {};
    if (fromDate) diarioQuery.createdAt.$gte = fromDate;
    if (toDate) diarioQuery.createdAt.$lte = toDate;
  }

  const [diario, accessi] = await Promise.all([
    DiarioClinico.find(diarioQuery).sort({ createdAt: 1 }).lean(),
    WorkPlanAccess.find({ workPlan: { $in: workPlanIds } })
      .sort({ oraEntrata: -1 })
      .lean(),
  ]);

  const datiPaziente = {
    nome: `${safeString(patient.firstName)} ${safeString(patient.lastName)}`,
    dataNascita: patient.birthDate ? new Date(patient.birthDate).toLocaleDateString('it-IT') : 'ND',
    indirizzo: safeString(patient.address),
    telefono: safeString(patient.contactPhone),
    email: safeString(patient.email),
    diagnosi: safeString(patient.diagnosiAmmissione) || safeString(patient.assistanceNeeds),
    allergie: safeString(patient.allergie),
    comorbilita: safeString(patient.comorbilita),
    caregiver: safeString(patient.caregiverRiferimento),
  };

  const vociDiario = diario.map(d => ({
    data: new Date((d as any).dataRegistrazione || (d as any).createdAt).toLocaleString('it-IT'),
    operatore: safeString(d.staffName),
    testo: safeString(d.testo),
    parametri: d.parametriVitali ? Object.entries(d.parametriVitali).map(([k, v]) => `${k}: ${v}`).join(', ') : '',
    scale: d.scaleValutazione ? Object.entries(d.scaleValutazione).map(([k, v]) => `${k}: ${v}`).join(', ') : '',
    terapia: Array.isArray(d.terapiaFarmacologica)
      ? d.terapiaFarmacologica.map(t => `${safeString(t.farmaco)} ${safeString(t.dosaggio)}`).join('; ')
      : '',
    firmato: d.firmato ? 'Sì' : 'No',
  }));

  const piani = workplans.map(w => ({
    categoria: w.category || w.type,
    task: safeString(w.task),
    date: w.date ? new Date(w.date).toLocaleDateString('it-IT') : 'ND',
    dataFine: w.dataFine ? new Date(w.dataFine).toLocaleDateString('it-IT') : '',
    status: w.status,
    note: safeString(w.notes),
  }));

  const accessiInfo = accessi.map(a => ({
    data: a.oraEntrata ? new Date(a.oraEntrata).toLocaleString('it-IT') : 'ND',
    operatore: safeString(a.staffName),
    durata: a.durataMinuti ? `${a.durataMinuti} min` : '',
    note: safeString(a.note),
  }));

  const userContent = `Genera una relazione medico-infermieristica formale, professionale e chiara, adatta per ASL, medico di famiglia o coordinamento.

SCOPE RELAZIONE: ${scope === 'category' && category ? `solo prestazione ${category}${workPlanType ? ` (${workPlanType})` : ''}` : 'generale su tutto il percorso'}${assignedToStaffId ? ' - limitata ai piani assegnati al professionista che redige' : ''}

DATI PAZIENTE:
${JSON.stringify(datiPaziente, null, 2)}

PIANI DI LAVORO/ASSISTENZA:
${JSON.stringify(piani.slice(0, 30), null, 2)}

ACCESSI EFFETTUATI:
${JSON.stringify(accessiInfo.slice(0, 30), null, 2)}

VOCIDIARIO CLINICO:
${JSON.stringify(vociDiario.slice(-30), null, 2)}

Istruzioni:
- Scrivi in italiano.
- Inizia con intestazione (paziente, periodo).
- Struttura: sintesi clinica, andamento, parametri vitali rilevanti, terapia, valutazioni scale, note accessi, conclusione e raccomandazioni.
- Usa linguaggio tecnico ma comprensibile.
- Non inventare dati non presenti.
- Non ripetere per eccesso; massimo 2-3 pagine.
`;

  const systemPrompt = `Sei un assistente specializzato in cure domiciliari. Redigi relazioni clinico-assistenziali formali in italiano, adatte per medici di famiglia, ASL e coordinatori sanitari. Usa un tono professionale, oggettivo e rispettoso della privacy GDPR. Non inventare informazioni.`;

  const report = await callGroqChat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    4096
  );

  return {
    report,
    patient: datiPaziente,
    generatedAt: new Date().toISOString(),
    sources: {
      diarioCount: diario.length,
      workplanCount: workplans.length,
      accessCount: accessi.length,
    },
  };
}
