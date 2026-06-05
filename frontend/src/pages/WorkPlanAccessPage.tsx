import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import {
  CheckCircle, LogIn, LogOut, BookOpen, Activity,
  Target, Plus, ChevronDown, ChevronUp, AlertCircle, Trash2, PenLine, Lock,
  Paperclip, FileText, Image, File, ExternalLink, Smartphone
} from 'lucide-react';

interface WorkPlanInfo {
  _id: string; task: string; type: string; category: string;
  date: string; time?: string; notes?: string; status: string;
  patient: { firstName: string; lastName: string };
  staff: { firstName: string; lastName: string; role: string };
}
interface AccessoInfo { _id: string; oraEntrata: string; oraUscita?: string; note?: string; staffName: string; }
interface DiarioEntry {
  _id: string; testo: string; dataRegistrazione: string; staffName: string;
  firmaLogin: string; firmato: boolean; dataFirma?: string;
  parametriVitali?: { pressioneSistolica?: number; pressioneDiastolica?: number; frequenzaCardiaca?: number; frequenzaRespiratoria?: number; temperatura?: number; saturazione?: number; glicemia?: number; peso?: number; dolore?: number; };
}
interface AllegatoInfo { _id: string; nomeFile: string; mimeType: string; dimensione: number; descrizione?: string; caricatoDa: string; dataCaricamento: string; urlCloudinary?: string; }
interface Obiettivo {
  _id: string; descrizione: string; stato: 'attivo' | 'raggiunto' | 'parziale' | 'non_raggiunto' | 'rivalutato';
  dataInizio: string; dataRivalutazione?: string; createdBy: string;
  valutazioni: Array<{ _id: string; data: string; stato: string; note?: string; valutatoDa: string; }>;
}

const statoObiettivoConfig: Record<string, { label: string; color: string; bg: string }> = {
  attivo:        { label: 'Attivo',         color: '#2563eb', bg: '#eff6ff' },
  raggiunto:     { label: 'Raggiunto ✓',    color: '#16a34a', bg: '#f0fdf4' },
  parziale:      { label: 'Parzialmente',   color: '#d97706', bg: '#fefce8' },
  non_raggiunto: { label: 'Non raggiunto',  color: '#dc2626', bg: '#fef2f2' },
  rivalutato:    { label: 'Rivalutato 🔄',  color: '#7c3aed', bg: '#fdf4ff' },
};

// Assicura che API_BASE termini sempre con /api
const _rawBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const API_BASE = _rawBase.endsWith('/api') ? _rawBase : _rawBase.replace(/\/$/, '') + '/api';

