import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/api';
import { Search, MapPin, UserCheck, Calendar, AlertTriangle, X } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// TROVA OPERATORI PER ZONA — motore di ricerca unificato per tutte le aree.
// Accessibile dal menu e dalla pratica (parametri URL precompilati).
// Regola chiave: una PROPOSTA non è un incarico — crea un'attività di verifica.
// ═══════════════════════════════════════════════════════════════════════════

interface Operatore {
  _id: string;
  nome: string;
  qualifica: string;
  ruolo: string;
  email: string;
  phone: string;
  areeAbilitate: string[];
  areaIntermediazione: boolean;
  zona: string;
  raggioAzioneKm: number;
  coordinateMancanti: boolean;
  distanzaKm: number | null;
  disponibilita: string | null;
  tipoLavoro: string | null;
  residenzaPressoFamiglia: boolean;
  professionista: boolean;
}

const QUALIFICHE = [
  '', 'infermieristico', 'oss', 'osa', 'riabilitativo', 'medico', 'sociale',
  'assistente-familiare', 'badante', 'colf', 'coordinamento', 'privato',
];

const QUALIFICA_LABEL: Record<string, string> = {
  infermieristico: 'Infermiere', oss: 'OSS', osa: 'OSA', riabilitativo: 'Riabilitativo',
  medico: 'Medico', sociale: 'Sociale', 'assistente-familiare': 'Assistente familiare',
  badante: 'Badante', colf: 'Colf', coordinamento: 'Coordinamento', privato: 'Privato',
  direzione: 'Direzione',
};

