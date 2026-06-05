import { useEffect, useState } from 'react';
import api from '../api/api';
import { Eye, EyeOff, Lock, MapPin, Save, X } from 'lucide-react';

interface StaffDoc {
  _id: string;
  name: string;
  url: string;
  tipo?: string;
  createdAt: string;
}

interface StaffProfile {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  category: string;
  phone?: string;
  active: boolean;
  dataInizioCollaborazione?: string;
  dataFineCollaborazione?: string;
  note?: string;
  domicilioPartenza?: string;
  raggioAzioneKm?: number;
  domicilioCoords?: { lat: number; lng: number };
}

const categoriaLabel: Record<string, string> = {
  infermieristico: '🩺 Infermieristico',
  oss: '🤝 OSS',
  riabilitativo: '🏃 Riabilitativo',
  medico: '👨‍⚕️ Medico',
  coordinamento: '📋 Coordinamento',
  direzione: '🏥 Direzione',
};

function formatData(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function ProfiloPersonale() {
  const [profilo, setProfilo] = useState<StaffProfile | null>(null);
  const [documenti, setDocumenti] = useState<StaffDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState('');

  // ── Zona lavorativa ──
  const [editZona, setEditZona] = useState(false);
  const [zonaDomicilio, setZonaDomicilio] = useState('');
  const [zonaRaggio, setZonaRaggio] = useState(10);
  const [geocoding, setGeocoding] = useState(false);
  const [zonaSaving, setZonaSaving] = useState(false);
  const [zonaSuccess, setZonaSuccess] = useState('');
  const [zonaError, setZonaError] = useState('');

  // ── Cambio password ──
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdError, setPwdError] = useState('');

  useEffect(() => {
    fetchProfilo();
  }, []);

  const fetchProfilo = async () => {
    try {
      const res = await api.get('/workplan/mio-profilo-staff');
      setProfilo(res.data);
      setZonaDomicilio(res.data.domicilioPartenza || '');
      setZonaRaggio(res.data.raggioAzioneKm || 10);

      try {
        const docsRes = await api.get(`/staff/${res.data._id}/documents`);
        setDocumenti(docsRes.data || []);
      } catch {
        setDocumenti([]);
      }
    } catch (err: any) {
      setErrore(err?.response?.data?.message || 'Profilo non trovato. Contatta l\'amministratore.');
    } finally {
      setLoading(false);
    }
  };

  const geocodificaIndirizzo = async (indirizzo: string) => {
    if (!indirizzo.trim()) return null;
    setGeocoding(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(indirizzo)}&limit=1&countrycodes=it`;
      const r = await fetch(url, { headers: { 'Accept-Language': 'it' } });
      const data = await r.json();
      if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      return null;
    } catch {
      return null;
    } finally {
      setGeocoding(false);
    }
  };

  const salvaZona = async () => {
    if (!profilo) return;
    setZonaError('');
    setZonaSuccess('');
    setZonaSaving(true);
    try {
      const coords = await geocodificaIndirizzo(zonaDomicilio);
      await api.put(`/staff/${profilo._id}`, {
        domicilioPartenza: zonaDomicilio.trim(),
        raggioAzioneKm: zonaRaggio,
        ...(coords ? { domicilioCoords: coords } : {}),
      });
      setProfilo(prev => prev ? { ...prev, domicilioPartenza: zonaDomicilio.trim(), raggioAzioneKm: zonaRaggio, domicilioCoords: coords || prev.domicilioCoords } : prev);
      setZonaSuccess('Zona lavorativa aggiornata con successo.');
      setEditZona(false);
    } catch (err: any) {
      setZonaError(err?.response?.data?.message || 'Errore nel salvataggio della zona.');
    } finally {
      setZonaSaving(false);
    }
  };

  const cambiaPassword = async () => {
    setPwdError('');
    setPwdSuccess('');
    if (newPassword !== confirmPassword) {
      setPwdError('Le password non coincidono.');
      return;
    }
    setPwdLoading(true);
    try {
      const res = await api.patch('/auth/change-password', { oldPassword, newPassword });
      setPwdSuccess(res.data.message);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwdError(err?.response?.data?.message || 'Errore nel cambio password.');
    } finally {
      setPwdLoading(false);
    }
  };

  if (loading) return <section><p>Caricamento profilo...</p></section>;

  if (errore) {
    return (
      <section>
        <h2>👤 Il mio profilo</h2>
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid #f59e0b', borderRadius: '8px', padding: '20px', color: '#92400e' }}>
          ⚠️ {errore}
        </div>
      </section>
    );
  }

  if (!profilo) return null;

  return (
    <section>
      <h2>👤 Il mio profilo</h2>
      <p style={{ color: 'var(--gray-500)', marginBottom: '24px', fontSize: '0.95rem' }}>
        Visualizza i tuoi dati personali, il contratto e i documenti allegati.
      </p>

      {/* Stato attivo/inattivo */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 16px',
        borderRadius: '20px',
        marginBottom: '24px',
        background: profilo.active ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.1)',
        border: `1px solid ${profilo.active ? '#059669' : '#dc2626'}`,
        color: profilo.active ? '#065f46' : '#7f1d1d',
        fontWeight: '700',
        fontSize: '0.9rem',
      }}>
        {profilo.active ? '✅ Collaborazione attiva' : '❌ Collaborazione terminata'}
      </div>

      {/* Dati anagrafici */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 16px', color: '#1e4d8c', fontSize: '1rem' }}>📋 Dati personali</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Nome completo</div>
            <div style={{ fontWeight: '600', color: '#374151' }}>{profilo.firstName} {profilo.lastName}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Email</div>
            <div style={{ fontWeight: '600', color: '#374151' }}>{profilo.email}</div>
          </div>
          {profilo.phone && (
            <div>
              <div style={{ fontSize: '0.78rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Telefono</div>
              <div style={{ fontWeight: '600', color: '#374151' }}>{profilo.phone}</div>
            </div>
          )}
          <div>
            <div style={{ fontSize: '0.78rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Figura professionale</div>
            <div style={{ fontWeight: '600', color: '#374151' }}>{profilo.role}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Categoria</div>
            <div style={{ fontWeight: '600', color: '#374151' }}>{categoriaLabel[profilo.category] || profilo.category}</div>
          </div>
        </div>
      </div>

      {/* Periodo collaborazione */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 16px', color: '#1e4d8c', fontSize: '1rem' }}>📅 Periodo di collaborazione</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Data inizio</div>
            <div style={{ fontWeight: '600', color: '#374151' }}>{formatData(profilo.dataInizioCollaborazione)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Data fine</div>
            <div style={{ fontWeight: '600', color: profilo.dataFineCollaborazione ? '#dc2626' : '#059669' }}>
              {profilo.dataFineCollaborazione ? formatData(profilo.dataFineCollaborazione) : 'In corso'}
            </div>
          </div>
        </div>
        {profilo.note && (
          <div style={{ marginTop: '12px', padding: '10px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.9rem', color: '#555' }}>
            📝 {profilo.note}
          </div>
        )}
      </div>

      {/* Zona lavorativa */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, color: '#1e4d8c', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={16} /> Zona lavorativa
          </h3>
          {!editZona && (
            <button type="button" onClick={() => { setEditZona(true); setZonaSuccess(''); setZonaError(''); }}
              style={{ background: 'none', border: '1px solid #1e4d8c', borderRadius: '6px', padding: '4px 12px', color: '#1e4d8c', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
              ✏️ Modifica
            </button>
          )}
        </div>

        {zonaSuccess && <div style={{ background: 'rgba(5,150,105,0.08)', border: '1px solid #6ee7b7', borderRadius: '6px', padding: '10px 14px', color: '#065f46', fontSize: '0.88rem', marginBottom: '12px' }}>✅ {zonaSuccess}</div>}
        {zonaError && <div style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid #fca5a5', borderRadius: '6px', padding: '10px 14px', color: '#7f1d1d', fontSize: '0.88rem', marginBottom: '12px' }}>❌ {zonaError}</div>}

        {!editZona ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Domicilio di partenza</div>
              <div style={{ fontWeight: '600', color: profilo.domicilioPartenza ? '#374151' : '#9ca3af', fontStyle: profilo.domicilioPartenza ? 'normal' : 'italic' }}>
                {profilo.domicilioPartenza || 'Non impostato'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Raggio d'azione</div>
              <div style={{ fontWeight: '600', color: '#374151' }}>{profilo.raggioAzioneKm || 10} km</div>
            </div>
            {profilo.domicilioCoords?.lat && (
              <div>
                <div style={{ fontSize: '0.78rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Coordinate</div>
                <div style={{ fontWeight: '600', color: '#374151', fontSize: '0.85rem' }}>{profilo.domicilioCoords.lat.toFixed(5)}, {profilo.domicilioCoords.lng.toFixed(5)}</div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Indirizzo di partenza</span>
              <input
                type="text"
                value={zonaDomicilio}
                onChange={e => setZonaDomicilio(e.target.value)}
                placeholder="Es: Via Roma 10, Roma"
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem' }}
              />
              <span style={{ fontSize: '0.75rem', color: '#888' }}>L'indirizzo verrà geocodificato automaticamente (Nominatim/OSM)</span>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Raggio d'azione: <strong>{zonaRaggio} km</strong></span>
              <input type="range" min={1} max={100} value={zonaRaggio} onChange={e => setZonaRaggio(Number(e.target.value))} />
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={salvaZona} disabled={zonaSaving || geocoding}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1e4d8c', color: '#fff', border: 'none', borderRadius: '7px', padding: '8px 18px', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem' }}>
                <Save size={15} />
                {geocoding ? 'Geocoding...' : zonaSaving ? 'Salvataggio...' : 'Salva zona'}
              </button>
              <button type="button" onClick={() => { setEditZona(false); setZonaDomicilio(profilo.domicilioPartenza || ''); setZonaRaggio(profilo.raggioAzioneKm || 10); setZonaError(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px solid #d1d5db', borderRadius: '7px', padding: '8px 14px', cursor: 'pointer', color: '#555', fontSize: '0.88rem' }}>
                <X size={14} /> Annulla
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Documenti allegati */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 16px', color: '#1e4d8c', fontSize: '1rem' }}>📎 Documenti e contratto</h3>
        {documenti.length === 0 ? (
          <p style={{ color: '#888', fontStyle: 'italic', margin: 0 }}>Nessun documento allegato. Contatta l'amministratore.</p>
        ) : (
          <div className="document-list">
            <ul>
              {documenti.map(doc => (
                <li key={doc._id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ fontWeight: '600', marginBottom: '2px' }}>📄 {doc.name}</div>
                      <div style={{ fontSize: '0.82rem', color: '#888' }}>
                        {doc.tipo && <span style={{ marginRight: '12px' }}>🏷️ {doc.tipo}</span>}
                        📅 {new Date(doc.createdAt).toLocaleDateString('it-IT')}
                      </div>
                    </div>
                    <a href={doc.url} target="_blank" rel="noopener noreferrer"
                      style={{ background: '#1e4d8c', color: '#fff', padding: '6px 14px', borderRadius: '6px', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '600' }}>
                      👁️ Visualizza
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Cambio password */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px' }}>
        <h3 style={{ margin: '0 0 16px', color: '#1e4d8c', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Lock size={16} /> Cambia password
        </h3>

        {pwdSuccess && <div style={{ background: 'rgba(5,150,105,0.08)', border: '1px solid #6ee7b7', borderRadius: '6px', padding: '10px 14px', color: '#065f46', fontSize: '0.88rem', marginBottom: '14px' }}>✅ {pwdSuccess}</div>}
        {pwdError && <div style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid #fca5a5', borderRadius: '6px', padding: '10px 14px', color: '#7f1d1d', fontSize: '0.88rem', marginBottom: '14px' }}>❌ {pwdError}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '400px' }}>
          {/* Vecchia password */}
          {[
            { label: 'Password attuale', value: oldPassword, setter: setOldPassword, show: showOld, toggle: () => setShowOld(v => !v) },
            { label: 'Nuova password', value: newPassword, setter: setNewPassword, show: showNew, toggle: () => setShowNew(v => !v), hint: 'Min. 8 caratteri, almeno 1 lettera e 1 numero' },
            { label: 'Conferma nuova password', value: confirmPassword, setter: setConfirmPassword, show: showConfirm, toggle: () => setShowConfirm(v => !v) },
          ].map(({ label, value, setter, show, toggle, hint }) => (
            <label key={label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>{label}</span>
              <div style={{ position: 'relative' }}>
                <input
                  type={show ? 'text' : 'password'}
                  value={value}
                  onChange={e => setter(e.target.value)}
                  placeholder="••••••••"
                  style={{ padding: '8px 40px 8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem', width: '100%', boxSizing: 'border-box' }}
                />
                <button type="button" onClick={toggle}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '2px' }}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {hint && <span style={{ fontSize: '0.73rem', color: '#888' }}>{hint}</span>}
              {label === 'Conferma nuova password' && confirmPassword && newPassword !== confirmPassword && (
                <span style={{ fontSize: '0.73rem', color: '#dc2626' }}>Le password non coincidono</span>
              )}
            </label>
          ))}

          <button
            type="button"
            onClick={cambiaPassword}
            disabled={pwdLoading || !oldPassword || !newPassword || newPassword !== confirmPassword}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start',
              background: (!oldPassword || !newPassword || newPassword !== confirmPassword) ? '#e5e7eb' : '#1e4d8c',
              color: (!oldPassword || !newPassword || newPassword !== confirmPassword) ? '#9ca3af' : '#fff',
              border: 'none', borderRadius: '7px', padding: '9px 20px',
              cursor: pwdLoading || !oldPassword || !newPassword || newPassword !== confirmPassword ? 'not-allowed' : 'pointer',
              fontWeight: 700, fontSize: '0.88rem',
            }}
          >
            <Lock size={15} />
            {pwdLoading ? 'Salvataggio...' : 'Aggiorna password'}
          </button>
        </div>
      </div>
    </section>
  );
}
