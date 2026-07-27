import { useEffect, useMemo, useState } from 'react';
import api from '../api/api';
import { useToast } from '../hooks/useToast';
import { AlertTriangle, Bell, CheckCircle, Clock, Loader2, RefreshCw, Shield, User, UserCheck, XCircle, ArrowUpCircle } from 'lucide-react';

type Alert = {
  _id: string;
  pazienteId: string;
  pazienteNome: string;
  tipo: string;
  priorita: 'bassa' | 'media' | 'alta' | 'critica';
  stato: 'aperto' | 'in_carico' | 'risolto' | 'evaso' | 'chiuso';
  messaggio: string;
  dettagli?: string;
  parametroId?: string;
  dispositivoId?: string;
  teleconsultoId?: string;
  assegnatoA?: string;
  assegnatoANome?: string;
  inCaricoIl?: string;
  risoltoIl?: string;
  slaMinuti?: number;
  slaScadenza?: string;
  escalationLevel: number;
  inRitardo?: boolean;
  createdAt: string;
  azioni?: { data: string; autore: string; nota: string }[];
  storicoAssegnazioni?: { data: string; assegnatoA?: string; assegnatoANome?: string; autore: string; nota?: string }[];
};

type Staff = { userId: string; firstName: string; lastName: string; category?: string; };

const prioritaOrdine: Record<string, number> = { critica: 4, alta: 3, media: 2, bassa: 1 };

