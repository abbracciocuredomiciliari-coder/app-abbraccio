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
  Eye,
  Printer,
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
  codiceFiscale?: string;
  diagnosiAmmissione?: string;
  comorbilita?: string;
  allergie?: string;
  caregiverRiferimento?: string;
  caregiverTelefono?: string;
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

interface Consenso {
  _id: string;
  patientId: string;
  finalita: { prestazioneSanitaria: boolean; fatturazione: boolean; auditInterno: boolean; ricercaScientifica: boolean };
  datiSensibili: { datiSanitari: boolean; datiEconomici: boolean; immagini: boolean };
  comunicazioneTerzi: { mediciSpecialisti: boolean; struttureSanitarie: boolean; familiari: boolean; assicurazioni: boolean };
  firmatoDa: 'paziente' | 'familiare' | 'tutore';
  nomeFirmatario: string;
  cognomeFirmatario: string;
  dataFirma: string;
  versioneInformativa: string;
  revocato: boolean;
  operatoreEmail: string;
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

  // Stato modal dati clinici ADI
  const [showDatiCliniciModal, setShowDatiCliniciModal] = useState(false);
  const [datiCliniciPaziente, setDatiCliniciPaziente] = useState<Patient | null>(null);
  const [datiCliniciForm, setDatiCliniciForm] = useState({ codiceFiscale: '', diagnosiAmmissione: '', comorbilita: '', allergie: '', caregiverRiferimento: '', caregiverTelefono: '' });
  const [salvandoDatiCliniciADI, setSalvandoDatiCliniciADI] = useState(false);

  // Stato modal consenso GDPR
  const [showConsensoModal, setShowConsensoModal] = useState(false);
  const [consensoPaziente, setConsensoPaziente] = useState<Patient | null>(null);
  const [activeConsenso, setActiveConsenso] = useState<Consenso | null>(null);
  const [consensoLoading, setConsensoLoading] = useState(false);
  const [firmaConsenso, setFirmaConsenso] = useState('');
  const [firmaConsensoNome, setFirmaConsensoNome] = useState('');
  const [firmaConsensoRuolo, setFirmaConsensoRuolo] = useState<'paziente' | 'familiare' | 'tutore'>('paziente');
  const [salvandoConsenso, setSalvandoConsenso] = useState(false);
  const [consensoSalvato, setConsensoSalvato] = useState<false | 'ok' | 'email'>(false);
  const [emailConsenso, setEmailConsenso] = useState('');

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

  const loadActiveConsenso = async (patientId: string) => {
    try {
      setConsensoLoading(true);
      const response = await api.get(`/gdpr/consenso/${patientId}`);
      setActiveConsenso(response.data.consenso || null);
    } catch (error) {
      setActiveConsenso(null);
    } finally {
      setConsensoLoading(false);
    }
  };

  const openDocumentsModal = async (patient: Patient) => {
    setSelectedPatient(patient);
    setSelectedCategory('');
    await Promise.all([loadPatientDocuments(patient._id), loadActiveConsenso(patient._id)]);
    setShowDocumentsModal(true);
  };

