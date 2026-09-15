import { useState, useCallback, lazy, Suspense } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useModalita } from '../context/ModalitaContext';
import { Search, MapPin, User, CheckCircle, Building2, ClipboardList, ShieldOff } from 'lucide-react';

const MappaZona = lazy(() => import('../components/MappaZona'));

// ─── Tipi ─────────────────────────────────────────────────────────────────────
interface Paziente {
  _id: string;
  firstName: string;
  lastName: string;
  address: string;
  birthDate?: string;
  assistanceNeeds?: string;
  tipoGestione?: string;
  siat?: { asl?: string; npi?: string; tipologiaCura?: string };
  coords?: { lat: number; lng: number };
}

interface OperatoreInZona {
  _id: string;
  firstName: string;
  lastName: string;
  role: string;
  category: string;
  domicilioPartenza?: string;
  domicilioCoords?: { lat: number; lng: number };
  raggioAzioneKm?: number;
  modalitaAbilitata: string;
  distanzaKm: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function geocodificaIndirizzo(indirizzo: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(indirizzo)}&limit=1&countrycodes=it`,
      { headers: { 'Accept-Language': 'it' } }
    );
    const d = await r.json();
    if (d.length > 0) return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
  } catch { /* noop */ }
  return null;
}

const COLORI_CATEGORIA: Record<string, string> = {
  infermieristico: '#0369a1',
  oss: '#7c3aed',
  riabilitativo: '#059669',
  medico: '#dc2626',
  coordinamento: '#d97706',
  direzione: '#374151',
};

const FIGURE_FILTRO = ['infermiere', 'oss', 'fisioterapista', 'badante', 'caregiver', 'medico', 'coordinatore', 'direttore'];

function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}

// ─── Componente ────────────────────────────────────────────────────────────────
export default function AssegnazionePAI() {
  const { user } = useAuth();
  const { isConvenzione, modalita } = useModalita();

  // Ricerca paziente
  const [cercaPaziente, setCercaPaziente] = useState('');
  const [risultatiPazienti, setRisultatiPazienti] = useState<Paziente[]>([]);
  const [pazienteSelezionato, setPazienteSelezionato] = useState<Paziente | null>(null);
  const [geocodingPaziente, setGeocodingPaziente] = useState(false);

  // Operatori in zona
  const [operatoriInZona, setOperatoriInZona] = useState<OperatoreInZona[]>([]);
  const [loadingZona, setLoadingZona] = useState(false);
  const [operatoreSelezionato, setOperatoreSelezionato] = useState<OperatoreInZona | null>(null);

  // Form piano/PAI
  const [showFormPiano, setShowFormPiano] = useState(false);
  const [formPiano, setFormPiano] = useState({
    task: '',
    date: new Date().toISOString().split('T')[0],
    duration: 60,
    tipoCompenso: 'nessuno' as 'nessuno' | 'orario' | 'fisso',
    tariffa: 0,
    tariffaAsl: 0,
    notes: '',
  });
  const [salvandoPiano, setSalvandoPiano] = useState(false);
  const [pianoCreatoMsg, setPianoCreatoMsg] = useState('');

  // Ricerca per indirizzo libero
  const [indirizzo, setIndirizzo] = useState('');
  const [indirizzoCoords, setIndirizzoCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingIndirizzo, setLoadingIndirizzo] = useState(false);

  // Filtro figure professionali
  const [figuraFiltro, setFiguraFiltro] = useState<string[]>([]);

  const isPrivilegiato = user && ['admin', 'coordinator', 'direttore'].includes(user.role);
  const colore = isConvenzione ? '#0369a1' : '#1e4d8c';
  const titoloTipo = isConvenzione ? 'Assegnazione PAI — Convenzione SIAT' : 'Assegnazione Piano di Lavoro — Privato';

  // ─── Cerca pazienti ────────────────────────────────────────────────────────
  const cercaPazienti = useCallback(async () => {
    if (!cercaPaziente.trim()) return;
    try {
      const res = await api.get('/patients', { params: { search: cercaPaziente } });
      const tutti: Paziente[] = res.data || [];
      setRisultatiPazienti(
        tutti.filter(p => isConvenzione
          ? p.tipoGestione === 'convenzione'
          : (p.tipoGestione === 'privato' || !p.tipoGestione)
        )
      );
    } catch { setRisultatiPazienti([]); }
  }, [cercaPaziente, isConvenzione]);

  // ─── Seleziona paziente + geocodifica + cerca operatori ───────────────────
  const selezionaPaziente = async (p: Paziente) => {
    setOperatoriInZona([]);
    setOperatoreSelezionato(null);
    setPianoCreatoMsg('');
    setShowFormPiano(false);

    let coords = p.coords;
    if (!coords && p.address) {
      setGeocodingPaziente(true);
      coords = (await geocodificaIndirizzo(p.address)) ?? undefined;
      setGeocodingPaziente(false);
    }
    const pazConCoords = { ...p, coords };
    setPazienteSelezionato(pazConCoords);

    if (coords) {
      setLoadingZona(true);
      try {
        const res = await api.get('/staff/zona', {
          params: { lat: coords.lat, lng: coords.lng, tipoGestione: isConvenzione ? 'convenzione' : 'privato' }
        });
        setOperatoriInZona(res.data || []);
      } catch { setOperatoriInZona([]); }
      setLoadingZona(false);
    }
  };

  // ─── Cerca operatori per indirizzo libero ────────────────────────────────
  const cercaPerIndirizzo = async () => {
    if (!indirizzo.trim()) return;
    setLoadingIndirizzo(true);
    setPazienteSelezionato(null);
    setOperatoreSelezionato(null);
    setShowFormPiano(false);
    setRisultatiPazienti([]);
    setPianoCreatoMsg('');
    const coords = await geocodificaIndirizzo(indirizzo);
    if (!coords) {
      setLoadingIndirizzo(false);
      setPianoCreatoMsg('❌ Indirizzo non trovato');
      setTimeout(() => setPianoCreatoMsg(''), 3000);
      return;
    }
    setIndirizzoCoords(coords);
    setLoadingZona(true);
    try {
      const res = await api.get('/staff/zona', {
        params: { lat: coords.lat, lng: coords.lng, tipoGestione: isConvenzione ? 'convenzione' : 'privato' },
      });
      setOperatoriInZona(res.data || []);
    } catch { setOperatoriInZona([]); }
    setLoadingZona(false);
    setLoadingIndirizzo(false);
  };

  const toggleFigura = (fig: string) => {
    setFiguraFiltro(prev => prev.includes(fig) ? prev.filter(f => f !== fig) : [...prev, fig]);
  };

  // ─── Crea piano/PAI ────────────────────────────────────────────────────────
  const creaPiano = async () => {
    if (!pazienteSelezionato) return;
    setSalvandoPiano(true);
    try {
      const body: any = {
        patient: pazienteSelezionato._id,
        staff: operatoreSelezionato?._id || undefined,
        task: formPiano.task,
        date: formPiano.date,
        duration: formPiano.duration,
        tipoCompenso: formPiano.tipoCompenso,
        tariffa: formPiano.tariffa,
        tariffaAsl: formPiano.tariffaAsl,
        notes: formPiano.notes,
        status: 'pending',
      };
      await api.post('/workplan', body);
      const opNome = operatoreSelezionato ? `${operatoreSelezionato.firstName} ${operatoreSelezionato.lastName}` : 'nessun operatore';
      setPianoCreatoMsg(`✅ ${isConvenzione ? 'PAI' : 'Piano di lavoro'} creato per ${pazienteSelezionato.firstName} ${pazienteSelezionato.lastName} → ${opNome}`);
      setShowFormPiano(false);
      setOperatoreSelezionato(null);
    } catch (err: any) {
      setPianoCreatoMsg(`❌ Errore: ${err?.response?.data?.message || err.message || 'salvataggio fallito'}`);
    }
    setSalvandoPiano(false);
  };

  // ─── Filtra operatori per figura selezionata ──────────────────────────────
  const operatoriVisualizzati = figuraFiltro.length === 0
    ? operatoriInZona
    : operatoriInZona.filter(op => figuraFiltro.includes(op.role.toLowerCase()));

  // ─── Marker mappa ──────────────────────────────────────────────────────────
  const markersOperatori = operatoriVisualizzati
    .filter(o => o.domicilioCoords?.lat)
    .map(o => ({
      lat: o.domicilioCoords!.lat,
      lng: o.domicilioCoords!.lng,
      label: `${o.firstName} ${o.lastName}`,
      sublabel: `${o.role} — ${o.raggioAzioneKm ?? 10} km`,
      colore: operatoreSelezionato?._id === o._id ? '#dc2626' : (COLORI_CATEGORIA[o.category] || '#059669'),
      distanzaKm: o.distanzaKm,
    }));

  // ─── Guard ruolo ───────────────────────────────────────────────────────────
  if (!isPrivilegiato) {
    return (
      <section>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '16px', color: '#6b7280' }}>
          <ShieldOff size={48} color="#d1d5db" />
          <p style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}>Accesso non autorizzato</p>
          <p style={{ fontSize: '0.88rem', margin: 0, textAlign: 'center' }}>Questa sezione è riservata ad admin, coordinatori e direttori sanitari.</p>
        </div>
      </section>
    );
  }

  // ─── UI ────────────────────────────────────────────────────────────────────
  return (
    <section className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px', color: colore }}>
          <ClipboardList size={28} />
          {titoloTipo}
        </h1>
        <div style={{ marginTop: '6px' }}>
          {isConvenzione
            ? <span style={{ background: '#eff6ff', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '6px', padding: '2px 10px', fontSize: '0.8rem', fontWeight: 700 }}><Building2 size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Convenzione SIAT</span>
            : <span style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '2px 10px', fontSize: '0.8rem', fontWeight: 700 }}>👤 Gestione Privata</span>
          }
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '20px', alignItems: 'start' }}>

        {/* ═══ COLONNA SINISTRA: ricerca + lista ════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Cerca per indirizzo */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#374151', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={16} style={{ color: colore }} />
              Cerca per indirizzo
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                value={indirizzo}
                onChange={e => setIndirizzo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && cercaPerIndirizzo()}
                placeholder="Via, città..."
                style={{ flex: 1, padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
              />
              <button
                type="button"
                onClick={cercaPerIndirizzo}
                disabled={loadingIndirizzo}
                style={{ background: colore, color: 'white', border: 'none', borderRadius: '6px', padding: '8px 12px', cursor: 'pointer', fontWeight: 700 }}
              >
                {loadingIndirizzo ? '...' : <Search size={15} />}
              </button>
            </div>
            {indirizzoCoords && (
              <div style={{ fontSize: '0.78rem', color: '#059669', marginTop: '8px' }}>✓ Posizione trovata</div>
            )}
          </div>

          {/* Cerca paziente */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#374151', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Search size={16} style={{ color: colore }} />
              Cerca paziente
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                value={cercaPaziente}
                onChange={e => setCercaPaziente(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && cercaPazienti()}
                placeholder="Nome, cognome..."
                style={{ flex: 1, padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
              />
              <button
                type="button"
                onClick={cercaPazienti}
                style={{ background: colore, color: 'white', border: 'none', borderRadius: '6px', padding: '8px 12px', cursor: 'pointer', fontWeight: 700 }}
              >
                <Search size={15} />
              </button>
            </div>

            {risultatiPazienti.length > 0 && (
              <div style={{ marginTop: '10px', maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {risultatiPazienti.map(p => (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => selezionaPaziente(p)}
                    style={{
                      textAlign: 'left', background: pazienteSelezionato?._id === p._id ? '#eff6ff' : '#f8fafc',
                      border: `1px solid ${pazienteSelezionato?._id === p._id ? '#bae6fd' : '#e2e8f0'}`,
                      borderRadius: '6px', padding: '8px 10px', cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1e293b' }}>{p.firstName} {p.lastName}</div>
                    <div style={{ fontSize: '0.77rem', color: '#64748b', marginTop: '2px' }}>
                      <MapPin size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                      {p.address}
                    </div>
                    {p.siat?.tipologiaCura && <div style={{ fontSize: '0.72rem', color: '#0369a1', marginTop: '1px' }}>{p.siat.tipologiaCura}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dettaglio paziente selezionato */}
          {pazienteSelezionato && (
            <div style={{ background: 'white', borderRadius: '12px', padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', border: `1px solid ${colore}40` }}>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: colore, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={15} /> Paziente selezionato
              </div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>{pazienteSelezionato.firstName} {pazienteSelezionato.lastName}</div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '4px' }}>
                📍 {pazienteSelezionato.address}
              </div>
              {pazienteSelezionato.siat?.asl && <div style={{ fontSize: '0.78rem', color: '#0369a1', marginTop: '3px' }}>ASL: {pazienteSelezionato.siat.asl}</div>}
              {geocodingPaziente && <div style={{ fontSize: '0.78rem', color: '#d97706', marginTop: '4px' }}>📡 Geocodifica indirizzo...</div>}
              {pazienteSelezionato.coords && <div style={{ fontSize: '0.78rem', color: '#059669', marginTop: '2px' }}>✓ Posizione trovata</div>}
              {!pazienteSelezionato.coords && !geocodingPaziente && (
                <div style={{ fontSize: '0.78rem', color: '#dc2626', marginTop: '2px' }}>⚠️ Indirizzo non geocodificabile</div>
              )}
            </div>
          )}

          {/* Lista operatori in zona */}
          {(pazienteSelezionato || indirizzoCoords) && (
            <div style={{ background: 'white', borderRadius: '12px', padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={15} style={{ color: colore }} />
                Operatori disponibili in zona
                {loadingZona && <span style={{ fontSize: '0.75rem', color: '#d97706' }}> · ricerca...</span>}
                {!loadingZona && operatoriVisualizzati.length > 0 && (
                  <span style={{ marginLeft: 'auto', background: '#f0fdf4', color: '#059669', borderRadius: '10px', padding: '1px 8px', fontSize: '0.75rem', fontWeight: 700 }}>{operatoriVisualizzati.length} trovati</span>
                )}
              </div>

              {!loadingZona && !pazienteSelezionato?.coords && !indirizzoCoords && (
                <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>Impossibile cercare operatori senza coordinate paziente o indirizzo.</p>
              )}

              {/* Filtro figure */}
              <div style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>Filtra figura:</span>
                {FIGURE_FILTRO.map(fig => (
                  <label key={fig} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem', color: '#475569', background: '#f8fafc', border: `1px solid ${figuraFiltro.includes(fig) ? colore : '#e2e8f0'}`, borderRadius: '6px', padding: '4px 8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={figuraFiltro.includes(fig)}
                      onChange={() => toggleFigura(fig)}
                      style={{ margin: 0, cursor: 'pointer' }}
                    />
                    {capitalize(fig)}
                  </label>
                ))}
                {figuraFiltro.length > 0 && (
                  <button type="button" onClick={() => setFiguraFiltro([])} style={{ fontSize: '0.72rem', color: '#dc2626', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Azzera filtri</button>
                )}
              </div>
              {!loadingZona && (pazienteSelezionato?.coords || indirizzoCoords) && operatoriInZona.length === 0 && (
                <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '12px 14px', fontSize: '0.82rem', color: '#92400e' }}>
                  <strong>⚠️ Nessun operatore trovato in questa zona.</strong>
                  <div style={{ marginTop: '4px' }}>Possibili cause: nessun operatore ha impostato la propria zona di lavoro, oppure l'indirizzo non è coperto dai raggi d'azione configurati. Vai a <em>Gestione Personale</em> per configurare la zona degli operatori.</div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '340px', overflowY: 'auto' }}>
                {operatoriVisualizzati.map((op, i) => (
                  <button
                    key={op._id}
                    type="button"
                    onClick={() => { setOperatoreSelezionato(op); setShowFormPiano(true); setPianoCreatoMsg(''); }}
                    style={{
                      textAlign: 'left', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                      background: operatoreSelezionato?._id === op._id ? '#f0fdf4' : '#f8fafc',
                      border: `1px solid ${operatoreSelezionato?._id === op._id ? '#059669' : '#e2e8f0'}`,
                      borderLeft: `4px solid ${COLORI_CATEGORIA[op.category] || '#059669'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1e293b' }}>
                        <span style={{ display: 'inline-block', width: '20px', height: '20px', borderRadius: '50%', background: COLORI_CATEGORIA[op.category] || '#059669', color: 'white', fontSize: '0.7rem', textAlign: 'center', lineHeight: '20px', marginRight: '6px' }}>{i + 1}</span>
                        {op.firstName} {op.lastName}
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669', whiteSpace: 'nowrap' }}>📍 {op.distanzaKm} km</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px', marginLeft: '26px' }}>
                      {op.role} · raggio {op.raggioAzioneKm ?? 10} km
                    </div>
                    {op.domicilioPartenza && (
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '1px', marginLeft: '26px' }}>🏠 {op.domicilioPartenza}</div>
                    )}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: '12px', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => { setOperatoreSelezionato(null); setShowFormPiano(true); setPianoCreatoMsg(''); }}
                  style={{ background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 14px', cursor: 'pointer', fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}
                >
                  Procedi senza operatore
                </button>
              </div>
            </div>
          )}

          {/* Messaggio successo */}
          {pianoCreatoMsg && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px 14px', fontSize: '0.875rem', color: '#166534', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={18} />{pianoCreatoMsg}
            </div>
          )}
        </div>

        {/* ═══ COLONNA DESTRA: mappa + form ════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Mappa */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#374151', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={16} style={{ color: colore }} /> Mappa zone operative
            </div>
            {operatoriInZona.length > 0 && (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '8px', flexWrap: 'wrap', fontSize: '0.78rem', color: '#64748b' }}>
                <span>🏥 Paziente</span>
                <span>🏠 Domicilio operatore</span>
                <span>— Cerchio = raggio disponibilità</span>
              </div>
            )}
            <Suspense fallback={<div style={{ height: 420, background: '#f1f5f9', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Caricamento mappa...</div>}>
              <MappaZona
                center={operatoreSelezionato?.domicilioCoords || indirizzoCoords || pazienteSelezionato?.coords || undefined}
                raggioKm={operatoreSelezionato?.raggioAzioneKm ?? 10}
                markers={markersOperatori}
                markerPaziente={
                  pazienteSelezionato?.coords
                    ? { lat: pazienteSelezionato.coords.lat, lng: pazienteSelezionato.coords.lng, label: `${pazienteSelezionato.firstName} ${pazienteSelezionato.lastName}` }
                    : indirizzoCoords
                      ? { lat: indirizzoCoords.lat, lng: indirizzoCoords.lng, label: indirizzo }
                      : undefined
                }
                altezza={420}
                readonly
              />
            </Suspense>
          </div>

          {/* Form crea piano/PAI */}
          {showFormPiano && pazienteSelezionato && (
            <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', border: `2px solid ${colore}40` }}>
              <h3 style={{ margin: '0 0 4px', color: colore, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ClipboardList size={18} />
                {isConvenzione ? 'Crea PAI' : 'Crea Piano di Lavoro'}
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: '0.83rem', color: '#64748b' }}>
                {pazienteSelezionato.firstName} {pazienteSelezionato.lastName}
                {' → '}
                <strong>{operatoreSelezionato ? `${operatoreSelezionato.firstName} ${operatoreSelezionato.lastName}` : 'Nessun operatore assegnato'}</strong>
                {operatoreSelezionato && ` (📍 ${operatoreSelezionato.distanzaKm} km)`}
                {' '}
                {operatoreSelezionato && (
                  <button type="button" onClick={() => setOperatoreSelezionato(null)} style={{ fontSize: '0.75rem', background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', textDecoration: 'underline' }}>Rimuovi operatore</button>
                )}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: '0.83rem', fontWeight: 600, color: '#374151' }}>Compito / Prestazione *</span>
                  <textarea
                    value={formPiano.task}
                    onChange={e => setFormPiano(f => ({ ...f, task: e.target.value }))}
                    placeholder={isConvenzione ? 'Es. ADI 1° livello — assistenza infermieristica' : 'Es. Assistenza domiciliare quotidiana'}
                    rows={2}
                    style={{ width: '100%', marginTop: '4px', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.875rem', resize: 'vertical' }}
                  />
                </label>
                <label>
                  <span style={{ fontSize: '0.83rem', fontWeight: 600, color: '#374151' }}>Data inizio</span>
                  <input
                    type="date"
                    value={formPiano.date}
                    onChange={e => setFormPiano(f => ({ ...f, date: e.target.value }))}
                    style={{ width: '100%', marginTop: '4px', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                  />
                </label>
                <label>
                  <span style={{ fontSize: '0.83rem', fontWeight: 600, color: '#374151' }}>Durata (min)</span>
                  <input
                    type="number"
                    min={15} step={15}
                    value={formPiano.duration}
                    onChange={e => setFormPiano(f => ({ ...f, duration: Number(e.target.value) }))}
                    style={{ width: '100%', marginTop: '4px', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                  />
                </label>

                {!isConvenzione && (
                  <>
                    <label>
                      <span style={{ fontSize: '0.83rem', fontWeight: 600, color: '#374151' }}>Tipo compenso</span>
                      <select
                        value={formPiano.tipoCompenso}
                        onChange={e => setFormPiano(f => ({ ...f, tipoCompenso: e.target.value as any }))}
                        style={{ width: '100%', marginTop: '4px', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                      >
                        <option value="nessuno">Nessuno</option>
                        <option value="orario">Orario</option>
                        <option value="fisso">Fisso a prestazione</option>
                      </select>
                    </label>
                    {formPiano.tipoCompenso !== 'nessuno' && (
                      <label>
                        <span style={{ fontSize: '0.83rem', fontWeight: 600, color: '#374151' }}>Tariffa (€)</span>
                        <input
                          type="number" min={0} step={0.5}
                          value={formPiano.tariffa}
                          onChange={e => setFormPiano(f => ({ ...f, tariffa: Number(e.target.value) }))}
                          style={{ width: '100%', marginTop: '4px', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                        />
                      </label>
                    )}
                  </>
                )}

                {isConvenzione && (
                  <label>
                    <span style={{ fontSize: '0.83rem', fontWeight: 600, color: '#374151' }}>Tariffa ASL (€)</span>
                    <input
                      type="number" min={0} step={0.5}
                      value={formPiano.tariffaAsl}
                      onChange={e => setFormPiano(f => ({ ...f, tariffaAsl: Number(e.target.value) }))}
                      style={{ width: '100%', marginTop: '4px', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                    />
                  </label>
                )}

                <label style={{ gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: '0.83rem', fontWeight: 600, color: '#374151' }}>Note</span>
                  <textarea
                    value={formPiano.notes}
                    onChange={e => setFormPiano(f => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    style={{ width: '100%', marginTop: '4px', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.875rem', resize: 'vertical' }}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowFormPiano(false)}
                  style={{ flex: 1, background: '#f1f5f9', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px', cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  Annulla
                </button>
                <button
                  type="button"
                  disabled={salvandoPiano || !formPiano.task.trim()}
                  onClick={creaPiano}
                  style={{ flex: 2, background: salvandoPiano || !formPiano.task.trim() ? '#d1d5db' : colore, color: 'white', border: 'none', borderRadius: '8px', padding: '10px', cursor: salvandoPiano ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.875rem' }}
                >
                  {salvandoPiano ? '...' : `✅ ${isConvenzione ? 'Assegna PAI' : 'Assegna Piano'}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
