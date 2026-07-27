import { Request, Response } from 'express';
import ParametroVita from '../models/ParametroVita';
import Teleconsulto from '../models/Teleconsulto';
import Patient from '../models/Patient';

function pad(n: number, len: number) { return String(n).padStart(len, '0'); }
function hl7Timestamp(d: Date) {
  const x = new Date(d);
  return `${x.getFullYear()}${pad(x.getMonth() + 1, 2)}${pad(x.getDate(), 2)}${pad(x.getHours(), 2)}${pad(x.getMinutes(), 2)}${pad(x.getSeconds(), 2)}`;
}

const loincMap: Record<string, string> = {
  frequenza_cardiaca: '8867-4',
  pressione_sistolica: '8480-6',
  pressione_diastolica: '8462-4',
  saturazione_o2: '59408-5',
  spo2: '59408-5',
  glicemia: '2339-0',
  temperatura: '8310-5',
  peso: '29463-7',
  altezza: '8302-2',
  bmi: '39156-5',
  co2: '2021-4',
};

const unitMap: Record<string, string> = {
  frequenza_cardiaca: '/min',
  pressione_sistolica: 'mm[Hg]',
  pressione_diastolica: 'mm[Hg]',
  saturazione_o2: '%',
  spo2: '%',
  glicemia: 'mg/dL',
  temperatura: 'Cel',
  peso: 'kg',
  altezza: 'cm',
  bmi: 'kg/m2',
  co2: 'mm[Hg]',
};

export async function exportHl7Message(req: Request, res: Response) {
  try {
    const { pazienteId } = req.params;
    const { days = '30' } = req.query as any;
    const from = new Date();
    from.setDate(from.getDate() - parseInt(days || '30', 10));

    const [patient, parametri, teleconsulti] = await Promise.all([
      Patient.findById(pazienteId).lean(),
      ParametroVita.find({ pazienteId, rilevatoIl: { $gte: from } }).sort({ rilevatoIl: -1 }).limit(500),
      Teleconsulto.find({ patientId: pazienteId, dataOra: { $gte: from } }).sort({ dataOra: -1 }).limit(100),
    ]);

    if (!patient) return res.status(404).json({ message: 'Paziente non trovato' });

    const now = new Date();
    const msgId = `abbraccio-${Date.now()}`;
    const timestamp = hl7Timestamp(now);
    const birth = patient.birthDate ? new Date(patient.birthDate).toISOString().slice(0, 10).replace(/-/g, '') : '';
    const patientAny = patient as any;
    const gender = patientAny.gender === 'Maschio' ? 'M' : patientAny.gender === 'Femmina' ? 'F' : 'U';
    const name = `${patient.lastName || ''}^${patient.firstName || ''}`;

    const segments: string[] = [];
    segments.push(`MSH|^~\\&|AbbraccioTelemedicina|Abbraccio|DEST|DEST|${timestamp}||ORU^R01^ORU_R01|${msgId}|P|2.5`);
    segments.push(`PID|1||${pazienteId}^^^Abbraccio^MR||${name}||${birth}|${gender}||||||||||||||||||||||`);

    let obrSeq = 1;
    segments.push(`OBR|${obrSeq}||${msgId}^Abbraccio|^^^^^^^^Vitali e teleconsulti|||${timestamp}||||||||||||||`);

    parametri.forEach((p, i) => {
      const ts = hl7Timestamp(new Date(p.rilevatoIl));
      const code = loincMap[p.tipo] || '';
      const desc = p.tipo.replace(/_/g, ' ');
      const unit = unitMap[p.tipo] || p.unita || '';
      const value = String(p.valore);
      const abnormal = p.anomalo ? 'A' : 'N';
      segments.push(`OBX|${i + 1}|NM|${code}^${desc}^LN||${value}|${unit}||||${abnormal}|||${ts}`);
    });

    if (teleconsulti.length) {
      segments.push(`NTE|1||Teleconsulti effettuati: ${teleconsulti.length}|`);
      teleconsulti.forEach((t, i) => {
        segments.push(`NTE|${i + 2}||${new Date(t.dataOra).toLocaleDateString('it-IT')} - ${t.professione}: ${t.titolo} (${t.stato})||`);
      });
    }

    const message = segments.join('\r\n') + '\r\n';
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="hl7-${pazienteId}-${now.getTime()}.txt"`);
    return res.send(message);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore esportazione HL7', error: error.message });
  }
}
