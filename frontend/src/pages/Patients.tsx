import { FormEvent, useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import SkeletonList from '../components/SkeletonList';
import {
  Search,
  UserPlus,
  FileText,
  Download,
  Trash2,
  X,
  Upload,
  FolderOpen,
  TestTube2,
  Stethoscope,
  ClipboardList,
  AlertCircle,
  Loader2,
  Shield,
  CheckCircle,
} from 'lucide-react';
import FirmaCanvas from '../components/FirmaCanvas';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Loading } from '../components/ui/Loading';

// Assicura che API_BASE_URL termini sempre con /api
const _rawBasePatients = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const API_BASE_URL = _rawBasePatients.endsWith('/api') ? _rawBasePatients : _rawBasePatients.replace(/\/$/, '') + '/api';

interface Patient {
  _id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  address: string;
  assistanceNeeds: string;
  contactPhone?: string;
  email?: string;
}

interface PatientDocument {
  _id: string;
  patient: string;
  category: 'cartella_clinica' | 'esame' | 'risultato_analisi' | 'consulenza';
  title: string;
  description?: string;
  fileName: string;
  contentType: string;
  uploadedByNome?: string;
  dataCaricamento: string;
  createdAt: string;
}

const categoryLabels: Record<string, string> = {
  cartella_clinica: 'Cartella Clinica',
  esame: 'Esame',
  risultato_analisi: 'Risultato Analisi',
  consulenza: 'Consulenza',
};

const categoryIcons: Record<string, React.ElementType> = {
  cartella_clinica: FolderOpen,
  esame: TestTube2,
  risultato_analisi: ClipboardList,
  consulenza: Stethoscope,
};

const categoryColors: Record<string, string> = {
  cartella_clinica: '#4f46e5',
  esame: '#06b6d4',
  risultato_analisi: '#10b981',
  consulenza: '#f59e0b',
};