  const closeDocumentsModal = () => {
    setShowDocumentsModal(false);
    setSelectedPatient(null);
    setDocuments([]);
    setUploadForm({ title: '', description: '', category: '' });
    setActiveConsenso(null);
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

  const getDocumentBlobUrl = async (documentId: string, contentType: string) => {
    const token = getToken();
    if (!token) return null;

    const response = await api.get(`/documents/documents/${documentId}`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'blob'
    });

    const blob = new Blob([response.data], { type: typeof contentType === 'string' ? contentType : 'application/octet-stream' });
    return window.URL.createObjectURL(blob);
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

  const openDocument = async (documentId: string, contentType: string, fileName: string) => {
    try {
      const url = await getDocumentBlobUrl(documentId, contentType);
      if (!url) {
        alert('Impossibile aprire il documento');
        return;
      }
      const isPdf = contentType.toLowerCase().includes('pdf');
      if (isPdf) {
        const newWindow = window.open(url, '_blank');
        if (!newWindow) {
          alert('Impossibile aprire il documento PDF. Controlla il blocco popup del browser.');
          window.URL.revokeObjectURL(url);
          return;
        }
        newWindow.focus();
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch (error) {
      console.error('Errore apertura documento:', error);
      alert('Errore nell\'apertura del documento');
    }
  };

  const printDocument = async (documentId: string, contentType: string, fileName: string) => {
    try {
      const url = await getDocumentBlobUrl(documentId, contentType);
      if (!url) {
        alert('Impossibile stampare il documento');
        return;
      }
      const isPdf = contentType.toLowerCase().includes('pdf');
      if (isPdf) {
        const newWindow = window.open(url, '_blank');
        if (!newWindow) {
          alert('Impossibile aprire la finestra di stampa. Controlla il blocco popup del browser.');
          window.URL.revokeObjectURL(url);
          return;
        }
        newWindow.focus();
        newWindow.onload = () => {
          try {
            newWindow.print();
          } catch (err) {
            console.warn('Stampa automatica fallita', err);
          }
        };
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        alert('Documento non PDF: è stato scaricato per la stampa locale.');
      }
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch (error) {
      console.error('Errore stampa documento:', error);
      alert('Errore nella stampa del documento');
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

  const generatePatientSummaryHtml = (patient: Patient, documents: PatientDocument[], consenso: Consenso | null, autoPrint = false) => {
    const documentRows = documents.map((doc, index) => {
      const uploaded = doc.uploadedByNome ? `Caricato da ${doc.uploadedByNome}` : 'Caricato dal sistema';
      return `<tr style="border-bottom:1px solid #e5e7eb"><td style="padding:8px">${index + 1}</td><td style="padding:8px">${categoryLabels[doc.category]}</td><td style="padding:8px">${doc.title}</td><td style="padding:8px">${doc.fileName}</td><td style="padding:8px">${uploaded}</td></tr>`;
    }).join('');

    const consensoHtml = consenso ? `
      <h2 style="font-size:13pt;color:#1e40af;margin-top:24px">Consenso GDPR attivo</h2>
      <div style="padding:14px;background:#f8fafc;border:1px solid #dbeafe;border-radius:10px;margin-bottom:20px">
        <p style="margin:0 0 8px"><strong>Firmatario:</strong> ${consenso.nomeFirmatario} ${consenso.cognomeFirmatario} (${consenso.firmatoDa})</p>
        <p style="margin:0 0 8px"><strong>Data firma:</strong> ${new Date(consenso.dataFirma).toLocaleDateString('it-IT')}</p>
        <p style="margin:0 0 8px"><strong>Versione informativa:</strong> ${consenso.versioneInformativa}</p>
        <p style="margin:0"><strong>Finalità:</strong> ${Object.entries(consenso.finalita).filter(([, v]) => v).map(([k]) => k === 'prestazioneSanitaria' ? 'Prestazione Sanitaria' : k === 'fatturazione' ? 'Fatturazione' : k === 'auditInterno' ? 'Audit Interno' : 'Ricerca Scientifica').join(', ')}</p>
      </div>
    ` : '<p style="color:#475569;">Nessun consenso GDPR attivo trovato.</p>';

    return `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Riepilogo paziente ${patient.firstName} ${patient.lastName}</title><style>
      body{font-family:Arial,sans-serif;color:#111;margin:0;padding:24px}
      h1{font-size:18pt;color:#1e40af;margin-bottom:8px}
      h2{font-size:13pt;color:#1e40af;margin-top:24px;margin-bottom:10px}
      p{font-size:10pt;line-height:1.6;margin:0 0 10px}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border:1px solid #e5e7eb;padding:10px;text-align:left;font-size:10pt}
      th{background:#eff6ff}
      .section{margin-top:18px}
    </style></head><body>
      <h1>Riepilogo paziente</h1>
      <p><strong>Paziente:</strong> ${patient.firstName} ${patient.lastName}</p>
      <p><strong>Data di nascita:</strong> ${formatDate(patient.birthDate)}</p>
      <p><strong>Indirizzo:</strong> ${patient.address}</p>
      <p><strong>Contatto:</strong> ${patient.contactPhone || 'N/D'} | ${patient.email || 'N/D'}</p>
      <p><strong>Fabbisogni assistenziali:</strong> ${patient.assistanceNeeds || 'N/D'}</p>
      <p><strong>Diagnosi ammissione:</strong> ${patient.diagnosiAmmissione || 'N/D'}</p>
      <p><strong>Comorbilità:</strong> ${patient.comorbilita || 'N/D'}</p>
      <p><strong>Allergie:</strong> ${patient.allergie || 'N/D'}</p>
      <p><strong>Caregiver:</strong> ${patient.caregiverRiferimento || 'N/D'} (${patient.caregiverTelefono || 'N/D'})</p>

      <div class="section">
        <h2>Documentazione clinica</h2>
        ${documents.length === 0 ? '<p>Nessun documento caricato.</p>' : `<table><thead><tr><th>#</th><th>Categoria</th><th>Titolo</th><th>File</th><th>Info</th></tr></thead><tbody>${documentRows}</tbody></table>`}
      </div>
      <div class="section">
        ${consensoHtml}
      </div>
      <p style="margin-top:24px;font-size:9pt;color:#475569">Generato il: ${new Date().toLocaleDateString('it-IT')} ${new Date().toLocaleTimeString('it-IT')}</p>
      ${autoPrint ? '<script>window.onload=function(){window.print()}</script>' : ''}
    </body></html>`;
  };

  const openPatientSummaryPdf = (patient: Patient) => {
    const win = window.open('', '_blank');
    if (!win) {
      alert('Impossibile aprire il PDF. Controlla il blocco popup del browser.');
      return;
    }
    const html = generatePatientSummaryHtml(patient, documents, activeConsenso, false);
    win.document.write(html);
    win.document.close();
    win.focus();
  };

  const printPatientSummaryPdf = (patient: Patient) => {
    const win = window.open('', '_blank');
    if (!win) {
      alert('Impossibile aprire il PDF. Controlla il blocco popup del browser.');
      return;
    }
    const html = generatePatientSummaryHtml(patient, documents, activeConsenso, true);
    win.document.write(html);
    win.document.close();
    win.focus();
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
                  {(patient.diagnosiAmmissione || patient.allergie || patient.caregiverRiferimento) && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {patient.diagnosiAmmissione && <span style={{ fontSize: '0.78rem', background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bfdbfe' }}>🏥 {patient.diagnosiAmmissione.slice(0, 40)}{patient.diagnosiAmmissione.length > 40 ? '…' : ''}</span>}
                      {patient.allergie && <span style={{ fontSize: '0.78rem', background: '#fef2f2', color: '#dc2626', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fecaca', fontWeight: '600' }}>⚠️ {patient.allergie.slice(0, 30)}{patient.allergie.length > 30 ? '…' : ''}</span>}
                      {patient.caregiverRiferimento && <span style={{ fontSize: '0.78rem', background: '#f0fdf4', color: '#16a34a', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bbf7d0' }}>👤 {patient.caregiverRiferimento}</span>}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      setDatiCliniciPaziente(patient);
                      setDatiCliniciForm({
                        codiceFiscale: patient.codiceFiscale || '',
                        diagnosiAmmissione: patient.diagnosiAmmissione || '',
                        comorbilita: patient.comorbilita || '',
                        allergie: patient.allergie || '',
                        caregiverRiferimento: patient.caregiverRiferimento || '',
                        caregiverTelefono: patient.caregiverTelefono || '',
                      });
                      setShowDatiCliniciModal(true);
                    }}
                    style={{ background: '#0369a1', color: 'white', whiteSpace: 'nowrap' }}
                    title="Dati Clinici ADI"
                  >
                    <Stethoscope size={16} />
                    ADI
                  </button>
                  <button
                    onClick={() => {
                      setConsensoPaziente(patient);
                      setFirmaConsenso('');
                      setFirmaConsensoNome(patient.firstName + ' ' + patient.lastName);
                      setFirmaConsensoRuolo('paziente');
                      setConsensoSalvato(false);
                      setEmailConsenso(patient.email || '');
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
                  <p style={{ color: '#6b7280', marginBottom: '8px' }}>Il consenso GDPR di <strong>{consensoPaziente.firstName} {consensoPaziente.lastName}</strong> è stato salvato con firma digitale.</p>
                  {consensoSalvato === 'email' && (
                    <p style={{ color: '#059669', fontWeight: '600', marginBottom: '20px', fontSize: '0.95rem' }}>✉️ Copia email inviata a <strong>{emailConsenso}</strong></p>
                  )}
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

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '6px', fontSize: '0.9rem' }}>
                      📧 Email per copia consenso <span style={{ fontWeight: 400, color: '#9ca3af' }}>(opzionale)</span>
                    </label>
                    <input type="email" value={emailConsenso} onChange={e => setEmailConsenso(e.target.value)}
                      placeholder="es. nome@email.it"
                      style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', boxSizing: 'border-box' }} />
                    {emailConsenso && <p style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '4px' }}>✉️ Al salvataggio verrà inviata una copia email con il riepilogo del consenso firmato.</p>}
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
                        const res = await api.post('/gdpr/consenso', {
                          patientId: consensoPaziente._id,
                          finalita: { prestazioneSanitaria: true, fatturazione: true, auditInterno: true, ricercaScientifica: false },
                          datiSensibili: { datiSanitari: true, datiEconomici: true, immagini: false },
                          comunicazioneTerzi: { mediciSpecialisti: false, struttureSanitarie: false, familiari: false, assicurazioni: false },
                          firmatoDa: firmaConsensoRuolo,
                          nomeFirmatario: firmaConsensoNome.split(' ')[0] || firmaConsensoNome,
                          cognomeFirmatario: firmaConsensoNome.split(' ').slice(1).join(' ') || '',
                          versioneInformativa: 'v2025.1',
                          firmaDigitale: firmaConsenso,
                          ...(emailConsenso.trim() ? { emailNotifica: emailConsenso.trim() } : {}),
                        });
                        setConsensoSalvato(res.data.emailInviata ? 'email' : 'ok');
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

      {/* === Modal Dati Clinici ADI === */}
      {showDatiCliniciModal && datiCliniciPaziente && (
        <div className="modal-overlay" onClick={() => setShowDatiCliniciModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#0369a1' }}>
                  <Stethoscope size={22} /> Dati Clinici ADI
                </h3>
                <p style={{ margin: '4px 0 0', color: 'var(--gray-500)', fontSize: '0.9rem' }}>
                  {datiCliniciPaziente.firstName} {datiCliniciPaziente.lastName}
                </p>
              </div>
              <button onClick={() => setShowDatiCliniciModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-500)' }}>
                <X size={24} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontWeight: '600', fontSize: '0.85rem', color: '#374151', display: 'block', marginBottom: '4px' }}>Codice Fiscale</label>
                <input type="text" value={datiCliniciForm.codiceFiscale} onChange={e => setDatiCliniciForm(p => ({ ...p, codiceFiscale: e.target.value.toUpperCase() }))} placeholder="es. RSSMRA80A01H501Z" style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box', fontFamily: 'monospace' }} />
              </div>
              <div>
                <label style={{ fontWeight: '600', fontSize: '0.85rem', color: '#374151', display: 'block', marginBottom: '4px' }}>Diagnosi di ammissione / Patologia principale</label>
                <textarea value={datiCliniciForm.diagnosiAmmissione} onChange={e => setDatiCliniciForm(p => ({ ...p, diagnosiAmmissione: e.target.value }))} placeholder="es. Scompenso cardiaco cronico, BPCO, ..." rows={3} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontWeight: '600', fontSize: '0.85rem', color: '#374151', display: 'block', marginBottom: '4px' }}>Comorbilità / Patologie associate</label>
                <textarea value={datiCliniciForm.comorbilita} onChange={e => setDatiCliniciForm(p => ({ ...p, comorbilita: e.target.value }))} placeholder="es. Diabete mellito tipo 2, Ipertensione arteriosa, ..." rows={3} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontWeight: '600', fontSize: '0.85rem', color: '#dc2626', display: 'block', marginBottom: '4px' }}>⚠️ Allergie / Intolleranze farmacologiche</label>
                <textarea value={datiCliniciForm.allergie} onChange={e => setDatiCliniciForm(p => ({ ...p, allergie: e.target.value }))} placeholder="es. Penicillina, FANS, lattice, ... (NESSUNA se assenti)" rows={2} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #fca5a5', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box', background: '#fff7f7' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontWeight: '600', fontSize: '0.85rem', color: '#374151', display: 'block', marginBottom: '4px' }}>Caregiver / Familiare di riferimento</label>
                  <input type="text" value={datiCliniciForm.caregiverRiferimento} onChange={e => setDatiCliniciForm(p => ({ ...p, caregiverRiferimento: e.target.value }))} placeholder="Nome e cognome" style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontWeight: '600', fontSize: '0.85rem', color: '#374151', display: 'block', marginBottom: '4px' }}>Telefono caregiver</label>
                  <input type="tel" value={datiCliniciForm.caregiverTelefono} onChange={e => setDatiCliniciForm(p => ({ ...p, caregiverTelefono: e.target.value }))} placeholder="es. 3331234567" style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={salvandoDatiCliniciADI}
              onClick={async () => {
                setSalvandoDatiCliniciADI(true);
                try {
                  const res = await api.patch(`/patients/${datiCliniciPaziente._id}/dati-clinici`, datiCliniciForm);
                  setPatients(prev => prev.map(p => p._id === datiCliniciPaziente._id ? { ...p, ...res.data } : p));
                  setFilteredPatients(prev => prev.map(p => p._id === datiCliniciPaziente._id ? { ...p, ...res.data } : p));
                  setShowDatiCliniciModal(false);
                  setSuccess('✅ Dati clinici ADI salvati!');
                  setTimeout(() => setSuccess(''), 3000);
                } catch (err: any) {
                  alert(err?.response?.data?.message || 'Errore nel salvataggio');
                } finally { setSalvandoDatiCliniciADI(false); }
              }}
              style={{ marginTop: '20px', width: '100%', padding: '13px', background: salvandoDatiCliniciADI ? '#93c5fd' : '#0369a1', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '1rem', cursor: salvandoDatiCliniciADI ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {salvandoDatiCliniciADI ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={18} />}
              {salvandoDatiCliniciADI ? 'Salvataggio...' : 'Salva dati clinici ADI'}
            </button>
          </div>
        </div>
      )}

      {/* Documents Modal */}
      {showDocumentsModal && selectedPatient && (
        <div className="modal-overlay" onClick={closeDocumentsModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FolderOpen size={24} />
                  Documenti Paziente
                </h3>
                <p style={{ margin: '4px 0 0', color: 'var(--gray-500)', fontSize: '0.92rem' }}>
                  {selectedPatient.firstName} {selectedPatient.lastName} - {formatDate(selectedPatient.birthDate)}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => openPatientSummaryPdf(selectedPatient)}
                  style={{ background: '#2563eb', color: 'white', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Eye size={16} />
                  Visualizza PDF
                </button>
                <button
                  type="button"
                  onClick={() => printPatientSummaryPdf(selectedPatient)}
                  style={{ background: '#059669', color: 'white', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Printer size={16} />
                  Stampa PDF
                </button>
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
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => openDocument(doc._id, doc.contentType, doc.fileName)}
                          style={{ background: '#2563eb', color: 'white', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Eye size={16} />
                          Apri
                        </button>
                        <button
                          type="button"
                          onClick={() => printDocument(doc._id, doc.contentType, doc.fileName)}
                          style={{ background: '#0f766e', color: 'white', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Printer size={16} />
                          Stampa
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadDocument(doc._id, doc.fileName)}
                          style={{ background: 'var(--success)', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Download size={16} />
                          Scarica
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => deleteDocument(doc._id)}
                            style={{ background: 'var(--danger)', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
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
