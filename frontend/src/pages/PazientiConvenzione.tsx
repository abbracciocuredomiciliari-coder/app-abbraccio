import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import {
  Upload, Search, AlertCircle, CheckCircle, Loader2,
  FileText, User, Building2, Calendar, Phone, RefreshCw,
  Info, ChevronDown, ChevronUp, Download
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';

interface PazienteSIAT {
  _id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  address: string;
  contactPhone?: string;
  codiceFiscale?: string;
  tipoGestione: 'privato' | 'convenzione';
  siat?: {
    npi?: string;
    codiceAutorizzazione?: string;
    codicePrestazione?: string;
    tipologiaCura?: string;
    dataAutorizzazione?: string;
    dataScadenzaAutorizzazione?: string;
    distretto?: string;
    asl?: string;
    uvm?: string;
    medicoReferente?: string;
    importatoDa?: string;
    importatoIl?: string;
    note?: string;
  };
}

const INTESTAZIONI_CSV_ATTESE = [
  'firstName', 'lastName', 'birthDate', 'address',
  'codiceFiscale', 'contactPhone', 'npi', 'codiceAutorizzazione',
  'codicePrestazione', 'tipologiaCura', 'dataAutorizzazione',
  'dataScadenzaAutorizzazione', 'distretto', 'asl', 'uvm',
  'medicoReferente', 'note',
];

function parseCsvRiga(intestazioni: string[], valori: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  intestazioni.forEach((h, i) => { obj[h.trim()] = (valori[i] || '').trim(); });
  return obj;
}

export default function PazientiConvenzione() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pazienti, setPazienti] = useState<PazienteSIAT[]>([]);
  const [loading, setLoading] = useState(true);
  const [cerca, setCerca] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [importLoading, setImportLoading] = useState(false);
  const [importRisultato, setImportRisultato] = useState<{ creati: number; aggiornati: number; errori: string[] } | null>(null);
  const [anteprima, setAnteprima] = useState<Record<string, string>[]>([]);
  const [nomeFileCsv, setNomeFileCsv] = useState('');

  const [espansoId, setEspansoId] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'coordinator';

  useEffect(() => { caricaPazienti(); }, []);

  const caricaPazienti = async () => {
    try {
      setLoading(true);
      const res = await api.get('/patients?tipo=convenzione');
      setPazienti(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore caricamento pazienti');
    } finally {
      setLoading(false);
    }
  };

  const handleFileCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNomeFileCsv(file.name);
    setImportRisultato(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const testo = ev.target?.result as string;
      const righe = testo.split('\n').filter(r => r.trim());
      if (righe.length < 2) {
        setError('Il file CSV deve avere almeno una riga di intestazione e una riga di dati');
        return;
      }

      const intestazioni = righe[0].split(';').map(h => h.trim().replace(/^"|"$/g, ''));
      const dati = righe.slice(1).map(r => {
        const valori = r.split(';').map(v => v.trim().replace(/^"|"$/g, ''));
        return parseCsvRiga(intestazioni, valori);
      }).filter(r => r.firstName && r.lastName);

      setAnteprima(dati);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const eseguiImport = async () => {
    if (anteprima.length === 0) return;
    try {
      setImportLoading(true);
      const res = await api.post('/patients/import-siat', {
        pazienti: anteprima,
        nomeFile: nomeFileCsv,
      });
      setImportRisultato(res.data);
      setSuccess(`✅ ${res.data.message}`);
      setAnteprima([]);
      setNomeFileCsv('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await caricaPazienti();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore import');
    } finally {
      setImportLoading(false);
    }
  };

  const scaricaTemplateCsv = () => {
    const intestazione = INTESTAZIONI_CSV_ATTESE.join(';');
    const esempio = 'Mario;Rossi;1950-01-15;Via Roma 1 Roma;RSSMRA50A15H501Z;0612345678;NPI-001;AUTO-2024-001;ADI-01;ADI 1° livello;2024-01-01;2024-12-31;Distretto 1;ASL Roma 1;UVM Roma Nord;Dr. Bianchi;Note paziente';
    const contenuto = `${intestazione}\n${esempio}`;
    const blob = new Blob([contenuto], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-import-siat.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const pazientiFiltrati = pazienti.filter(p => {
    const q = cerca.toLowerCase();
    return (
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
      p.codiceFiscale?.toLowerCase().includes(q) ||
      p.siat?.npi?.toLowerCase().includes(q) ||
      p.siat?.asl?.toLowerCase().includes(q)
    );
  });

  const scadenzaVicina = (data?: string) => {
    if (!data) return false;
    const d = new Date(data);
    const oggi = new Date();
    const diff = (d.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  };

  const scaduta = (data?: string) => {
    if (!data) return false;
    return new Date(data) < new Date();
  };

  const passaAPrivato = async (p: PazienteSIAT) => {
    if (!window.confirm(`Confermi di passare ${p.firstName} ${p.lastName} da SIAT a privato?\n\nVerrà spostato nella sezione Pazienti Privati.`)) return;
    try {
      await api.patch(`/patients/${p._id}`, { tipoGestione: 'privato' });
      setSuccess(`✅ ${p.firstName} ${p.lastName} spostato in privati.`);
      setTimeout(() => setSuccess(''), 3000);
      await caricaPazienti();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Errore nel passaggio a privato');
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 16px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e3a5f', margin: 0 }}>
            🏥 Pazienti in Convenzione
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '4px' }}>
            Regione Lazio — SIAT · {pazienti.length} pazienti
          </p>
        </div>
        <button
          onClick={caricaPazienti}
          style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#374151', fontSize: '0.9rem' }}
        >
          <RefreshCw size={15} /> Aggiorna
        </button>
      </div>

      {error && (
        <Alert type="error" onClose={() => setError('')} style={{ marginBottom: '16px' }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert type="success" onClose={() => setSuccess('')} style={{ marginBottom: '16px' }}>
          {success}
        </Alert>
      )}

      {/* Import CSV — solo admin/coordinator */}
      {isAdmin && (
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Upload size={18} color="#0284c7" />
              <span style={{ fontWeight: '600', color: '#0c4a6e', fontSize: '0.95rem' }}>Importa pazienti da CSV SIAT</span>
            </div>
            <button
              onClick={scaricaTemplateCsv}
              style={{ background: 'white', border: '1px solid #bae6fd', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#0284c7', fontSize: '0.85rem' }}
            >
              <Download size={14} /> Scarica template CSV
            </button>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            style={{ border: '2px dashed #7dd3fc', borderRadius: '10px', padding: '20px', textAlign: 'center', cursor: 'pointer', background: 'white', marginBottom: '12px' }}
          >
            <FileText size={28} color="#0284c7" style={{ marginBottom: '8px' }} />
            <p style={{ color: '#0284c7', fontWeight: '600', margin: 0 }}>
              {nomeFileCsv ? `📄 ${nomeFileCsv}` : 'Clicca per selezionare il file CSV'}
            </p>
            <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '4px 0 0' }}>
              Formato: separato da punto e virgola (;) · UTF-8
            </p>
          </div>
          <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFileCsv} style={{ display: 'none' }} />

          {anteprima.length > 0 && (
            <div>
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#065f46', fontSize: '0.9rem' }}>
                <Info size={16} /> <strong>{anteprima.length} pazienti</strong> pronti per l'import
              </div>

              {/* Anteprima tabella */}
              <div style={{ overflowX: 'auto', marginBottom: '12px', maxHeight: '180px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                    <tr>
                      {['Cognome', 'Nome', 'Cod. Fiscale', 'Tipologia', 'NPI', 'ASL', 'Scadenza'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#374151', fontWeight: '600', whiteSpace: 'nowrap', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {anteprima.slice(0, 10).map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '6px 10px' }}>{r.lastName}</td>
                        <td style={{ padding: '6px 10px' }}>{r.firstName}</td>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{r.codiceFiscale}</td>
                        <td style={{ padding: '6px 10px' }}>{r.tipologiaCura}</td>
                        <td style={{ padding: '6px 10px' }}>{r.npi}</td>
                        <td style={{ padding: '6px 10px' }}>{r.asl}</td>
                        <td style={{ padding: '6px 10px' }}>{r.dataScadenzaAutorizzazione}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {anteprima.length > 10 && (
                  <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.8rem', padding: '8px' }}>... e altri {anteprima.length - 10} pazienti</p>
                )}
              </div>

              <button
                onClick={eseguiImport}
                disabled={importLoading}
                style={{ width: '100%', background: '#0284c7', color: 'white', border: 'none', borderRadius: '8px', padding: '12px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: importLoading ? 0.7 : 1 }}
              >
                {importLoading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={18} />}
                Conferma Import ({anteprima.length} pazienti)
              </button>
            </div>
          )}

          {importRisultato && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '12px 14px', marginTop: '12px', fontSize: '0.9rem' }}>
              <div style={{ color: '#15803d', fontWeight: '600' }}>✅ Import completato</div>
              <div style={{ color: '#374151', marginTop: '4px' }}>
                Creati: <strong>{importRisultato.creati}</strong> · Aggiornati: <strong>{importRisultato.aggiornati}</strong>
                {importRisultato.errori.length > 0 && (
                  <div style={{ color: '#dc2626', marginTop: '4px' }}>⚠️ {importRisultato.errori.length} errori: {importRisultato.errori.slice(0, 3).join(', ')}</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Barra ricerca */}
      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
        <input
          type="text"
          placeholder="Cerca per nome, codice fiscale, NPI, ASL..."
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
          style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', boxSizing: 'border-box' }}
        />
      </div>

      {/* Lista pazienti */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
          <p>Caricamento pazienti...</p>
        </div>
      ) : pazientiFiltrati.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>
          <Building2 size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
          <p style={{ fontWeight: '600' }}>Nessun paziente in convenzione</p>
          <p style={{ fontSize: '0.9rem' }}>Importa il file CSV da SIAT Lazio per popolare la lista</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {pazientiFiltrati.map((p) => {
            const scad = p.siat?.dataScadenzaAutorizzazione;
            const isScaduta = scaduta(scad);
            const isVicina = scadenzaVicina(scad);
            const espanso = espansoId === p._id;

            return (
              <div
                key={p._id}
                style={{ background: 'white', border: `1px solid ${isScaduta ? '#fca5a5' : isVicina ? '#fde68a' : '#e5e7eb'}`, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
              >
                {/* Riga principale */}
                <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: '700', color: '#1e3a5f', fontSize: '1rem' }}>
                        {p.lastName} {p.firstName}
                      </span>
                      {isScaduta && (
                        <span style={{ background: '#fee2e2', color: '#dc2626', borderRadius: '4px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: '600' }}>SCADUTA</span>
                      )}
                      {!isScaduta && isVicina && (
                        <span style={{ background: '#fef3c7', color: '#d97706', borderRadius: '4px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: '600' }}>SCADE PRESTO</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '4px', flexWrap: 'wrap' }}>
                      {p.codiceFiscale && (
                        <span style={{ color: '#6b7280', fontSize: '0.8rem', fontFamily: 'monospace' }}>{p.codiceFiscale}</span>
                      )}
                      {p.siat?.tipologiaCura && (
                        <span style={{ color: '#0284c7', fontSize: '0.82rem', fontWeight: '600' }}>{p.siat.tipologiaCura}</span>
                      )}
                      {p.siat?.asl && (
                        <span style={{ color: '#6b7280', fontSize: '0.82rem' }}>
                          <Building2 size={12} style={{ display: 'inline', marginRight: '3px' }} />{p.siat.asl}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      onClick={() => navigate(`/workplan?tipo=convenzione&patientId=${p._id}`)}
                      style={{ background: '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}
                    >
                      Piano di lavoro →
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => passaAPrivato(p)}
                        style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}
                        title="Passa a privato"
                      >
                        🔄 Privato
                      </button>
                    )}
                    <button
                      onClick={() => setEspansoId(espanso ? null : p._id)}
                      style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: '#374151' }}
                    >
                      {espanso ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Dettagli SIAT espansi */}
                {espanso && (
                  <div style={{ borderTop: '1px solid #f3f4f6', padding: '14px 16px', background: '#f9fafb' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', fontSize: '0.85rem' }}>
                      {[
                        { label: 'NPI', val: p.siat?.npi },
                        { label: 'Cod. Autorizzazione', val: p.siat?.codiceAutorizzazione },
                        { label: 'Cod. Prestazione', val: p.siat?.codicePrestazione },
                        { label: 'Distretto', val: p.siat?.distretto },
                        { label: 'UVM', val: p.siat?.uvm },
                        { label: 'Medico referente', val: p.siat?.medicoReferente },
                        { label: 'Data autorizzazione', val: p.siat?.dataAutorizzazione ? new Date(p.siat.dataAutorizzazione).toLocaleDateString('it-IT') : undefined },
                        { label: 'Scadenza autorizzazione', val: scad ? new Date(scad).toLocaleDateString('it-IT') : undefined },
                        { label: 'Indirizzo', val: p.address },
                        { label: 'Telefono', val: p.contactPhone },
                        { label: 'Importato da', val: p.siat?.importatoDa },
                        { label: 'Data import', val: p.siat?.importatoIl ? new Date(p.siat.importatoIl).toLocaleDateString('it-IT') : undefined },
                      ].filter(item => item.val).map(({ label, val }) => (
                        <div key={label}>
                          <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '2px' }}>{label}</div>
                          <div style={{ color: '#1e3a5f', fontWeight: '500' }}>{val}</div>
                        </div>
                      ))}
                    </div>
                    {p.siat?.note && (
                      <div style={{ marginTop: '12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '8px 12px', fontSize: '0.85rem', color: '#92400e' }}>
                        📝 {p.siat.note}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
