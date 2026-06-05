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
} from 'lucide-react';

interface StaffMember {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  category: 'infermieristico' | 'oss' | 'riabilitativo' | 'medico' | 'coordinamento' | 'direzione';
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
  { value: 'coordinamento', label: 'Coordinamento', color: '#8b5cf6' },
  { value: 'direzione', label: 'Direttore Sanitario', color: '#ef4444' },
];

const rolesByCategory: Record<string, string[]> = {
  infermieristico: ['Infermiere', 'Infermiere pediatrico', 'Infermiere di comunità'],
  oss: ['OSS - Operatore Socio Sanitario'],
  riabilitativo: ['Fisioterapista', 'Neuropsicomotricista', 'Logopedista', 'Terapista occupazionale'],
  medico: ['Medico rianimatore', 'Broncopneumologo', 'Psicologo', 'Neurologo', 'Geriatra'],
  coordinamento: ['Coordinatore infermieristico', 'Coordinatore medico', 'Coordinatore fisioterapico', 'Assistente sociale'],
  direzione: ['Direttore sanitario'],
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
    setFormData(prev => ({ ...prev, [name]: value }));
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
          <CheckCircle size={18} />
          {success}
        </div>
      )}
      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '12px 16px',
          backgroundColor: 'var(--danger-bg)',
          border: '1px solid rgba(220,38,38,0.2)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--danger)',
          marginBottom: '16px',
        }}>
          <span><AlertCircle size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />{error}</span>
          <button type="button" onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 0 }}><X size={16} /></button>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '20px',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <div style={{
          flex: 1,
          minWidth: '200px',
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
            placeholder="Cerca per nome, email o ruolo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px 12px 44px',
              border: '1px solid var(--gray-300)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.95rem',
              outline: 'none',
            }}
          />
        </div>

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
            {showForm ? 'Annulla' : 'Nuovo Staff'}
          </button>
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
                {categories.map(cat => (
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
                        <span style={{
                          fontSize: '0.78rem',
                          padding: '2px 10px',
                          backgroundColor: 'var(--danger-bg)',
                          color: 'var(--danger)',
                          borderRadius: 'var(--radius-full)',
                          fontWeight: 600,
                        }}>
                          Inattivo
                        </span>
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
                        <button
                          type="button"
                          onClick={() => zonaEditId === staff._id ? setZonaEditId(null) : apriZonaEdit(staff)}
                          style={{ fontSize: '0.75rem', background: 'none', border: '1px solid #d1d5db', borderRadius: '5px', padding: '2px 8px', cursor: 'pointer', color: '#374151' }}
                        >
                          {zonaEditId === staff._id ? '✕ Chiudi' : '✏️ Zona'}
                        </button>
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