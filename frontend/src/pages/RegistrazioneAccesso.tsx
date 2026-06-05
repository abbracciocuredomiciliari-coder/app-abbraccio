import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import FirmaCanvas from '../components/FirmaCanvas';
import {
  LogIn, LogOut, CheckCircle, AlertCircle, Loader2,
  User, Clock, MapPin, PenLine, Heart
} from 'lucide-react';

interface WorkPlanInfo {
  _id: string;
  task: string;
  type: string;
  status: string;
  patient: { firstName: string; lastName: string; address?: string };
}

interface AccessoInfo {
  _id: string;
  oraEntrata: string;
  oraUscita?: string;
  firmaOperatore?: string;
  firmaPaziente?: string;
  nomeFirmatarioPaziente?: string;
  staffName: string;
}

type Step = 'selezione' | 'firma-operatore-entrata' | 'conferma-entrata' | 'accesso-attivo' | 'firma-operatore-uscita' | 'firma-paziente' | 'riepilogo';

export default function RegistrazioneAccesso() {
  const { workPlanId } = useParams<{ workPlanId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('selezione');
  const [workPlan, setWorkPlan] = useState<WorkPlanInfo | null>(null);
  const [accessoAperto, setAccessoAperto] = useState<AccessoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [firmaOperatore, setFirmaOperatore] = useState('');
  const [firmaPaziente, setFirmaPaziente] = useState('');
  const [nomeFirmatario, setNomeFirmatario] = useState('');
  const [ruoloFirmatario, setRuoloFirmatario] = useState<'paziente' | 'caregiver'>('paziente');
  const [note, setNote] = useState('');
  const [oraNow, setOraNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setOraNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (workPlanId) loadData();
  }, [workPlanId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/workplan-access/piano/${workPlanId}/info`);
      setWorkPlan(res.data.workPlan);
      setAccessoAperto(res.data.accessoApertoUtente || null);
      setStep(res.data.accessoApertoUtente ? 'accesso-attivo' : 'selezione');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore caricamento dati');
    } finally {
      setLoading(false);
    }
  };

  const registraEntrata = async () => {
    try {
      setLoading(true);
      const res = await api.post(`/workplan-access/${workPlanId}/entrata`, {
        note: note || undefined,
        firmaOperatore: firmaOperatore || undefined,
      });
      setAccessoAperto(res.data.accesso);
      setStep('conferma-entrata');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore registrazione entrata');
    } finally {
      setLoading(false);
    }
  };

  const registraUscita = async () => {
    if (!accessoAperto) return;
    try {
      setLoading(true);
      await api.patch(`/workplan-access/${accessoAperto._id}/uscita`, {
        note: note || undefined,
        firmaPaziente: firmaPaziente || undefined,
        nomeFirmatarioPaziente: nomeFirmatario || undefined,
        ruoloFirmatario,
      });
      setStep('riepilogo');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore registrazione uscita');
    } finally {
      setLoading(false);
    }
  };

  const durataAccesso = (): string => {
    if (!accessoAperto?.oraEntrata) return '';
    const diff = oraNow.getTime() - new Date(accessoAperto.oraEntrata).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h > 0 ? `${h}h ` : ''}${m}min`;
  };

  if (loading && step === 'selezione') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4ff' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={48} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
          <p style={{ marginTop: '16px', color: '#6b7280' }}>Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)', padding: '0', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Heart size={24} color="#60a5fa" />
            <span style={{ color: 'white', fontWeight: '700', fontSize: '1.1rem' }}>Abbraccio</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#93c5fd', fontSize: '0.85rem' }}>{user?.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>
              {oraNow.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '20px', maxWidth: '600px', margin: '0 auto', width: '100%' }}>

        {/* Info paziente */}
        {workPlan && (
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <User size={20} color="#60a5fa" />
              <span style={{ color: 'white', fontWeight: '600', fontSize: '1.1rem' }}>
                {workPlan.patient.firstName} {workPlan.patient.lastName}
              </span>
            </div>
            {workPlan.patient.address && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#93c5fd', fontSize: '0.9rem' }}>
                <MapPin size={14} />
                {workPlan.patient.address}
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ background: '#fee2e2', border: '1px solid #ef4444', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626' }}>
            <AlertCircle size={18} />
            {error}
            <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>✕</button>
          </div>
        )}

        {/* === STEP: SELEZIONE === */}
        {step === 'selezione' && (
          <div>
            <h2 style={{ color: 'white', textAlign: 'center', marginBottom: '8px', fontSize: '1.4rem' }}>Registra Accesso</h2>
            <p style={{ color: '#93c5fd', textAlign: 'center', marginBottom: '32px', fontSize: '0.95rem' }}>
              {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>

            <button
              onClick={() => setStep('firma-operatore-entrata')}
              style={{ width: '100%', background: 'linear-gradient(135deg, #16a34a, #15803d)', color: 'white', border: 'none', borderRadius: '16px', padding: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', fontSize: '1.1rem', fontWeight: '600' }}
            >
              <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '12px', padding: '12px' }}>
                <LogIn size={28} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div>Registra Entrata</div>
                <div style={{ fontWeight: '400', fontSize: '0.85rem', opacity: 0.85, marginTop: '2px' }}>Inizio visita domiciliare</div>
              </div>
            </button>

            <button
              onClick={() => navigate(-1)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', color: '#93c5fd', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '16px', padding: '16px', cursor: 'pointer', fontSize: '0.95rem' }}
            >
              ← Torna indietro
            </button>
          </div>
        )}

        {/* === STEP: FIRMA OPERATORE ENTRATA === */}
        {step === 'firma-operatore-entrata' && (
          <div style={{ background: 'white', borderRadius: '20px', padding: '24px' }}>
            <h2 style={{ color: '#1e3a5f', marginBottom: '6px', fontSize: '1.3rem' }}>
              <PenLine size={20} style={{ display: 'inline', marginRight: '8px' }} />
              Firma Operatore
            </h2>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '24px' }}>
              Firma per registrare la tua entrata — {new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </p>

            <FirmaCanvas
              label="Firma dell'Operatore"
              sublabel={`${user?.name} — ${new Date().toLocaleDateString('it-IT')}`}
              onFirmaCompleta={(firma) => setFirmaOperatore(firma)}
              onCancella={() => setFirmaOperatore('')}
              altezza={180}
            />

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Note (opzionale)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note sull'accesso..."
                rows={2}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', resize: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setStep('selezione')} style={{ flex: 1, background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '10px', padding: '14px', cursor: 'pointer', fontWeight: '600' }}>
                ← Indietro
              </button>
              <button
                onClick={registraEntrata}
                disabled={loading}
                style={{ flex: 2, background: '#16a34a', color: 'white', border: 'none', borderRadius: '10px', padding: '14px', cursor: 'pointer', fontWeight: '600', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <LogIn size={18} />}
                Registra Entrata
              </button>
            </div>
          </div>
        )}

        {/* === STEP: CONFERMA ENTRATA === */}
        {step === 'conferma-entrata' && (
          <div style={{ background: 'white', borderRadius: '20px', padding: '32px', textAlign: 'center' }}>
            <CheckCircle size={64} color="#16a34a" style={{ marginBottom: '16px' }} />
            <h2 style={{ color: '#1e3a5f', marginBottom: '8px' }}>Entrata Registrata!</h2>
            <p style={{ color: '#6b7280', marginBottom: '8px' }}>
              {new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p style={{ color: '#374151', marginBottom: '32px' }}>
              Visita iniziata con <strong>{workPlan?.patient.firstName} {workPlan?.patient.lastName}</strong>
            </p>
            <button
              onClick={() => { setStep('accesso-attivo'); setNote(''); }}
              style={{ width: '100%', background: '#2563eb', color: 'white', border: 'none', borderRadius: '12px', padding: '16px', cursor: 'pointer', fontWeight: '600', fontSize: '1rem' }}
            >
              OK, capito →
            </button>
          </div>
        )}

        {/* === STEP: ACCESSO ATTIVO === */}
        {step === 'accesso-attivo' && accessoAperto && (
          <div>
            <div style={{ background: 'rgba(22, 163, 74, 0.15)', border: '1px solid rgba(22, 163, 74, 0.4)', borderRadius: '16px', padding: '20px', marginBottom: '20px', textAlign: 'center' }}>
              <CheckCircle size={32} color="#4ade80" style={{ marginBottom: '8px' }} />
              <div style={{ color: '#4ade80', fontWeight: '700', fontSize: '1.1rem', marginBottom: '4px' }}>Accesso Attivo</div>
              <div style={{ color: 'white', fontSize: '1.4rem', fontWeight: '700' }}>
                <Clock size={18} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                {durataAccesso()}
              </div>
              <div style={{ color: '#93c5fd', fontSize: '0.85rem', marginTop: '4px' }}>
                Entrata: {new Date(accessoAperto.oraEntrata).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <button
              onClick={() => { setNote(''); setStep('firma-operatore-uscita'); }}
              style={{ width: '100%', background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: 'white', border: 'none', borderRadius: '16px', padding: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px', fontSize: '1.1rem', fontWeight: '600' }}
            >
              <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '12px', padding: '12px' }}>
                <LogOut size={28} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div>Registra Uscita</div>
                <div style={{ fontWeight: '400', fontSize: '0.85rem', opacity: 0.85, marginTop: '2px' }}>Fine visita + firma paziente</div>
              </div>
            </button>
          </div>
        )}

        {/* === STEP: FIRMA OPERATORE USCITA === */}
        {step === 'firma-operatore-uscita' && (
          <div style={{ background: 'white', borderRadius: '20px', padding: '24px' }}>
            <h2 style={{ color: '#1e3a5f', marginBottom: '6px', fontSize: '1.3rem' }}>
              <PenLine size={20} style={{ display: 'inline', marginRight: '8px' }} />
              Firma Operatore — Uscita
            </h2>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '24px' }}>
              Firma per confermare la fine della visita
            </p>

            <FirmaCanvas
              label="Firma dell'Operatore"
              sublabel={`${user?.name} — Uscita ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`}
              onFirmaCompleta={(firma) => setFirmaOperatore(firma)}
              onCancella={() => setFirmaOperatore('')}
              altezza={180}
            />

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Note visita (opzionale)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note sulla visita..."
                rows={2}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', resize: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setStep('accesso-attivo')} style={{ flex: 1, background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '10px', padding: '14px', cursor: 'pointer', fontWeight: '600' }}>
                ← Indietro
              </button>
              <button
                onClick={() => setStep('firma-paziente')}
                style={{ flex: 2, background: '#2563eb', color: 'white', border: 'none', borderRadius: '10px', padding: '14px', cursor: 'pointer', fontWeight: '600', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                Avanti → Firma Paziente
              </button>
            </div>
          </div>
        )}

        {/* === STEP: FIRMA PAZIENTE/CAREGIVER === */}
        {step === 'firma-paziente' && (
          <div style={{ background: 'white', borderRadius: '20px', padding: '24px' }}>
            <h2 style={{ color: '#1e3a5f', marginBottom: '6px', fontSize: '1.3rem' }}>
              <User size={20} style={{ display: 'inline', marginRight: '8px' }} />
              Firma Paziente / Caregiver
            </h2>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '20px' }}>
              Consegnare il tablet al paziente o caregiver per la firma di conferma della visita
            </p>

            {/* Selezione ruolo firmatario */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Chi firma?</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {(['paziente', 'caregiver'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRuoloFirmatario(r)}
                    style={{
                      flex: 1, padding: '12px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.95rem',
                      background: ruoloFirmatario === r ? '#1e3a5f' : '#f3f4f6',
                      color: ruoloFirmatario === r ? 'white' : '#374151',
                      border: `2px solid ${ruoloFirmatario === r ? '#1e3a5f' : '#d1d5db'}`,
                    }}
                  >
                    {r === 'paziente' ? '🧑‍🦳 Paziente' : '👨‍👩‍👧 Caregiver'}
                  </button>
                ))}
              </div>
            </div>

            {/* Nome firmatario */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Nome del firmatario</label>
              <input
                type="text"
                value={nomeFirmatario}
                onChange={(e) => setNomeFirmatario(e.target.value)}
                placeholder={ruoloFirmatario === 'paziente' ? `${workPlan?.patient.firstName} ${workPlan?.patient.lastName}` : 'Nome del caregiver'}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '1rem', boxSizing: 'border-box' }}
              />
            </div>

            <FirmaCanvas
              label={`Firma del ${ruoloFirmatario === 'paziente' ? 'Paziente' : 'Caregiver'}`}
              sublabel="Firma per confermare la visita ricevuta"
              onFirmaCompleta={(firma) => setFirmaPaziente(firma)}
              onCancella={() => setFirmaPaziente('')}
              altezza={180}
            />

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setStep('firma-operatore-uscita')} style={{ flex: 1, background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '10px', padding: '14px', cursor: 'pointer', fontWeight: '600' }}>
                ← Indietro
              </button>
              <button
                onClick={registraUscita}
                disabled={loading}
                style={{ flex: 2, background: '#dc2626', color: 'white', border: 'none', borderRadius: '10px', padding: '14px', cursor: 'pointer', fontWeight: '600', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <LogOut size={18} />}
                Conferma Uscita
              </button>
            </div>

            <p style={{ color: '#9ca3af', fontSize: '0.8rem', textAlign: 'center', marginTop: '12px' }}>
              La firma del paziente è opzionale ma consigliata per la tracciabilità
            </p>
          </div>
        )}

        {/* === STEP: RIEPILOGO === */}
        {step === 'riepilogo' && (
          <div style={{ background: 'white', borderRadius: '20px', padding: '32px', textAlign: 'center' }}>
            <CheckCircle size={64} color="#16a34a" style={{ marginBottom: '16px' }} />
            <h2 style={{ color: '#1e3a5f', marginBottom: '8px', fontSize: '1.4rem' }}>Visita Completata!</h2>
            <p style={{ color: '#374151', marginBottom: '8px' }}>
              Accesso a <strong>{workPlan?.patient.firstName} {workPlan?.patient.lastName}</strong> registrato correttamente.
            </p>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '8px' }}>
              {firmaPaziente
                ? `✅ Firma ${ruoloFirmatario} raccolta`
                : '⚠️ Firma paziente non raccolta'}
            </p>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '32px' }}>
              {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>

            <button
              onClick={() => navigate(-1)}
              style={{ width: '100%', background: '#2563eb', color: 'white', border: 'none', borderRadius: '12px', padding: '16px', cursor: 'pointer', fontWeight: '600', fontSize: '1rem' }}
            >
              ← Torna al piano di lavoro
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
