import { ChangeEvent, FormEvent, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useModalita } from '../context/ModalitaContext';
import api from '../api/api';
import SkeletonList from '../components/SkeletonList';
import {
  Users,
  UserPlus,
  FileText,
  Download,
  Trash2,
  X,
  Upload,
  Eye,
  AlertCircle,
  Loader2,
  Search,
  Calendar,
  Phone,
  Mail,
  LogOut,
  CheckCircle,
  UserX,
  Pencil,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Loading } from '../components/ui/Loading';

interface StaffMember {
  _id: string;
  userId?: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  category: 'infermieristico' | 'oss' | 'riabilitativo' | 'medico' | 'sociale' | 'coordinamento' | 'direzione' | 'privato' | 'osa' | 'assistente-familiare' | 'badante';
  phone?: string;
  active: boolean;
  dataInizioCollaborazione?: string;
  dataFineCollaborazione?: string;
  note?: string;
  modalitaAbilitata?: 'entrambi' | 'privato' | 'convenzione';
  domicilioPartenza?: string;
  raggioAzioneKm?: number;
  domicilioCoords?: { lat: number; lng: number };
}

interface StaffDocument {
  _id: string;
  staff: string;
  documentType: string;
  title: string;
  description?: string;
  fileName: string;
  contentType: string;
  createdAt: string;
}

const categories = [
  { value: 'infermieristico', label: 'Personale Infermieristico', color: '#4f46e5' },
  { value: 'oss', label: 'Personale OSS', color: '#06b6d4' },
  { value: 'riabilitativo', label: 'Personale Riabilitativo', color: '#10b981' },
  { value: 'medico', label: 'Medico', color: '#f59e0b' },
  { value: 'sociale', label: 'Personale Sociale', color: '#db2777' },
  { value: 'coordinamento', label: 'Coordinamento', color: '#8b5cf6' },
  { value: 'direzione', label: 'Direttore Sanitario', color: '#ef4444' },
  { value: 'privato', label: 'Personale Privato', color: '#84cc16' },
  { value: 'osa', label: 'OSA - Operatore Socio Assistenziale', color: '#06b6d4' },
  { value: 'assistente-familiare', label: 'Assistente familiare', color: '#f59e0b' },
  { value: 'badante', label: 'Badante', color: '#ec4899' },
];

const rolesByCategory: Record<string, string[]> = {
  infermieristico: ['Infermiere', 'Infermiere pediatrico', 'Infermiere di comunità'],
  oss: ['OSS - Operatore Socio Sanitario'],
  riabilitativo: ['Fisioterapista', 'Neuropsicomotricista', 'Logopedista', 'Terapista occupazionale'],
  medico: ['Medico rianimatore', 'Broncopneumologo', 'Psicologo', 'Neurologo', 'Geriatra'],
  sociale: ['Assistente sociale'],
  coordinamento: ['Coordinatore infermieristico', 'Coordinatore medico', 'Coordinatore fisioterapico'],
  direzione: ['Direttore sanitario'],
  privato: ['Assistente familiare', 'Assistente sanitario', 'OSS - Operatore Socio Sanitario', 'Badante'],
  osa: ['OSA - Operatore Socio Assistenziale'],
  'assistente-familiare': ['Assistente familiare'],
  badante: ['Badante'],
};

const documentTypes = [
  { value: 'contratto', label: 'Contratto di lavoro' },
  { value: 'curriculum', label: 'Curriculum Vitae' },
  { value: 'diploma', label: 'Diploma/Laurea' },
  { value: 'abilitazione', label: 'Abilitazione professionale' },
  { value: 'certificato', label: 'Certificato' },
  { value: 'altro', label: 'Altro' },
];

