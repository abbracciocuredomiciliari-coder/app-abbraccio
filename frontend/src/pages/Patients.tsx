import { FormEvent, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useModalita } from '../context/ModalitaContext';
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
  Mail,
  MessageCircle,
  Pencil,
  MapPin,
  User,
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
import MappaZona from '../components/MappaZona';

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
  tipoGestione?: 'privato' | 'convenzione' | 'consulenza';
  inAccettazione?: boolean;
  accettatoIl?: string;
  terminato?: boolean;
  terminatoIl?: string;
  categoriaPrivata?: 'diagnostica' | 'prelievi' | 'assistenza_domiciliare' | 'trasporto' | 'visite_mediche' | 'riabilitazione' | 'intermediazione_badanti';
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
    note?: string;
  };
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
  const { isConsulenza } = useModalita();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [preventivoRapidoPaziente, setPreventivoRapidoPaziente] = useState<Patient | null>(null);
  const [preventivoRapidoRighe, setPreventivoRapidoRighe] = useState<{ descrizione: string; quantita: number; prezzoUnitario: number; aliquotaIva: number; tariffarioId: string }[]>([
    { descrizione: '', quantita: 1, prezzoUnitario: 0, aliquotaIva: 0, tariffarioId: '' },
  ]);
  const [preventivoRapidoData, setPreventivoRapidoData] = useState('');
  const [preventivoRapidoNote, setPreventivoRapidoNote] = useState('');
  const [preventivoRapidoCF, setPreventivoRapidoCF] = useState('');
  const [preventivoRapidoLoading, setPreventivoRapidoLoading] = useState(false);
  const [preventivoRapidoError, setPreventivoRapidoError] = useState('');
  const [tariffarioVoci, setTariffarioVoci] = useState<{ _id: string; categoria: string; nome: string; prezzo: number }[]>([]);
  const TARIFFARIO_CATEGORIE_LABEL: Record<string, string> = {
    prestazioni_infermieristiche: '💉 Prestazioni Infermieristiche',
    prelievi: '🩸 Prelievi',
    assistenza_domiciliare: '🏠 Assistenza Domiciliare',
    trasporto: '🚑 Trasporto',
    radiologia: '🩻 Radiologia (RX)',
    ecografia: '🔊 Ecografie / Ecocolordoppler',
    visite_mediche: '🩺 Visite Mediche',
    riabilitazione: '🤸 Riabilitazione',
  };
  const [activeCategoria, setActiveCategoria] = useState<'tutti' | 'diagnostica' | 'prelievi' | 'assistenza_domiciliare' | 'trasporto' | 'visite_mediche' | 'riabilitazione' | 'intermediazione_badanti'>('tutti');
  const CATEGORIA_PRIVATA_LABEL: Record<string, string> = {
    diagnostica: '🩻 Diagnostica (RX/Ecografie/Esami strumentali)',
    prelievi: '🩸 Prelievi',
    assistenza_domiciliare: '🏠 Assistenza domiciliare',
    trasporto: '🚑 Trasporto',
    visite_mediche: '🩺 Visite mediche',
    riabilitazione: '🤸 Riabilitazione',
    intermediazione_badanti: '🤝 Intermediazioni',
  };
  const [activeAccettazione, setActiveAccettazione] = useState<'tutti' | 'in_accettazione' | 'accettati' | 'terminati'>('tutti');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    birthDate: '',
    address: '',
    assistanceNeeds: '',
    categoriaPrivata: 'diagnostica' as string,
    contactPhone: '',
    email: '',
    codiceFiscale: '',
    tipoGestione: 'privato' as 'privato' | 'convenzione' | 'consulenza',
    inAccettazione: false,
    terminato: false
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sendingConsentId, setSendingConsentId] = useState<string | null>(null);
  const [sentConsentIds, setSentConsentIds] = useState<Set<string>>(new Set());

  // Modifica paziente e verifica indirizzo
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [suggerimentiIndirizzo, setSuggerimentiIndirizzo] = useState<any[]>([]);
  const [cercandoIndirizzo, setCercandoIndirizzo] = useState(false);
  const [indirizzoCoords, setIndirizzoCoords] = useState<{ lat: number; lng: number } | null>(null);

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

  // Stato modal visualizzazione anagrafica
  const [showAnagraficaModal, setShowAnagraficaModal] = useState(false);
  const [selectedAnagrafica, setSelectedAnagrafica] = useState<Patient | null>(null);

  // Stato modal contratto d'incarico
  const [showContrattoModal, setShowContrattoModal] = useState(false);
  const [contrattoPatient, setContrattoPatient] = useState<Patient | null>(null);
  const [contrattoProfilo, setContrattoProfilo] = useState<'Operatore generale' | 'Assistente familiare'>('Operatore generale');
  const [contrattoEmail, setContrattoEmail] = useState('');
  const [contrattoLoading, setContrattoLoading] = useState(false);
  const [contrattoPreventivi, setContrattoPreventivi] = useState<{ _id: string; numero: string; totale: number; data: string }[]>([]);
  const [contrattoPreventivoId, setContrattoPreventivoId] = useState('');
  const [contrattoAllegato, setContrattoAllegato] = useState<File | null>(null);

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
  }, [searchTerm, patients, activeCategoria, activeAccettazione]);

  const loadPatients = async () => {
    try {
      const response = await api.get(isConsulenza ? '/patients?tipo=consulenza' : '/patients?tipo=privato');
      setPatients(response.data);
    } catch (error) {
      console.error('Errore caricamento pazienti', error);
    } finally {
      setLoading(false);
    }
  };

  const filterPatients = () => {
    let filtered = patients;

    if (activeCategoria !== 'tutti') {
      filtered = filtered.filter(p =>
        p.categoriaPrivata === activeCategoria ||
        (p.tipoGestione === 'privato' && !p.categoriaPrivata && activeCategoria === 'diagnostica')
      );
    }

    if (activeAccettazione === 'in_accettazione') {
      filtered = filtered.filter(p => p.inAccettazione === true && p.terminato !== true);
    } else if (activeAccettazione === 'accettati') {
      filtered = filtered.filter(p => p.inAccettazione !== true && p.terminato !== true && !!p.accettatoIl);
    } else if (activeAccettazione === 'terminati') {
      filtered = filtered.filter(p => p.terminato === true);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(patient => {
        const fullName = `${patient.firstName} ${patient.lastName}`.toLowerCase();
        return (
          fullName.includes(term) ||
          patient.firstName.toLowerCase().includes(term) ||
          patient.lastName.toLowerCase().includes(term) ||
          patient._id.toLowerCase().includes(term)
        );
      });
    }

    setFilteredPatients(filtered);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingPatient) {
        const vecchiaGestione = editingPatient.tipoGestione || 'privato';
        const nuovaGestione = formData.tipoGestione || 'privato';
        if (vecchiaGestione !== nuovaGestione) {
          const nomiGestione: Record<string, string> = { privato: 'Privato', convenzione: 'SIAT', consulenza: 'Intermediazioni' };
          const nomiArea: Record<string, string> = { privato: 'Pazienti Privati', convenzione: 'Pazienti Convenzione SIAT', consulenza: 'Pazienti Intermediazioni' };
          const msg = `Vuoi cambiare gestione del paziente da ${nomiGestione[vecchiaGestione] || 'Privato'} a ${nomiGestione[nuovaGestione] || 'Privato'}?\n\nI dati del paziente verranno spostati nell'area ${nomiArea[nuovaGestione] || 'Pazienti Privati'}.`;
          if (!confirm(msg)) return;
        }
        const payload = { ...formData } as any;
        if (isConsulenza) { payload.tipoGestione = 'consulenza'; payload.categoriaPrivata = 'intermediazione_badanti'; }
        if (payload.tipoGestione === 'convenzione') payload.categoriaPrivata = undefined;
        await api.patch(`/patients/${editingPatient._id}`, payload);
        setSuccess('Paziente aggiornato con successo!');
      } else {
        const payload = { ...formData } as any;
        if (isConsulenza) { payload.tipoGestione = 'consulenza'; payload.categoriaPrivata = 'intermediazione_badanti'; }
        if (payload.tipoGestione === 'convenzione') payload.categoriaPrivata = undefined;
        await api.post('/patients', payload);
        setSuccess('Paziente salvato con successo!');
      }
      setFormData({
        firstName: '',
        lastName: '',
        birthDate: '',
        address: '',
        assistanceNeeds: '',
        categoriaPrivata: 'diagnostica',
        contactPhone: '',
        email: '',
        codiceFiscale: '',
        tipoGestione: 'privato',
        inAccettazione: false,
        terminato: false
      });
      setEditingPatient(null);
      setIndirizzoCoords(null);
      setSuggerimentiIndirizzo([]);
      setShowForm(false);
      loadPatients();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Impossibile salvare il paziente. Riprova.');
    }
  };

  const apriCreazionePaziente = () => {
    if (showForm) {
      setShowForm(false);
    } else {
      setFormData({ firstName: '', lastName: '', birthDate: '', address: '', assistanceNeeds: '', categoriaPrivata: 'diagnostica', contactPhone: '', email: '', codiceFiscale: '', tipoGestione: 'privato', inAccettazione: false, terminato: false });
      setEditingPatient(null);
      setSuggerimentiIndirizzo([]);
      setIndirizzoCoords(null);
      setShowForm(true);
    }
  };

  const apriModificaPaziente = (patient: Patient) => {
    setFormData({
      firstName: patient.firstName,
      lastName: patient.lastName,
      birthDate: patient.birthDate ? patient.birthDate.split('T')[0] : '',
      address: patient.address,
      assistanceNeeds: patient.assistanceNeeds,
      categoriaPrivata: patient.categoriaPrivata || 'diagnostica',
      contactPhone: patient.contactPhone || '',
      email: patient.email || '',
      codiceFiscale: patient.codiceFiscale || '',
      tipoGestione: patient.tipoGestione || 'privato',
      inAccettazione: patient.inAccettazione === true,
      terminato: patient.terminato === true,
    });
    setEditingPatient(patient);
    setSuggerimentiIndirizzo([]);
    setIndirizzoCoords(null);
    setShowForm(true);
  };

  const segnaAccettato = async (patient: Patient) => {
    if (!confirm(`Segnare ${patient.firstName} ${patient.lastName} come ACCETTATO? Uscirà dalla fase di accettazione.`)) return;
    try {
      await api.patch(`/patients/${patient._id}`, { accetta: true });
      loadPatients();
      setSuccess('✅ Paziente segnato come accettato');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore aggiornamento paziente');
    }
  };

  const apriPreventivoRapido = async (patient: Patient) => {
    setPreventivoRapidoPaziente(patient);
    setPreventivoRapidoRighe([{ descrizione: '', quantita: 1, prezzoUnitario: 0, aliquotaIva: 0, tariffarioId: '' }]);
    setPreventivoRapidoData(new Date().toISOString().split('T')[0]);
    setPreventivoRapidoNote('');
    setPreventivoRapidoCF(patient.codiceFiscale || '');
    setPreventivoRapidoError('');
    if (tariffarioVoci.length === 0) {
      try {
        const res = await api.get('/tariffario', { params: { soloAttivi: 'true' } });
        setTariffarioVoci(res.data);
      } catch { /* tariffario non disponibile, resta vuoto */ }
    }
  };

  const chiudiPreventivoRapido = () => {
    setPreventivoRapidoPaziente(null);
    setPreventivoRapidoError('');
    setPreventivoRapidoLoading(false);
  };

  const aggiornaRigaPreventivoRapido = (i: number, field: 'descrizione' | 'quantita' | 'prezzoUnitario' | 'aliquotaIva', value: string | number) => {
    setPreventivoRapidoRighe(prev => prev.map((r, j) => j === i ? { ...r, [field]: value } : r));
  };

  const selezionaTariffarioRiga = (i: number, tariffarioId: string) => {
    const voce = tariffarioVoci.find(v => v._id === tariffarioId);
    setPreventivoRapidoRighe(prev => prev.map((r, j) => j === i
      ? { ...r, tariffarioId, descrizione: voce ? voce.nome : r.descrizione, prezzoUnitario: voce ? voce.prezzo : r.prezzoUnitario }
      : r));
  };

  const aggiungiRigaPreventivoRapido = () => {
    setPreventivoRapidoRighe(prev => [...prev, { descrizione: '', quantita: 1, prezzoUnitario: 0, aliquotaIva: 0, tariffarioId: '' }]);
  };

  const rimuoviRigaPreventivoRapido = (i: number) => {
    setPreventivoRapidoRighe(prev => prev.filter((_, j) => j !== i));
  };

  const totalePreventivoRapido = preventivoRapidoRighe.reduce((acc, r) => {
    const importo = (Number(r.quantita) || 0) * (Number(r.prezzoUnitario) || 0);
    return { imponibile: acc.imponibile + importo, iva: acc.iva + importo * ((Number(r.aliquotaIva) || 0) / 100) };
  }, { imponibile: 0, iva: 0 });

  const generaPreventivoRapido = async (e: FormEvent) => {
    e.preventDefault();
    if (!preventivoRapidoPaziente) return;
    const righeValide = preventivoRapidoRighe.filter(r => r.descrizione.trim() && (Number(r.prezzoUnitario) || 0) > 0);
    if (righeValide.length === 0) {
      setPreventivoRapidoError('Inserisci almeno una prestazione con descrizione e importo.');
      return;
    }
    setPreventivoRapidoError('');
    setPreventivoRapidoLoading(true);
    try {
      const cfPulito = preventivoRapidoCF.trim().toUpperCase();
      if (cfPulito && cfPulito !== (preventivoRapidoPaziente.codiceFiscale || '')) {
        await api.patch(`/patients/${preventivoRapidoPaziente._id}`, { codiceFiscale: cfPulito });
        setPatients(prev => prev.map(p => p._id === preventivoRapidoPaziente._id ? { ...p, codiceFiscale: cfPulito } : p));
        setFilteredPatients(prev => prev.map(p => p._id === preventivoRapidoPaziente._id ? { ...p, codiceFiscale: cfPulito } : p));
      }
      await api.post('/fatturazione-documenti', {
        tipo: 'preventivo',
        patient: preventivoRapidoPaziente._id,
        dataPrestazione: preventivoRapidoData || undefined,
        note: preventivoRapidoNote || undefined,
        prestazioni: righeValide.map(r => ({
          descrizione: r.descrizione.trim(),
          quantita: Number(r.quantita) || 1,
          prezzoUnitario: Number(r.prezzoUnitario) || 0,
          aliquotaIva: Number(r.aliquotaIva) || 0,
        })),
      });
      setSuccess('✅ Preventivo generato! Lo trovi in Gestione Fatturazione.');
      setTimeout(() => setSuccess(''), 4000);
      chiudiPreventivoRapido();
    } catch (err: any) {
      setPreventivoRapidoError(err?.response?.data?.message || 'Errore nella generazione del preventivo');
    } finally {
      setPreventivoRapidoLoading(false);
    }
  };

  const riattivaPaziente = async (patient: Patient) => {
    if (!confirm(`Riattivare ${patient.firstName} ${patient.lastName}? Tornerà tra i pazienti attivi e potrai assegnargli un nuovo piano.`)) return;
    try {
      await api.patch(`/patients/${patient._id}`, { terminato: false });
      loadPatients();
      setSuccess('↩ Paziente riattivato');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore riattivazione paziente');
    }
  };

  const apriContrattoModal = (patient: Patient) => {
    setContrattoPatient(patient);
    setContrattoProfilo(patient.categoriaPrivata === 'intermediazione_badanti' ? 'Assistente familiare' : 'Operatore generale');
    setContrattoEmail(patient.email || '');
    setContrattoLoading(false);
    setContrattoPreventivoId('');
    setContrattoAllegato(null);
    setContrattoPreventivi([]);
    setShowContrattoModal(true);
    api.get('/fatturazione-documenti', { params: { patient: patient._id, tipo: 'preventivo' } })
      .then(res => setContrattoPreventivi((res.data || []).map((d: any) => ({ _id: d._id, numero: d.numero, totale: d.totale, data: d.data }))))
      .catch(() => setContrattoPreventivi([]));
  };

  const inviaConsensoEmail = async (patient: Patient) => {
    if (!patient.email) {
      alert('Il paziente non ha un indirizzo email. Aggiungilo in anagrafica.');
      return;
    }
    setSendingConsentId(patient._id);
    try {
      await api.post(`/gdpr/consenso/${patient._id}/invia-firma`, { email: patient.email });
      setSentConsentIds(prev => new Set(prev).add(patient._id));
      setSuccess('✅ Email con link firma consenso inviata');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore invio consenso');
    } finally {
      setSendingConsentId(null);
    }
  };

  const chiudiContrattoModal = () => {
    setShowContrattoModal(false);
    setContrattoPatient(null);
    setContrattoLoading(false);
    setContrattoPreventivoId('');
    setContrattoAllegato(null);
    setContrattoPreventivi([]);
  };

  const creaContratto = async () => {
    if (!contrattoPatient) return;
    setContrattoLoading(true);
    try {
      const res = await api.post('/contratti-pazienti', {
        patient: contrattoPatient._id,
        profilo: contrattoProfilo,
        email: contrattoEmail,
        importo: contrattoProfilo === 'Assistente familiare' ? 250 : 150,
        preventivoId: contrattoPreventivoId || undefined,
      });
      const id = res.data._id as string;
      // Allega file preventivo caricato manualmente (se presente)
      if (contrattoAllegato) {
        const fd = new FormData();
        fd.append('file', contrattoAllegato);
        await api.post(`/contratti-pazienti/${id}/allegato`, fd);
      }
      return id;
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nella creazione del contratto');
      return null;
    } finally {
      setContrattoLoading(false);
    }
  };

  const stampaContratto = async () => {
    const id = await creaContratto();
    if (id) {
      const res = await api.get(`/contratti-pazienti/${id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
  };

  const inviaContrattoEmail = async () => {
    if (!contrattoEmail) {
      alert('Inserisci un indirizzo email');
      return;
    }
    const id = await creaContratto();
    if (id) {
      try {
        setContrattoLoading(true);
        await api.post(`/contratti-pazienti/${id}/invia-email`, { email: contrattoEmail });
        alert('Email di firma inviata');
        chiudiContrattoModal();
      } catch (err: any) {
        alert(err?.response?.data?.message || "Errore nell'invio dell'email");
      } finally {
        setContrattoLoading(false);
      }
    }
  };

  const cercaIndirizzo = async () => {
    const q = formData.address.trim();
    if (!q) return;
    setCercandoIndirizzo(true);
    setSuggerimentiIndirizzo([]);
    setIndirizzoCoords(null);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&q=${encodeURIComponent(q)}&accept-language=it`, {
        headers: { 'Accept-Language': 'it' },
      });
      const data = await res.json();
      setSuggerimentiIndirizzo(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Errore ricerca indirizzo', err);
      setSuggerimentiIndirizzo([]);
    } finally {
      setCercandoIndirizzo(false);
    }
  };

  const selezionaIndirizzo = (item: any) => {
    setFormData(prev => ({ ...prev, address: item.display_name }));
    setIndirizzoCoords({ lat: parseFloat(item.lat), lng: parseFloat(item.lon) });
    setSuggerimentiIndirizzo([]);
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

  const spostaCategoria = async (patientId: string, nuovaCategoria: string) => {
    if (!confirm(`Spostare il paziente in ${nuovaCategoria}?`)) return;
    try {
      await api.patch(`/patients/${patientId}`, { categoriaPrivata: nuovaCategoria });
      loadPatients();
    } catch (error: any) {
      alert('Errore nello spostamento: ' + (error?.response?.data?.message || 'Riprova.'));
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
    <section className="tw-max-w-none">
      <h2 className="tw-flex tw-items-center tw-gap-2">
        <FileText size={28} />
        {isConsulenza ? 'Pazienti — Intermediazioni' : 'Gestione Pazienti'}
      </h2>

      {success && (
        <Alert type="success" onClose={() => setSuccess('')} className="tw-mb-4">
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
            onClick={apriCreazionePaziente}
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
            {editingPatient ? <Pencil size={18} /> : <UserPlus size={18} />}
            {editingPatient ? 'Modifica Paziente' : 'Nuovo Paziente'}
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
          <div>
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
            <button
              type="button"
              onClick={cercaIndirizzo}
              disabled={!formData.address.trim() || cercandoIndirizzo}
              className="tw-flex tw-items-center tw-gap-1.5 tw-mt-2 tw-bg-sky-600 tw-text-white tw-border-0 tw-rounded-lg tw-px-3 tw-py-1.5 tw-text-[0.85rem] tw-cursor-pointer hover:tw-bg-sky-700 disabled:tw-bg-slate-300"
            >
              <MapPin size={16} />
              {cercandoIndirizzo ? 'Ricerca...' : 'Verifica su mappa'}
            </button>
            {suggerimentiIndirizzo.length > 0 && (
              <div className="tw-mt-2 tw-border tw-border-slate-200 tw-rounded-lg tw-overflow-hidden tw-bg-white">
                {suggerimentiIndirizzo.map((item: any) => (
                  <button
                    key={item.place_id}
                    type="button"
                    onClick={() => selezionaIndirizzo(item)}
                    className="tw-w-full tw-text-left tw-px-3 tw-py-2 tw-text-[0.85rem] tw-border-b tw-border-slate-100 last:tw-border-b-0 hover:tw-bg-slate-50 tw-text-slate-700"
                  >
                    {item.display_name}
                  </button>
                ))}
              </div>
            )}
            {indirizzoCoords && (
              <div className="tw-mt-3" style={{ borderRadius: '10px', overflow: 'hidden' }}>
                <MappaZona center={indirizzoCoords} altezza={220} readonly={true} />
              </div>
            )}
          </div>
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
            Codice Fiscale
            <input
              name="codiceFiscale"
              value={formData.codiceFiscale}
              onChange={handleInputChange}
              placeholder="RSSMRA70A01H501Z"
            />
          </label>
          <label>
            Gestione paziente
            {editingPatient ? (
              <select
                value={formData.tipoGestione}
                onChange={e => setFormData(prev => ({ ...prev, tipoGestione: e.target.value as 'privato' | 'convenzione' | 'consulenza' }))}
              >
                <option value="privato">👤 Privato</option>
                <option value="convenzione">🏥 SIAT — Convenzione</option>
                <option value="consulenza">🤝 Intermediazioni</option>
              </select>
            ) : (
              <select value={isConsulenza ? 'consulenza' : 'privato'} disabled>
                {isConsulenza
                  ? <option value="consulenza">🤝 Intermediazioni</option>
                  : <option value="privato">👤 Privato</option>}
              </select>
            )}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', background: formData.inAccettazione ? '#fef3c7' : '#f8fafc', border: `1px solid ${formData.inAccettazione ? '#f59e0b' : '#e2e8f0'}`, borderRadius: '10px', padding: '12px 14px', cursor: 'pointer' }}>
            <input type="checkbox" checked={formData.inAccettazione} onChange={e => setFormData(prev => ({ ...prev, inAccettazione: e.target.checked }))} style={{ width: '18px', height: '18px', accentColor: '#d97706' }} />
            <span style={{ fontSize: '0.9rem', color: '#374151' }}>
              <strong>Paziente accettazione</strong> — il paziente è in fase di accettazione: serve per preventivi e piani in accettazione, non ancora operativi.
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', background: formData.terminato ? '#fee2e2' : '#f8fafc', border: `1px solid ${formData.terminato ? '#ef4444' : '#e2e8f0'}`, borderRadius: '10px', padding: '12px 14px', cursor: 'pointer' }}>
            <input type="checkbox" checked={formData.terminato} onChange={e => setFormData(prev => ({ ...prev, terminato: e.target.checked, inAccettazione: e.target.checked ? false : prev.inAccettazione }))} style={{ width: '18px', height: '18px', accentColor: '#dc2626' }} />
            <span style={{ fontSize: '0.9rem', color: '#374151' }}>
              <strong>Paziente terminato</strong> — il percorso con il paziente è concluso: finisce nello slot "Terminati".
            </span>
          </label>

          {formData.tipoGestione === 'privato' && !isConsulenza && (
            <label>
              Categoria servizio privato *
              <select
                value={formData.categoriaPrivata}
                onChange={e => setFormData(prev => ({ ...prev, categoriaPrivata: e.target.value as any }))}
                required
              >
                <option value="diagnostica">🩻 Diagnostica (RX / Ecografie / Esami strumentali)</option>
                <option value="prelievi">🩸 Prelievi</option>
                <option value="assistenza_domiciliare">🏠 Assistenza domiciliare</option>
                <option value="trasporto">🚑 Trasporto</option>
                <option value="visite_mediche">🩺 Visite mediche</option>
                <option value="riabilitazione">🤸 Riabilitazione</option>
              </select>
            </label>
          )}
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
          <button type="submit">
            {editingPatient ? 'Aggiorna Paziente' : 'Salva Paziente'}
          </button>
        </form>
      )}

      {/* Tabs categoria — nascosti nell'area Intermediazioni */}
      {!isConsulenza && (
      <div className="tw-flex tw-flex-wrap tw-gap-2 tw-mb-2">
        {(['tutti', 'diagnostica', 'prelievi', 'assistenza_domiciliare', 'trasporto', 'visite_mediche', 'riabilitazione'] as const).map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategoria(cat)}
            className={`tw-px-4 tw-py-2 tw-rounded-xl tw-border-0 tw-font-semibold tw-text-sm tw-transition-colors ${
              activeCategoria === cat
                ? 'tw-bg-brand tw-text-white'
                : 'tw-bg-white tw-text-slate-600 tw-border tw-border-slate-200 hover:tw-bg-slate-50'
            }`}
          >
            {cat === 'tutti' ? 'Tutti' : CATEGORIA_PRIVATA_LABEL[cat]}
          </button>
        ))}
      </div>
      )}

      {/* Tabs stato accettazione */}
      <div className="tw-flex tw-flex-wrap tw-gap-2 tw-mb-5">
        {([
          { key: 'tutti', label: 'Tutti gli stati', count: patients.length },
          { key: 'in_accettazione', label: '⏳ In accettazione', count: patients.filter(p => p.inAccettazione === true && p.terminato !== true).length },
          { key: 'accettati', label: '✅ Accettati', count: patients.filter(p => p.inAccettazione !== true && p.terminato !== true && !!p.accettatoIl).length },
          { key: 'terminati', label: '🏁 Terminati', count: patients.filter(p => p.terminato === true).length },
        ] as const).map(st => (
          <button
            key={st.key}
            onClick={() => setActiveAccettazione(st.key)}
            className={`tw-px-4 tw-py-2 tw-rounded-xl tw-font-semibold tw-text-sm tw-transition-colors ${
              activeAccettazione === st.key
                ? (st.key === 'in_accettazione' ? 'tw-bg-amber-500 tw-text-white tw-border-0' : st.key === 'accettati' ? 'tw-bg-emerald-600 tw-text-white tw-border-0' : st.key === 'terminati' ? 'tw-bg-slate-600 tw-text-white tw-border-0' : 'tw-bg-brand tw-text-white tw-border-0')
                : 'tw-bg-white tw-text-slate-600 tw-border tw-border-slate-200 hover:tw-bg-slate-50'
            }`}
          >
            {st.label} ({st.count})
          </button>
        ))}
      </div>

      {/* Patients List */}
      <div className="tw-bg-white tw-border tw-border-slate-200 tw-rounded-2xl tw-shadow-sm tw-p-5">
        <h3 className="tw-flex tw-items-center tw-gap-2 tw-m-0 tw-mb-4 tw-text-slate-700">
          <FileText size={20} />
          Elenco Pazienti ({filteredPatients.length})
        </h3>
        {loading ? (
          <div className="tw-py-2"><SkeletonList rows={6} showHeader={false} /></div>
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
                    {patient.inAccettazione && !patient.terminato && (
                      <span className="tw-text-xs tw-px-2 tw-py-0.5 tw-rounded-full tw-bg-amber-100 tw-text-amber-700 tw-font-bold tw-border tw-border-amber-200">
                        ⏳ In accettazione
                      </span>
                    )}
                    {!patient.inAccettazione && !patient.terminato && patient.accettatoIl && (
                      <span className="tw-text-xs tw-px-2 tw-py-0.5 tw-rounded-full tw-bg-emerald-100 tw-text-emerald-700 tw-font-bold tw-border tw-border-emerald-200" title={`Accettato il ${formatDate(patient.accettatoIl)}`}>
                        ✅ Accettato
                      </span>
                    )}
                    {patient.terminato && (
                      <span className="tw-text-xs tw-px-2 tw-py-0.5 tw-rounded-full tw-bg-slate-200 tw-text-slate-600 tw-font-bold tw-border tw-border-slate-300" title={patient.terminatoIl ? `Terminato il ${formatDate(patient.terminatoIl)}` : 'Terminato'}>
                        🏁 Terminato
                      </span>
                    )}
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
                  {patient.terminato && (user?.role === 'admin' || user?.role === 'coordinator') && (
                    <button
                      onClick={() => riattivaPaziente(patient)}
                      className="tw-bg-amber-600 tw-text-white tw-whitespace-nowrap"
                      title="Riattiva il paziente: torna attivo e può ricevere un nuovo piano"
                    >
                      <UserPlus size={16} />
                      Riattiva
                    </button>
                  )}
                  {patient.inAccettazione && !patient.terminato && (user?.role === 'admin' || user?.role === 'coordinator') && (
                    <>
                      <button
                        onClick={() => isConsulenza
                          ? navigate(`/badanti-intermediazione?patientId=${patient._id}&nuovo=1`)
                          : apriPreventivoRapido(patient)}
                        className="tw-bg-amber-500 tw-text-white tw-whitespace-nowrap"
                        title={isConsulenza ? 'Apri Intermediazioni per generare il preventivo di intermediazione badante' : 'Genera subito un preventivo per questo paziente, senza creare un piano di lavoro'}
                      >
                        <FileText size={16} />
                        Preventivo
                      </button>
                      <button
                        onClick={() => segnaAccettato(patient)}
                        className="tw-bg-emerald-600 tw-text-white tw-whitespace-nowrap"
                        title="Segna il paziente come accettato (esce dalla fase di accettazione)"
                      >
                        <CheckCircle size={16} />
                        Accetta
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => { setSelectedAnagrafica(patient); setShowAnagraficaModal(true); }}
                    className="tw-bg-indigo-600 tw-text-white tw-whitespace-nowrap"
                  >
                    <User size={16} />
                    Anagrafica
                  </button>
                  <button
                    onClick={() => inviaConsensoEmail(patient)}
                    disabled={sendingConsentId === patient._id || sentConsentIds.has(patient._id)}
                    className={`tw-whitespace-nowrap ${sentConsentIds.has(patient._id) ? 'tw-bg-green-600 tw-text-white' : 'tw-bg-purple-600 tw-text-white'}`}
                  >
                    <Mail size={16} />
                    {sendingConsentId === patient._id ? 'Invio...' : sentConsentIds.has(patient._id) ? 'Consenso inviato' : 'Invia consenso GDPR'}
                  </button>
                  <button
                    onClick={() => apriContrattoModal(patient)}
                    className="tw-bg-slate-700 tw-text-white tw-whitespace-nowrap"
                  >
                    <FileText size={16} />
                    Contratto
                  </button>
                  <button
                    onClick={() => openDocumentsModal(patient)}
                    className="tw-whitespace-nowrap"
                    style={{ background: 'var(--info)' }}
                  >
                    <FolderOpen size={16} />
                    Documenti
                  </button>
                  <button
                    onClick={() => openDocumentsModal(patient)}
                    className="tw-bg-indigo-700 tw-text-white tw-whitespace-nowrap"
                    title="Carica documento scannerizzato"
                  >
                    <Upload size={16} />
                    Carica documento
                  </button>
                  <button
                    onClick={() => setChatPatient(patient)}
                    className="tw-bg-teal-600 tw-text-white tw-whitespace-nowrap"
                  >
                    <MessageCircle size={16} />
                    Chat
                  </button>
                  {!isConsulenza && (user?.role === 'admin' || user?.role === 'coordinator') ? (
                    <select
                      value={patient.categoriaPrivata || ''}
                      onChange={e => {
                        if (e.target.value && e.target.value !== patient.categoriaPrivata) {
                          spostaCategoria(patient._id, e.target.value);
                        }
                      }}
                      className="tw-px-2 tw-py-2 tw-rounded-lg tw-border tw-border-slate-300 tw-text-sm tw-bg-white tw-cursor-pointer"
                      style={{ minWidth: '130px' }}
                      title="Sposta categoria"
                    >
                      <option value="" disabled>Sposta in...</option>
                      <option value="diagnostica">🩻 Diagnostica</option>
                      <option value="prelievi">🩸 Prelievi</option>
                      <option value="assistenza_domiciliare">🏠 Assistenza domiciliare</option>
                      <option value="trasporto">🚑 Trasporto</option>
                      <option value="visite_mediche">🩺 Visite mediche</option>
                      <option value="riabilitazione">🤸 Riabilitazione</option>
                    </select>
                  ) : null}
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
                            label: 'Relazione LLM',
                            icon: <FileText size={16} />,
                            onClick,
                          },
                          {
                            label: 'Modifica paziente',
                            icon: <Pencil size={16} />,
                            onClick: () => apriModificaPaziente(patient),
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

      {/* ═══ MODAL ANAGRAFICA COMPLETA ═══ */}
      {showAnagraficaModal && selectedAnagrafica && (
        <div className="tw-fixed tw-inset-0 tw-z-50 tw-bg-black/60 tw-flex tw-items-start tw-justify-center tw-p-4 tw-overflow-y-auto" onClick={() => setShowAnagraficaModal(false)}>
          <div className="tw-bg-white tw-rounded-2xl tw-shadow-2xl tw-w-full tw-max-w-[700px] tw-my-10 tw-p-6" onClick={e => e.stopPropagation()}>
            <div className="tw-flex tw-justify-between tw-items-center tw-mb-4 tw-flex-wrap tw-gap-2">
              <h3 className="tw-m-0 tw-text-brand tw-text-lg">
                <User size={22} className="tw-inline tw-mr-2" />
                Anagrafica completa — {selectedAnagrafica.firstName} {selectedAnagrafica.lastName}
              </h3>
              <button onClick={() => setShowAnagraficaModal(false)} className="tw-bg-slate-100 tw-border tw-border-slate-200 tw-rounded-md tw-px-2.5 tw-py-1.5 tw-cursor-pointer hover:tw-bg-slate-200">
                <X size={18} />
              </button>
            </div>

            <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-4 tw-text-sm">
              <div className="tw-bg-slate-50 tw-rounded-lg tw-p-3">
                <div className="tw-text-slate-500 tw-text-xs tw-mb-1">Nome</div>
                <div className="tw-font-semibold tw-text-slate-800">{selectedAnagrafica.firstName}</div>
              </div>
              <div className="tw-bg-slate-50 tw-rounded-lg tw-p-3">
                <div className="tw-text-slate-500 tw-text-xs tw-mb-1">Cognome</div>
                <div className="tw-font-semibold tw-text-slate-800">{selectedAnagrafica.lastName}</div>
              </div>
              <div className="tw-bg-slate-50 tw-rounded-lg tw-p-3">
                <div className="tw-text-slate-500 tw-text-xs tw-mb-1">Data di nascita</div>
                <div className="tw-font-semibold tw-text-slate-800">{formatDate(selectedAnagrafica.birthDate)}</div>
              </div>
              <div className="tw-bg-slate-50 tw-rounded-lg tw-p-3">
                <div className="tw-text-slate-500 tw-text-xs tw-mb-1">Codice Fiscale</div>
                <div className="tw-font-semibold tw-text-slate-800">{selectedAnagrafica.codiceFiscale || '—'}</div>
              </div>
              <div className="tw-bg-slate-50 tw-rounded-lg tw-p-3 sm:tw-col-span-2">
                <div className="tw-text-slate-500 tw-text-xs tw-mb-1">Indirizzo</div>
                <div className="tw-font-semibold tw-text-slate-800">{selectedAnagrafica.address || '—'}</div>
              </div>
              <div className="tw-bg-slate-50 tw-rounded-lg tw-p-3">
                <div className="tw-text-slate-500 tw-text-xs tw-mb-1">Telefono</div>
                <div className="tw-font-semibold tw-text-slate-800">{selectedAnagrafica.contactPhone || '—'}</div>
              </div>
              <div className="tw-bg-slate-50 tw-rounded-lg tw-p-3">
                <div className="tw-text-slate-500 tw-text-xs tw-mb-1">Email</div>
                <div className="tw-font-semibold tw-text-slate-800">{selectedAnagrafica.email || '—'}</div>
              </div>
              <div className="tw-bg-slate-50 tw-rounded-lg tw-p-3 sm:tw-col-span-2">
                <div className="tw-text-slate-500 tw-text-xs tw-mb-1">Fabbisogni assistenziali</div>
                <div className="tw-font-semibold tw-text-slate-800">{selectedAnagrafica.assistanceNeeds || '—'}</div>
              </div>
              {selectedAnagrafica.diagnosiAmmissione && (
                <div className="tw-bg-slate-50 tw-rounded-lg tw-p-3 sm:tw-col-span-2">
                  <div className="tw-text-slate-500 tw-text-xs tw-mb-1">Diagnosi di ammissione</div>
                  <div className="tw-font-semibold tw-text-slate-800">{selectedAnagrafica.diagnosiAmmissione}</div>
                </div>
              )}
              {selectedAnagrafica.comorbilita && (
                <div className="tw-bg-slate-50 tw-rounded-lg tw-p-3 sm:tw-col-span-2">
                  <div className="tw-text-slate-500 tw-text-xs tw-mb-1">Comorbilità</div>
                  <div className="tw-font-semibold tw-text-slate-800">{selectedAnagrafica.comorbilita}</div>
                </div>
              )}
              {selectedAnagrafica.allergie && (
                <div className="tw-bg-slate-50 tw-rounded-lg tw-p-3 sm:tw-col-span-2">
                  <div className="tw-text-slate-500 tw-text-xs tw-mb-1">Allergie</div>
                  <div className="tw-font-semibold tw-text-slate-800">{selectedAnagrafica.allergie}</div>
                </div>
              )}
              {selectedAnagrafica.caregiverRiferimento && (
                <div className="tw-bg-slate-50 tw-rounded-lg tw-p-3">
                  <div className="tw-text-slate-500 tw-text-xs tw-mb-1">Caregiver di riferimento</div>
                  <div className="tw-font-semibold tw-text-slate-800">{selectedAnagrafica.caregiverRiferimento}</div>
                </div>
              )}
              {selectedAnagrafica.caregiverTelefono && (
                <div className="tw-bg-slate-50 tw-rounded-lg tw-p-3">
                  <div className="tw-text-slate-500 tw-text-xs tw-mb-1">Telefono caregiver</div>
                  <div className="tw-font-semibold tw-text-slate-800">{selectedAnagrafica.caregiverTelefono}</div>
                </div>
              )}
              {selectedAnagrafica.tipoGestione === 'convenzione' && selectedAnagrafica.siat && (
                <div className="tw-bg-slate-50 tw-rounded-lg tw-p-3 sm:tw-col-span-2">
                  <div className="tw-text-slate-500 tw-text-xs tw-mb-1">Dati SIAT / Convenzione</div>
                  <div className="tw-font-semibold tw-text-slate-800">
                    NPI: {selectedAnagrafica.siat.npi || '—'} — Auth: {selectedAnagrafica.siat.codiceAutorizzazione || '—'}
                  </div>
                </div>
              )}
            </div>

            <div className="tw-flex tw-justify-end tw-gap-3 tw-mt-6">
              <button
                type="button"
                onClick={() => setShowAnagraficaModal(false)}
                className="tw-px-4 tw-py-2 tw-rounded-lg tw-border tw-border-slate-200 tw-bg-white tw-text-slate-700 tw-font-semibold hover:tw-bg-slate-50"
              >
                Chiudi
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => { setShowAnagraficaModal(false); apriModificaPaziente(selectedAnagrafica); }}
                  className="tw-px-4 tw-py-2 tw-rounded-lg tw-bg-brand tw-text-white tw-font-semibold hover:tw-bg-brand-dark tw-flex tw-items-center tw-gap-2"
                >
                  <Pencil size={16} />
                  Modifica
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL CONTRATTO D'INCARICO ═══ */}
      {showContrattoModal && contrattoPatient && (
        <div className="tw-fixed tw-inset-0 tw-z-50 tw-bg-black/60 tw-flex tw-items-start tw-justify-center tw-p-4 tw-overflow-y-auto" onClick={chiudiContrattoModal}>
          <div className="tw-bg-white tw-rounded-2xl tw-shadow-2xl tw-w-full tw-max-w-[480px] tw-my-10 tw-p-6" onClick={e => e.stopPropagation()}>
            <div className="tw-flex tw-justify-between tw-items-center tw-mb-4 tw-flex-wrap tw-gap-2">
              <h3 className="tw-m-0 tw-text-brand tw-text-lg">
                <FileText size={22} className="tw-inline tw-mr-2" />
                Contratto d'incarico
              </h3>
              <button onClick={chiudiContrattoModal} className="tw-bg-slate-100 tw-border tw-border-slate-200 tw-rounded-md tw-px-2.5 tw-py-1.5 tw-cursor-pointer hover:tw-bg-slate-200">
                <X size={18} />
              </button>
            </div>

            <p className="tw-text-sm tw-text-slate-600 tw-mb-4">
              Genera il contratto per <strong>{contrattoPatient.firstName} {contrattoPatient.lastName}</strong>.
            </p>

            <div className="tw-mb-4">
              <label className="tw-block tw-text-sm tw-font-semibold tw-text-slate-700 tw-mb-2">Profilo da reclutare</label>
              <select
                value={contrattoProfilo}
                onChange={(e) => setContrattoProfilo(e.target.value as 'Operatore generale' | 'Assistente familiare')}
                className="tw-w-full tw-px-3 tw-py-2 tw-rounded-lg tw-border tw-border-slate-300 tw-text-[0.9rem]"
              >
                <option value="Operatore generale">Operatore generale</option>
                <option value="Assistente familiare">Assistente familiare (badante/colf)</option>
              </select>
            </div>

            <div className="tw-mb-4">
              <label className="tw-block tw-text-sm tw-font-semibold tw-text-slate-700 tw-mb-2">Email destinatario (per firma)</label>
              <input
                type="email"
                value={contrattoEmail}
                onChange={(e) => setContrattoEmail(e.target.value)}
                placeholder="paziente@email.com"
                className="tw-w-full tw-px-3 tw-py-2 tw-rounded-lg tw-border tw-border-slate-300 tw-text-[0.9rem]"
              />
            </div>

            <div className="tw-mb-4 tw-bg-amber-50 tw-border tw-border-amber-200 tw-rounded-lg tw-p-3">
              <label className="tw-block tw-text-sm tw-font-semibold tw-text-slate-700 tw-mb-2">📎 Documento preventivo da allegare (opzionale)</label>
              {contrattoPreventivi.length > 0 && (
                <select
                  value={contrattoPreventivoId}
                  onChange={(e) => setContrattoPreventivoId(e.target.value)}
                  className="tw-w-full tw-px-3 tw-py-2 tw-rounded-lg tw-border tw-border-slate-300 tw-text-[0.9rem] tw-mb-2"
                >
                  <option value="">Nessun preventivo dal gestionale</option>
                  {contrattoPreventivi.map(p => (
                    <option key={p._id} value={p._id}>
                      {p.numero} — €{Number(p.totale || 0).toFixed(2)} ({new Date(p.data).toLocaleDateString('it-IT')})
                    </option>
                  ))}
                </select>
              )}
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => setContrattoAllegato(e.target.files?.[0] || null)}
                className="tw-w-full tw-text-sm tw-text-slate-600"
              />
              <p className="tw-text-xs tw-text-slate-500 tw-mt-1 tw-mb-0">
                Puoi allegare un preventivo già emesso (verrà inviato in PDF) e/o caricare un file. Il paziente lo riceverà in allegato e potrà scaricarlo prima di firmare.
              </p>
            </div>

            <div className="tw-flex tw-justify-end tw-gap-3">
              <button
                onClick={chiudiContrattoModal}
                className="tw-px-4 tw-py-2 tw-rounded-lg tw-border tw-border-slate-200 tw-bg-white tw-text-slate-700 tw-font-semibold hover:tw-bg-slate-50"
              >
                Annulla
              </button>
              <button
                onClick={stampaContratto}
                disabled={contrattoLoading}
                className="tw-px-4 tw-py-2 tw-rounded-lg tw-bg-brand tw-text-white tw-font-semibold hover:tw-bg-brand-dark tw-flex tw-items-center tw-gap-2"
              >
                <Printer size={16} />
                {contrattoLoading ? 'Creazione...' : 'Stampa / PDF'}
              </button>
              <button
                onClick={inviaContrattoEmail}
                disabled={contrattoLoading}
                className="tw-px-4 tw-py-2 tw-rounded-lg tw-bg-emerald-600 tw-text-white tw-font-semibold hover:tw-bg-emerald-700 tw-flex tw-items-center tw-gap-2"
              >
                <Mail size={16} />
                {contrattoLoading ? 'Invio...' : 'Invia firma'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL PREVENTIVO RAPIDO (senza piano di lavoro) ═══ */}
      {preventivoRapidoPaziente && (
        <div className="tw-fixed tw-inset-0 tw-z-50 tw-bg-black/60 tw-flex tw-items-start tw-justify-center tw-p-4 tw-overflow-y-auto" onClick={chiudiPreventivoRapido}>
          <div className="tw-bg-white tw-rounded-2xl tw-shadow-2xl tw-w-full tw-max-w-[640px] tw-my-10 tw-p-6" onClick={e => e.stopPropagation()}>
            <h3 className="tw-m-0 tw-mb-1 tw-text-brand tw-text-lg tw-font-bold">
              📄 Nuovo preventivo
            </h3>
            <p className="tw-text-sm tw-text-slate-500 tw-mb-4">
              {preventivoRapidoPaziente.firstName} {preventivoRapidoPaziente.lastName} — generato subito, senza creare un piano di lavoro
            </p>
            <form onSubmit={generaPreventivoRapido}>
              <div className="tw-flex tw-gap-3 tw-mb-4">
                <div className="tw-flex-1">
                  <label className="tw-block tw-text-sm tw-font-semibold tw-mb-1.5">Data prestazione</label>
                  <input
                    type="date"
                    value={preventivoRapidoData}
                    onChange={e => setPreventivoRapidoData(e.target.value)}
                    className="tw-w-full tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-300 tw-box-border"
                  />
                </div>
                <div className="tw-flex-1">
                  <label className="tw-block tw-text-sm tw-font-semibold tw-mb-1.5">Codice Fiscale paziente</label>
                  <input
                    type="text"
                    value={preventivoRapidoCF}
                    onChange={e => setPreventivoRapidoCF(e.target.value.toUpperCase())}
                    placeholder="RSSMRA70A01H501Z"
                    className="tw-w-full tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-300 tw-box-border tw-font-mono tw-uppercase"
                  />
                </div>
              </div>

              <div className="tw-mb-4">
                <label className="tw-block tw-text-sm tw-font-semibold tw-mb-2">Prestazioni</label>
                {preventivoRapidoRighe.map((riga, i) => (
                  <div key={i} className="tw-flex tw-flex-col tw-gap-1.5 tw-mb-2.5 tw-p-2 tw-rounded-lg tw-bg-slate-50 tw-border tw-border-slate-200">
                  <div className="tw-flex tw-gap-2">
                    <select
                      value={riga.tariffarioId}
                      onChange={e => selezionaTariffarioRiga(i, e.target.value)}
                      className="tw-flex-[2] tw-p-2 tw-rounded-lg tw-border tw-border-slate-300 tw-bg-white"
                      title="Carica dal tariffario"
                    >
                      <option value="">— Scegli dal tariffario (opzionale) —</option>
                      {Object.keys(TARIFFARIO_CATEGORIE_LABEL).map(cat => {
                        const vociCat = tariffarioVoci.filter(v => v.categoria === cat);
                        if (vociCat.length === 0) return null;
                        return (
                          <optgroup key={cat} label={TARIFFARIO_CATEGORIE_LABEL[cat]}>
                            {vociCat.map(v => (
                              <option key={v._id} value={v._id}>{v.nome} ({v.prezzo.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })})</option>
                            ))}
                          </optgroup>
                        );
                      })}
                      {(() => {
                        const altre = tariffarioVoci.filter(v => !TARIFFARIO_CATEGORIE_LABEL[v.categoria]);
                        if (altre.length === 0) return null;
                        return (
                          <optgroup label="Altro">
                            {altre.map(v => (
                              <option key={v._id} value={v._id}>{v.nome} ({v.prezzo.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })})</option>
                            ))}
                          </optgroup>
                        );
                      })()}
                    </select>
                  </div>
                  <div className="tw-flex tw-gap-2 tw-items-start">
                    <input
                      type="text"
                      value={riga.descrizione}
                      onChange={e => aggiornaRigaPreventivoRapido(i, 'descrizione', e.target.value)}
                      placeholder="Descrizione prestazione"
                      className="tw-flex-[2] tw-p-2 tw-rounded-lg tw-border tw-border-slate-300"
                    />
                    <input
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={riga.quantita}
                      onChange={e => aggiornaRigaPreventivoRapido(i, 'quantita', Number(e.target.value))}
                      title="Quantità"
                      className="tw-w-[64px] tw-p-2 tw-rounded-lg tw-border tw-border-slate-300"
                    />
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={riga.prezzoUnitario}
                      onChange={e => aggiornaRigaPreventivoRapido(i, 'prezzoUnitario', Number(e.target.value))}
                      placeholder="€"
                      title="Prezzo unitario"
                      className="tw-w-[90px] tw-p-2 tw-rounded-lg tw-border tw-border-slate-300"
                    />
                    <select
                      value={riga.aliquotaIva}
                      onChange={e => aggiornaRigaPreventivoRapido(i, 'aliquotaIva', Number(e.target.value))}
                      title="IVA"
                      className="tw-w-[92px] tw-p-2 tw-rounded-lg tw-border tw-border-slate-300"
                    >
                      <option value={0}>Esente</option>
                      <option value={4}>IVA 4%</option>
                      <option value={5}>IVA 5%</option>
                      <option value={10}>IVA 10%</option>
                      <option value={22}>IVA 22%</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => rimuoviRigaPreventivoRapido(i)}
                      disabled={preventivoRapidoRighe.length === 1}
                      className="tw-px-2.5 tw-py-2 tw-rounded-lg tw-bg-red-50 tw-text-red-700 tw-font-bold tw-border-0 disabled:tw-opacity-40"
                    >
                      ✕
                    </button>
                  </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={aggiungiRigaPreventivoRapido}
                  className="tw-px-3.5 tw-py-2 tw-rounded-lg tw-border tw-border-slate-300 tw-bg-slate-50 tw-font-semibold"
                >
                  + Aggiungi riga
                </button>
              </div>

              <div className="tw-mb-4">
                <label className="tw-block tw-text-sm tw-font-semibold tw-mb-1.5">Note (opzionale)</label>
                <textarea
                  value={preventivoRapidoNote}
                  onChange={e => setPreventivoRapidoNote(e.target.value)}
                  rows={2}
                  className="tw-w-full tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-300 tw-box-border"
                />
              </div>

              <div className="tw-flex tw-justify-between tw-items-center tw-mb-4 tw-gap-2 tw-bg-emerald-50 tw-border tw-border-emerald-200 tw-rounded-lg tw-p-3">
                <div className="tw-text-sm tw-text-emerald-800">
                  Imponibile {totalePreventivoRapido.imponibile.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                  {totalePreventivoRapido.iva > 0
                    ? ` + IVA ${totalePreventivoRapido.iva.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}`
                    : ' · esente art. 10 c.1 n.18 DPR 633/72'}
                </div>
                <div className="tw-text-lg tw-font-bold tw-text-emerald-800">
                  {(totalePreventivoRapido.imponibile + totalePreventivoRapido.iva).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                </div>
              </div>

              {preventivoRapidoError && (
                <div className="tw-text-red-600 tw-text-sm tw-mb-3">{preventivoRapidoError}</div>
              )}

              <div className="tw-flex tw-gap-2.5 tw-justify-end">
                <button
                  type="button"
                  onClick={chiudiPreventivoRapido}
                  className="tw-px-4 tw-py-2.5 tw-rounded-lg tw-border tw-border-slate-300 tw-bg-slate-50 tw-font-semibold"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={preventivoRapidoLoading}
                  className="tw-px-4.5 tw-py-2.5 tw-rounded-lg tw-bg-brand tw-text-white tw-font-bold tw-border-0"
                >
                  {preventivoRapidoLoading ? 'Generazione...' : 'Genera preventivo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </section>
  );
}

export default Patients;
