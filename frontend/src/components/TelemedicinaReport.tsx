import { useState } from 'react';
import api from '../api/api';
import { useToast } from '../hooks/useToast';
import { FileText, Loader2, Calendar, AlertTriangle, Activity, TrendingUp, Printer, Download } from 'lucide-react';

type ReportSummary = {
  pazienteId: string;
  periodoGiorni: number;
  riepilogo: string;
  raccomandazioni: string[];
  anomalie: number;
  teleconsulti: number;
  alertAperti: number;
  latest: { tipo: string; valore: number; unita: string; rilevatoIl: string }[];
  generatoIl: string;
};

type PatientMini = { _id: string; firstName: string; lastName: string };

export default function TelemedicinaReport({ patients }: { patients: PatientMini[] }) {
  const { addToast } = useToast();
  const [patientId, setPatientId] = useState('');
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportSummary | null>(null);

  const load = async () => {
    if (!patientId) return;
    try {
      setLoading(true);
      const res = await api.get(`/telemedicina/ai/summary/${patientId}`, { params: { days } });
      setReport(res.data);
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Errore generazione report', 'error');
    } finally { setLoading(false); }
  };

  const stampa = () => window.print();

  const scaricaFhir = async () => {
    if (!patientId) return;
    try {
      const res = await api.get(`/telemedicina/fhir/${patientId}`, { params: { days }, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/fhir+json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `fhir-${patientId}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) { addToast('Errore esportazione FHIR', 'error'); }
  };

  const scaricaHl7 = async () => {
    if (!patientId) return;
    try {
      const res = await api.get(`/telemedicina/hl7/${patientId}`, { params: { days }, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/plain' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `hl7-${patientId}-${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) { addToast('Errore esportazione HL7', 'error'); }
  };

  return (
    <div className="bg-white border rounded-xl p-5 shadow-sm">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><TrendingUp size={20} /> Report e AI di supporto</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <select value={patientId} onChange={e => setPatientId(e.target.value)} className="border rounded p-2"><option value="">Seleziona paziente</option>{patients.map(p => <option key={p._id} value={p._id}>{p.firstName} {p.lastName}</option>)}</select>
        <select value={days} onChange={e => setDays(Number(e.target.value))} className="border rounded p-2"><option value={7}>Ultimi 7 giorni</option><option value={15}>Ultimi 15 giorni</option><option value={30}>Ultimi 30 giorni</option></select>
        <button disabled={!patientId || loading} onClick={load} className="px-4 py-2 bg-teal-600 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-60">{loading ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />} Genera riepilogo</button>
      </div>

      {report && (
        <div className="border rounded-lg p-4 bg-slate-50 print-area">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold text-lg">Riepilogo telemedicina</h3>
              <p className="text-xs text-slate-500">{new Date(report.generatoIl).toLocaleString('it-IT')} · periodo {report.periodoGiorni} giorni</p>
            </div>
            <div className="flex gap-2 print:hidden">
              <button onClick={scaricaFhir} className="p-2 border rounded hover:bg-white" title="Esporta FHIR"><Download size={16} /></button>
              <button onClick={scaricaHl7} className="p-2 border rounded hover:bg-white" title="Esporta HL7 v2.x">HL7</button>
              <button onClick={stampa} className="p-2 border rounded hover:bg-white"><Printer size={16} /></button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-white p-3 rounded border text-center"><Activity className="mx-auto mb-1 text-teal-600" size={20} /><div className="text-2xl font-bold">{report.latest.length}</div><div className="text-xs text-slate-500">parametri ultimi</div></div>
            <div className="bg-white p-3 rounded border text-center"><AlertTriangle className="mx-auto mb-1 text-rose-600" size={20} /><div className="text-2xl font-bold">{report.anomalie}</div><div className="text-xs text-slate-500">anomalie</div></div>
            <div className="bg-white p-3 rounded border text-center"><Calendar className="mx-auto mb-1 text-blue-600" size={20} /><div className="text-2xl font-bold">{report.teleconsulti}</div><div className="text-xs text-slate-500">teleconsulti</div></div>
            <div className="bg-white p-3 rounded border text-center"><AlertTriangle className="mx-auto mb-1 text-amber-600" size={20} /><div className="text-2xl font-bold">{report.alertAperti}</div><div className="text-xs text-slate-500">alert aperti</div></div>
          </div>
          <pre className="whitespace-pre-wrap text-sm bg-white p-3 rounded border mb-4">{report.riepilogo}</pre>
          {report.raccomandazioni.length > 0 && (
            <div className="bg-teal-50 p-3 rounded border border-teal-100">
              <strong className="text-sm text-teal-800">Raccomandazioni:</strong>
              <ul className="list-disc list-inside text-sm mt-1">{report.raccomandazioni.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