function Staff() {
  const { user } = useAuth();
  const { isConvenzione, isConsulenza } = useModalita();
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingContratto, setLoadingContratto] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedModalita, setSelectedModalita] = useState<'tutte' | 'privato' | 'convenzione' | 'entrambi'>('tutte');
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: '',
    category: 'infermieristico' as StaffMember['category'],
    phone: '',
    dataInizioCollaborazione: new Date().toISOString().split('T')[0],
    note: '',
    modalitaAbilitata: 'entrambi' as 'entrambi' | 'privato' | 'convenzione',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [staffInModifica, setStaffInModifica] = useState<StaffMember | null>(null);
  const [modificaForm, setModificaForm] = useState({ firstName: '', lastName: '', email: '', phone: '', role: '', category: 'infermieristico' as StaffMember['category'], note: '', modalitaAbilitata: 'entrambi' as 'entrambi' | 'privato' | 'convenzione' });
  const [salvataggioModifica, setSalvataggioModifica] = useState(false);

  // Document management state
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [documents, setDocuments] = useState<StaffDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({ documentType: '', title: '', description: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Zona lavorativa inline edit
  const [zonaEditId, setZonaEditId] = useState<string | null>(null);
  const [zonaForm, setZonaForm] = useState<{ domicilioPartenza: string; raggioAzioneKm: number; domicilioCoords: { lat: number; lng: number } | null }>({ domicilioPartenza: '', raggioAzioneKm: 10, domicilioCoords: null });
  const [zonaGeoLoading, setZonaGeoLoading] = useState(false);
  const [zonaGeoError, setZonaGeoError] = useState('');
  const [zonaSalvando, setZonaSalvando] = useState(false);

  const apriZonaEdit = (s: StaffMember) => {
    setZonaEditId(s._id);
    setZonaForm({
      domicilioPartenza: s.domicilioPartenza || '',
      raggioAzioneKm: s.raggioAzioneKm ?? 10,
      domicilioCoords: s.domicilioCoords || null,
    });
    setZonaGeoError('');
  };

  const geocodificaZona = useCallback(async () => {
    if (!zonaForm.domicilioPartenza.trim()) return;
    setZonaGeoLoading(true);
    setZonaGeoError('');
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(zonaForm.domicilioPartenza)}&limit=1&countrycodes=it`,
        { headers: { 'Accept-Language': 'it' } }
      );
      const d = await r.json();
      if (d.length > 0) {
        setZonaForm(f => ({ ...f, domicilioCoords: { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) } }));
      } else {
        setZonaGeoError('Indirizzo non trovato.');
      }
    } catch { setZonaGeoError('Errore geocoding.'); }
    setZonaGeoLoading(false);
  }, [zonaForm.domicilioPartenza]);

  const salvaZona = async (staffId: string) => {
    setZonaSalvando(true);
    try {
      await api.put(`/staff/${staffId}`, {
        domicilioPartenza: zonaForm.domicilioPartenza,
        raggioAzioneKm: zonaForm.raggioAzioneKm,
        ...(zonaForm.domicilioCoords ? { domicilioCoords: zonaForm.domicilioCoords } : {}),
      });
      setZonaEditId(null);
      loadStaff();
    } catch { /* noop */ }
    setZonaSalvando(false);
  };

  // Dimissioni modal state
  const [showDimissioniModal, setShowDimissioniModal] = useState(false);
  const [dimissioniStaff, setDimissioniStaff] = useState<StaffMember | null>(null);
  const [dimissioniForm, setDimissioniForm] = useState({ dataFine: '', motivazione: '' });

  useEffect(() => {
    loadStaff();
  }, []);

  useEffect(() => {
    filterStaff();
  }, [searchTerm, selectedCategory, selectedModalita, staffMembers, isConvenzione, isConsulenza]);

  const loadStaff = async () => {
    try {
      const response = await api.get('/staff');
      setStaffMembers(response.data);
    } catch (error) {
      console.error('Errore caricamento personale', error);
    } finally {
      setLoading(false);
    }
  };

  const categoriePrivate = ['privato', 'osa', 'assistente-familiare', 'badante'];
  // Area Consulenza Famiglie: solo personale domestico/familiare (colf, badanti, assistenti familiari, osa)
  const categorieConsulenza = ['privato', 'osa', 'assistente-familiare', 'badante'];

  // In area Consulenza Famiglie il nuovo personale è sempre di tipo familiare e abilitato al privato
  useEffect(() => {
    if (!isConsulenza) return;
    if (!categorieConsulenza.includes(formData.category)) {
      setFormData(prev => ({ ...prev, category: 'badante', role: '', modalitaAbilitata: 'privato' }));
    }
  }, [isConsulenza, showForm]);

  const filterStaff = () => {
    let filtered = [...staffMembers];

    if (isConsulenza) {
      filtered = filtered.filter(s =>
        categorieConsulenza.includes(s.category) && s.modalitaAbilitata !== 'convenzione'
      );
    } else if (isConvenzione) {
      filtered = filtered.filter(s =>
        s.modalitaAbilitata !== 'privato' &&
        !categoriePrivate.includes(s.category)
      );
    } else {
      // In Gestione Privata: nasconde lo staff abilitato solo alla convenzione SIAT
      filtered = filtered.filter(s => s.modalitaAbilitata !== 'convenzione');
    }

    if (selectedCategory) {
      filtered = filtered.filter(s => s.category === selectedCategory);
    }

    if (selectedModalita !== 'tutte') {
      filtered = filtered.filter(s => s.modalitaAbilitata === selectedModalita || s.modalitaAbilitata === 'entrambi');
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term) ||
        s.role.toLowerCase().includes(term)
      );
    }

    setFilteredStaff(filtered);
  };

  const spostaCategoriaStaff = async (staffId: string, nuovaCategoria: string) => {
    if (!window.confirm(`Spostare il professionista in ${getCategoryLabel(nuovaCategoria)}?`)) return;
    try {
      await api.put(`/staff/${staffId}`, { category: nuovaCategoria });
      loadStaff();
    } catch (error: any) {
      alert('Errore nello spostamento: ' + (error?.response?.data?.message || 'Riprova.'));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    try {
      await api.post('/staff', isConsulenza ? { ...formData, modalitaAbilitata: 'privato' } : formData);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        role: '',
        category: 'infermieristico',
        phone: '',
        dataInizioCollaborazione: new Date().toISOString().split('T')[0],
        note: '',
        modalitaAbilitata: 'entrambi',
      });
      setShowForm(false);
      loadStaff();
      setSuccess('Membro dello staff aggiunto con successo!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      const apiMessage = err?.response?.data?.message || err?.message;
      setError(apiMessage || 'Impossibile salvare il membro dello staff.');
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'modalitaAbilitata' && value === 'convenzione' && ['privato','osa','assistente-familiare','badante'].includes(prev.category)) {
        next.category = 'infermieristico';
        next.role = '';
      }
      return next;
    });
  };

  const apriModificaStaff = (staff: StaffMember) => {
    setStaffInModifica(staff);
    setModificaForm({ firstName: staff.firstName, lastName: staff.lastName, email: staff.email, phone: staff.phone || '', role: staff.role, category: staff.category, note: staff.note || '', modalitaAbilitata: staff.modalitaAbilitata || 'entrambi' });
    setError('');
  };

  const salvaModificaStaff = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!staffInModifica) return;
    setSalvataggioModifica(true);
    setError('');
    try {
      await api.put(`/staff/${staffInModifica._id}`, modificaForm);
      setStaffInModifica(null);
      setSuccess('Dati dell’operatore aggiornati. Se è cambiata l’email, l’operatore dovrà usare il nuovo indirizzo dal prossimo accesso.');
      await loadStaff();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Impossibile aggiornare i dati dell’operatore.');
    } finally {
      setSalvataggioModifica(false);
    }
  };

  const openDocumentsModal = async (staff: StaffMember) => {
    setSelectedStaff(staff);
    await loadStaffDocuments(staff._id);
    setShowDocumentsModal(true);
  };

  const closeDocumentsModal = () => {
    setShowDocumentsModal(false);
    setSelectedStaff(null);
    setDocuments([]);
    setUploadForm({ documentType: '', title: '', description: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const loadStaffDocuments = async (staffId: string) => {
    try {
      const response = await api.get(`/staff/${staffId}/documents`);
      setDocuments(response.data);
    } catch (error) {
      console.error('Errore caricamento documenti:', error);
    }
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Seleziona un file da caricare');
      return;
    }

    if (!uploadForm.documentType) {
      setError('Seleziona un tipo di documento');
      return;
    }

    if (!selectedStaff) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('documentType', uploadForm.documentType);
      formData.append('title', uploadForm.title || file.name);
      if (uploadForm.description) {
        formData.append('description', uploadForm.description);
      }

      await api.post(`/staff/${selectedStaff._id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      await loadStaffDocuments(selectedStaff._id);
      setUploadForm({ documentType: '', title: '', description: '' });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setSuccess('Documento caricato con successo!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore nel caricamento del documento');
    } finally {
      setUploading(false);
    }
  };

  const downloadDocument = async (documentId: string, fileName: string) => {
    try {
      const response = await api.get(`/staff/documents/${documentId}`, {
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
      setError('Errore nel download del documento');
    }
  };

  const previewDocument = async (documentId: string) => {
    try {
      const response = await api.get(`/staff/documents/${documentId}`, {
        responseType: 'blob'
      });
      const contentType = response.headers['content-type'] as string | undefined;
      const blob = new Blob([response.data], { type: contentType || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      console.error('Errore anteprima:', error);
    }
  };

  const deleteDocument = async (documentId: string) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo documento?')) return;
    try {
      await api.delete(`/staff/documents/${documentId}`);
      if (selectedStaff) {
        await loadStaffDocuments(selectedStaff._id);
      }
      setSuccess('Documento eliminato con successo!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Errore eliminazione:', error);
      setError('Errore nell\'eliminazione del documento');
    }
  };

  const openDimissioniModal = (staff: StaffMember) => {
    setDimissioniStaff(staff);
    setDimissioniForm({ dataFine: new Date().toISOString().split('T')[0], motivazione: '' });
    setShowDimissioniModal(true);
  };

  const closeDimissioniModal = () => {
    setShowDimissioniModal(false);
    setDimissioniStaff(null);
    setDimissioniForm({ dataFine: '', motivazione: '' });
  };

  const confermaDimissioni = async () => {
    if (!dimissioniStaff) return;
    try {
      await api.post(`/staff/${dimissioniStaff._id}/dimissioni`, dimissioniForm);
      closeDimissioniModal();
      loadStaff();
      setSuccess('Dimissione registrata con successo!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore nella registrazione della dimissione');
    }
  };

  const riattivaStaff = async (staffId: string) => {
    try {
      await api.post(`/staff/${staffId}/riattiva`);
      loadStaff();
      setSuccess('Membro dello staff riattivato!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError('Errore nella riattivazione');
    }
  };

  const deleteStaff = async (staffId: string) => {
    if (!window.confirm('Sei sicuro di voler eliminare definitivamente questo membro dello staff?')) return;
    try {
      await api.delete(`/staff/${staffId}`);
      loadStaff();
      setSuccess('Membro dello staff eliminato!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError('Errore nell\'eliminazione');
    }
  };

  const apriContrattoStaff = async (staff: StaffMember) => {
    if (!staff.userId) {
      setError('Operatore non collegato a un account utente.');
      setTimeout(() => setError(''), 4000);
      return;
    }
    setLoadingContratto(staff._id);
    try {
      const res = await api.get(`/contratto/pdf/${staff.userId}`);
      const html = res.data;
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, '_blank');
      if (w) w.onload = () => URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Errore nel caricamento del contratto.');
      setTimeout(() => setError(''), 4000);
    } finally {
      setLoadingContratto(null);
    }
  };

  const openProfiloPdf = async (staff: StaffMember) => {
    if (!staff.userId) {
      setError('Profilo utente non collegato. Questo operatore potrebbe essere stato creato manualmente.');
      setTimeout(() => setError(''), 4000);
      return;
    }
    try {
      const [resUser, resDocs] = await Promise.all([
        api.get(`/auth/users/${staff.userId}/details`),
        api.get(`/staff/${staff._id}/documents`),
      ]);
      const u = resUser.data;
      const docs: StaffDocument[] = resDocs.data;
      const contratti = docs.filter(d => d.documentType === 'contratto');
      const altriDocs = docs.filter(d => d.documentType !== 'contratto');

      const roleLabel = u.professione || u.role || staff.role;
      const fd = (d?: string) => d ? new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
      const esc = (v?: string) => v ? String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : '—';

      const baseUrl = (api.defaults.baseURL as string || 'http://localhost:4000/api').replace(/\/$/, '');
      const token = localStorage.getItem('token') || '';

      const contrattiHtml = contratti.length > 0
        ? `<h2>📎 Contratto caricato</h2>
           <table style="width:100%;border-collapse:collapse;margin-top:8px">
             ${contratti.map(d => `
               <tr>
                 <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">${esc(d.title)}</td>
                 <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:0.82rem;color:#6b7280">${esc(d.fileName)}</td>
                 <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">
                   <a href="${baseUrl}/staff/documents/${d._id}?token=${encodeURIComponent(token)}" target="_blank" style="color:#1e4d8c;font-weight:600">Apri documento ↗</a>
                 </td>
               </tr>`).join('')}
           </table>`
        : `<h2>📎 Contratto caricato</h2><p style="color:#6b7280;font-style:italic">Nessun contratto caricato nella sezione Documenti.</p>`;

      const altriDocsHtml = altriDocs.length > 0
        ? `<h2>📄 Altri documenti</h2>
           <table style="width:100%;border-collapse:collapse;margin-top:8px">
             ${altriDocs.map(d => `
               <tr>
                 <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">${esc(d.title)}</td>
                 <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:0.82rem;color:#6b7280">${esc(d.documentType)}</td>
                 <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">
                   <a href="${baseUrl}/staff/documents/${d._id}?token=${encodeURIComponent(token)}" target="_blank" style="color:#1e4d8c">Apri ↗</a>
                 </td>
               </tr>`).join('')}
           </table>`
        : '';

      const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Profilo - ${esc(u.name)}</title>
      <style>body{font-family:Arial,sans-serif;margin:24px;color:#1f2937}h1{font-size:1.4rem;color:#1e4d8c;border-bottom:2px solid #1e4d8c;padding-bottom:8px}h2{font-size:1rem;margin-top:20px;border-bottom:1px solid #d1d5db;padding-bottom:6px}.f{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e5e7eb}.f strong{color:#111827}@media print{body{margin:12px}}</style>
      </head><body>
      <h1>Profilo Operatore</h1>
      <p>${esc(u.name)} • ${esc(roleLabel)}</p>
      <h2>Informazioni generali</h2>
      <div class="f"><strong>Nome</strong><span>${esc(u.name)}</span></div>
      <div class="f"><strong>Email</strong><span>${esc(u.email)}</span></div>
      <div class="f"><strong>Ruolo</strong><span>${esc(roleLabel)}</span></div>
      <div class="f"><strong>Categoria</strong><span>${esc(u.categoria || staff.category)}</span></div>
      ${u.telefono ? `<div class="f"><strong>Telefono</strong><span>${esc(u.telefono)}</span></div>` : ''}
      ${u.codiceFiscale ? `<div class="f"><strong>Codice Fiscale</strong><span>${esc(u.codiceFiscale)}</span></div>` : ''}
      ${u.dataNascita ? `<div class="f"><strong>Data nascita</strong><span>${esc(fd(u.dataNascita))}</span></div>` : ''}
      ${u.luogoNascita ? `<div class="f"><strong>Luogo nascita</strong><span>${esc(u.luogoNascita)}</span></div>` : ''}
      ${u.indirizzoResidenza ? `<div class="f"><strong>Residenza</strong><span>${esc(u.indirizzoResidenza)}</span></div>` : ''}
      ${u.pec ? `<div class="f"><strong>PEC</strong><span>${esc(u.pec)}</span></div>` : ''}
      ${u.tipoCollaborazione ? `<div class="f"><strong>Collaborazione</strong><span>${esc(u.tipoCollaborazione)}</span></div>` : ''}
      ${u.partitaIva ? `<div class="f"><strong>Partita IVA</strong><span>${esc(u.partitaIva)}</span></div>` : ''}
      ${u.ordineAlbo ? `<div class="f"><strong>Ordine Albo</strong><span>${esc(u.ordineAlbo)} n. ${esc(u.numeroAlbo)}</span></div>` : ''}
      ${staff.domicilioPartenza ? `<div class="f"><strong>Zona lavorativa</strong><span>${esc(staff.domicilioPartenza)} — ${staff.raggioAzioneKm ?? 10} km</span></div>` : ''}
      <h2>Collaborazione</h2>
      <div class="f"><strong>Inizio</strong><span>${esc(fd(staff.dataInizioCollaborazione))}</span></div>
      ${!staff.active && staff.dataFineCollaborazione ? `<div class="f"><strong>Fine</strong><span>${esc(fd(staff.dataFineCollaborazione))}</span></div>` : ''}
      <div class="f"><strong>Stato</strong><span>${staff.active ? 'Attivo' : 'Inattivo'}</span></div>
      <h2>Firma digitale contratto</h2>
      ${(u.firmaContratto && u.firmaContratto !== 'null' && u.firmaContratto.length > 10) ? `<div style="margin:8px 0"><img src="${u.firmaContratto}" style="max-width:280px;border:1px solid #d1d5db;padding:8px;background:#fff" /></div><div class="f"><strong>Data firma</strong><span>${esc(fd(u.dataFirmaContratto))}</span></div><div class="f"><strong>Luogo firma</strong><span>${esc(u.luogoFirmaContratto)}</span></div>` : '<p style="color:#6b7280;font-style:italic">Firma digitale non disponibile.</p>'}
      ${contrattiHtml}
      ${altriDocsHtml}
      <p style="margin-top:24px;font-size:8pt;color:#6b7280;text-align:center;border-top:1px solid #e5e7eb;padding-top:12px">Generata il ${new Date().toLocaleString('it-IT')} - Abbraccio Cure Domiciliari</p>
      <script>window.onload=function(){window.print()}<\/script>
      </body></html>`;
      const win = window.open('', '_blank');
      if (!win) { setError('Impossibile aprire la finestra. Controlla il blocco popup.'); return; }
      win.document.write(html);
      win.document.close();
      win.focus();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Errore nel caricamento del profilo.');
      setTimeout(() => setError(''), 4000);
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/D';
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  const getCategoryColor = (category: string) => {
    const cat = categories.find(c => c.value === category);
    return cat?.color || '#6b7280';
  };

  const getCategoryLabel = (category: string) => {
    const cat = categories.find(c => c.value === category);
    return cat?.label || category;
  };

  const canEdit = user && (user.role === 'admin' || user.role === 'coordinator');

  return (
    <section className="section-wide">
      <h2>
        <Users size={28} />
        {isConsulenza ? 'Personale Consulenza Famiglie' : 'Gestione Personale'}
      </h2>

      {success && (
        <Alert type="success" onClose={() => setSuccess('')} className="tw-mb-4">
          {success}
        </Alert>
      )}
      {error && (
        <Alert type="error" onClose={() => setError('')} className="tw-mb-4">
          {error}
        </Alert>
      )}

      {/* Search and Filter Bar */}
      <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-3 tw-mb-5">
        <div className="tw-flex-1 tw-min-w-[200px]">
          <Input
            placeholder="Cerca per nome, email o ruolo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search size={18} />}
          />
        </div>

        <div className="tw-flex tw-flex-wrap tw-gap-2">
          <button
            onClick={() => setSelectedCategory('')}
            className={`tw-px-3 tw-py-2 tw-rounded-lg tw-text-sm tw-font-semibold tw-transition-colors ${selectedCategory === '' ? 'tw-bg-slate-800 tw-text-white' : 'tw-bg-white tw-text-slate-600 tw-border tw-border-slate-300'}`}
          >
            Tutti
          </button>
          {categories
            .filter(cat =>
              isConsulenza
                ? categorieConsulenza.includes(cat.value)
                : (!isConvenzione || !categoriePrivate.includes(cat.value))
            )
            .map(cat => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`tw-px-3 tw-py-2 tw-rounded-lg tw-text-sm tw-font-semibold tw-transition-colors tw-border ${selectedCategory === cat.value ? 'tw-text-white tw-border-transparent' : 'tw-bg-white tw-text-slate-600 tw-border-slate-300'}`}
                style={selectedCategory === cat.value ? { backgroundColor: cat.color } : undefined}
              >
                {cat.label}
              </button>
            ))}
        </div>

        {canEdit && (
          <Button
            variant={showForm ? 'secondary' : 'primary'}
            onClick={() => setShowForm(!showForm)}
            icon={<UserPlus size={18} />}
          >
            {showForm ? 'Annulla' : 'Nuovo Staff'}
          </Button>
        )}
      </div>

      {/* Modalità (chip contestuali all'area attiva) — nascosti in Consulenza Famiglie */}
      {!isConsulenza && (
      <div className="tw-flex tw-flex-wrap tw-gap-2 tw-mb-5">
        {[
          { value: 'tutte', label: 'Tutti' },
          { value: 'privato', label: '👤 Solo Privati' },
          { value: 'convenzione', label: '🏥 Solo SIAT' },
          { value: 'entrambi', label: '🔀 Entrambi' },
        ].filter(mod =>
          !(isConvenzione && mod.value === 'privato') &&
          !(!isConvenzione && mod.value === 'convenzione')
        ).map(mod => (
          <button
            key={mod.value}
            onClick={() => setSelectedModalita(mod.value as any)}
            className={`tw-px-3 tw-py-2 tw-rounded-lg tw-text-sm tw-font-semibold tw-transition-colors tw-border ${selectedModalita === mod.value ? 'tw-bg-brand tw-text-white tw-border-transparent' : 'tw-bg-white tw-text-slate-600 tw-border-slate-300'}`}
          >
            {mod.label}
          </button>
        ))}
      </div>
      )}

      {/* Search Results Info */}
      {(searchTerm || selectedCategory) && (
        <p className="tw-mb-4 tw-text-slate-500 tw-text-[0.92rem]">
          Trovati {filteredStaff.length} membro{filteredStaff.length !== 1 ? 'i' : ''} dello staff
        </p>
      )}

      {/* Add Staff Form */}
      {showForm && canEdit && (
        <form onSubmit={handleSubmit} className="user-form">
          <h4>
            <UserPlus size={18} />
            Nuovo Membro dello Staff
          </h4>
          <div className="tw-grid tw-grid-cols-2 tw-gap-4">
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
            Email *
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              placeholder="mario.rossi@email.com"
            />
          </label>
          <div className="tw-grid tw-grid-cols-2 tw-gap-4">
            <label>
              Categoria *
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
              >
                {categories
                  .filter(cat =>
                    isConsulenza
                      ? categorieConsulenza.includes(cat.value)
                      : (!['privato','osa','assistente-familiare','badante'].includes(cat.value) || (!isConvenzione && formData.modalitaAbilitata !== 'convenzione'))
                  )
                  .map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
              </select>
            </label>
            <label>
              Ruolo *
              <select
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                required
              >
                <option value="">Seleziona ruolo...</option>
                {formData.category && rolesByCategory[formData.category]?.map(role => (
                  <option key={role} value={role.toLowerCase().replace(/\s+/g, '-').replace(/[']/g, '').replace(/-$/,'')}>{role}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Telefono
            <input
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="+39 333 1234567"
            />
          </label>
          <label>
            Data inizio collaborazione *
            <input
              type="date"
              name="dataInizioCollaborazione"
              value={formData.dataInizioCollaborazione}
              onChange={handleInputChange}
              required
            />
          </label>
          {!isConsulenza && (
            <label>
              Modalità abilitata
              <select
                name="modalitaAbilitata"
                value={formData.modalitaAbilitata}
                onChange={handleInputChange}
              >
                <option value="entrambi">Entrambe (Privato + Convenzione)</option>
                <option value="privato">Solo Pazienti Privati</option>
                <option value="convenzione">Solo Pazienti Convenzione SIAT</option>
              </select>
            </label>
          )}
          <label>
            Note (opzionale)
            <textarea
              name="note"
              value={formData.note}
              onChange={handleInputChange}
              rows={2}
              placeholder="Note aggiuntive..."
            />
          </label>
          {error && (
            <div className="tw-flex tw-items-center tw-gap-2 tw-p-3 tw-rounded-md tw-text-[0.92rem] tw-text-red-600 tw-bg-red-600/[0.08]">
              <AlertCircle size={18} />
              {error}
            </div>
          )}
          <button type="submit">Salva Membro dello Staff</button>
        </form>
      )}

      {/* Staff List */}
      <div className="staff-list">
        <h3>
          <Users size={20} />
          Elenco Personale ({filteredStaff.length})
        </h3>
        {loading ? (
          <div className="tw-py-2"><SkeletonList rows={6} showHeader={false} /></div>
        ) : filteredStaff.length === 0 ? (
          <p className="tw-text-center tw-py-8 tw-text-slate-500">
            Nessun membro dello staff trovato.
          </p>
        ) : (
          <ul>
            {filteredStaff.map((staff) => (
              <li key={staff._id} className={`tw-border-l-4 ${!staff.active ? 'tw-opacity-60' : ''}`} style={{ borderLeftColor: getCategoryColor(staff.category) }}>
                <div className="tw-flex tw-justify-between tw-items-start tw-gap-4">
                  <div className="tw-flex-1">
                    <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-3 tw-mb-2">
                      <strong className="tw-text-[1.05rem]">
                        {staff.firstName} {staff.lastName}
                      </strong>
                      <span className="tw-text-[0.78rem] tw-px-2.5 tw-py-0.5 tw-rounded-full tw-font-semibold" style={{
                        backgroundColor: `${getCategoryColor(staff.category)}20`,
                        color: getCategoryColor(staff.category),
                      }}>
                        {getCategoryLabel(staff.category)}
                      </span>
                      {!staff.active && (
                        <Badge variant="danger" size="sm">Inattivo</Badge>
                      )}
                      {/* Badge modalità abilitata */}
                      {staff.modalitaAbilitata && staff.modalitaAbilitata !== 'entrambi' && (
                        <span className="tw-text-[0.72rem] tw-px-2 tw-py-0.5 tw-rounded-full tw-font-bold" style={{
                          backgroundColor: staff.modalitaAbilitata === 'convenzione' ? '#eff6ff' : '#f0fdf4',
                          color: staff.modalitaAbilitata === 'convenzione' ? '#0369a1' : '#166534',
                          border: `1px solid ${staff.modalitaAbilitata === 'convenzione' ? '#bae6fd' : '#bbf7d0'}`,
                        }}>
                          {staff.modalitaAbilitata === 'convenzione' ? '🏥 Solo SIAT' : '👤 Solo Privati'}
                        </span>
                      )}
                    </div>
                    <div className="tw-text-[0.88rem] tw-text-slate-600 tw-flex tw-flex-wrap tw-gap-4">
                      <span className="tw-inline-flex tw-items-center tw-gap-1">
                        <Mail size={14} /> {staff.email}
                      </span>
                      {staff.phone && (
                        <span className="tw-inline-flex tw-items-center tw-gap-1">
                          <Phone size={14} /> {staff.phone}
                        </span>
                      )}
                      <span className="tw-inline-flex tw-items-center tw-gap-1">
                        <Calendar size={14} /> Dal {formatDate(staff.dataInizioCollaborazione)}
                      </span>
                    </div>
                    {!staff.active && staff.dataFineCollaborazione && (
                      <p className="tw-text-[0.85rem] tw-text-red-600 tw-mt-1 tw-mb-0">
                        Fine collaborazione: {formatDate(staff.dataFineCollaborazione)}
                      </p>
                    )}
                    {/* ── Zona lavorativa ── */}
                    <div className="tw-mt-1.5 tw-flex tw-flex-wrap tw-items-center tw-gap-2">
                      {staff.domicilioPartenza ? (
                        <span className="tw-text-[0.8rem] tw-bg-green-50 tw-border tw-border-green-200 tw-rounded-md tw-px-2 tw-py-0.5 tw-text-green-800 tw-inline-flex tw-items-center tw-gap-1">
                          📍 {staff.domicilioPartenza} — {staff.raggioAzioneKm ?? 10} km
                          {staff.domicilioCoords && <span className="tw-text-green-600">✓</span>}
                        </span>
                      ) : (
                        <span className="tw-text-[0.78rem] tw-bg-amber-50 tw-border tw-border-amber-300 tw-rounded-md tw-px-2 tw-py-0.5 tw-text-amber-800">
                          ⚠️ Zona non impostata
                        </span>
                      )}
                      {canEdit && staff.active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => zonaEditId === staff._id ? setZonaEditId(null) : apriZonaEdit(staff)}
                        >
                          {zonaEditId === staff._id ? '✕ Chiudi' : '✏️ Zona'}
                        </Button>
                      )}
                    </div>
                    {/* Form inline zona */}
                    {zonaEditId === staff._id && (
                      <div className="tw-mt-2.5 tw-bg-slate-50 tw-border tw-border-slate-200 tw-rounded-lg tw-p-3 tw-flex tw-flex-col tw-gap-2.5">
                        <div className="tw-font-bold tw-text-[0.85rem] tw-text-brand tw-mb-0.5">📍 Zona lavorativa</div>
                        <div className="tw-flex tw-gap-1.5">
                          <input
                            value={zonaForm.domicilioPartenza}
                            onChange={e => { setZonaForm(f => ({ ...f, domicilioPartenza: e.target.value, domicilioCoords: null })); setZonaGeoError(''); }}
                            placeholder="Es. Via Roma 10, Roma RM"
                            className="tw-flex-1 tw-py-1.5 tw-px-2.5 tw-rounded-md tw-border tw-border-slate-300 tw-text-[0.85rem]"
                          />
                          <button type="button" onClick={geocodificaZona} disabled={zonaGeoLoading || !zonaForm.domicilioPartenza.trim()}
                            className="tw-bg-brand tw-text-white tw-border-0 tw-rounded-md tw-py-1.5 tw-px-3 tw-cursor-pointer tw-text-[0.82rem] tw-font-bold disabled:tw-opacity-70">
                            {zonaGeoLoading ? '...' : '📍'}
                          </button>
                        </div>
                        {zonaGeoError && <span className="tw-text-[0.78rem] tw-text-red-600">{zonaGeoError}</span>}
                        {zonaForm.domicilioCoords && <span className="tw-text-[0.78rem] tw-text-green-600">✓ Posizione trovata ({zonaForm.domicilioCoords.lat.toFixed(4)}, {zonaForm.domicilioCoords.lng.toFixed(4)})</span>}
                        <label className="tw-text-[0.82rem] tw-font-semibold tw-text-slate-700">
                          Raggio: <strong>{zonaForm.raggioAzioneKm} km</strong>
                          <input type="range" min={1} max={80} step={1} value={zonaForm.raggioAzioneKm}
                            onChange={e => setZonaForm(f => ({ ...f, raggioAzioneKm: Number(e.target.value) }))}
                            className="tw-w-full tw-mt-1" />
                        </label>
                        <div className="tw-flex tw-gap-2">
                          <button type="button" onClick={() => setZonaEditId(null)}
                            className="tw-flex-1 tw-bg-slate-100 tw-border tw-border-slate-300 tw-rounded-md tw-py-1.5 tw-cursor-pointer tw-text-[0.82rem]">
                            Annulla
                          </button>
                          <button type="button" onClick={() => salvaZona(staff._id)} disabled={zonaSalvando}
                            className={`tw-flex-[2] tw-text-white tw-border-0 tw-rounded-md tw-py-1.5 tw-font-bold tw-text-[0.82rem] tw-cursor-pointer disabled:tw-cursor-not-allowed ${zonaSalvando ? 'tw-bg-slate-300' : 'tw-bg-emerald-600'}`}>
                            {zonaSalvando ? '...' : '✅ Salva zona'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="tw-flex tw-flex-wrap tw-gap-2 tw-flex-shrink-0 tw-items-center">
                    {/* Select modalità inline — solo admin/coordinator */}
                    {canEdit && staff.active && (
                      <select
                        value={staff.modalitaAbilitata || 'entrambi'}
                        onChange={async (e) => {
                          const val = e.target.value as 'entrambi' | 'privato' | 'convenzione';
                          try {
                            await api.put(`/staff/${staff._id}`, { modalitaAbilitata: val });
                            loadStaff();
                          } catch {}
                        }}
                        className="tw-text-[0.78rem] tw-py-1 tw-px-2 tw-rounded-md tw-border tw-border-slate-300 tw-cursor-pointer tw-bg-white tw-text-slate-700"
                        title="Modalità abilitata per questo operatore"
                      >
                        <option value="entrambi">🔓 Entrambi</option>
                        <option value="privato">👤 Solo Privati</option>
                        <option value="convenzione">🏥 Solo SIAT</option>
                      </select>
                    )}
                    {canEdit && staff.active && (
                      <select
                        value={staff.category}
                        onChange={async (e) => { if (e.target.value !== staff.category) await spostaCategoriaStaff(staff._id, e.target.value); }}
                        className="tw-text-[0.78rem] tw-py-1 tw-px-2 tw-rounded-md tw-border tw-border-slate-300 tw-cursor-pointer tw-bg-white tw-text-slate-700"
                        title="Sposta categoria"
                      >
                        {categories
                          .filter(cat => !isConsulenza || categorieConsulenza.includes(cat.value))
                          .map(cat => (
                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                          ))}
                      </select>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => apriModificaStaff(staff)}
                        className="!tw-bg-brand tw-text-white"
                        title="Modifica dati operatore"
                      >
                        <Pencil size={16} />
                        Modifica
                      </button>
                    )}
                    <button
                      onClick={() => openProfiloPdf(staff)}
                      className="!tw-bg-blue-600 tw-text-white"
                      title="Visualizza profilo PDF"
                    >
                      <FileText size={16} />
                      Profilo PDF
                    </button>
                    <button
                      onClick={() => apriContrattoStaff(staff)}
                      className="!tw-bg-green-600 tw-text-white"
                      title="Visualizza contratto firmato"
                      disabled={loadingContratto === staff._id}
                    >
                      <FileText size={16} />
                      {loadingContratto === staff._id ? 'Apertura...' : 'Contratto'}
                    </button>
                    <button
                      onClick={() => openDocumentsModal(staff)}
                      className="!tw-bg-sky-600 tw-text-white"
                    >
                      <FileText size={16} />
                      Documenti
                    </button>
                    <button
                      onClick={() => openDocumentsModal(staff)}
                      className="!tw-bg-indigo-700 tw-text-white"
                      title="Carica documenti scannerizzati"
                    >
                      <Upload size={16} />
                      Carica
                    </button>
                    {staff.active && canEdit && (
                      <button
                        onClick={() => openDimissioniModal(staff)}
                        className="!tw-bg-amber-600 tw-text-white"
                      >
                        <LogOut size={16} />
                        Dimetti
                      </button>
                    )}
                    {!staff.active && canEdit && (
                      <button
                        onClick={() => riattivaStaff(staff._id)}
                        className="!tw-bg-green-600 tw-text-white"
                      >
                        <CheckCircle size={16} />
                        Riattiva
                      </button>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => deleteStaff(staff._id)}
                        className="!tw-bg-red-600 tw-text-white"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal isOpen={Boolean(staffInModifica)} onClose={() => setStaffInModifica(null)} title="Modifica dati operatore" size="lg">
        {staffInModifica && <form onSubmit={salvaModificaStaff} className="tw-grid tw-gap-3.5">
          <div className="tw-grid tw-grid-cols-2 tw-gap-3">
            <label>Nome *<input required value={modificaForm.firstName} onChange={e => setModificaForm(f => ({ ...f, firstName: e.target.value }))} /></label>
            <label>Cognome *<input required value={modificaForm.lastName} onChange={e => setModificaForm(f => ({ ...f, lastName: e.target.value }))} /></label>
          </div>
          <label>Email di accesso *<input type="email" required value={modificaForm.email} onChange={e => setModificaForm(f => ({ ...f, email: e.target.value }))} /></label>
          <label>Telefono<input type="tel" value={modificaForm.phone} onChange={e => setModificaForm(f => ({ ...f, phone: e.target.value }))} /></label>
          <div className="tw-grid tw-grid-cols-2 tw-gap-3">
            <label>Categoria<select value={modificaForm.category} onChange={e => setModificaForm(f => ({ ...f, category: e.target.value as StaffMember['category'], role: rolesByCategory[e.target.value]?.includes(f.role) ? f.role : '' }))}>{categories.filter(c => !['privato','osa','assistente-familiare','badante'].includes(c.value) || (!isConvenzione && modificaForm.modalitaAbilitata !== 'convenzione')).map(category => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
            <label>Ruolo *<select required value={modificaForm.role} onChange={e => setModificaForm(f => ({ ...f, role: e.target.value }))}><option value="">Seleziona ruolo</option>{rolesByCategory[modificaForm.category].map(role => <option key={role} value={role}>{role}</option>)}</select></label>
          </div>
          <label>Modalità abilitata<select value={modificaForm.modalitaAbilitata} onChange={e => setModificaForm(f => {
              const next = { ...f, modalitaAbilitata: e.target.value as 'entrambi' | 'privato' | 'convenzione' };
              if (e.target.value === 'convenzione' && ['privato','osa','assistente-familiare','badante'].includes(f.category)) {
                next.category = 'infermieristico';
                next.role = '';
              }
              return next;
            })}><option value="entrambi">Entrambi</option><option value="privato">Solo privati</option><option value="convenzione">Solo SIAT</option></select></label>
          <label>Note<textarea value={modificaForm.note} onChange={e => setModificaForm(f => ({ ...f, note: e.target.value }))} rows={3} /></label>
          <p className="tw-m-0 tw-text-slate-500 tw-text-[0.85rem]">La modifica dell’email aggiorna anche l’account di accesso dell’operatore.</p>
          <div className="tw-flex tw-justify-end tw-gap-2.5"><Button type="button" variant="secondary" onClick={() => setStaffInModifica(null)}>Annulla</Button><Button type="submit" disabled={salvataggioModifica}>{salvataggioModifica ? 'Salvataggio...' : 'Salva modifiche'}</Button></div>
        </form>}
      </Modal>

      {/* Documents Modal */}
      {showDocumentsModal && selectedStaff && (
        <div className="modal-overlay" onClick={closeDocumentsModal}>
          <div className="modal-content tw-max-w-[800px]" onClick={(e) => e.stopPropagation()}>
            <div className="tw-flex tw-justify-between tw-items-center tw-mb-5">
              <div>
                <h3 className="tw-m-0 tw-flex tw-items-center tw-gap-2.5">
                  <FileText size={24} />
                  Documenti Staff
                </h3>
                <p className="tw-mt-1 tw-mb-0 tw-text-slate-500 tw-text-[0.92rem]">
                  {selectedStaff.firstName} {selectedStaff.lastName} - {selectedStaff.role}
                </p>
              </div>
              <button
                onClick={closeDocumentsModal}
                className="tw-bg-transparent tw-border-0 tw-cursor-pointer tw-p-2 tw-rounded-md tw-text-slate-500"
              >
                <X size={24} />
              </button>
            </div>

            {/* Upload Section */}
            {canEdit && (
              <div className="tw-mb-6 tw-p-5 tw-border-2 tw-border-dashed tw-border-slate-300 tw-rounded-lg tw-bg-slate-50">
                <h4 className="tw-m-0 tw-mb-4 tw-flex tw-items-center tw-gap-2">
                  <Upload size={18} />
                  Carica Nuovo Documento
                </h4>

                <div className="tw-grid tw-grid-cols-2 tw-gap-4 tw-mb-4">
                  <label>
                    Tipo documento *
                    <select
                      value={uploadForm.documentType}
                      onChange={(e) => setUploadForm({ ...uploadForm, documentType: e.target.value })}
                    >
                      <option value="">Seleziona tipo...</option>
                      {documentTypes.map(dt => (
                        <option key={dt.value} value={dt.value}>{dt.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Titolo
                    <input
                      type="text"
                      value={uploadForm.title}
                      onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                      placeholder="Es. Contratto 2024"
                    />
                  </label>
                </div>

                <label className="tw-block tw-mb-4">
                  Descrizione (opzionale)
                  <textarea
                    value={uploadForm.description}
                    onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                    placeholder="Breve descrizione..."
                    rows={2}
                  />
                </label>

                <div className="tw-flex tw-gap-3 tw-items-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="tw-hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="!tw-bg-slate-500 tw-text-white"
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
                    className="!tw-bg-green-600 tw-text-white tw-ml-auto tw-opacity-100 disabled:tw-opacity-60"
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

            {/* Documents List */}
            {documents.length === 0 ? (
              <p className="tw-text-center tw-py-8 tw-text-slate-500">
                Nessun documento presente.
              </p>
            ) : (
              <div className="tw-flex tw-flex-col tw-gap-3">
                {documents.map((doc) => (
                  <div
                    key={doc._id}
                    className="tw-flex tw-items-center tw-gap-4 tw-p-4 tw-border tw-border-slate-200 tw-rounded-lg tw-bg-white"
                  >
                    <div className="tw-w-12 tw-h-12 tw-rounded-md tw-bg-sky-50 tw-flex tw-items-center tw-justify-center tw-flex-shrink-0">
                      <FileText size={24} color="var(--info)" />
                    </div>
                    <div className="tw-flex-1 tw-min-w-0">
                      <div className="tw-flex tw-items-center tw-gap-2 tw-mb-1">
                        <span className="tw-text-[0.75rem] tw-px-2 tw-py-0.5 tw-bg-sky-50 tw-text-sky-600 tw-rounded-full tw-font-semibold tw-whitespace-nowrap">
                          {documentTypes.find(dt => dt.value === doc.documentType)?.label || doc.documentType}
                        </span>
                        <strong className="tw-truncate">
                          {doc.title}
                        </strong>
                      </div>
                      {doc.description && (
                        <p className="tw-m-0 tw-mb-1 tw-text-[0.85rem] tw-text-slate-500">
                          {doc.description}
                        </p>
                      )}
                      <p className="tw-m-0 tw-text-[0.8rem] tw-text-slate-400">
                        {formatDate(doc.createdAt)}
                      </p>
                    </div>
                    <div className="tw-flex tw-gap-2 tw-flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => downloadDocument(doc._id, doc.fileName)}
                        className="!tw-bg-green-600 tw-text-white tw-px-3 tw-py-2"
                      >
                        <Download size={16} />
                        Scarica
                      </button>
                      <button
                        type="button"
                        onClick={() => previewDocument(doc._id)}
                        className="!tw-bg-cyan-600 tw-text-white tw-px-3 tw-py-2"
                      >
                        <Eye size={16} />
                        Anteprima
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => deleteDocument(doc._id)}
                          className="!tw-bg-red-600 tw-text-white tw-px-3 tw-py-2"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dimissioni Modal */}
      {showDimissioniModal && dimissioniStaff && (
        <div className="modal-overlay" onClick={closeDimissioniModal}>
          <div className="modal-content tw-max-w-[500px]" onClick={(e) => e.stopPropagation()}>
            <div className="tw-flex tw-justify-between tw-items-center tw-mb-5">
              <h3 className="tw-m-0 tw-flex tw-items-center tw-gap-2.5">
                <LogOut size={24} />
                Registra Dimissione
              </h3>
              <button
                onClick={closeDimissioniModal}
                className="tw-bg-transparent tw-border-0 tw-cursor-pointer tw-p-2 tw-rounded-md tw-text-slate-500"
              >
                <X size={24} />
              </button>
            </div>

            <p className="tw-mb-5 tw-text-slate-600">
              Stai registrando la dimissione di <strong>{dimissioniStaff.firstName} {dimissioniStaff.lastName}</strong>
            </p>

            <label className="tw-block tw-mb-4">
              Data fine collaborazione *
              <input
                type="date"
                value={dimissioniForm.dataFine}
                onChange={(e) => setDimissioniForm({ ...dimissioniForm, dataFine: e.target.value })}
                className="tw-w-full"
              />
            </label>

            <label className="tw-block tw-mb-5">
              Motivazione (opzionale)
              <textarea
                value={dimissioniForm.motivazione}
                onChange={(e) => setDimissioniForm({ ...dimissioniForm, motivazione: e.target.value })}
                placeholder="Es. Dimissioni volontarie, fine contratto..."
                rows={3}
                className="tw-w-full"
              />
            </label>

            <div className="tw-flex tw-justify-end tw-gap-3">
              <button
                type="button"
                onClick={closeDimissioniModal}
                className="!tw-bg-slate-500 tw-text-white"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={confermaDimissioni}
                className="!tw-bg-amber-600 tw-text-white"
              >
                Conferma Dimissione
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default Staff;