function Patients() {
  const { user, getToken } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    birthDate: '',
    address: '',
    assistanceNeeds: '',
    contactPhone: '',
    email: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Document management state
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: '', description: '', category: '' as string });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stato modal consenso GDPR
  const [showConsensoModal, setShowConsensoModal] = useState(false);
  const [consensoPaziente, setConsensoPaziente] = useState<Patient | null>(null);
  const [firmaConsenso, setFirmaConsenso] = useState('');
  const [firmaConsensoNome, setFirmaConsensoNome] = useState('');
  const [firmaConsensoRuolo, setFirmaConsensoRuolo] = useState<'paziente' | 'familiare' | 'tutore'>('paziente');
  const [salvandoConsenso, setSalvandoConsenso] = useState(false);
  const [consensoSalvato, setConsensoSalvato] = useState(false);

  useEffect(() => {
    loadPatients();
  }, []);

  useEffect(() => {
    filterPatients();
  }, [searchTerm, patients]);

  const loadPatients = async () => {
    try {
      const response = await api.get('/patients');
      setPatients(response.data);
    } catch (error) {
      console.error('Errore caricamento pazienti', error);
    } finally {
      setLoading(false);
    }
  };

  const filterPatients = () => {
    if (!searchTerm.trim()) {
      setFilteredPatients(patients);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = patients.filter(patient => {
      const fullName = `${patient.firstName} ${patient.lastName}`.toLowerCase();
      return (
        fullName.includes(term) ||
        patient.firstName.toLowerCase().includes(term) ||
        patient.lastName.toLowerCase().includes(term) ||
        patient._id.toLowerCase().includes(term)
      );
    });
    setFilteredPatients(filtered);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    try {
      await api.post('/patients', formData);
      setFormData({
        firstName: '',
        lastName: '',
        birthDate: '',
        address: '',
        assistanceNeeds: '',
        contactPhone: '',
        email: ''
      });
      setShowForm(false);
      loadPatients();
      setSuccess('Paziente salvato con successo!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Impossibile salvare il paziente. Riprova.');
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const openDocumentsModal = async (patient: Patient) => {
    setSelectedPatient(patient);
    setSelectedCategory('');
    await loadPatientDocuments(patient._id);
    setShowDocumentsModal(true);
  };

  const closeDocumentsModal = () => {
    setShowDocumentsModal(false);
    setSelectedPatient(null);
    setDocuments([]);
    setUploadForm({ title: '', description: '', category: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const loadPatientDocuments = async (patientId: string) => {
    try {
      const token = getToken();
      if (!token) return;

      const params = selectedCategory ? { category: selectedCategory } : {};
      const response = await api.get(`/documents/patients/${patientId}/documents`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocuments(response.data);
    } catch (error) {
      console.error('Errore caricamento documenti:', error);
    }
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      alert('Seleziona un file da caricare');
      return;
    }

    if (!uploadForm.title.trim()) {
      alert('Inserisci un titolo per il documento');
      return;
    }

    if (!uploadForm.category) {
      alert('Seleziona una categoria');
      return;
    }

    if (!selectedPatient) return;

    setUploading(true);
    try {
      const token = getToken();
      if (!token) return;

      const formData = new FormData();
      formData.append('document', file);
      formData.append('title', uploadForm.title);
      formData.append('category', uploadForm.category);
      if (uploadForm.description) {
        formData.append('description', uploadForm.description);
      }

      await api.post(`/documents/patients/${selectedPatient._id}/documents`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      await loadPatientDocuments(selectedPatient._id);
      setUploadForm({ title: '', description: '', category: '' });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setSuccess('Documento caricato con successo!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Errore nel caricamento del documento');
    } finally {
      setUploading(false);
    }
  };

  const downloadDocument = async (documentId: string, fileName: string) => {
    try {
      const token = getToken();
      if (!token) return;

      const response = await api.get(`/documents/documents/${documentId}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Errore download:', error);
      alert('Errore nel download del documento');
    }
  };

  const deleteDocument = async (documentId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo documento?')) return;

    try {
      const token = getToken();
      if (!token) return;

      await api.delete(`/documents/documents/${documentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      await loadPatientDocuments(selectedPatient!._id);
      setSuccess('Documento eliminato con successo!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Errore eliminazione:', error);
      alert('Errore nell\'eliminazione del documento');
    }
  };

  const deletePatient = async (patientId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo paziente?\n\nQuesta azione è irreversibile!')) return;

    try {
      await api.delete(`/patients/${patientId}`);
      setSuccess('Paziente eliminato con successo!');
      setTimeout(() => setSuccess(''), 3000);
      loadPatients();
    } catch (error) {
      console.error('Errore eliminazione paziente:', error);
      alert('Errore nell\'eliminazione del paziente');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const canEdit = user && (user.role === 'admin' || user.role === 'coordinator');

  return (
    <section>
      <h2>
        <FileText size={28} />
        Gestione Pazienti
      </h2>

      {success && (
        <Alert type="success" onClose={() => setSuccess('')} style={{ marginBottom: '16px' }}>
          {success}
        </Alert>
      )}

      {/* Search Bar */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '20px',
        alignItems: 'center',
      }}>
        <Input
          placeholder="Cerca per nome, cognome o ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          icon={<Search size={18} />}
        />
        {canEdit && (
          <Button
            variant={showForm ? 'secondary' : 'primary'}
            onClick={() => setShowForm(!showForm)}
            icon={<UserPlus size={18} />}
          >
            {showForm ? 'Annulla' : 'Nuovo Paziente'}
          </Button>
        )}
      </div>

      {/* Search Results Info */}
      {searchTerm && (
        <p style={{ marginBottom: '16px', color: 'var(--gray-500)', fontSize: '0.92rem' }}>
          Trovati {filteredPatients.length} paziente{filteredPatients.length !== 1 ? 'i' : ''} per "{searchTerm}"
        </p>
      )}

      {/* Add Patient Form */}
      {showForm && canEdit && (
        <form onSubmit={handleSubmit} className="user-form">
          <h4>
            <UserPlus size={18} />
            Nuovo Paziente
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <label>
              Nome *
              <input
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                required
                placeholder="Mario"
              />
            </label>
            <label>
              Cognome *
              <input
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                required
                placeholder="Rossi"
              />
            </label>
          </div>
          <label>
            Data di nascita *
            <input
              type="date"
              name="birthDate"
              value={formData.birthDate}
              onChange={handleInputChange}
              required
            />
          </label>
          <label>
            Indirizzo *
            <input
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              required
              placeholder="Via Roma 1, Milano"
            />
          </label>
          <label>
            Telefono di contatto
            <input
              name="contactPhone"
              value={formData.contactPhone}
              onChange={handleInputChange}
              placeholder="+39 333 1234567"
            />
          </label>
          <label>
            Email
            <input
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="paziente@email.com"
            />
          </label>
          <label>
            Fabbisogni assistenziali *
            <textarea
              name="assistanceNeeds"
              value={formData.assistanceNeeds}
              onChange={handleInputChange}
              required
              rows={3}
              placeholder="Descrivi le necessità assistenziali del paziente..."
            />
          </label>
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px',
              backgroundColor: 'var(--danger-bg)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--danger)',
              fontSize: '0.92rem',
            }}>
              <AlertCircle size={18} />
              {error}
            </div>
          )}
          <button type="submit">Salva Paziente</button>
        </form>
      )}

      {/* Patients List */}
      <div className="patients-list">
        <h3>
          <FileText size={20} />
          Elenco Pazienti ({filteredPatients.length})
        </h3>
        {loading ? (
          <div style={{ padding: '8px 0' }}><SkeletonList rows={6} showHeader={false} /></div>
        ) : filteredPatients.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '32px', color: 'var(--gray-500)' }}>
            {searchTerm ? 'Nessun paziente trovato.' : 'Nessun paziente presente.'}
          </p>
        ) : (
          <ul>
            {filteredPatients.map((patient) => (
              <li key={patient._id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '16px',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '1.05rem' }}>
                      {patient.firstName} {patient.lastName}
                    </strong>
                    <span style={{
                      fontSize: '0.78rem',
                      padding: '2px 8px',
                      backgroundColor: 'var(--primary-bg)',
                      color: 'var(--primary)',
                      borderRadius: 'var(--radius-full',
                      fontWeight: 500,
                    }}>
                      ID: {patient._id.slice(-6).toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.88rem', color: 'var(--gray-500)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <span>📅 Nato il: {formatDate(patient.birthDate)}</span>
                    <span>📍 {patient.address}</span>
                    {patient.contactPhone && <span>📞 {patient.contactPhone}</span>}
                    {patient.email && <span>✉️ {patient.email}</span>}
                  </div>
                  <div style={{ fontSize: '0.88rem', color: 'var(--gray-600)', marginTop: '4px', fontStyle: 'italic' }}>
                    💡 {patient.assistanceNeeds}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      setConsensoPaziente(patient);
                      setFirmaConsenso('');
                      setFirmaConsensoNome(patient.firstName + ' ' + patient.lastName);
                      setFirmaConsensoRuolo('paziente');
                      setConsensoSalvato(false);
                      setShowConsensoModal(true);
                    }}
                    style={{ background: '#7e22ce', color: 'white', whiteSpace: 'nowrap' }}
                    title="Consenso GDPR"
                  >
                    <Shield size={16} />
                    GDPR
                  </button>
                  <button
                    onClick={() => openDocumentsModal(patient)}
                    style={{
                      background: 'var(--info)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <FolderOpen size={16} />
                    Documenti
                  </button>
                  {user?.role === 'admin' && (
                    <button
                      onClick={() => deletePatient(patient._id)}
                      style={{
                        background: 'var(--danger)',
                        whiteSpace: 'nowrap',
                      }}
                      title="Elimina paziente"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ═══ MODAL CONSENSO GDPR ═══ */}
      {showConsensoModal && consensoPaziente && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, overflowY: 'auto', padding: '0' }}>
          <div style={{ background: 'white', minHeight: '100vh', maxWidth: '700px', margin: '0 auto', padding: '0' }}>

            {/* Header fisso */}
            <div style={{ position: 'sticky', top: 0, background: '#1e4d8c', color: 'white', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '1rem' }}>🛡️ Consenso GDPR</div>
                <div style={{ fontSize: '0.82rem', opacity: 0.8 }}>{consensoPaziente.firstName} {consensoPaziente.lastName}</div>
              </div>
              <button onClick={() => setShowConsensoModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '6px', color: 'white', padding: '6px 10px', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px 24px' }}>

              {consensoSalvato ? (
                <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <CheckCircle size={64} color="#16a34a" style={{ marginBottom: '16px' }} />
                  <h2 style={{ color: '#15803d', marginBottom: '8px' }}>Consenso registrato!</h2>
                  <p style={{ color: '#6b7280', marginBottom: '24px' }}>Il consenso GDPR di <strong>{consensoPaziente.firstName} {consensoPaziente.lastName}</strong> è stato salvato con firma digitale.</p>
                  <button onClick={() => setShowConsensoModal(false)} style={{ background: '#1e4d8c', color: 'white', border: 'none', borderRadius: '8px', padding: '12px 28px', fontWeight: '700', cursor: 'pointer' }}>Chiudi</button>
                </div>
              ) : (
                <>
                  {/* Testo informativa */}
                  <div style={{ fontSize: '0.82rem', color: '#374151', lineHeight: 1.7, marginBottom: '20px' }}>
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 16px', marginBottom: '14px', fontSize: '0.83rem' }}>
                      <strong>Gent. Sig./Sig.ra {consensoPaziente.firstName} {consensoPaziente.lastName}</strong>,<br/>
                      con la presente La informiamo che la nostra Società <strong>Abbraccio Cure Domiciliari</strong> (Roma, Via Di Santa Maria Ausiliatrice 4b) tratterà i Suoi dati personali in qualità di Responsabile del trattamento per l'erogazione dei servizi di assistenza domiciliare, ai sensi del Reg. UE 2016/679 (GDPR).
                    </div>

                    <strong style={{ display: 'block', color: '#1e4d8c', marginBottom: '4px' }}>Dati trattati:</strong>
                    <ul style={{ marginLeft: '18px', marginBottom: '10px' }}>
                      <li>Dati comuni identificativi (nome, indirizzo, telefono, email)</li>
                      <li>Categorie particolari (dati sanitari, cartella clinica) — art. 9 GDPR</li>
                    </ul>

                    <strong style={{ display: 'block', color: '#1e4d8c', marginBottom: '4px' }}>Finalità:</strong>
                    <ul style={{ marginLeft: '18px', marginBottom: '10px' }}>
                      <li>Erogazione delle cure domiciliari e gestione della cartella clinica</li>
                      <li>Adempimenti di legge (conservazione 10 anni dalla cessazione del servizio)</li>
                      <li>Comunicazione a enti pubblici (ASL), medici specialisti, strutture sanitarie</li>
                    </ul>

                    <strong style={{ display: 'block', color: '#1e4d8c', marginBottom: '4px' }}>I Suoi diritti (artt. 15–21 GDPR):</strong>
                    <ul style={{ marginLeft: '18px', marginBottom: '10px' }}>
                      <li>Accesso, rettifica, cancellazione ("diritto all'oblio"), limitazione, portabilità, opposizione</li>
                      <li>Revoca del consenso in qualsiasi momento senza pregiudizio per il trattamento pregresso</li>
                    </ul>

                    <strong style={{ display: 'block', color: '#1e4d8c', marginBottom: '4px' }}>Contatti:</strong>
                    <p style={{ marginBottom: '0', color: '#555' }}>abbracciocuredomiciliari@gmail.com — Tel. 351 417 5117 | Garante Privacy: garante@gpdp.it</p>
                  </div>

                  <div style={{ background: '#fef3c7', borderLeft: '3px solid #f59e0b', padding: '10px 14px', borderRadius: '0 6px 6px 0', fontSize: '0.82rem', marginBottom: '20px' }}>
                    Il mancato conferimento dei dati sanitari potrebbe impedire la corretta erogazione delle cure domiciliari.
                  </div>

                  {/* Selezione ruolo firmatario */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '8px', fontSize: '0.9rem' }}>Chi firma?</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {(['paziente', 'familiare', 'tutore'] as const).map(r => (
                        <button key={r} type="button" onClick={() => setFirmaConsensoRuolo(r)}
                          style={{ padding: '9px 16px', borderRadius: '8px', border: `2px solid ${firmaConsensoRuolo === r ? '#1e4d8c' : '#d1d5db'}`, background: firmaConsensoRuolo === r ? '#1e4d8c' : 'white', color: firmaConsensoRuolo === r ? 'white' : '#374151', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', textTransform: 'capitalize' }}>
                          {r === 'paziente' ? '🧑 Paziente' : r === 'familiare' ? '👨‍👩‍👧 Familiare' : '📋 Tutore legale'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '6px', fontSize: '0.9rem' }}>Nome del firmatario *</label>
                    <input type="text" value={firmaConsensoNome} onChange={e => setFirmaConsensoNome(e.target.value)}
                      placeholder="Nome e Cognome"
                      style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', boxSizing: 'border-box' }} />
                  </div>

                  {/* Consenso checkbox */}
                  <div style={{ border: '2px solid #1e4d8c', borderRadius: '10px', padding: '16px', marginBottom: '20px', background: '#f8faff' }}>
                    <p style={{ fontSize: '0.88rem', color: '#374151', marginBottom: '12px', fontWeight: '600' }}>📋 Preso atto dell'informativa sul trattamento dei dati personali e di categoria particolare:</p>
                    <p style={{ fontSize: '0.88rem', color: '#374151', lineHeight: 1.6 }}>
                      Acconsento al trattamento dei miei Dati Personali per le finalità connesse alla corretta esecuzione del/i servizio/i di assistenza domiciliare richiesto/i.
                    </p>
                  </div>

                  {/* FirmaCanvas */}
                  <FirmaCanvas
                    label="✍️ Firma del paziente / firmatario"
                    sublabel="Firmare con il dito o con la penna sullo schermo"
                    onFirmaCompleta={(f) => setFirmaConsenso(f)}
                    onCancella={() => setFirmaConsenso('')}
                    altezza={200}
                  />

                  {/* Pulsante salva */}
                  <button
                    type="button"
                    disabled={!firmaConsenso || !firmaConsensoNome || salvandoConsenso}
                    onClick={async () => {
                      if (!firmaConsenso || !firmaConsensoNome) return;
                      setSalvandoConsenso(true);
                      try {
                        await api.post('/gdpr/consenso', {
                          patientId: consensoPaziente._id,
                          finalita: { prestazioneSanitaria: true, fatturazione: true, auditInterno: true, ricercaScientifica: false },
                          datiSensibili: { datiSanitari: true, datiEconomici: true, immagini: false },
                          comunicazioneTerzi: { mediciSpecialisti: false, struttureSanitarie: false, familiari: false, assicurazioni: false },
                          firmatoDa: firmaConsensoRuolo,
                          nomeFirmatario: firmaConsensoNome.split(' ')[0] || firmaConsensoNome,
                          cognomeFirmatario: firmaConsensoNome.split(' ').slice(1).join(' ') || '',
                          versioneInformativa: 'v2025.1',
                          firmaDigitale: firmaConsenso,
                        });
                        setConsensoSalvato(true);
                      } catch (err: any) {
                        alert(err?.response?.data?.message || 'Errore nel salvataggio del consenso');
                      } finally { setSalvandoConsenso(false); }
                    }}
                    style={{ width: '100%', padding: '14px', background: firmaConsenso && firmaConsensoNome ? '#15803d' : '#d1d5db', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '1rem', cursor: firmaConsenso && firmaConsensoNome ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}
                  >
                    {salvandoConsenso ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Shield size={18} />}
                    {salvandoConsenso ? 'Salvataggio...' : 'Conferma e salva consenso GDPR'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Documents Modal */}
      {showDocumentsModal && selectedPatient && (
        <div className="modal-overlay" onClick={closeDocumentsModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FolderOpen size={24} />
                  Documenti Paziente
                </h3>
                <p style={{ margin: '4px 0 0', color: 'var(--gray-500)', fontSize: '0.92rem' }}>
                  {selectedPatient.firstName} {selectedPatient.lastName} - {formatDate(selectedPatient.birthDate)}
                </p>
              </div>
              <button
                onClick={closeDocumentsModal}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--gray-500)',
                }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Upload Section */}
            {canEdit && (
              <div style={{
                marginBottom: '24px',
                padding: '20px',
                border: '2px dashed var(--gray-300)',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--gray-50)',
              }}>
                <h4 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Upload size={18} />
                  Carica Nuovo Documento
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <label>
                    Titolo *
                    <input
                      type="text"
                      value={uploadForm.title}
                      onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                      placeholder="Es. Emocromo completo"
                    />
                  </label>
                  <label>
                    Categoria *
                    <select
                      value={uploadForm.category}
                      onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                    >
                      <option value="">Seleziona categoria...</option>
                      <option value="cartella_clinica">Cartella Clinica</option>
                      <option value="esame">Esame</option>
                      <option value="risultato_analisi">Risultato Analisi</option>
                      <option value="consulenza">Consulenza</option>
                    </select>
                  </label>
                </div>

                <label style={{ marginBottom: '16px', display: 'block' }}>
                  Descrizione (opzionale)
                  <textarea
                    value={uploadForm.description}
                    onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                    placeholder="Breve descrizione del documento..."
                    rows={2}
                  />
                </label>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    style={{ display: 'none' }}
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ background: 'var(--gray-500)' }}
                  >
                    Scegli file...
                  </button>
                  {fileInputRef.current?.files?.[0] && (
                    <span style={{ color: 'var(--gray-600)', fontSize: '0.92rem' }}>
                      {fileInputRef.current.files[0].name}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={uploading || !fileInputRef.current?.files?.[0]}
                    style={{
                      background: 'var(--success)',
                      marginLeft: 'auto',
                      opacity: uploading || !fileInputRef.current?.files?.[0] ? 0.6 : 1,
                    }}
                  >
                    {uploading ? (
                      <>
                        <Loader2 size={16} className="spin" />
                        Caricamento...
                      </>
                    ) : (
                      <>
                        <Upload size={16} />
                        Carica
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Filter by Category */}
            <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => { setSelectedCategory(''); loadPatientDocuments(selectedPatient._id); }}
                style={{
                  background: !selectedCategory ? 'var(--primary)' : 'var(--gray-200)',
                  color: !selectedCategory ? 'white' : 'var(--gray-700)',
                  padding: '8px 16px',
                  fontSize: '0.88rem',
                }}
              >
                Tutti
              </button>
              {(Object.keys(categoryLabels) as string[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => { setSelectedCategory(cat); loadPatientDocuments(selectedPatient._id); }}
                  style={{
                    background: selectedCategory === cat ? categoryColors[cat] : 'var(--gray-200)',
                    color: selectedCategory === cat ? 'white' : 'var(--gray-700)',
                    padding: '8px 16px',
                    fontSize: '0.88rem',
                  }}
                >
                  {categoryLabels[cat]}
                </button>
              ))}
            </div>

            {/* Documents List */}
            {documents.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '32px', color: 'var(--gray-500)' }}>
                Nessun documento presente per questo paziente.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {documents.map((doc) => {
                  const Icon = categoryIcons[doc.category] || FolderOpen;
                  return (
                    <div
                      key={doc._id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        padding: '16px',
                        border: '1px solid var(--gray-200)',
                        borderRadius: 'var(--radius-lg)',
                        backgroundColor: 'white',
                      }}
                    >
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: `${categoryColors[doc.category]}20`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Icon size={24} color={categoryColors[doc.category]} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{
                            fontSize: '0.75rem',
                            padding: '2px 8px',
                            backgroundColor: `${categoryColors[doc.category]}20`,
                            color: categoryColors[doc.category],
                            borderRadius: 'var(--radius-full)',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}>
                            {categoryLabels[doc.category]}
                          </span>
                          <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {doc.title}
                          </strong>
                        </div>
                        {doc.description && (
                          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: '4px' }}>
                            {doc.description}
                          </p>
                        )}
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--gray-400)' }}>
                          {formatDate(doc.createdAt)} {doc.uploadedByNome && `• Caricato da ${doc.uploadedByNome}`}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => downloadDocument(doc._id, doc.fileName)}
                          style={{ background: 'var(--success)', padding: '8px 12px' }}
                        >
                          <Download size={16} />
                          Scarica
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => deleteDocument(doc._id)}
                            style={{ background: 'var(--danger)', padding: '8px 12px' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

    </section>
  );
}

export default Patients;
