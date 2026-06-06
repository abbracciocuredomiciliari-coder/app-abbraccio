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
} from 'lucide-react';

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
    contactPhone: ''
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
        contactPhone: ''
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
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          backgroundColor: 'var(--success-bg)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--success)',
          marginBottom: '16px',
        }}>
          <AlertCircle size={18} />
          {success}
        </div>
      )}

      {/* Search Bar */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '20px',
        alignItems: 'center',
      }}>
        <div style={{
          flex: 1,
          position: 'relative',
        }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--gray-400)',
            }}
          />
          <input
            type="text"
            placeholder="Cerca per nome, cognome o ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px 12px 44px',
              border: '1px solid var(--gray-300)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.95rem',
              outline: 'none',
              transition: 'border-color var(--transition-fast)',
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--gray-300)'}
          />
        </div>
        {canEdit && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="add-button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              whiteSpace: 'nowrap',
            }}
          >
            <UserPlus size={18} />
            {showForm ? 'Annulla' : 'Nuovo Paziente'}
          </button>
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
                  </div>
                  <div style={{ fontSize: '0.88rem', color: 'var(--gray-600)', marginTop: '4px', fontStyle: 'italic' }}>
                    💡 {patient.assistanceNeeds}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
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
