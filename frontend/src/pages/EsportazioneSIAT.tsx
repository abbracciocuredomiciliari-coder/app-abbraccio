import { useState, useEffect } from 'react';
import api from '../api/api';
import {
  Download,
  FileText,
  User,
  Calendar,
  Printer,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  FileCode,
  CheckCircle,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';

interface Patient {
  _id: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
  codiceFiscale?: string;
}

interface WorkPlan {
  _id: string;
  patient: Patient | string;
  status: string;
  startDate?: string;
  endDate?: string;
}

export default function EsportazioneSIAT() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [workPlans, setWorkPlans] = useState<WorkPlan[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedWorkPlan, setSelectedWorkPlan] = useState<WorkPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [tipoInvio, setTipoInvio] = useState('ammissione');

  useEffect(() => {
    loadPatients();
    loadWorkPlans();
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      // Filtra workplan del paziente selezionato
      const patientWorkPlans = workPlans.filter(wp => {
        const wpPatientId = typeof wp.patient === 'string' ? wp.patient : wp.patient._id;
        return wpPatientId === selectedPatient._id;
      });
      if (patientWorkPlans.length > 0) {
        setSelectedWorkPlan(patientWorkPlans[0]);
      }
    }
  }, [selectedPatient, workPlans]);

  const loadPatients = async () => {
    try {
      const res = await api.get('/patients');
      setPatients(res.data);
    } catch (error) {
      console.error('Errore caricamento pazienti', error);
    }
  };

  const loadWorkPlans = async () => {
    try {
      const res = await api.get('/workplan');
      setWorkPlans(res.data);
    } catch (error) {
      console.error('Errore caricamento workplan', error);
    }
  };

  const exportCSV = async () => {
    if (!selectedPatient) {
      setMessage('Seleziona un paziente');
      return;
    }

    setLoading(true);
    try {
      const response = await api.get(`/export/siat/paziente/${selectedPatient._id}?format=csv`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `SIAT_${selectedPatient.lastName}_${selectedPatient.firstName}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setMessage('File CSV scaricato con successo!');
    } catch (error: any) {
      setMessage(`Errore esportazione: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const exportCDA2 = async () => {
    if (!selectedPatient) {
      setMessage('Seleziona un paziente');
      return;
    }

    setLoading(true);
    try {
      const response = await api.get(`/export/siat/paziente/${selectedPatient._id}?format=cda2`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `CDA2_${selectedPatient.lastName}_${selectedPatient.firstName}_${new Date().toISOString().split('T')[0]}.xml`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setMessage('File CDA2 scaricato con successo!');
    } catch (error: any) {
      setMessage(`Errore esportazione: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const generaModuloStampa = async () => {
    if (!selectedWorkPlan) {
      setMessage('Seleziona un piano di lavoro');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/export/siat/invio-manuale', {
        workPlanId: selectedWorkPlan._id,
        tipoInvio,
      }, {
        responseType: 'text',
      });

      // Apri modulo in nuova finestra per stampa
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(response.data);
        win.document.close();
        win.focus();
      }

      setMessage('Modulo generato! Usa Ctrl+P per stampare.');
    } catch (error: any) {
      setMessage(`Errore generazione: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const patientWorkPlans = selectedPatient
    ? workPlans.filter(wp => {
        const wpPatientId = typeof wp.patient === 'string' ? wp.patient : wp.patient?._id;
        return wpPatientId === selectedPatient._id;
      })
    : [];

  return (
    <section>
      <h2>
        <FileText size={28} />
        Esportazione Dati SIAT
      </h2>

      <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
        <AlertCircle size={20} style={{ display: 'inline', marginRight: '8px', color: '#f59e0b' }} />
        <strong>⚠️ Nota importante:</strong> Questa funzione genera file in formato compatibile con 
        <strong>SIAT Regione Lazio</strong> (formato CSV e CDA2). L'invio effettivo alla piattaforma 
        regionale richiede credenziali e accreditamento specifico con l'ASL di competenza.
      </div>

      {message && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px',
          backgroundColor: message.includes('successo') ? '#d1fae5' : '#fee2e2',
          border: `1px solid ${message.includes('successo') ? '#10b981' : '#ef4444'}`,
          borderRadius: '8px', marginBottom: '16px',
        }}>
          <AlertCircle size={18} />
          {message}
          <button onClick={() => setMessage('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Selezione Paziente */}
      <div style={{ background: 'var(--gray-50)', padding: '20px', borderRadius: '12px', marginBottom: '24px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <User size={20} />
          1. Seleziona Paziente
        </h3>
        <select
          value={selectedPatient?._id || ''}
          onChange={(e) => {
            const patient = patients.find(p => p._id === e.target.value);
            setSelectedPatient(patient || null);
          }}
          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--gray-300)', fontSize: '1rem' }}
        >
          <option value="">-- Seleziona un paziente --</option>
          {patients.map(p => (
            <option key={p._id} value={p._id}>
              {p.lastName} {p.firstName} {p.codiceFiscale ? `(CF: ${p.codiceFiscale})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Info Paziente */}
      {selectedPatient && (
        <div style={{ background: 'linear-gradient(135deg, #1e4d8c 0%, #3b82f6 100%)', padding: '20px', borderRadius: '12px', color: 'white', marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '12px' }}>📋 Dati Paziente Selezionato</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div>
              <div style={{ opacity: 0.8, fontSize: '0.9rem' }}>Nome</div>
              <div style={{ fontWeight: '600' }}>{selectedPatient.firstName} {selectedPatient.lastName}</div>
            </div>
            <div>
              <div style={{ opacity: 0.8, fontSize: '0.9rem' }}>Data nascita</div>
              <div style={{ fontWeight: '600' }}>{selectedPatient.birthDate ? new Date(selectedPatient.birthDate).toLocaleDateString('it-IT') : 'N/D'}</div>
            </div>
            <div>
              <div style={{ opacity: 0.8, fontSize: '0.9rem' }}>Codice Fiscale</div>
              <div style={{ fontWeight: '600' }}>{selectedPatient.codiceFiscale || 'Non disponibile'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Selezione WorkPlan */}
      {selectedPatient && (
        <div style={{ background: 'var(--gray-50)', padding: '20px', borderRadius: '12px', marginBottom: '24px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Calendar size={20} />
            2. Seleziona Piano di Lavoro
          </h3>
          {patientWorkPlans.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
              <AlertCircle size={24} style={{ marginBottom: '8px' }} />
              <p>Nessun piano di lavoro attivo per questo paziente.</p>
            </div>
          ) : (
            <select
              value={selectedWorkPlan?._id || ''}
              onChange={(e) => {
                const wp = patientWorkPlans.find(w => w._id === e.target.value);
                setSelectedWorkPlan(wp || null);
              }}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--gray-300)', fontSize: '1rem' }}
            >
              {patientWorkPlans.map(wp => (
                <option key={wp._id} value={wp._id}>
                  Piano del {wp.startDate ? new Date(wp.startDate).toLocaleDateString('it-IT') : 'N/D'} 
                  - Stato: {wp.status === 'pending' ? 'Attivo' : wp.status === 'completed' ? 'Completato' : wp.status}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Esportazione */}
      {selectedPatient && (
        <div style={{ display: 'grid', gap: '24px' }}>
          
          {/* Opzione 1: Download CSV */}
          <div style={{ background: 'white', border: '2px solid #e5e7eb', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <FileSpreadsheet size={24} color="#16a34a" />
              Esportazione CSV
            </h3>
            <p style={{ color: '#6b7280', marginBottom: '16px' }}>
              Formato tabellare compatibile con importazione manuale su SIAT. 
              Contiene: dati anagrafici, piano assistenziale, ultimi accessi.
            </p>
            <button
              onClick={exportCSV}
              disabled={loading}
              style={{ background: '#16a34a', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? <><Loader2 size={16} className="spin" /> Generazione...</> : <><Download size={16} /> Scarica CSV</>}
            </button>
          </div>

          {/* Opzione 2: Download CDA2 */}
          <div style={{ background: 'white', border: '2px solid #e5e7eb', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <FileCode size={24} color="#2563eb" />
              Esportazione CDA2 (XML)
            </h3>
            <p style={{ color: '#6b7280', marginBottom: '16px' }}>
              Formato standard internazionale HL7 CDA2 per fascicolo sanitario elettronico. 
              Contiene: referto clinico strutturato, parametri vitali, diario accessi.
            </p>
            <button
              onClick={exportCDA2}
              disabled={loading}
              style={{ background: '#2563eb', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? <><Loader2 size={16} className="spin" /> Generazione...</> : <><Download size={16} /> Scarica XML (CDA2)</>}
            </button>
          </div>

          {/* Opzione 3: Modulo stampa manuale */}
          {selectedWorkPlan && (
            <div style={{ background: 'white', border: '2px solid #f59e0b', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Printer size={24} color="#f59e0b" />
                Modulo per Invio Manuale
              </h3>
              <p style={{ color: '#6b7280', marginBottom: '16px' }}>
                Genera un modulo PDF stampabile con tutti i dati precompilati da inserire 
                manualmente su SIAT. Da stampare in 2 copie.
              </p>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>Tipo di invio SIAT:</label>
                <select
                  value={tipoInvio}
                  onChange={(e) => setTipoInvio(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--gray-300)' }}
                >
                  <option value="ammissione">📋 Ammissione Cure Domiciliari</option>
                  <option value="modifica">✏️ Modifica Piano Assistenziale</option>
                  <option value="chiusura">✅ Chiusura/Dimissione</option>
                  <option value="sospensione">⏸️ Sospensione Temporanea</option>
                </select>
              </div>

              <button
                onClick={generaModuloStampa}
                disabled={loading}
                style={{ background: '#f59e0b', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? <><Loader2 size={16} className="spin" /> Generazione...</> : <><Printer size={16} /> Genera Modulo Stampa</>}
              </button>

              <div style={{ marginTop: '16px', padding: '12px', background: '#fef3c7', borderRadius: '6px', fontSize: '0.9rem' }}>
                <CheckCircle size={16} style={{ display: 'inline', marginRight: '4px' }} />
                Il modulo include: dati paziente, tipo invio, sintesi piano assistenziale, ultimi accessi, firme.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Istruzioni */}
      <div style={{ marginTop: '32px', padding: '20px', background: '#f3f4f6', borderRadius: '12px' }}>
        <h4 style={{ marginBottom: '12px' }}>📖 Come utilizzare i file esportati</h4>
        <ol style={{ marginLeft: '20px', color: '#4b5563', lineHeight: '1.8' }}>
          <li><strong>CSV:</strong> Apri con Excel, verifica i dati, salva e carica su SIAT sezione "Importazione dati"</li>
          <li><strong>CDA2 (XML):</strong> Formato standard per FSE. Conserva per invio futuro quando disponibile</li>
          <li><strong>Modulo stampa:</strong> Stampa 2 copie → invia una all'ASL → conserva una in cartella clinica</li>
        </ol>
        <p style={{ marginTop: '12px', fontSize: '0.9rem', color: '#6b7280' }}>
          Per assistenza contatta l'ufficio Cure Domiciliari della tua ASL di riferimento.
        </p>
      </div>
    </section>
  );
}
