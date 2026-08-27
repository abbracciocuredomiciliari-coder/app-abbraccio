import { ChangeEvent, FormEvent, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
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
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingContratto, setLoadingContratto] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
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
  }, [searchTerm, selectedCategory, staffMembers]);

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

  const filterStaff = () => {
    let filtered = [...staffMembers];

    if (selectedCategory) {
      filtered = filtered.filter(s => s.category === selectedCategory);
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    try {
      await api.post('/staff', formData);
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
        Gestione Personale
      </h2>

      {success && (
        <Alert type="success" onClose={() => setSuccess('')} style={{ marginBottom: '16px' }}>
          {success}
        </Alert>
      )}
      {error && (
        <Alert type="error" onClose={() => setError('')} style={{ marginBottom: '16px' }}>
          {error}
        </Alert>
      )}

      {/* Search and Filter Bar */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '20px',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <Input
          placeholder="Cerca per nome, email o ruolo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          icon={<Search size={18} />}
          style={{ flex: 1, minWidth: '200px' }}
        />

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{
            padding: '12px 14px',
            border: '1px solid var(--gray-300)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.95rem',
            minWidth: '200px',
          }}
        >
          <option value="">Tutte le categorie</option>
          {categories.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>

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

      {/* Search Results Info */}
      {(searchTerm || selectedCategory) && (
        <p style={{ marginBottom: '16px', color: 'var(--gray-500)', fontSize: '0.92rem' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <label>
              Categoria *
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
              >
                {categories
                  .filter(cat => !['privato','osa','assistente-familiare','badante'].includes(cat.value) || formData.modalitaAbilitata !== 'convenzione')
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
          <div style={{ padding: '8px 0' }}><SkeletonList rows={6} showHeader={false} /></div>
        ) : filteredStaff.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '32px', color: 'var(--gray-500)' }}>
            Nessun membro dello staff trovato.
          </p>
        ) : (
          <ul>
            {filteredStaff.map((staff) => (
              <li key={staff._id} style={{
                borderLeft: `4px solid ${getCategoryColor(staff.category)}`,
                opacity: !staff.active ? 0.6 : 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '1.05rem' }}>
                        {staff.firstName} {staff.lastName}
                      </strong>
                      <span style={{
                        fontSize: '0.78rem',
                        padding: '2px 10px',
                        backgroundColor: `${getCategoryColor(staff.category)}20`,
                        color: getCategoryColor(staff.category),
                        borderRadius: 'var(--radius-full)',
                        fontWeight: 600,
                      }}>
                        {getCategoryLabel(staff.category)}
                      </span>
                      {!staff.active && (
                        <Badge variant="danger" size="sm">Inattivo</Badge>
                      )}
                      {/* Badge modalità abilitata */}
                      {staff.modalitaAbilitata && staff.modalitaAbilitata !== 'entrambi' && (
                        <span style={{
                          fontSize: '0.72rem',
                          padding: '2px 8px',
                          backgroundColor: staff.modalitaAbilitata === 'convenzione' ? '#eff6ff' : '#f0fdf4',
                          color: staff.modalitaAbilitata === 'convenzione' ? '#0369a1' : '#166534',
                          borderRadius: 'var(--radius-full)',
                          fontWeight: 700,
                          border: `1px solid ${staff.modalitaAbilitata === 'convenzione' ? '#bae6fd' : '#bbf7d0'}`,
                        }}>
                          {staff.modalitaAbilitata === 'convenzione' ? '🏥 Solo SIAT' : '👤 Solo Privati'}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--gray-600)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Mail size={14} /> {staff.email}
                      </span>
                      {staff.phone && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Phone size={14} /> {staff.phone}
                        </span>
                      )}
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={14} /> Dal {formatDate(staff.dataInizioCollaborazione)}
                      </span>
                    </div>
                    {!staff.active && staff.dataFineCollaborazione && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--danger)', marginTop: '4px', marginBottom: 0 }}>
                        Fine collaborazione: {formatDate(staff.dataFineCollaborazione)}
                      </p>
                    )}
                    {/* ── Zona lavorativa ── */}
                    <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {staff.domicilioPartenza ? (
                        <span style={{ fontSize: '0.8rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '2px 8px', color: '#065f46', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          📍 {staff.domicilioPartenza} — {staff.raggioAzioneKm ?? 10} km
                          {staff.domicilioCoords && <span style={{ color: '#059669' }}>✓</span>}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.78rem', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '6px', padding: '2px 8px', color: '#92400e' }}>
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
                      <div style={{ marginTop: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e4d8c', marginBottom: '2px' }}>📍 Zona lavorativa</div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input
                            value={zonaForm.domicilioPartenza}
                            onChange={e => { setZonaForm(f => ({ ...f, domicilioPartenza: e.target.value, domicilioCoords: null })); setZonaGeoError(''); }}
                            placeholder="Es. Via Roma 10, Roma RM"
                            style={{ flex: 1, padding: '7px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                          />
                          <button type="button" onClick={geocodificaZona} disabled={zonaGeoLoading || !zonaForm.domicilioPartenza.trim()}
                            style={{ background: '#1e4d8c', color: 'white', border: 'none', borderRadius: '6px', padding: '7px 12px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, opacity: zonaGeoLoading ? 0.7 : 1 }}>
                            {zonaGeoLoading ? '...' : '📍'}
                          </button>
                        </div>
                        {zonaGeoError && <span style={{ fontSize: '0.78rem', color: '#dc2626' }}>{zonaGeoError}</span>}
                        {zonaForm.domicilioCoords && <span style={{ fontSize: '0.78rem', color: '#059669' }}>✓ Posizione trovata ({zonaForm.domicilioCoords.lat.toFixed(4)}, {zonaForm.domicilioCoords.lng.toFixed(4)})</span>}
                        <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}>
                          Raggio: <strong>{zonaForm.raggioAzioneKm} km</strong>
                          <input type="range" min={1} max={80} step={1} value={zonaForm.raggioAzioneKm}
                            onChange={e => setZonaForm(f => ({ ...f, raggioAzioneKm: Number(e.target.value) }))}
                            style={{ width: '100%', marginTop: '4px' }} />
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button type="button" onClick={() => setZonaEditId(null)}
                            style={{ flex: 1, background: '#f1f5f9', border: '1px solid #d1d5db', borderRadius: '6px', padding: '7px', cursor: 'pointer', fontSize: '0.82rem' }}>
                            Annulla
                          </button>
                          <button type="button" onClick={() => salvaZona(staff._id)} disabled={zonaSalvando}
                            style={{ flex: 2, background: zonaSalvando ? '#d1d5db' : '#059669', color: 'white', border: 'none', borderRadius: '6px', padding: '7px', cursor: zonaSalvando ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>
                            {zonaSalvando ? '...' : '✅ Salva zona'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flexShrink: 0, alignItems: 'center' }}>
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
                        style={{ fontSize: '0.78rem', padding: '4px 8px', borderRadius: '6px', border: '1px solid #d1d5db', cursor: 'pointer', background: 'white', color: '#374151' }}
                        title="Modalità abilitata per questo operatore"
                      >
                        <option value="entrambi">🔓 Entrambi</option>
                        <option value="privato">👤 Solo Privati</option>
                        <option value="convenzione">🏥 Solo SIAT</option>
                      </select>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => apriModificaStaff(staff)}
                        style={{ background: '#1e4d8c' }}
                        title="Modifica dati operatore"
                      >
                        <Pencil size={16} />
                        Modifica
                      </button>
                    )}
                    <button
                      onClick={() => openProfiloPdf(staff)}
                      style={{ background: '#2563eb' }}
                      title="Visualizza profilo PDF"
                    >
                      <FileText size={16} />
                      Profilo PDF
                    </button>
                    <button
                      onClick={() => apriContrattoStaff(staff)}
                      style={{ background: '#059669' }}
                      title="Visualizza contratto firmato"
                      disabled={loadingContratto === staff._id}
                    >
                      <FileText size={16} />
                      {loadingContratto === staff._id ? 'Apertura...' : 'Contratto'}
                    </button>
                    <button
                      onClick={() => openDocumentsModal(staff)}
                      style={{ background: 'var(--info)' }}
                    >
                      <FileText size={16} />
                      Documenti
                    </button>
                    {staff.active && canEdit && (
                      <button
                        onClick={() => openDimissioniModal(staff)}
                        style={{ background: 'var(--warning)' }}
                      >
                        <LogOut size={16} />
                        Dimetti
                      </button>
                    )}
                    {!staff.active && canEdit && (
                      <button
                        onClick={() => riattivaStaff(staff._id)}
                        style={{ background: 'var(--success)' }}
                      >
                        <CheckCircle size={16} />
                        Riattiva
                      </button>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => deleteStaff(staff._id)}
                        style={{ background: 'var(--danger)' }}
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
        {staffInModifica && <form onSubmit={salvaModificaStaff} style={{ display: 'grid', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label>Nome *<input required value={modificaForm.firstName} onChange={e => setModificaForm(f => ({ ...f, firstName: e.target.value }))} /></label>
            <label>Cognome *<input required value={modificaForm.lastName} onChange={e => setModificaForm(f => ({ ...f, lastName: e.target.value }))} /></label>
          </div>
          <label>Email di accesso *<input type="email" required value={modificaForm.email} onChange={e => setModificaForm(f => ({ ...f, email: e.target.value }))} /></label>
          <label>Telefono<input type="tel" value={modificaForm.phone} onChange={e => setModificaForm(f => ({ ...f, phone: e.target.value }))} /></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label>Categoria<select value={modificaForm.category} onChange={e => setModificaForm(f => ({ ...f, category: e.target.value as StaffMember['category'], role: rolesByCategory[e.target.value]?.includes(f.role) ? f.role : '' }))}>{categories.filter(c => !['privato','osa','assistente-familiare','badante'].includes(c.value) || modificaForm.modalitaAbilitata !== 'convenzione').map(category => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
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
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>La modifica dell’email aggiorna anche l’account di accesso dell’operatore.</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}><Button type="button" variant="secondary" onClick={() => setStaffInModifica(null)}>Annulla</Button><Button type="submit" disabled={salvataggioModifica}>{salvataggioModifica ? 'Salvataggio...' : 'Salva modifiche'}</Button></div>
        </form>}
      </Modal>

      {/* Documents Modal */}
      {showDocumentsModal && selectedStaff && (
        <div className="modal-overlay" onClick={closeDocumentsModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileText size={24} />
                  Documenti Staff
                </h3>
                <p style={{ margin: '4px 0 0', color: 'var(--gray-500)', fontSize: '0.92rem' }}>
                  {selectedStaff.firstName} {selectedStaff.lastName} - {selectedStaff.role}
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

                <label style={{ marginBottom: '16px', display: 'block' }}>
                  Descrizione (opzionale)
                  <textarea
                    value={uploadForm.description}
                    onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                    placeholder="Breve descrizione..."
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

            {/* Documents List */}
            {documents.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '32px', color: 'var(--gray-500)' }}>
                Nessun documento presente.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {documents.map((doc) => (
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
                      backgroundColor: 'var(--info-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <FileText size={24} color="var(--info)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '2px 8px',
                          backgroundColor: 'var(--info-bg)',
                          color: 'var(--info)',
                          borderRadius: 'var(--radius-full)',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}>
                          {documentTypes.find(dt => dt.value === doc.documentType)?.label || doc.documentType}
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
                        {formatDate(doc.createdAt)}
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
                      <button
                        type="button"
                        onClick={() => previewDocument(doc._id)}
                        style={{ background: 'var(--secondary)', padding: '8px 12px' }}
                      >
                        <Eye size={16} />
                        Anteprima
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
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dimissioni Modal */}
      {showDimissioniModal && dimissioniStaff && (
        <div className="modal-overlay" onClick={closeDimissioniModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <LogOut size={24} />
                Registra Dimissione
              </h3>
              <button
                onClick={closeDimissioniModal}
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

            <p style={{ marginBottom: '20px', color: 'var(--gray-600)' }}>
              Stai registrando la dimissione di <strong>{dimissioniStaff.firstName} {dimissioniStaff.lastName}</strong>
            </p>

            <label style={{ display: 'block', marginBottom: '16px' }}>
              Data fine collaborazione *
              <input
                type="date"
                value={dimissioniForm.dataFine}
                onChange={(e) => setDimissioniForm({ ...dimissioniForm, dataFine: e.target.value })}
                style={{ width: '100%' }}
              />
            </label>

            <label style={{ display: 'block', marginBottom: '20px' }}>
              Motivazione (opzionale)
              <textarea
                value={dimissioniForm.motivazione}
                onChange={(e) => setDimissioniForm({ ...dimissioniForm, motivazione: e.target.value })}
                placeholder="Es. Dimissioni volontarie, fine contratto..."
                rows={3}
                style={{ width: '100%' }}
              />
            </label>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={closeDimissioniModal}
                style={{ background: 'var(--gray-500)' }}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={confermaDimissioni}
                style={{ background: 'var(--warning)' }}
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