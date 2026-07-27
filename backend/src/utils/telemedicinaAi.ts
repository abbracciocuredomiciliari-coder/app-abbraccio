import { Request, Response } from 'express';
import ParametroVita from '../models/ParametroVita';
import Teleconsulto from '../models/Teleconsulto';
import AlertTelemedicina from '../models/AlertTelemedicina';
import Patient from '../models/Patient';

export async function generateTelemedicinaSummary(req: Request, res: Response) {
  try {
    const { pazienteId } = req.params;
    const { days = '7' } = req.query as any;
    const from = new Date();
    from.setDate(from.getDate() - parseInt(days || '7', 10));

    const [parametri, teleconsulti, alert] = await Promise.all([
      ParametroVita.find({ pazienteId, rilevatoIl: { $gte: from } }).sort({ rilevatoIl: -1 }).limit(200),
      Teleconsulto.find({ patientId: pazienteId }).sort({ dataOra: -1 }).limit(20),
      AlertTelemedicina.find({ pazienteId, stato: { $in: ['aperto', 'in_carico'] } }).sort({ createdAt: -1 }),
    ]);

    const latestByTipo: Record<string, any> = {};
    parametri.forEach(p => { if (!latestByTipo[p.tipo] || new Date(p.rilevatoIl) > new Date(latestByTipo[p.tipo].rilevatoIl)) latestByTipo[p.tipo] = p; });

    const anomalie = parametri.filter(p => p.anomalo);
    const alertCritici = alert.filter(a => a.priorita === 'critica' || a.priorita === 'alta');

    const lines: string[] = [];
    lines.push(`Riepilogo telemedicina ultimi ${days} giorni.`);
    lines.push(`Parametri rilevati: ${parametri.length}, di cui anomali: ${anomalie.length}.`);
    if (Object.keys(latestByTipo).length) {
      lines.push('Valori più recenti:');
      Object.values(latestByTipo).forEach((p: any) => lines.push(`- ${p.tipo.replace(/_/g, ' ')}: ${p.valore} ${p.unita} (${new Date(p.rilevatoIl).toLocaleString('it-IT')})`));
    }
    if (teleconsulti.length) lines.push(`Teleconsulti: ${teleconsulti.length}, ultimo ${new Date(teleconsulti[0].dataOra).toLocaleDateString('it-IT')}.`);
    if (alertCritici.length) lines.push(`Attenzione: ${alertCritici.length} alert aperti di alta/critica priorità.`);

    const raccomandazioni: string[] = [];
    if (anomalie.some(p => p.tipo === 'frequenza_cardiaca' || p.tipo === 'pressione_sistolica' || p.tipo === 'pressione_diastolica')) raccomandazioni.push('Verificare parametri cardiovasculari e valutare contatto telefonico.');
    if (anomalie.some(p => p.tipo === 'glicemia')) raccomandazioni.push('Controllare glicemia e aderenza terapica.');
    if (anomalie.some(p => p.tipo === 'saturazione_o2' || p.tipo === 'spo2')) raccomandazioni.push('Valutare saturazione: considerare ossigeno o visita domiciliare.');
    if (alertCritici.length === 0 && anomalie.length === 0) raccomandazioni.push('Andamento stabile. Continuare monitoraggio programmato.');

    return res.json({
      pazienteId,
      periodoGiorni: parseInt(days, 10),
      riepilogo: lines.join('\n'),
      raccomandazioni,
      anomalie: anomalie.length,
      teleconsulti: teleconsulti.length,
      alertAperti: alert.length,
      latest: Object.values(latestByTipo),
      generatoIl: new Date(),
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore generazione riepilogo', error: error.message });
  }
}

export async function prioritizePatients(req: Request, res: Response) {
  try {
    const [pazienteIdsParams, pazienteIdsAlert, pazienteIdsTele] = await Promise.all([
      ParametroVita.distinct('pazienteId'),
      AlertTelemedicina.distinct('pazienteId', { stato: { $in: ['aperto', 'in_carico'] } }),
      Teleconsulto.distinct('patientId'),
    ]);
    const ids = new Set<string>([...pazienteIdsParams, ...pazienteIdsAlert, ...pazienteIdsTele]);
    const pazienti = await Patient.find({ _id: { $in: Array.from(ids) } }).lean();

    const result = await Promise.all(pazienti.map(async (p) => {
      const pid = (p as any)._id.toString();
      const [alert, anomalie, consulti, latest] = await Promise.all([
        AlertTelemedicina.find({ pazienteId: pid, stato: { $in: ['aperto', 'in_carico'] } }).sort({ priorita: -1 }),
        ParametroVita.countDocuments({ pazienteId: pid, anomalo: true, rilevatoIl: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }),
        Teleconsulto.countDocuments({ patientId: pid }),
        ParametroVita.find({ pazienteId: pid }).sort({ rilevatoIl: -1 }).limit(1),
      ]);
      const critici = alert.filter(a => a.priorita === 'critica').length;
      const alti = alert.filter(a => a.priorita === 'alta').length;
      const score = critici * 10 + alti * 5 + alert.length * 2 + anomalie * 1;
      return {
        pazienteId: pid,
        nome: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
        score,
        alertAperti: alert.length,
        alertCritici: critici,
        anomalie7gg: anomalie,
        teleconsultiTotali: consulti,
        ultimoParametro: latest[0] ? { tipo: latest[0].tipo, valore: latest[0].valore, unita: latest[0].unita, rilevatoIl: latest[0].rilevatoIl } : null,
      };
    }));

    return res.json(result.sort((a, b) => b.score - a.score));
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore prioritizzazione', error: error.message });
  }
}

function linearRegressionSlope(values: { x: number; y: number }[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const sumX = values.reduce((a, v) => a + v.x, 0);
  const sumY = values.reduce((a, v) => a + v.y, 0);
  const sumXY = values.reduce((a, v) => a + v.x * v.y, 0);
  const sumXX = values.reduce((a, v) => a + v.x * v.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

export async function detectTrend(req: Request, res: Response) {
  try {
    const { pazienteId } = req.params;
    const { tipo, days = '14' } = req.query as any;
    if (!tipo) return res.status(400).json({ message: 'tipo parametro obbligatorio' });
    const from = new Date();
    from.setDate(from.getDate() - parseInt(days || '14', 10));
    const parametri = await ParametroVita.find({ pazienteId, tipo, rilevatoIl: { $gte: from } }).sort({ rilevatoIl: 1 });
    if (parametri.length < 2) return res.json({ pazienteId, tipo, punti: parametri.length, slope: 0, direzione: 'insufficiente', values: parametri });
    const points = parametri.map((p, i) => ({ x: i, y: Number(p.valore) || 0 }));
    const slope = linearRegressionSlope(points);
    let direzione = 'stabile';
    if (slope > 0.05) direzione = 'crescente';
    if (slope < -0.05) direzione = 'decrescente';
    if (Math.abs(slope) < 0.05) direzione = 'stabile';
    const anomali = parametri.filter(p => p.anomalo).length;
    const forecast = parametri[parametri.length - 1].valore + slope * (parametri.length);
    return res.json({ pazienteId, tipo, punti: parametri.length, slope, direzione, anomali, forecast, values: parametri });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore trend', error: error.message });
  }
}
