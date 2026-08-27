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
  MessageCircle,
} from 'lucide-react';
import FirmaCanvas from '../components/FirmaCanvas';
import { ChatWidget } from '../components/ChatWidget';
import { ReportGenerator } from '../components/ReportGenerator';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Loading } from '../components/ui/Loading';
import { Dropdown } from '../components/ui/Dropdown';

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
  const [chatPatient, setChatPatient] = useState<Patient | null>(null);
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
    <section className="tw-max-w-none">
      <h2 className="tw-flex tw-items-center tw-gap-2">
        <FileText size={28} />
        Gestione Pazienti
      </h2>

      {success && (
        <Alert type="success" onClose={() => setSuccess('')} style={{ marginBottom: '16px' }}>
          {success}
        </Alert>
      )}

      {/* Search Bar */}
      <div className="tw-flex tw-flex-wrap tw-gap-3 tw-mb-5 tw-items-center">
        <div className="tw-flex-1 tw-min-w-[220px]">
          <Input
            placeholder="Cerca per nome, cognome o ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search size={18} />}
          />
        </div>
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
        <p className="tw-mb-4 tw-text-slate-500 tw-text-[0.92rem]">
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
          <div className="tw-grid sm:tw-grid-cols-2 tw-gap-4">
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
            <div className="tw-flex tw-items-center tw-gap-2 tw-p-3 tw-rounded-lg tw-bg-red-600/10 tw-text-red-600 tw-text-[0.92rem]">
              <AlertCircle size={18} />
              {error}
            </div>
          )}
          <button type="submit">Salva Paziente</button>
        </form>
      )}

      {/* Patients List */}
      <div className="tw-bg-white tw-border tw-border-slate-200 tw-rounded-2xl tw-shadow-sm tw-p-5">
        <h3 className="tw-flex tw-items-center tw-gap-2 tw-m-0 tw-mb-4 tw-text-slate-700">
          <FileText size={20} />
          Elenco Pazienti ({filteredPatients.length})
        </h3>
        {loading ? (
          <div style={{ padding: '8px 0' }}><SkeletonList rows={6} showHeader={false} /></div>
        ) : filteredPatients.length === 0 ? (
          <p className="tw-text-center tw-py-8 tw-text-slate-500">
            {searchTerm ? 'Nessun paziente trovato.' : 'Nessun paziente presente.'}
          </p>
        ) : (
          <ul className="tw-flex tw-flex-col tw-gap-3 tw-list-none tw-m-0 tw-p-0">
            {filteredPatients.map((patient) => (
              <li key={patient._id} className="tw-flex tw-flex-wrap tw-justify-between tw-items-center tw-gap-4 tw-p-4 tw-rounded-xl tw-border tw-border-slate-200 hover:tw-border-slate-300 tw-transition-colors">
                <div className="tw-flex-1 tw-min-w-[240px]">
                  <div className="tw-flex tw-items-center tw-gap-3 tw-mb-1">
                    <strong className="tw-text-[1.05rem]">
                      {patient.firstName} {patient.lastName}
                    </strong>
                    <span className="tw-text-xs tw-px-2 tw-py-0.5 tw-rounded-full tw-bg-brand/10 tw-text-brand tw-font-medium">
                      ID: {patient._id.slice(-6).toUpperCase()}
                    </span>
                  </div>
                  <div className="tw-flex tw-flex-wrap tw-gap-4 tw-text-[0.88rem] tw-text-slate-500">
                    <span>📅 Nato il: {formatDate(patient.birthDate)}</span>
                    <span>📍 {patient.address}</span>
                    {patient.contactPhone && <span>📞 {patient.contactPhone}</span>}
                    {patient.email && <span>✉️ {patient.email}</span>}
                  </div>
                  <div className="tw-text-[0.88rem] tw-text-slate-600 tw-mt-1 tw-italic">
                    💡 {patient.assistanceNeeds}
                  </div>
                  {(patient.diagnosiAmmissione || patient.allergie || patient.caregiverRiferimento) && (
                    <div className="tw-flex tw-flex-wrap tw-gap-2 tw-mt-1.5">
                      {patient.diagnosiAmmissione && <span className="tw-text-xs tw-bg-blue-50 tw-text-blue-700 tw-px-2 tw-py-0.5 tw-rounded tw-border tw-border-blue-200">🏥 {patient.diagnosiAmmissione.slice(0, 40)}{patient.diagnosiAmmissione.length > 40 ? '…' : ''}</span>}
                      {patient.allergie && <span className="tw-text-xs tw-bg-red-50 tw-text-red-600 tw-px-2 tw-py-0.5 tw-rounded tw-border tw-border-red-200 tw-font-semibold">⚠️ {patient.allergie.slice(0, 30)}{patient.allergie.length > 30 ? '…' : ''}</span>}
                      {patient.caregiverRiferimento && <span className="tw-text-xs tw-bg-green-50 tw-text-green-700 tw-px-2 tw-py-0.5 tw-rounded tw-border tw-border-green-200">👤 {patient.caregiverRiferimento}</span>}
                    </div>
                  )}
                </div>
                <div className="tw-flex tw-gap-2 tw-flex-shrink-0 tw-items-center">
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
                  <button
                    onClick={() => setChatPatient(patient)}
                    style={{
                      background: '#0d9488',
                      color: 'white',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <MessageCircle size={16} />
                    Chat
                  </button>
                  <ReportGenerator
                    patientId={patient._id}
                    patientName={`${patient.firstName} ${patient.lastName}`}
                    renderTrigger={({ onClick, loading }) => (
                      <Dropdown
                        items={[
                          {
                            label: 'Dati Clinici ADI',
                            icon: <Stethoscope size={16} />,
                            onClick: () => {
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
                            },
                          },
                          {
                            label: 'Consenso GDPR',
                            icon: <Shield size={16} />,
                            onClick: () => {
                              setConsensoPaziente(patient);
                              setFirmaConsenso('');
                              setFirmaConsensoNome(patient.firstName + ' ' + patient.lastName);
                              setFirmaConsensoRuolo('paziente');
                              setConsensoSalvato(false);
                              setEmailConsenso(patient.email || '');
                              setShowConsensoModal(true);
                            },
                          },
                          {
                            label: loading ? 'Generazione relazione...' : 'Relazione LLM',
                            icon: <FileText size={16} />,
                            onClick,
                          },
                          {
                            label: 'Elimina paziente',
                            icon: <Trash2 size={16} />,
                            onClick: () => deletePatient(patient._id),
                            danger: true,
                            hidden: user?.role !== 'admin',
                          },
                        ]}
                      />
                    )}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ═══ MODAL CONSENSO GDPR ═══ */}
      {showConsensoModal && consensoPaziente && (
        <div className="tw-fixed tw-inset-0 tw-z-50 tw-overflow-y-auto tw-bg-black/60" onClick={() => setShowConsensoModal(false)}>
          <div className="tw-min-h-screen tw-max-w-[700px] tw-mx-auto tw-bg-white tw-shadow-2xl" onClick={e => e.stopPropagation()}>

            {/* Header fisso */}
            <div className="tw-sticky tw-top-0 tw-z-10 tw-bg-brand tw-text-white tw-px-5 tw-py-3.5 tw-flex tw-justify-between tw-items-center">
              <div>
                <div className="tw-font-bold tw-text-base">🛡️ Consenso GDPR</div>
                <div className="tw-text-xs tw-opacity-80">{consensoPaziente.firstName} {consensoPaziente.lastName}</div>
              </div>
              <button onClick={() => setShowConsensoModal(false)} className="tw-bg-white/20 tw-border-0 tw-rounded-md tw-text-white tw-px-2.5 tw-py-1.5 tw-cursor-pointer hover:tw-bg-white/30">
                <X size={18} />
              </button>
            </div>

            <div className="tw-px-6 tw-py-5">

              {consensoSalvato ? (
                <div className="tw-text-center tw-py-12 tw-px-6">
                  <CheckCircle size={64} color="#16a34a" className="tw-mb-4" />
                  <h2 className="tw-text-green-700 tw-text-2xl tw-font-bold tw-mb-2">Consenso registrato!</h2>
                  <p className="tw-text-slate-500 tw-mb-2">Il consenso GDPR di <strong>{consensoPaziente.firstName} {consensoPaziente.lastName}</strong> è stato salvato con firma digitale.</p>
                  {consensoSalvato === 'email' && (
                    <p className="tw-text-emerald-600 tw-font-semibold tw-mb-5 tw-text-[0.95rem]">✉️ Copia email inviata a <strong>{emailConsenso}</strong></p>
                  )}
                  <button onClick={() => setShowConsensoModal(false)} className="tw-bg-brand tw-text-white tw-border-0 tw-rounded-lg tw-px-7 tw-py-3 tw-font-bold tw-cursor-pointer hover:tw-bg-brand-dark">Chiudi</button>
                </div>
              ) : (
                <>
                  {/* Testo informativa */}
                  <div className="tw-text-[0.82rem] tw-text-slate-700 tw-leading-relaxed tw-mb-5">
                    <div className="tw-bg-blue-50 tw-border tw-border-blue-200 tw-rounded-lg tw-p-3 tw-mb-3.5 tw-text-[0.83rem]">
                      <strong>Gent. Sig./Sig.ra {consensoPaziente.firstName} {consensoPaziente.lastName}</strong>,<br/>
                      con la presente La informiamo che la nostra Società <strong>Abbraccio Cure Domiciliari</strong> (Roma, Via Di Santa Maria Ausiliatrice 4b) tratterà i Suoi dati personali in qualità di Responsabile del trattamento per l'erogazione dei servizi di assistenza domiciliare, ai sensi del Reg. UE 2016/679 (GDPR).
                    </div>

                    <strong className="tw-block tw-text-brand tw-mb-1">Dati trattati:</strong>
                    <ul className="tw-list-disc tw-pl-5 tw-mb-2.5">
                      <li>Dati comuni identificativi (nome, indirizzo, telefono, email)</li>
                      <li>Categorie particolari (dati sanitari, cartella clinica) — art. 9 GDPR</li>
                    </ul>

                    <strong className="tw-block tw-text-brand tw-mb-1">Finalità:</strong>
                    <ul className="tw-list-disc tw-pl-5 tw-mb-2.5">
                      <li>Erogazione delle cure domiciliari e gestione della cartella clinica</li>
                      <li>Adempimenti di legge (conservazione 10 anni dalla cessazione del servizio)</li>
                      <li>Comunicazione a enti pubblici (ASL), medici specialisti, strutture sanitarie</li>
                    </ul>

                    <strong className="tw-block tw-text-brand tw-mb-1">I Suoi diritti (artt. 15–21 GDPR):</strong>
                    <ul className="tw-list-disc tw-pl-5 tw-mb-2.5">
                      <li>Accesso, rettifica, cancellazione ("diritto all'oblio"), limitazione, portabilità, opposizione</li>
                      <li>Revoca del consenso in qualsiasi momento senza pregiudizio per il trattamento pregresso</li>
                    </ul>

                    <strong className="tw-block tw-text-brand tw-mb-1">Contatti:</strong>
                    <p className="tw-text-slate-600 tw-mb-0">abbracciocuredomiciliari@gmail.com — Tel. 351 417 5117 | Garante Privacy: garante@gpdp.it</p>
                  </div>

                  <div className="tw-bg-amber-50 tw-border-l-4 tw-border-amber-500 tw-p-2.5 tw-rounded-r-lg tw-text-[0.82rem] tw-mb-5">
                    Il mancato conferimento dei dati sanitari potrebbe impedire la corretta erogazione delle cure domiciliari.
                  </div>

                  {/* Selezione ruolo firmatario */}
                  <div className="tw-mb-3.5">
                    <label className="tw-block tw-font-semibold tw-text-slate-700 tw-mb-2 tw-text-[0.9rem]">Chi firma?</label>
                    <div className="tw-flex tw-flex-wrap tw-gap-2">
                      {(['paziente', 'familiare', 'tutore'] as const).map(r => (
                        <button key={r} type="button" onClick={() => setFirmaConsensoRuolo(r)}
                          className={`tw-px-4 tw-py-2 tw-rounded-lg tw-border-2 tw-font-semibold tw-text-[0.85rem] tw-capitalize tw-cursor-pointer tw-transition-colors ${firmaConsensoRuolo === r ? 'tw-bg-brand tw-border-brand tw-text-white' : 'tw-bg-white tw-border-slate-300 tw-text-slate-700 hover:tw-bg-slate-50'}`}>
                          {r === 'paziente' ? '🧑 Paziente' : r === 'familiare' ? '👨‍👩‍👧 Familiare' : '📋 Tutore legale'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="tw-mb-4">
                    <label className="tw-block tw-font-semibold tw-text-slate-700 tw-mb-1.5 tw-text-[0.9rem]">Nome del firmatario *</label>
                    <input type="text" value={firmaConsensoNome} onChange={e => setFirmaConsensoNome(e.target.value)}
                      placeholder="Nome e Cognome"
                      className="tw-w-full tw-px-3.5 tw-py-2.5 tw-rounded-lg tw-border tw-border-slate-300 tw-text-[0.95rem]" />
                  </div>

                  <div className="tw-mb-4">
                    <label className="tw-block tw-font-semibold tw-text-slate-700 tw-mb-1.5 tw-text-[0.9rem]">
                      📧 Email per copia consenso <span className="tw-font-normal tw-text-slate-400">(opzionale)</span>
                    </label>
                    <input type="email" value={emailConsenso} onChange={e => setEmailConsenso(e.target.value)}
                      placeholder="es. nome@email.it"
                      className="tw-w-full tw-px-3.5 tw-py-2.5 tw-rounded-lg tw-border tw-border-slate-300 tw-text-[0.95rem]" />
                    {emailConsenso && <p className="tw-text-[0.78rem] tw-text-slate-500 tw-mt-1">✉️ Al salvataggio verrà inviata una copia email con il riepilogo del consenso firmato.</p>}
                  </div>

                  {/* Consenso checkbox */}
                  <div className="tw-border-2 tw-border-brand tw-rounded-xl tw-p-4 tw-mb-5 tw-bg-blue-50/50">
                    <p className="tw-text-[0.88rem] tw-text-slate-700 tw-mb-3 tw-font-semibold">📋 Preso atto dell'informativa sul trattamento dei dati personali e di categoria particolare:</p>
                    <p className="tw-text-[0.88rem] tw-text-slate-700 tw-leading-snug">
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
                    className={`tw-w-full tw-flex tw-items-center tw-justify-center tw-gap-2 tw-py-3.5 tw-rounded-xl tw-text-white tw-font-bold tw-text-base tw-border-0 tw-mb-3 ${firmaConsenso && firmaConsensoNome ? 'tw-bg-green-700 tw-cursor-pointer hover:tw-bg-green-800' : 'tw-bg-slate-300 tw-cursor-not-allowed'}`}
                  >
                    {salvandoConsenso ? <Loader2 size={18} className="tw-animate-spin" /> : <Shield size={18} />}
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
        <div className="tw-fixed tw-inset-0 tw-z-50 tw-bg-black/60 tw-flex tw-items-start tw-justify-center tw-p-4 tw-overflow-y-auto" onClick={() => setShowDatiCliniciModal(false)}>
          <div className="tw-bg-white tw-rounded-2xl tw-shadow-2xl tw-w-full tw-max-w-[600px] tw-my-10 tw-p-6" onClick={e => e.stopPropagation()}>
            <div className="tw-flex tw-justify-between tw-items-center tw-mb-5">
              <div>
                <h3 className="tw-m-0 tw-flex tw-items-center tw-gap-2.5 tw-text-sky-700 tw-text-lg">
                  <Stethoscope size={22} /> Dati Clinici ADI
                </h3>
                <p className="tw-m-0 tw-mt-1 tw-text-slate-500 tw-text-[0.9rem]">
                  {datiCliniciPaziente.firstName} {datiCliniciPaziente.lastName}
                </p>
              </div>
              <button onClick={() => setShowDatiCliniciModal(false)} className="tw-bg-transparent tw-border-0 tw-cursor-pointer tw-text-slate-400 hover:tw-text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="tw-flex tw-flex-col tw-gap-3.5">
              <div>
                <label className="tw-block tw-font-semibold tw-text-sm tw-text-slate-700 tw-mb-1">Codice Fiscale</label>
                <input type="text" value={datiCliniciForm.codiceFiscale} onChange={e => setDatiCliniciForm(p => ({ ...p, codiceFiscale: e.target.value.toUpperCase() }))} placeholder="es. RSSMRA80A01H501Z" className="tw-w-full tw-px-3 tw-py-2 tw-rounded-lg tw-border tw-border-slate-300 tw-text-[0.9rem] tw-font-mono" />
              </div>
              <div>
                <label className="tw-block tw-font-semibold tw-text-sm tw-text-slate-700 tw-mb-1">Diagnosi di ammissione / Patologia principale</label>
                <textarea value={datiCliniciForm.diagnosiAmmissione} onChange={e => setDatiCliniciForm(p => ({ ...p, diagnosiAmmissione: e.target.value }))} placeholder="es. Scompenso cardiaco cronico, BPCO, ..." rows={3} className="tw-w-full tw-px-3 tw-py-2 tw-rounded-lg tw-border tw-border-slate-300 tw-text-[0.9rem] tw-resize-y" />
              </div>
              <div>
                <label className="tw-block tw-font-semibold tw-text-sm tw-text-slate-700 tw-mb-1">Comorbilità / Patologie associate</label>
                <textarea value={datiCliniciForm.comorbilita} onChange={e => setDatiCliniciForm(p => ({ ...p, comorbilita: e.target.value }))} placeholder="es. Diabete mellito tipo 2, Ipertensione arteriosa, ..." rows={3} className="tw-w-full tw-px-3 tw-py-2 tw-rounded-lg tw-border tw-border-slate-300 tw-text-[0.9rem] tw-resize-y" />
              </div>
              <div>
                <label className="tw-block tw-font-semibold tw-text-sm tw-text-red-600 tw-mb-1">⚠️ Allergie / Intolleranze farmacologiche</label>
                <textarea value={datiCliniciForm.allergie} onChange={e => setDatiCliniciForm(p => ({ ...p, allergie: e.target.value }))} placeholder="es. Penicillina, FANS, lattice, ... (NESSUNA se assenti)" rows={2} className="tw-w-full tw-px-3 tw-py-2 tw-rounded-lg tw-border tw-border-red-300 tw-text-[0.9rem] tw-resize-y tw-bg-red-50/50" />
              </div>
              <div className="tw-grid sm:tw-grid-cols-2 tw-gap-3">
                <div>
                  <label className="tw-block tw-font-semibold tw-text-sm tw-text-slate-700 tw-mb-1">Caregiver / Familiare di riferimento</label>
                  <input type="text" value={datiCliniciForm.caregiverRiferimento} onChange={e => setDatiCliniciForm(p => ({ ...p, caregiverRiferimento: e.target.value }))} placeholder="Nome e cognome" className="tw-w-full tw-px-3 tw-py-2 tw-rounded-lg tw-border tw-border-slate-300 tw-text-[0.9rem]" />
                </div>
                <div>
                  <label className="tw-block tw-font-semibold tw-text-sm tw-text-slate-700 tw-mb-1">Telefono caregiver</label>
                  <input type="tel" value={datiCliniciForm.caregiverTelefono} onChange={e => setDatiCliniciForm(p => ({ ...p, caregiverTelefono: e.target.value }))} placeholder="es. 3331234567" className="tw-w-full tw-px-3 tw-py-2 tw-rounded-lg tw-border tw-border-slate-300 tw-text-[0.9rem]" />
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
              className={`tw-w-full tw-mt-5 tw-py-3.5 tw-rounded-xl tw-text-white tw-font-bold tw-text-base tw-border-0 tw-flex tw-items-center tw-justify-center tw-gap-2 tw-cursor-pointer ${salvandoDatiCliniciADI ? 'tw-bg-sky-300 tw-cursor-not-allowed' : 'tw-bg-sky-700 hover:tw-bg-sky-800'}`}
            >
              {salvandoDatiCliniciADI ? <Loader2 size={18} className="tw-animate-spin" /> : <CheckCircle size={18} />}
              {salvandoDatiCliniciADI ? 'Salvataggio...' : 'Salva dati clinici ADI'}
            </button>
          </div>
        </div>
      )}

      {/* Documents Modal */}
      {showDocumentsModal && selectedPatient && (
        <div className="tw-fixed tw-inset-0 tw-z-50 tw-bg-black/60 tw-flex tw-items-start tw-justify-center tw-p-4 tw-overflow-y-auto" onClick={closeDocumentsModal}>
          <div className="tw-bg-white tw-rounded-2xl tw-shadow-2xl tw-w-full tw-max-w-[800px] tw-my-10 tw-p-6" onClick={(e) => e.stopPropagation()}>
            <div className="tw-flex tw-justify-between tw-items-center tw-mb-5 tw-gap-3 tw-flex-wrap">
              <div>
                <h3 className="tw-m-0 tw-flex tw-items-center tw-gap-2.5 tw-text-lg tw-text-slate-800">
                  <FolderOpen size={24} />
                  Documenti Paziente
                </h3>
                <p className="tw-m-0 tw-mt-1 tw-text-slate-500 tw-text-[0.92rem]">
                  {selectedPatient.firstName} {selectedPatient.lastName} - {formatDate(selectedPatient.birthDate)}
                </p>
              </div>
              <div className="tw-flex tw-flex-wrap tw-gap-2">
                <button
                  type="button"
                  onClick={() => openPatientSummaryPdf(selectedPatient)}
                  className="tw-bg-blue-600 tw-text-white tw-px-3.5 tw-py-2.5 tw-rounded-lg tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold hover:tw-bg-blue-700"
                >
                  <Eye size={16} />
                  Visualizza PDF
                </button>
                <button
                  type="button"
                  onClick={() => printPatientSummaryPdf(selectedPatient)}
                  className="tw-bg-emerald-600 tw-text-white tw-px-3.5 tw-py-2.5 tw-rounded-lg tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold hover:tw-bg-emerald-700"
                >
                  <Printer size={16} />
                  Stampa PDF
                </button>
                <button
                  onClick={closeDocumentsModal}
                  className="tw-bg-transparent tw-border-0 tw-cursor-pointer tw-p-2 tw-text-slate-400 hover:tw-text-slate-600"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Upload Section */}
            {canEdit && (
              <div className="tw-mb-6 tw-p-5 tw-border-2 tw-border-dashed tw-border-slate-300 tw-rounded-xl tw-bg-slate-50">
                <h4 className="tw-m-0 tw-mb-4 tw-flex tw-items-center tw-gap-2 tw-text-base tw-font-bold tw-text-slate-700">
                  <Upload size={18} />
                  Carica Nuovo Documento
                </h4>

                <div className="tw-grid sm:tw-grid-cols-2 tw-gap-4 tw-mb-4">
                  <label className="tw-block tw-text-sm tw-font-semibold tw-text-slate-700">
                    Titolo *
                    <input
                      type="text"
                      value={uploadForm.title}
                      onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                      placeholder="Es. Emocromo completo"
                      className="tw-w-full tw-px-3 tw-py-2 tw-rounded-lg tw-border tw-border-slate-300 tw-text-[0.9rem]"
                    />
                  </label>
                  <label className="tw-block tw-text-sm tw-font-semibold tw-text-slate-700">
                    Categoria *
                    <select
                      value={uploadForm.category}
                      onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                      className="tw-w-full tw-px-3 tw-py-2 tw-rounded-lg tw-border tw-border-slate-300 tw-text-[0.9rem]"
                    >
                      <option value="">Seleziona categoria...</option>
                      <option value="cartella_clinica">Cartella Clinica</option>
                      <option value="esame">Esame</option>
                      <option value="risultato_analisi">Risultato Analisi</option>
                      <option value="consulenza">Consulenza</option>
                    </select>
                  </label>
                </div>

                <label className="tw-block tw-text-sm tw-font-semibold tw-text-slate-700 tw-mb-4">
                  Descrizione (opzionale)
                  <textarea
                    value={uploadForm.description}
                    onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                    placeholder="Breve descrizione del documento..."
                    rows={2}
                    className="tw-w-full tw-px-3 tw-py-2 tw-rounded-lg tw-border tw-border-slate-300 tw-text-[0.9rem] tw-resize-y"
                  />
                </label>

                <div className="tw-flex tw-items-center tw-gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="tw-hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="tw-bg-slate-500 tw-text-white tw-px-3.5 tw-py-2 tw-rounded-lg tw-text-sm tw-font-semibold hover:tw-bg-slate-600"
                  >
                    Scegli file...
                  </button>
                  {fileInputRef.current?.files?.[0] && (
                    <span className="tw-text-slate-600 tw-text-[0.92rem]">
                      {fileInputRef.current.files[0].name}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={uploading || !fileInputRef.current?.files?.[0]}
                    className={`tw-ml-auto tw-px-3.5 tw-py-2 tw-rounded-lg tw-text-white tw-font-semibold tw-flex tw-items-center tw-gap-1.5 ${uploading || !fileInputRef.current?.files?.[0] ? 'tw-bg-green-400 tw-cursor-not-allowed' : 'tw-bg-green-600 tw-cursor-pointer hover:tw-bg-green-700'}`}
                  >
                    {uploading ? (
                      <>
                        <Loader2 size={16} className="tw-animate-spin" />
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
            <div className="tw-flex tw-flex-wrap tw-gap-2 tw-mb-4">
              <button
                type="button"
                onClick={() => { setSelectedCategory(''); loadPatientDocuments(selectedPatient._id); }}
                className={`tw-px-4 tw-py-2 tw-rounded-lg tw-text-sm tw-font-semibold ${!selectedCategory ? 'tw-bg-brand tw-text-white' : 'tw-bg-slate-200 tw-text-slate-700 hover:tw-bg-slate-300'}`}
              >
                Tutti
              </button>
              {(Object.keys(categoryLabels) as string[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => { setSelectedCategory(cat); loadPatientDocuments(selectedPatient._id); }}
                  className={`tw-px-4 tw-py-2 tw-rounded-lg tw-text-sm tw-font-semibold ${selectedCategory === cat ? 'tw-text-white' : 'tw-bg-slate-200 tw-text-slate-700 hover:tw-bg-slate-300'}`}
                  style={{ background: selectedCategory === cat ? categoryColors[cat] : undefined }}
                >
                  {categoryLabels[cat]}
                </button>
              ))}
            </div>

            {/* Documents List */}
            {documents.length === 0 ? (
              <p className="tw-text-center tw-py-8 tw-text-slate-500">
                Nessun documento presente per questo paziente.
              </p>
            ) : (
              <div className="tw-flex tw-flex-col tw-gap-3">
                {documents.map((doc) => {
                  const Icon = categoryIcons[doc.category] || FolderOpen;
                  return (
                    <div
                      key={doc._id}
                      className="tw-flex tw-items-center tw-gap-4 tw-p-4 tw-border tw-border-slate-200 tw-rounded-xl tw-bg-white"
                    >
                      <div
                        className="tw-w-12 tw-h-12 tw-rounded-lg tw-flex tw-items-center tw-justify-center tw-flex-shrink-0"
                        style={{ backgroundColor: `${categoryColors[doc.category]}20` }}
                      >
                        <Icon size={24} color={categoryColors[doc.category]} />
                      </div>
                      <div className="tw-flex-1 tw-min-w-0">
                        <div className="tw-flex tw-items-center tw-gap-2 tw-mb-1">
                          <span
                            className="tw-text-xs tw-px-2 tw-py-0.5 tw-rounded-full tw-font-semibold tw-whitespace-nowrap"
                            style={{ backgroundColor: `${categoryColors[doc.category]}20`, color: categoryColors[doc.category] }}
                          >
                            {categoryLabels[doc.category]}
                          </span>
                          <strong className="tw-truncate">
                            {doc.title}
                          </strong>
                        </div>
                        {doc.description && (
                          <p className="tw-m-0 tw-text-[0.85rem] tw-text-slate-500 tw-mb-1">
                            {doc.description}
                          </p>
                        )}
                        <p className="tw-m-0 tw-text-[0.8rem] tw-text-slate-400">
                          {formatDate(doc.createdAt)} {doc.uploadedByNome && `• Caricato da ${doc.uploadedByNome}`}
                        </p>
                      </div>
                      <div className="tw-flex tw-flex-wrap tw-gap-2 tw-flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => openDocument(doc._id, doc.contentType, doc.fileName)}
                          className="tw-bg-blue-600 tw-text-white tw-px-3 tw-py-2 tw-rounded-lg tw-flex tw-items-center tw-gap-1.5 tw-text-sm tw-font-semibold hover:tw-bg-blue-700"
                        >
                          <Eye size={16} />
                          Apri
                        </button>
                        <button
                          type="button"
                          onClick={() => printDocument(doc._id, doc.contentType, doc.fileName)}
                          className="tw-bg-teal-700 tw-text-white tw-px-3 tw-py-2 tw-rounded-lg tw-flex tw-items-center tw-gap-1.5 tw-text-sm tw-font-semibold hover:tw-bg-teal-800"
                        >
                          <Printer size={16} />
                          Stampa
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadDocument(doc._id, doc.fileName)}
                          className="tw-bg-green-600 tw-text-white tw-px-3 tw-py-2 tw-rounded-lg tw-flex tw-items-center tw-gap-1.5 tw-text-sm tw-font-semibold hover:tw-bg-green-700"
                        >
                          <Download size={16} />
                          Scarica
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => deleteDocument(doc._id)}
                            className="tw-bg-red-600 tw-text-white tw-px-3 tw-py-2 tw-rounded-lg tw-flex tw-items-center tw-gap-1.5 tw-text-sm tw-font-semibold hover:tw-bg-red-700"
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

      {/* ═══ MODAL CHAT PAZIENTE ═══ */}
      {chatPatient && (
        <div className="tw-fixed tw-inset-0 tw-z-50 tw-bg-black/60 tw-flex tw-items-start tw-justify-center tw-p-4 tw-overflow-y-auto" onClick={() => setChatPatient(null)}>
          <div className="tw-bg-white tw-rounded-2xl tw-shadow-2xl tw-w-full tw-max-w-[720px] tw-my-10 tw-p-6" onClick={e => e.stopPropagation()}>
            <div className="tw-flex tw-justify-between tw-items-center tw-mb-4 tw-flex-wrap tw-gap-2">
              <h3 className="tw-m-0 tw-text-brand tw-text-lg">
                💬 Chat con operatore — {chatPatient.firstName} {chatPatient.lastName}
              </h3>
              <button onClick={() => setChatPatient(null)} className="tw-bg-slate-100 tw-border tw-border-slate-200 tw-rounded-md tw-px-2.5 tw-py-1.5 tw-cursor-pointer hover:tw-bg-slate-200">
                <X size={18} />
              </button>
            </div>
            <ChatWidget
              scope="patient"
              patientId={chatPatient._id}
              title=""
              height={520}
            />
          </div>
        </div>
      )}

    </section>
  );
}

export default Patients;