function tempoRimanente(scadenza?: string) {
  if (!scadenza) return '';
  const diff = new Date(scadenza).getTime() - Date.now();
  if (diff <= 0) return 'Scaduto';
  const m = Math.ceil(diff / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export default function TelemedicinaCentrale() {
  const { addToast } = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState({ aperti: 0, inCarico: 0, critici: 0, scaduti: 0 });
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ priorita: '', stato: '', assegnatoA: '', scaduto: false });
  const [nota, setNota] = useState<Record<string, string>>({});
  const [assegnazione, setAssegnazione] = useState<Record<string, string>>({});

  const carica = async () => {
    try {
      setLoading(true);
      const [res, staffRes] = await Promise.all([
        api.get('/telemedicina/centrale', { params: { ...filters, scaduto: filters.scaduto ? 'true' : '' } }),
        api.get('/staff'),
      ]);
      setSummary(res.data.summary);
      setAlerts(res.data.alerts);
      setStaff((staffRes.data || []).filter((s: Staff) => s.userId));
    } catch {
      addToast('Errore caricamento centrale', 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { carica(); }, [filters]);

  const applicaFiltro = (k: string, v: any) => setFilters(s => ({ ...s, [k]: v }));

  const azione = async (id: string, body: any) => {
    try {
      await api.patch(`/telemedicina/alert/${id}/azione`, body);
      addToast('Aggiornato', 'success');
      await carica();
    } catch {
      addToast('Errore aggiornamento alert', 'error');
    }
  };

  const assegna = (alert: Alert) => {
    const userId = assegnazione[alert._id];
    if (!userId) return;
    const s = staff.find(x => x.userId === userId);
    azione(alert._id, { assegnaA: userId, assegnaANome: s ? `${s.firstName} ${s.lastName}`.trim() : userId, nota: nota[alert._id] || 'Presa in carico' });
  };

  const chiudi = (alert: Alert) => azione(alert._id, { stato: 'chiuso', nota: nota[alert._id] || 'Chiusura' });
  const risolvi = (alert: Alert) => azione(alert._id, { stato: 'risolto', nota: nota[alert._id] || 'Risoluzione' });
  const evasa = (alert: Alert) => azione(alert._id, { stato: 'evaso', nota: nota[alert._id] || 'Evasa' });

  const escalate = async (alert: Alert) => {
    try {
      await api.post(`/telemedicina/alert/${alert._id}/escalate`);
      addToast('Escalation effettuata', 'success');
      await carica();
    } catch {
      addToast('Errore escalation', 'error');
    }
  };

  const sortedAlerts = useMemo(() => {
    return [...alerts].sort((a, b) => (prioritaOrdine[b.priorita] || 0) - (prioritaOrdine[a.priorita] || 0) || new Date(a.slaScadenza || 0).getTime() - new Date(b.slaScadenza || 0).getTime());
  }, [alerts]);

  const badgePriorita = (p: string) => {
    const map: Record<string, string> = { critica: 'bg-rose-100 text-rose-800', alta: 'bg-amber-100 text-amber-800', media: 'bg-blue-100 text-blue-800', bassa: 'bg-slate-100 text-slate-800' };
    return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${map[p] || map.bassa}`}>{p}</span>;
  };

  const badgeStato = (s: string) => {
    const map: Record<string, string> = { aperto: 'bg-slate-100 text-slate-800', in_carico: 'bg-blue-100 text-blue-800', risolto: 'bg-emerald-100 text-emerald-800', evaso: 'bg-teal-100 text-teal-800', chiuso: 'bg-slate-100 text-slate-800' };
    return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${map[s] || map.aperto}`}>{s.replace('_', ' ')}</span>;
  };

  if (loading && alerts.length === 0) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-teal-600" /></div>;

  return (
    <div className="bg-white border rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Shield size={20} /> Centrale operativa</h2>
        <button onClick={carica} className="px-3 py-2 bg-teal-600 text-white rounded-lg flex items-center gap-2 text-sm font-medium"><RefreshCw size={16} /> Aggiorna</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-slate-50 border rounded-lg p-3 text-center"><div className="text-2xl font-bold text-slate-700">{summary.aperti}</div><div className="text-xs text-slate-500">Alert aperti</div></div>
        <div className="bg-blue-50 border rounded-lg p-3 text-center"><div className="text-2xl font-bold text-blue-700">{summary.inCarico}</div><div className="text-xs text-slate-500">In carico</div></div>
        <div className="bg-rose-50 border rounded-lg p-3 text-center"><div className="text-2xl font-bold text-rose-700">{summary.critici}</div><div className="text-xs text-slate-500">Critici</div></div>
        <div className="bg-amber-50 border rounded-lg p-3 text-center"><div className="text-2xl font-bold text-amber-700">{summary.scaduti}</div><div className="text-xs text-slate-500">Scaduti SLA</div></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 items-end">
        <div>
          <label className="text-xs text-slate-500">Priorità</label>
          <select value={filters.priorita} onChange={e => applicaFiltro('priorita', e.target.value)} className="w-full border rounded p-2">
            <option value="">Tutte</option><option value="critica">Critica</option><option value="alta">Alta</option><option value="media">Media</option><option value="bassa">Bassa</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Stato</label>
          <select value={filters.stato} onChange={e => applicaFiltro('stato', e.target.value)} className="w-full border rounded p-2">
            <option value="">Tutti</option><option value="aperto">Aperto</option><option value="in_carico">In carico</option><option value="risolto">Risolto</option><option value="chiuso">Chiuso</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Assegnato a</label>
          <select value={filters.assegnatoA} onChange={e => applicaFiltro('assegnatoA', e.target.value)} className="w-full border rounded p-2">
            <option value="">Tutti</option>
            {staff.map(s => <option key={s.userId} value={s.userId}>{s.firstName} {s.lastName} {s.category ? `(${s.category})` : ''}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input id="scaduto" type="checkbox" checked={filters.scaduto} onChange={e => applicaFiltro('scaduto', e.target.checked)} className="w-4 h-4" />
          <label htmlFor="scaduto" className="text-sm text-slate-600">Solo scaduti</label>
        </div>
      </div>

      {sortedAlerts.length === 0 ? (
        <div className="text-center p-12 bg-slate-50 rounded-xl border">
          <Bell className="mx-auto mb-2 text-slate-400" size={40} />
          <p className="text-slate-600">Nessun alert corrisponde ai filtri.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedAlerts.map(a => (
            <div key={a._id} className={`border rounded-lg p-4 ${a.inRitardo ? 'bg-rose-50 border-rose-200' : 'bg-white'}`}>
              <div className="flex justify-between items-start flex-wrap gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {badgePriorita(a.priorita)} {badgeStato(a.stato)}
                    {a.inRitardo && <span className="px-2 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 flex items-center gap-1"><Clock size={12} /> In ritardo</span>}
                    <span className="text-xs text-slate-500 flex items-center gap-1"><Clock size={12} /> SLA: {tempoRimanente(a.slaScadenza)}</span>
                  </div>
                  <h3 className="font-semibold text-base">{a.messaggio}</h3>
                  <p className="text-sm text-slate-500">{a.pazienteNome} · {a.tipo.replace(/_/g, ' ')} · {new Date(a.createdAt).toLocaleString('it-IT')}</p>
                </div>
                <div className="text-right">
                  {a.assegnatoANome ? <div className="text-sm font-medium flex items-center gap-1 justify-end"><UserCheck size={14} /> {a.assegnatoANome}</div> : <div className="text-sm text-slate-500">Non assegnato</div>}
                  {a.escalationLevel > 0 && <div className="text-xs text-amber-600">Escalation liv. {a.escalationLevel}</div>}
                </div>
              </div>

              {a.dettagli && <p className="text-sm text-slate-600 mb-2">{a.dettagli}</p>}

              {(a.storicoAssegnazioni && a.storicoAssegnazioni.length > 0) && (
                <div className="text-xs text-slate-500 mb-2">
                  <strong>Assegnazioni:</strong> {a.storicoAssegnazioni.map((s, i) => <span key={i}>{s.autore} → {s.assegnatoANome || s.assegnatoA} {s.nota ? `(${s.nota})` : ''}; </span>)}
                </div>
              )}

              {(a.azioni && a.azioni.length > 0) && (
                <div className="text-xs text-slate-500 mb-2">
                  <strong>Note:</strong> {a.azioni.slice(-2).map((n, i) => <span key={i}>{n.autore}: {n.nota}; </span>)}
                </div>
              )}

              {a.stato !== 'chiuso' && a.stato !== 'risolto' && (
                <div className="space-y-2 mt-3">
                  <textarea value={nota[a._id] || ''} onChange={e => setNota(s => ({ ...s, [a._id]: e.target.value }))} placeholder="Nota azione" className="w-full border rounded p-2 h-16" />
                  <div className="flex flex-wrap gap-2 items-end">
                    <select value={assegnazione[a._id] || ''} onChange={e => setAssegnazione(s => ({ ...s, [a._id]: e.target.value }))} className="border rounded p-2">
                      <option value="">Assegna operatore</option>
                      {staff.map(s => <option key={s.userId} value={s.userId}>{s.firstName} {s.lastName}</option>)}
                    </select>
                    <button onClick={() => assegna(a)} className="px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium flex items-center gap-1"><User size={14} /> Assegna</button>
                    <button onClick={() => risolvi(a)} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium flex items-center gap-1"><CheckCircle size={14} /> Risolvi</button>
                    <button onClick={() => evasa(a)} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center gap-1"><Bell size={14} /> Evasa</button>
                    <button onClick={() => chiudi(a)} className="px-3 py-2 bg-slate-600 text-white rounded-lg text-sm font-medium flex items-center gap-1"><XCircle size={14} /> Chiudi</button>
                    <button onClick={() => escalate(a)} className="px-3 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium flex items-center gap-1"><ArrowUpCircle size={14} /> Escalation</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