export default function TrovaOperatori() {
  const [searchParams] = useSearchParams();
  const contesto = {
    praticaTipo: searchParams.get('praticaTipo') || '',
    praticaId: searchParams.get('praticaId') || '',
    praticaLabel: searchParams.get('praticaLabel') || '',
  };

  const [qualifica, setQualifica] = useState(searchParams.get('qualifica') || '');
  const [area, setArea] = useState(searchParams.get('area') || '');
  const [zona, setZona] = useState(searchParams.get('zona') || '');
  const [disponibilita, setDisponibilita] = useState('');
  const [tipoLavoro, setTipoLavoro] = useState('');
  const [q, setQ] = useState('');
  const [lat, setLat] = useState(searchParams.get('lat') || '');
  const [lng, setLng] = useState(searchParams.get('lng') || '');
  const [raggioKm, setRaggioKm] = useState('15');

  const [risultati, setRisultati] = useState<Operatore[]>([]);
  const [senzaZonaEsclusi, setSenzaZonaEsclusi] = useState(0);
  const [loading, setLoading] = useState(false);
  const [cercato, setCercato] = useState(false);

  const [modalProposta, setModalProposta] = useState<Operatore | null>(null);
  const [modalColloquio, setModalColloquio] = useState<Operatore | null>(null);
  const [notaProposta, setNotaProposta] = useState('');
  const [dataColloquio, setDataColloquio] = useState('');
  const [modalitaColloquio, setModalitaColloquio] = useState('');
  const [salvando, setSalvando] = useState(false);

  const cerca = async () => {
    setLoading(true);
    setCercato(true);
    try {
      const params: any = {};
      if (qualifica) params.qualifica = qualifica;
      if (area) params.area = area;
      if (zona) params.zona = zona;
      if (disponibilita) params.disponibilita = disponibilita;
      if (tipoLavoro) params.tipoLavoro = tipoLavoro;
      if (q) params.q = q;
      if (lat && lng) { params.lat = lat; params.lng = lng; params.raggioKm = raggioKm; }
      const res = await api.get('/ricerca-operatori', { params });
      setRisultati(res.data.risultati || []);
      setSenzaZonaEsclusi(res.data.senzaZonaEsclusi || 0);
    } catch {
      setRisultati([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cerca(); /* ricerca iniziale con eventuali parametri URL */ }, []);

  const registraProposta = async () => {
    if (!modalProposta || !notaProposta.trim()) return;
    setSalvando(true);
    try {
      await api.post('/ricerca-operatori/proposta', {
        staffId: modalProposta._id,
        ...contesto,
        area: area || undefined,
        note: notaProposta,
      });
      alert(`Proposta per ${modalProposta.nome} registrata: è stata creata un'attività di verifica. Nessun incarico inviato.`);
      setModalProposta(null);
      setNotaProposta('');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nella registrazione della proposta');
    } finally {
      setSalvando(false);
    }
  };

  const registraColloquio = async () => {
    if (!modalColloquio || !dataColloquio) return;
    setSalvando(true);
    try {
      await api.post('/ricerca-operatori/colloquio', {
        staffId: modalColloquio._id,
        dataOra: dataColloquio,
        modalita: modalitaColloquio,
        ...contesto,
        area: area || undefined,
      });
      alert(`Colloquio con ${modalColloquio.nome} registrato in attività. Nessun invito inviato.`);
      setModalColloquio(null);
      setDataColloquio('');
      setModalitaColloquio('');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nella registrazione del colloquio');
    } finally {
      setSalvando(false);
    }
  };

  const inputStyle: React.CSSProperties = { padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.88rem' };
  const labelStyle: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '16px' }}>
      <h2 style={{ margin: '0 0 4px', color: '#1e4d8c' }}>Trova operatori per zona</h2>
      <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '0.9rem' }}>
        Un'unica ricerca per assistenza privata, intermediazione e convenzione SIAT.
      </p>

      {contesto.praticaLabel && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '0.88rem', color: '#1e40af' }}>
          Contesto pratica: <strong>{contesto.praticaLabel}</strong>. Le proposte e i colloqui registrati saranno collegati a questa pratica.
        </div>
      )}

      {/* Filtri */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={labelStyle}>Qualifica</span>
            <select value={qualifica} onChange={e => setQualifica(e.target.value)} style={inputStyle}>
              <option value="">Tutte le qualifiche</option>
              {QUALIFICHE.filter(Boolean).map(qf => <option key={qf} value={qf}>{QUALIFICA_LABEL[qf] || qf}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={labelStyle}>Area operativa</span>
            <select value={area} onChange={e => setArea(e.target.value)} style={inputStyle}>
              <option value="">Tutte le aree</option>
              <option value="privato">Gestione Privata</option>
              <option value="convenzione">Convenzione SIAT</option>
              <option value="intermediazione">Intermediazioni</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={labelStyle}>Zona / città</span>
            <input value={zona} onChange={e => setZona(e.target.value)} placeholder="Es. Tuscolana, Appia…" style={inputStyle} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={labelStyle}>Disponibilità</span>
            <select value={disponibilita} onChange={e => setDisponibilita(e.target.value)} style={inputStyle}>
              <option value="">Tutte</option>
              <option value="diurno">Diurno</option>
              <option value="notturno">Notturno</option>
              <option value="h24">H24</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={labelStyle}>Tipo lavoro</span>
            <select value={tipoLavoro} onChange={e => setTipoLavoro(e.target.value)} style={inputStyle}>
              <option value="">Tutti</option>
              <option value="ore">A ore</option>
              <option value="convivenza">Convivenza</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={labelStyle}>Nome / email</span>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca per nome…" style={inputStyle} />
          </label>
        </div>
        <details style={{ marginTop: '10px' }}>
          <summary style={{ cursor: 'pointer', fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>Ricerca geografica (coordinate + raggio)</summary>
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
            <input value={lat} onChange={e => setLat(e.target.value)} placeholder="Latitudine" style={{ ...inputStyle, width: '110px' }} />
            <input value={lng} onChange={e => setLng(e.target.value)} placeholder="Longitudine" style={{ ...inputStyle, width: '110px' }} />
            <input value={raggioKm} onChange={e => setRaggioKm(e.target.value)} placeholder="Raggio km" type="number" style={{ ...inputStyle, width: '90px' }} />
            <span style={{ fontSize: '0.78rem', color: '#94a3b8', alignSelf: 'center' }}>
              Con coordinate attive, gli operatori senza zona impostata vengono esclusi e conteggiati.
            </span>
          </div>
        </details>
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
          <button onClick={cerca} disabled={loading}
            style={{ background: '#1e4d8c', color: '#fff', border: 'none', borderRadius: '6px', padding: '9px 20px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Search size={15} /> {loading ? 'Ricerca…' : 'Cerca operatori'}
          </button>
        </div>
      </div>

      {senzaZonaEsclusi > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '8px 14px', marginBottom: '12px', fontSize: '0.82rem', color: '#92400e', display: 'flex', gap: '6px', alignItems: 'center' }}>
          <AlertTriangle size={14} /> {senzaZonaEsclusi} operatori senza zona impostata esclusi dalla ricerca geografica — restano trovabili con la ricerca non geografica.
        </div>
      )}

      {/* Risultati */}
      {cercato && !loading && (
        <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 10px' }}>
          {risultati.length} operator{risultati.length === 1 ? 'e trovato' : 'i trovati'}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {risultati.map(op => (
          <div key={op._id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px', display: 'flex', gap: '14px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '0.95rem' }}>{op.nome}</strong>
                <span style={{ background: '#e0f2fe', color: '#0369a1', borderRadius: '10px', padding: '1px 8px', fontSize: '0.74rem', fontWeight: 700 }}>
                  {QUALIFICA_LABEL[op.qualifica] || op.qualifica}
                </span>
                {op.professionista && <span style={{ background: '#f5f3ff', color: '#6d28d9', borderRadius: '10px', padding: '1px 8px', fontSize: '0.74rem', fontWeight: 700 }}>P.IVA</span>}
                {op.coordinateMancanti && (
                  <span style={{ background: '#fffbeb', color: '#92400e', borderRadius: '10px', padding: '1px 8px', fontSize: '0.74rem', fontWeight: 700 }}>
                    ⚠ zona non impostata
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '4px' }}>
                {op.ruolo} · aree: {op.areeAbilitate.join(', ')}{op.areaIntermediazione ? ' + intermediazioni' : ''}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {op.zona && <span><MapPin size={11} style={{ verticalAlign: '-1px' }} /> {op.zona}</span>}
                {op.distanzaKm !== null && <span><strong>{op.distanzaKm} km</strong> (raggio {op.raggioAzioneKm} km)</span>}
                {op.disponibilita && <span>disp: {op.disponibilita}</span>}
                {op.tipoLavoro && <span>{op.tipoLavoro === 'convivenza' ? 'convivenza' : 'a ore'}</span>}
                {op.residenzaPressoFamiglia && <span>residente possibile</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
              <button onClick={() => setModalProposta(op)}
                style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', padding: '7px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <UserCheck size={13} /> Proposta
              </button>
              <button onClick={() => setModalColloquio(op)}
                style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '7px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={13} /> Colloquio
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal proposta */}
      {modalProposta && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }} onClick={() => setModalProposta(null)}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '22px', maxWidth: '480px', width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>Proposta operatore</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>{modalProposta.nome} · {QUALIFICA_LABEL[modalProposta.qualifica] || modalProposta.qualifica}</p>
              </div>
              <button onClick={() => setModalProposta(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '8px 12px', fontSize: '0.8rem', color: '#92400e', marginBottom: '12px' }}>
              Una proposta non è un incarico accettato. Verrà creata un'attività di verifica{contesto.praticaLabel ? ` collegata a ${contesto.praticaLabel}` : ''}. Nessuna notifica all'operatore.
            </div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Nota e verifiche da eseguire *
              <textarea value={notaProposta} onChange={e => setNotaProposta(e.target.value)} rows={3} required
                placeholder="Es. verificare disponibilità serali e documenti…"
                style={{ width: '100%', marginTop: '6px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.88rem', boxSizing: 'border-box', resize: 'vertical' }} />
            </label>
            <button onClick={registraProposta} disabled={salvando || !notaProposta.trim()}
              style={{ width: '100%', marginTop: '10px', background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px', fontWeight: 700, cursor: 'pointer' }}>
              {salvando ? 'Registrazione…' : 'Registra proposta'}
            </button>
          </div>
        </div>
      )}

      {/* Modal colloquio */}
      {modalColloquio && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }} onClick={() => setModalColloquio(null)}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '22px', maxWidth: '480px', width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>Colloquio</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>{modalColloquio.nome}</p>
              </div>
              <button onClick={() => setModalColloquio(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '10px' }}>
              Data e ora *
              <input type="datetime-local" value={dataColloquio} onChange={e => setDataColloquio(e.target.value)} required
                style={{ width: '100%', marginTop: '6px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.88rem', boxSizing: 'border-box' }} />
            </label>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600 }}>
              Modalità / nota
              <input value={modalitaColloquio} onChange={e => setModalitaColloquio(e.target.value)} placeholder="Es. telefonico, da confermare"
                style={{ width: '100%', marginTop: '6px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.88rem', boxSizing: 'border-box' }} />
            </label>
            <button onClick={registraColloquio} disabled={salvando || !dataColloquio}
              style={{ width: '100%', marginTop: '14px', background: '#1e4d8c', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px', fontWeight: 700, cursor: 'pointer' }}>
              {salvando ? 'Registrazione…' : 'Aggiungi ad attività (nessun invito)'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