export default function WorkPlanAccessPage() {
  const { workPlanId } = useParams<{ workPlanId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [now, setNow] = useState(new Date());
  const [workPlan, setWorkPlan] = useState<WorkPlanInfo | null>(null);
  const [accessoCorrente, setAccessoCorrente] = useState<AccessoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Diario
  const [diario, setDiario] = useState<DiarioEntry[]>([]);
  const [showDiario, setShowDiario] = useState(false);
  const [testoDiario, setTestoDiario] = useState('');
  const [showParametri, setShowParametri] = useState(false);
  const [parametri, setParametri] = useState({ pressioneSistolica: '', pressioneDiastolica: '', frequenzaCardiaca: '', frequenzaRespiratoria: '', temperatura: '', saturazione: '', glicemia: '', peso: '', dolore: '' });

  // Allegati
  const [allegati, setAllegati] = useState<AllegatoInfo[]>([]);
  const [showAllegati, setShowAllegati] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDescrizione, setUploadDescrizione] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);

  // Obiettivi
  const [obiettivi, setObiettivi] = useState<Obiettivo[]>([]);
  const [showObiettivi, setShowObiettivi] = useState(false);
  const [valutazioneObiettivo, setValutazioneObiettivo] = useState<{ id: string; stato: string; note: string; dataRivalutazione: string } | null>(null);
  const [nuovoObiettivo, setNuovoObiettivo] = useState('');
  const [nuovaDataRivalutazione, setNuovaDataRivalutazione] = useState('');
  const [showNuovoObiettivo, setShowNuovoObiettivo] = useState(false);

  const isAdminOrCoord = user?.role === 'admin' || user?.role === 'coordinator';
  const canDelete = user?.role === 'admin' || user?.role === 'direttore';
  const canDeleteAllegato = user?.role === 'admin' || user?.role === 'direttore' || user?.role === 'coordinator';

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (workPlanId) loadAll(); }, [workPlanId]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [wpRes, diarioRes, obiettiviRes, allegatiRes] = await Promise.all([
        api.get(`/workplan-access/piano/${workPlanId}/info`),
        api.get(`/diario/${workPlanId}`),
        api.get(`/obiettivi/${workPlanId}`),
        api.get(`/allegati/${workPlanId}`),
      ]);
      setWorkPlan(wpRes.data.workPlan);
      setAccessoCorrente(wpRes.data.accessoApertoUtente || null);
      setDiario(diarioRes.data);
      setObiettivi(obiettiviRes.data);
      setAllegati(allegatiRes.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore nel caricamento');
    } finally {
      setLoading(false);
    }
  };

  const registraEntrata = async () => {
    try {
      const res = await api.post(`/workplan-access/${workPlanId}/entrata`);
      setAccessoCorrente(res.data);
      setSuccess('✅ Entrata registrata!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) { setError(err.response?.data?.message || 'Errore entrata'); }
  };

  const registraUscita = async () => {
    if (!accessoCorrente) return;
    try {
      await api.patch(`/workplan-access/${accessoCorrente._id}/uscita`);
      setAccessoCorrente(null);
      setSuccess('✅ Uscita registrata!');
      setTimeout(() => setSuccess(''), 3000);
      await loadAll();
    } catch (err: any) { setError(err.response?.data?.message || 'Errore uscita'); }
  };

  const salvaDiario = async () => {
    if (!testoDiario.trim()) return;
    try {
      const parametriVitali: Record<string, number> = {};
      Object.entries(parametri).forEach(([k, v]) => { if (v !== '') parametriVitali[k] = parseFloat(v); });
      await api.post(`/diario/${workPlanId}`, { testo: testoDiario, parametriVitali: Object.keys(parametriVitali).length > 0 ? parametriVitali : undefined, workPlanAccess: accessoCorrente?._id });
      setTestoDiario('');
      setParametri({ pressioneSistolica: '', pressioneDiastolica: '', frequenzaCardiaca: '', frequenzaRespiratoria: '', temperatura: '', saturazione: '', glicemia: '', peso: '', dolore: '' });
      setShowParametri(false);
      setSuccess('📝 Voce diario salvata!');
      setTimeout(() => setSuccess(''), 3000);
      const res = await api.get(`/diario/${workPlanId}`);
      setDiario(res.data);
    } catch (err: any) { setError(err.response?.data?.message || 'Errore salvataggio diario'); }
  };

  const firmaDiario = async (id: string) => {
    if (!confirm('Firmare questa voce? Una volta firmata non sarà più modificabile.')) return;
    try {
      const res = await api.post(`/diario/firma/${id}`);
      setDiario(prev => prev.map(d => d._id === id ? { ...d, firmato: res.data.firmato, dataFirma: res.data.dataFirma, firmaLogin: res.data.firmaLogin } : d));
      setSuccess('✍️ Voce firmata e bloccata!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) { setError(err.response?.data?.message || 'Errore firma'); }
  };

  const eliminaDiario = async (id: string) => {
    if (!confirm('Eliminare questa voce del diario?')) return;
    try {
      await api.delete(`/diario/entry/${id}`);
      setDiario(prev => prev.filter(d => d._id !== id));
    } catch (err: any) { setError(err.response?.data?.message || 'Errore eliminazione'); }
  };

  // Allegati
  const caricaFile = async () => {
    if (!uploadFile) return;
    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      if (uploadDescrizione.trim()) formData.append('descrizione', uploadDescrizione.trim());
      const res = await api.post(`/allegati/${workPlanId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setAllegati(prev => [res.data, ...prev]);
      setUploadFile(null);
      setUploadDescrizione('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSuccess('📎 File allegato con successo!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) { setError(err.response?.data?.message || 'Errore caricamento file'); }
    finally { setUploadLoading(false); }
  };

  const eliminaAllegato = async (id: string) => {
    if (!confirm('Eliminare questo allegato?')) return;
    try {
      await api.delete(`/allegati/${id}`);
      setAllegati(prev => prev.filter(a => a._id !== id));
    } catch (err: any) { setError(err.response?.data?.message || 'Errore eliminazione allegato'); }
  };

  const apriAllegato = (allegato: AllegatoInfo) => {
    // Se l'allegato è su Cloudinary, apri direttamente l'URL (nessun token necessario)
    if (allegato.urlCloudinary) {
      window.open(allegato.urlCloudinary, '_blank');
      return;
    }
    // Fallback: usa l'endpoint backend con token (storage locale)
    const token = localStorage.getItem('authToken');
    if (!token) {
      alert('Sessione scaduta. Effettua nuovamente il login.');
      return;
    }
    window.open(`${API_BASE}/allegati/file/${allegato._id}?token=${encodeURIComponent(token)}`, '_blank');
  };

  const formatDimensione = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image size={16} color="#0284c7" />;
    if (mimeType === 'application/pdf') return <FileText size={16} color="#dc2626" />;
    return <File size={16} color="#6b7280" />;
  };

  // Obiettivi
  const valutaObiettivo = async () => {
    if (!valutazioneObiettivo) return;
    try {
      await api.post(`/obiettivi/valuta/${valutazioneObiettivo.id}`, { stato: valutazioneObiettivo.stato, note: valutazioneObiettivo.note, dataRivalutazione: valutazioneObiettivo.dataRivalutazione || undefined });
      setValutazioneObiettivo(null);
      setSuccess('🎯 Obiettivo valutato!');
      setTimeout(() => setSuccess(''), 3000);
      const res = await api.get(`/obiettivi/${workPlanId}`);
      setObiettivi(res.data);
    } catch (err: any) { setError(err.response?.data?.message || 'Errore valutazione'); }
  };

  const aggiungiObiettivo = async () => {
    if (!nuovoObiettivo.trim()) return;
    try {
      await api.post(`/obiettivi/${workPlanId}`, { descrizione: nuovoObiettivo, dataRivalutazione: nuovaDataRivalutazione || undefined });
      setNuovoObiettivo(''); setNuovaDataRivalutazione(''); setShowNuovoObiettivo(false);
      setSuccess('🎯 Obiettivo aggiunto!');
      setTimeout(() => setSuccess(''), 3000);
      const res = await api.get(`/obiettivi/${workPlanId}`);
      setObiettivi(res.data);
    } catch (err: any) { setError(err.response?.data?.message || 'Errore aggiunta obiettivo'); }
  };

  const formatOra = (d: string) => new Date(d).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const formatDataOra = (d: string) => new Date(d).toLocaleString('it-IT');
  const calcolaDurata = (e: string, u?: string) => {
    const min = Math.round(((u ? new Date(u) : new Date()).getTime() - new Date(e).getTime()) / 60000);
    return min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}min` : `${min}min`;
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '16px' }}><div style={{ fontSize: '2rem' }}>⏳</div><p style={{ color: '#666' }}>Caricamento...</p></div>;
  if (!workPlan) return <div style={{ padding: '32px', textAlign: 'center' }}><AlertCircle size={48} color="#dc2626" /><p style={{ color: '#dc2626', marginTop: '16px' }}>Piano di lavoro non trovato.</p></div>;

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '20px 16px', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ backgroundColor: '#1e40af', color: 'white', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '4px' }}>Piano di lavoro</div>
            <h2 style={{ margin: '0 0 4px', fontSize: '1.2rem' }}>{workPlan.task}</h2>
            <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>👤 {workPlan.patient.firstName} {workPlan.patient.lastName}</div>
            <div style={{ fontSize: '0.82rem', opacity: 0.75, marginTop: '2px' }}>🏥 {workPlan.staff.firstName} {workPlan.staff.lastName} — {workPlan.staff.role}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>{now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{now.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' })}</div>
          </div>
        </div>
      </div>

      {/* Messaggi */}
      {success && <div style={{ padding: '12px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#16a34a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle size={18} /> {success}</div>}
      {error && <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertCircle size={18} /> {error}<button type="button" onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>✕</button></div>}

      {/* Accesso in corso */}
      {accessoCorrente && (
        <div style={{ padding: '14px 16px', backgroundColor: '#f0fdf4', border: '2px solid #86efac', borderRadius: '10px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', fontWeight: '600', marginBottom: '4px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#16a34a' }} /> Accesso in corso
          </div>
          <div style={{ fontSize: '0.88rem', color: '#555' }}>Entrata: <strong>{formatOra(accessoCorrente.oraEntrata)}</strong> — Durata: <strong>{calcolaDurata(accessoCorrente.oraEntrata)}</strong></div>
        </div>
      )}

      {/* Pulsante firma touch (ottimizzato tablet/mobile) */}
      <button
        type="button"
        onClick={() => navigate(`/registrazione-accesso/${workPlanId}`)}
        style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '2px solid #2563eb', cursor: 'pointer', backgroundColor: '#eff6ff', color: '#2563eb', fontWeight: '700', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}
      >
        <Smartphone size={18} /> Usa Firma Touch (Tablet/Smartphone)
      </button>

      {/* Pulsanti entrata/uscita rapida (senza firma) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
        <button type="button" onClick={registraEntrata} disabled={!!accessoCorrente} style={{ padding: '16px', borderRadius: '10px', border: 'none', cursor: accessoCorrente ? 'not-allowed' : 'pointer', backgroundColor: accessoCorrente ? '#d1fae5' : '#16a34a', color: 'white', fontWeight: '700', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: accessoCorrente ? 0.6 : 1 }}>
          <LogIn size={20} /> ENTRATA
        </button>
        <button type="button" onClick={registraUscita} disabled={!accessoCorrente} style={{ padding: '16px', borderRadius: '10px', border: 'none', cursor: !accessoCorrente ? 'not-allowed' : 'pointer', backgroundColor: !accessoCorrente ? '#fee2e2' : '#dc2626', color: 'white', fontWeight: '700', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: !accessoCorrente ? 0.6 : 1 }}>
          <LogOut size={20} /> USCITA
        </button>
      </div>

      {/* ===== OBIETTIVI ===== */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', marginBottom: '16px', overflow: 'hidden' }}>
        <button type="button" onClick={() => setShowObiettivi(!showObiettivi)} style={{ width: '100%', padding: '14px 16px', background: '#fdf4ff', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '600', color: '#7c3aed', fontSize: '0.95rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Target size={18} /> Obiettivi ({obiettivi.length})
            {obiettivi.filter(o => o.dataRivalutazione && new Date(o.dataRivalutazione) <= new Date() && o.stato === 'attivo').length > 0 && (
              <span style={{ backgroundColor: '#dc2626', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>
                {obiettivi.filter(o => o.dataRivalutazione && new Date(o.dataRivalutazione) <= new Date() && o.stato === 'attivo').length}
              </span>
            )}
          </span>
          {showObiettivi ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {showObiettivi && (
          <div style={{ padding: '16px' }}>
            {isAdminOrCoord && (
              <div style={{ marginBottom: '16px' }}>
                {!showNuovoObiettivo ? (
                  <button type="button" onClick={() => setShowNuovoObiettivo(true)} style={{ background: '#7c3aed', padding: '8px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '6px', border: 'none', color: 'white', cursor: 'pointer' }}><Plus size={15} /> Nuovo obiettivo</button>
                ) : (
                  <div style={{ padding: '12px', backgroundColor: '#fdf4ff', borderRadius: '8px', border: '1px solid #e9d5ff' }}>
                    <textarea value={nuovoObiettivo} onChange={e => setNuovoObiettivo(e.target.value)} placeholder="Descrivi l'obiettivo..." rows={2} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <label style={{ fontSize: '0.82rem', color: '#666', display: 'flex', alignItems: 'center', gap: '4px' }}>Data rivalutazione: <input type="date" value={nuovaDataRivalutazione} onChange={e => setNuovaDataRivalutazione(e.target.value)} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.82rem' }} /></label>
                      <button type="button" onClick={aggiungiObiettivo} style={{ background: '#7c3aed', padding: '6px 14px', fontSize: '0.85rem', borderRadius: '6px', border: 'none', color: 'white', cursor: 'pointer' }}>Salva</button>
                      <button type="button" onClick={() => setShowNuovoObiettivo(false)} style={{ background: '#6c757d', padding: '6px 14px', fontSize: '0.85rem', borderRadius: '6px', border: 'none', color: 'white', cursor: 'pointer' }}>Annulla</button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {obiettivi.length === 0 ? <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', padding: '16px' }}>Nessun obiettivo definito.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {obiettivi.map(ob => {
                  const cfg = statoObiettivoConfig[ob.stato] || statoObiettivoConfig.attivo;
                  const scaduto = ob.dataRivalutazione && new Date(ob.dataRivalutazione) <= new Date() && ob.stato === 'attivo';
                  return (
                    <div key={ob._id} style={{ padding: '12px', borderRadius: '8px', border: `1px solid ${scaduto ? '#fca5a5' : '#e5e7eb'}`, backgroundColor: scaduto ? '#fff5f5' : '#fafafa' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: '0 0 6px', fontWeight: '600', fontSize: '0.9rem' }}>{ob.descrizione}</p>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', backgroundColor: cfg.bg, color: cfg.color, fontWeight: '600' }}>{cfg.label}</span>
                            {ob.dataRivalutazione && <span style={{ fontSize: '0.75rem', color: scaduto ? '#dc2626' : '#666' }}>🗓️ {new Date(ob.dataRivalutazione).toLocaleDateString('it-IT')}{scaduto && ' ⚠️'}</span>}
                            <span style={{ fontSize: '0.72rem', color: '#999' }}>da {ob.createdBy}</span>
                          </div>
                        </div>
                        <button type="button" onClick={() => setValutazioneObiettivo({ id: ob._id, stato: ob.stato, note: '', dataRivalutazione: '' })} style={{ background: '#7c3aed', padding: '6px 10px', fontSize: '0.78rem', borderRadius: '6px', border: 'none', color: 'white', cursor: 'pointer', whiteSpace: 'nowrap' }}>Valuta</button>
                      </div>
                      {valutazioneObiettivo?.id === ob._id && (
                        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f5f3ff', borderRadius: '6px', border: '1px solid #ddd6fe' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                            <label style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>Stato
                              <select value={valutazioneObiettivo.stato} onChange={e => setValutazioneObiettivo({ ...valutazioneObiettivo, stato: e.target.value })} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.82rem' }}>
                                <option value="attivo">Attivo</option><option value="raggiunto">Raggiunto</option><option value="parziale">Parzialmente raggiunto</option><option value="non_raggiunto">Non raggiunto</option><option value="rivalutato">Rivalutato</option>
                              </select>
                            </label>
                            {valutazioneObiettivo.stato === 'rivalutato' && <label style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>Nuova data<input type="date" value={valutazioneObiettivo.dataRivalutazione} onChange={e => setValutazioneObiettivo({ ...valutazioneObiettivo, dataRivalutazione: e.target.value })} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.82rem' }} /></label>}
                          </div>
                          <textarea value={valutazioneObiettivo.note} onChange={e => setValutazioneObiettivo({ ...valutazioneObiettivo, note: e.target.value })} placeholder="Note..." rows={2} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.82rem', resize: 'vertical', boxSizing: 'border-box', marginBottom: '8px' }} />
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button type="button" onClick={valutaObiettivo} style={{ background: '#7c3aed', padding: '6px 12px', fontSize: '0.82rem', borderRadius: '4px', border: 'none', color: 'white', cursor: 'pointer' }}>Conferma</button>
                            <button type="button" onClick={() => setValutazioneObiettivo(null)} style={{ background: '#6c757d', padding: '6px 12px', fontSize: '0.82rem', borderRadius: '4px', border: 'none', color: 'white', cursor: 'pointer' }}>Annulla</button>
                          </div>
                        </div>
                      )}
                      {ob.valutazioni.length > 0 && (
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                          <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '4px' }}>Storico:</div>
                          {ob.valutazioni.slice(-3).map(v => (
                            <div key={v._id} style={{ fontSize: '0.78rem', color: '#555', padding: '2px 0' }}>
                              <span style={{ color: statoObiettivoConfig[v.stato]?.color || '#666', fontWeight: '600' }}>{statoObiettivoConfig[v.stato]?.label || v.stato}</span>
                              {' — '}{new Date(v.data).toLocaleDateString('it-IT')} da {v.valutatoDa}{v.note && <span style={{ fontStyle: 'italic' }}> — {v.note}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== DIARIO CLINICO ===== */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', marginBottom: '16px', overflow: 'hidden' }}>
        <button type="button" onClick={() => setShowDiario(!showDiario)} style={{ width: '100%', padding: '14px 16px', background: '#f0f9ff', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '600', color: '#0284c7', fontSize: '0.95rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><BookOpen size={18} /> Diario Clinico ({diario.length})</span>
          {showDiario ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {showDiario && (
          <div style={{ padding: '16px' }}>
            <div style={{ marginBottom: '16px', padding: '14px', backgroundColor: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
              <textarea value={testoDiario} onChange={e => setTestoDiario(e.target.value)} placeholder="Descrivi l'intervento, le osservazioni cliniche..." rows={4} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #bae6fd', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box', marginBottom: '10px' }} />
              <button type="button" onClick={() => setShowParametri(!showParametri)} style={{ background: 'none', border: '1px solid #0284c7', color: '#0284c7', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: showParametri ? '12px' : '0' }}>
                <Activity size={14} /> {showParametri ? 'Nascondi parametri vitali' : 'Aggiungi parametri vitali'}
              </button>
              {showParametri && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    {[['pressioneSistolica','P. Sistolica (mmHg)','120'],['pressioneDiastolica','P. Diastolica (mmHg)','80'],['frequenzaCardiaca','Freq. Cardiaca (bpm)','72'],['frequenzaRespiratoria','Freq. Respiratoria (/min)','16'],['temperatura','Temperatura (°C)','36.5'],['saturazione','Saturazione O₂ (%)','98'],['glicemia','Glicemia (mg/dL)','95'],['peso','Peso (kg)','70']].map(([key, label, ph]) => (
                      <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.8rem', color: '#555' }}>{label}
                        <input type="number" step="0.1" value={parametri[key as keyof typeof parametri]} onChange={e => setParametri(prev => ({ ...prev, [key]: e.target.value }))} placeholder={`es. ${ph}`} style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #bae6fd', fontSize: '0.85rem' }} />
                      </label>
                    ))}
                  </div>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.8rem', color: '#555' }}>Dolore (0-10)
                    <input type="range" min="0" max="10" value={parametri.dolore || '0'} onChange={e => setParametri(prev => ({ ...prev, dolore: e.target.value }))} style={{ width: '100%' }} />
                    <span style={{ textAlign: 'center', fontWeight: '600', color: parseInt(parametri.dolore || '0') >= 7 ? '#dc2626' : parseInt(parametri.dolore || '0') >= 4 ? '#d97706' : '#16a34a' }}>{parametri.dolore || '0'}/10</span>
                  </label>
                </div>
              )}
              <button type="button" onClick={salvaDiario} disabled={!testoDiario.trim()} style={{ marginTop: '12px', width: '100%', padding: '12px', backgroundColor: testoDiario.trim() ? '#0284c7' : '#93c5fd', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: testoDiario.trim() ? 'pointer' : 'not-allowed', fontSize: '0.95rem' }}>💾 Salva nel diario clinico</button>
            </div>
            {diario.length === 0 ? <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', padding: '16px' }}>Nessuna voce nel diario.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {diario.map(entry => (
                  <div key={entry._id} style={{ padding: '12px', borderRadius: '8px', border: `1px solid ${entry.firmato ? '#86efac' : '#e5e7eb'}`, backgroundColor: entry.firmato ? '#f0fdf4' : '#fafafa' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div style={{ fontSize: '0.78rem', color: '#888', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        📅 {formatDataOra(entry.dataRegistrazione)} — ✍️ {entry.staffName}
                        {entry.firmato && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', backgroundColor: '#dcfce7', color: '#16a34a', padding: '1px 6px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: '600' }}><Lock size={10} /> Firmato {entry.dataFirma ? new Date(entry.dataFirma).toLocaleDateString('it-IT') : ''}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        {!entry.firmato && <button type="button" onClick={() => firmaDiario(entry._id)} style={{ background: 'none', border: '1px solid #16a34a', cursor: 'pointer', color: '#16a34a', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '3px' }}><PenLine size={12} /> Firma</button>}
                        {canDelete && <button type="button" onClick={() => eliminaDiario(entry._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '2px' }}><Trash2 size={14} /></button>}
                      </div>
                    </div>
                    <p style={{ margin: '0 0 8px', fontSize: '0.9rem', color: '#333', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{entry.testo}</p>
                    {entry.parametriVitali && Object.values(entry.parametriVitali).some(v => v !== undefined && v !== null) && (
                      <div style={{ padding: '8px', backgroundColor: '#f0f9ff', borderRadius: '6px', border: '1px solid #bae6fd' }}>
                        <div style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: '600', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><Activity size={12} /> Parametri vitali</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {entry.parametriVitali.pressioneSistolica && entry.parametriVitali.pressioneDiastolica && <span style={{ fontSize: '0.78rem', backgroundColor: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bae6fd' }}>🩺 {entry.parametriVitali.pressioneSistolica}/{entry.parametriVitali.pressioneDiastolica} mmHg</span>}
                          {entry.parametriVitali.frequenzaCardiaca && <span style={{ fontSize: '0.78rem', backgroundColor: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bae6fd' }}>❤️ {entry.parametriVitali.frequenzaCardiaca} bpm</span>}
                          {entry.parametriVitali.temperatura && <span style={{ fontSize: '0.78rem', backgroundColor: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bae6fd' }}>🌡️ {entry.parametriVitali.temperatura}°C</span>}
                          {entry.parametriVitali.saturazione && <span style={{ fontSize: '0.78rem', backgroundColor: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bae6fd' }}>💨 SpO₂ {entry.parametriVitali.saturazione}%</span>}
                          {entry.parametriVitali.glicemia && <span style={{ fontSize: '0.78rem', backgroundColor: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bae6fd' }}>🩸 {entry.parametriVitali.glicemia} mg/dL</span>}
                          {entry.parametriVitali.peso && <span style={{ fontSize: '0.78rem', backgroundColor: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bae6fd' }}>⚖️ {entry.parametriVitali.peso} kg</span>}
                          {entry.parametriVitali.dolore !== undefined && <span style={{ fontSize: '0.78rem', backgroundColor: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bae6fd', color: entry.parametriVitali.dolore >= 7 ? '#dc2626' : entry.parametriVitali.dolore >= 4 ? '#d97706' : '#16a34a' }}>😣 Dolore: {entry.parametriVitali.dolore}/10</span>}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== ALLEGATI — sempre visibili, integrati nel flusso ===== */}
      <div style={{ border: '2px solid #fed7aa', borderRadius: '10px', marginBottom: '16px', overflow: 'hidden', backgroundColor: '#fffbf7' }}>
        <div style={{ padding: '12px 16px', backgroundColor: '#fff7ed', borderBottom: '1px solid #fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: '700', color: '#c2410c', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Paperclip size={18} /> Allegati cartella ({allegati.length})
          </span>
          <button type="button" onClick={() => setShowAllegati(!showAllegati)} style={{ background: 'none', border: '1px solid #fed7aa', borderRadius: '6px', cursor: 'pointer', color: '#c2410c', padding: '4px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {showAllegati ? <><ChevronUp size={14} /> Nascondi</> : <><ChevronDown size={14} /> Mostra</>}
          </button>
        </div>

        {/* Form upload — sempre visibile */}
        <div style={{ padding: '12px 16px', borderBottom: allegati.length > 0 ? '1px solid #fed7aa' : 'none' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={e => setUploadFile(e.target.files?.[0] || null)} style={{ width: '100%', fontSize: '0.85rem', marginBottom: '6px' }} />
              {uploadFile && <div style={{ fontSize: '0.78rem', color: '#c2410c', marginBottom: '4px' }}>📄 {uploadFile.name} ({formatDimensione(uploadFile.size)})</div>}
              <input type="text" value={uploadDescrizione} onChange={e => setUploadDescrizione(e.target.value)} placeholder="Descrizione allegato (opzionale)..." style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #fed7aa', fontSize: '0.85rem', boxSizing: 'border-box' }} />
            </div>
            <button type="button" onClick={caricaFile} disabled={!uploadFile || uploadLoading} style={{ padding: '10px 16px', backgroundColor: uploadFile && !uploadLoading ? '#c2410c' : '#fdba74', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: uploadFile && !uploadLoading ? 'pointer' : 'not-allowed', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', alignSelf: 'flex-end' }}>
              {uploadLoading ? '⏳' : <><Paperclip size={15} /> Allega</>}
            </button>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#999', marginTop: '4px' }}>Immagini, PDF, Word, Excel, testo — max 20 MB</div>
        </div>

        {/* Lista allegati */}
        {allegati.length > 0 && showAllegati && (
          <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {allegati.map(all => (
              <div key={all._id} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #fed7aa', backgroundColor: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ flexShrink: 0 }}>{getFileIcon(all.mimeType)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{all.nomeFile}</div>
                  <div style={{ fontSize: '0.72rem', color: '#888', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <span>{formatDimensione(all.dimensione)}</span>
                    <span>📅 {new Date(all.dataCaricamento).toLocaleDateString('it-IT')}</span>
                    <span>👤 {all.caricatoDa}</span>
                    {all.descrizione && <span style={{ fontStyle: 'italic' }}>{all.descrizione}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  <button type="button" onClick={() => apriAllegato(all)} style={{ background: '#0284c7', border: 'none', cursor: 'pointer', color: 'white', padding: '5px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem' }}>
                    <ExternalLink size={12} /> Apri
                  </button>
                  {canDeleteAllegato && <button type="button" onClick={() => eliminaAllegato(all._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '5px' }}><Trash2 size={13} /></button>}
                </div>
              </div>
            ))}
          </div>
        )}
        {allegati.length > 0 && !showAllegati && (
          <div style={{ padding: '8px 16px', fontSize: '0.8rem', color: '#c2410c' }}>
            {allegati.length} allegato{allegati.length > 1 ? 'i' : ''} presente{allegati.length > 1 ? 'i' : ''} — clicca "Mostra" per visualizzarli
          </div>
        )}
      </div>

      {/* Note piano */}
      {workPlan.notes && (
        <div style={{ padding: '12px 16px', backgroundColor: '#fefce8', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '0.88rem', color: '#92400e' }}>
          📋 <strong>Note:</strong> {workPlan.notes}
        </div>
      )}
    </div>
  );
}
