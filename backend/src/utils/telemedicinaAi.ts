import { Request, Response } from 'express';
import ParametroVita from '../models/ParametroVita';
import Teleconsulto from '../models/Teleconsulto';
import AlertTelemedicina from '../models/AlertTelemedicina';

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
