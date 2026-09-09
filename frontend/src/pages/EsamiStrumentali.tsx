import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import {
  HeartPulse,
  Plus,
  Search,
  X,
  CheckCircle,
  AlertCircle,
  Trash2,
  Archive,
  FileText,
  Paperclip,
  BookOpen,
  Printer,
  ChevronDown,
  ChevronUp,
  PenLine,
  Eye,
  Upload,
  Clock,
  User,
  Calendar,
  Wand2,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { DictationMicButton } from '../components/DictationMicButton';
import FirmaCanvas from '../components/FirmaCanvas';

// ─── Interfacce ───────────────────────────────────────────────────────────────
interface PatientOption { _id: string; firstName: string; lastName: string; }
interface StaffMember { _id: string; firstName: string; lastName: string; role: string; active: boolean; }
interface VoceTariffario {
  _id: string;
  categoria: string;
  nome: string;
  prezzo: number;
  unitaMisura?: string;
  note?: string;
  attivo: boolean;
  ordine: number;
  isEsameStrumentale?: boolean;
}

interface DiariaVoce {
  _id: string;
  data: string;
  autore: string;
  ruoloAutore?: string;
  testo: string;
  firmato?: boolean;
  dataFirma?: string;
  firma?: string;
}

interface Referto {
  testoReferto?: string;
  redattoDa?: string;
  dataReferto?: string;
  firmato?: boolean;
  dataFirma?: string;
  firma?: string;
  nomeFile?: string;
  urlCloudinary?: string;
}

interface AllegatoEsame {
  _id: string;
  nomeFile: string;
  mimeType: string;
  dimensione: number;
  descrizione?: string;
  caricatoDa: string;
  dataCaricamento: string;
  urlCloudinary?: string;
}

interface EsameItem {
  _id: string;
  tipoEsame: string | string[];
  patient: PatientOption;
  staff: StaffMember;
  dataEsame: string;
  orario?: string;
  note?: string;
  status: 'pianificato' | 'eseguito' | 'refertato' | 'archiviato';
  diaria: DiariaVoce[];
  referto?: Referto;
  allegati: AllegatoEsame[];
  archiviato?: boolean;
  dataArchiviazione?: string;
  archiviatoDa?: string;
  workPlan?: string;
  // Conferma esecuzione
  eseguito?: boolean;
  dataEsecuzione?: string;
  eseguitoDa?: string;
  firmaEsecuzione?: string;
  medicoEsecuzione?: string;
  firmaMedicoEsecuzione?: string;
}

// ─── Colori status ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pianificato: { label: '📅 Pianificato', color: '#d97706', bg: '#fef3c7' },
  eseguito:    { label: '✅ Eseguito',    color: '#059669', bg: '#d1fae5' },
  refertato:   { label: '📋 Refertato',   color: '#2563eb', bg: '#dbeafe' },
  archiviato:  { label: '🗄️ Archiviato',  color: '#6b7280', bg: '#f3f4f6' },
};

// ─── Ruoli che possono refertare ──────────────────────────────────────────────
const RUOLI_REFERTO = ['admin', 'coordinator', 'direttore', 'medico'];
const RUOLI_PRIVILEGIATI = ['admin', 'coordinator', 'direttore'];

// ─── Formattazione ────────────────────────────────────────────────────────────
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('it-IT') : '—';
const fmtDateTime = (d: string) => d ? new Date(d).toLocaleString('it-IT') : '—';
const fmtSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPALE
// ─────────────────────────────────────────────────────────────────────────────
export default function EsamiStrumentali() {
  const { user } = useAuth();
  const [esami, setEsami] = useState<EsameItem[]>([]);
  const [tariffario, setTariffario] = useState<VoceTariffario[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroStato, setFiltroStato] = useState<string>('');
  const [mostraArchiviati, setMostraArchiviati] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Form nuovo esame
  const [formPatient, setFormPatient] = useState('');
  const [formStaff, setFormStaff] = useState('');
  const [formTipiEsame, setFormTipiEsame] = useState<string[]>([]);
  const [formDataEsame, setFormDataEsame] = useState('');
  const [formOrario, setFormOrario] = useState('');
  const [formNote, setFormNote] = useState('');

  // Modal dettaglio esame
  const [selectedEsame, setSelectedEsame] = useState<EsameItem | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Sezioni aperte nel modal
  const [showDiaria, setShowDiaria] = useState(true);
  const [showReferto, setShowReferto] = useState(true);
  const [showAllegati, setShowAllegati] = useState(true);

  // Diaria
  const [nuovaDiaria, setNuovaDiaria] = useState('');
  const [dataDiaria, setDataDiaria] = useState('');
  const [savingDiaria, setSavingDiaria] = useState(false);
  const [generatingAiDiaria, setGeneratingAiDiaria] = useState(false);
  const [firmaDiariaTemp, setFirmaDiariaTemp] = useState('');
  const [mostraFirmaDiaria, setMostraFirmaDiaria] = useState<string | null>(null);

  // Referto
  const [testoReferto, setTestoReferto] = useState('');
  const [editingReferto, setEditingReferto] = useState(false);
  const [savingReferto, setSavingReferto] = useState(false);
  const [generatingAiReferto, setGeneratingAiReferto] = useState(false);
  const refertoFileRef = useRef<HTMLInputElement>(null);
  const [uploadingRefertoFile, setUploadingRefertoFile] = useState(false);
  const [mostraFirmaReferto, setMostraFirmaReferto] = useState(false);
  const [firmaRefertoTemp, setFirmaRefertoTemp] = useState('');
  const [salvandoFirmaReferto, setSalvandoFirmaReferto] = useState(false);

  // Allegati
  const allegatoFileRef = useRef<HTMLInputElement>(null);
  const [descrizioneAllegato, setDescrizioneAllegato] = useState('');
  const [uploadingAllegato, setUploadingAllegato] = useState(false);

  // Segna eseguito (con firma operatore + eventuale medico)
  const [segnandoEseguito, setSegnandoEseguito] = useState(false);
  const [mostraFirmaEsecuzione, setMostraFirmaEsecuzione] = useState(false);
  const [firmaEsecOperatore, setFirmaEsecOperatore] = useState('');
  const [medicoPresente, setMedicoPresente] = useState(false);
  const [nomeMedicoEsec, setNomeMedicoEsec] = useState('');
  const [firmaEsecMedico, setFirmaEsecMedico] = useState('');

  // PDF
  const [loadingPdf, setLoadingPdf] = useState(false);

  const isPrivilegiato = RUOLI_PRIVILEGIATI.includes(user?.role || '');
  const puoRefertare = RUOLI_REFERTO.includes(user?.role || '');

  // ─── Caricamento dati ───────────────────────────────────────────────────────
  useEffect(() => {
    loadData();
  }, [mostraArchiviati]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (mostraArchiviati) params.archiviati = 'true';
      const [esamiRes, tariffarioRes, patRes, staffRes] = await Promise.all([
        api.get('/esami-strumentali', { params }),
        isPrivilegiato ? api.get('/tariffario', { params: { soloAttivi: 'true' } }) : Promise.resolve({ data: [] }),
        isPrivilegiato ? api.get('/patients') : Promise.resolve({ data: [] }),
        isPrivilegiato ? api.get('/staff') : Promise.resolve({ data: [] }),
      ]);
      setEsami(esamiRes.data);
      setTariffario(tariffarioRes.data);
      setPatients(patRes.data);
      setStaffMembers(staffRes.data);
    } catch (err) {
      console.error('Errore caricamento esami', err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Tariffario esami strumentali ───────────────────────────────────────────
  const tariffeEsami = useMemo(() => tariffario
    .filter(v => v.isEsameStrumentale)
    .sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0) || a.nome.localeCompare(b.nome)),
  [tariffario]);

  const tariffePerCategoria = useMemo(() => {
    const map = new Map<string, VoceTariffario[]>();
    const labels: Record<string, string> = {
      prestazioni_infermieristiche: 'Cardiologia / Fisiologia',
      radiologia: 'Radiologia (RX)',
      ecografia: 'Ecografie / Ecocolordoppler',
    };
    tariffeEsami.forEach(v => {
      const cat = v.categoria;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(v);
    });
    return { map, labels };
  }, [tariffeEsami]);

  // ─── Filtro lista ───────────────────────────────────────────────────────────
  const esamiFiltrati = esami.filter(e => {
    const term = searchTerm.toLowerCase();
    const tipoEsameStr = Array.isArray(e.tipoEsame) ? e.tipoEsame.join(' ') : e.tipoEsame;
    const matchSearch = !term ||
      (e.patient?.firstName || '').toLowerCase().includes(term) ||
      (e.patient?.lastName || '').toLowerCase().includes(term) ||
      tipoEsameStr.toLowerCase().includes(term) ||
      (e.staff?.firstName || '').toLowerCase().includes(term) ||
      (e.staff?.lastName || '').toLowerCase().includes(term);
    const matchStato = !filtroStato || e.status === filtroStato;
    return matchSearch && matchStato;
  });

  // ─── Crea nuovo esame ───────────────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!formPatient || !formStaff || formTipiEsame.length === 0 || !formDataEsame) {
      setError('Compila tutti i campi obbligatori.');
      return;
    }
    try {
      await api.post('/esami-strumentali', {
        patient: formPatient,
        staff: formStaff,
        tipiEsame: formTipiEsame,
        dataEsame: formDataEsame,
        orario: formOrario || undefined,
        note: formNote || undefined,
      });
      await loadData();
      setFormPatient(''); setFormStaff(''); setFormTipiEsame([]);
      setFormDataEsame(''); setFormOrario(''); setFormNote('');
      setSuccess('✅ Esame strumentale creato con successo!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore nella creazione dell\'esame.');
    }
  };

  // ─── Apri modal dettaglio ───────────────────────────────────────────────────
  const apriDettaglio = async (esame: EsameItem) => {
    setSelectedEsame(esame);
    setShowModal(true);
    setShowDiaria(true);
    setShowReferto(true);
    setShowAllegati(true);
    setNuovaDiaria('');
    setDataDiaria('');
    setFirmaDiariaTemp('');
    setMostraFirmaDiaria(null);
    setTestoReferto(esame.referto?.testoReferto || '');
    setEditingReferto(false);
    setMostraFirmaReferto(false);
    setFirmaRefertoTemp('');
    setMostraFirmaEsecuzione(false);
    setFirmaEsecOperatore('');
    setMedicoPresente(false);
    setNomeMedicoEsec('');
    setFirmaEsecMedico('');
    // Ricarica dati freschi
    try {
      const res = await api.get(`/esami-strumentali/${esame._id}`);
      setSelectedEsame(res.data);
      setTestoReferto(res.data.referto?.testoReferto || '');
    } catch {}
  };

  const chiudiModal = () => {
    setShowModal(false);
    setSelectedEsame(null);
  };

  // ─── Aggiorna esame nel modal ───────────────────────────────────────────────
  const refreshEsame = async () => {
    if (!selectedEsame) return;
    try {
      const res = await api.get(`/esami-strumentali/${selectedEsame._id}`);
      setSelectedEsame(res.data);
      // Aggiorna anche nella lista
      setEsami(prev => prev.map(e => e._id === res.data._id ? res.data : e));
    } catch {}
  };

  // ─── Aggiungi voce diaria ───────────────────────────────────────────────────
  const aggiungiDiaria = async () => {
    if (!selectedEsame || !nuovaDiaria.trim()) return;
    setSavingDiaria(true);
    try {
      await api.post(`/esami-strumentali/${selectedEsame._id}/diaria`, {
        testo: nuovaDiaria.trim(),
        data: dataDiaria || undefined,
        firma: firmaDiariaTemp || undefined,
      });
      setNuovaDiaria('');
      setDataDiaria('');
      setFirmaDiariaTemp('');
      setMostraFirmaDiaria(null);
      await refreshEsame();
      setSuccess('✅ Voce di diaria aggiunta!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore nell\'aggiunta della diaria.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setSavingDiaria(false);
    }
  };

  // ─── Firma voce diaria esistente (con FirmaCanvas) ───────────────────────────
  const firmaDiaria = async (diariaId: string, firma?: string) => {
    if (!selectedEsame) return;
    try {
      await api.patch(`/esami-strumentali/${selectedEsame._id}/diaria/${diariaId}/firma`, {
        firma: firma || undefined,
      });
      setMostraFirmaDiaria(null);
      setFirmaDiariaTemp('');
      await refreshEsame();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore nella firma.');
      setTimeout(() => setError(''), 3000);
    }
  };

  // ─── Elimina voce diaria ────────────────────────────────────────────────────
  const eliminaDiaria = async (diariaId: string) => {
    if (!selectedEsame || !confirm('Eliminare questa voce di diaria?')) return;
    try {
      await api.delete(`/esami-strumentali/${selectedEsame._id}/diaria/${diariaId}`);
      await refreshEsame();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore nell\'eliminazione.');
      setTimeout(() => setError(''), 3000);
    }
  };

  // ─── Salva referto testuale ─────────────────────────────────────────────────
  const generaAiDiaria = async () => {
    if (!selectedEsame || !nuovaDiaria.trim()) return;
    setGeneratingAiDiaria(true);
    try {
      const contesto = `Diaria clinica — esame ${Array.isArray(selectedEsame.tipoEsame) ? selectedEsame.tipoEsame.join(', ') : selectedEsame.tipoEsame} — paziente ${selectedEsame.patient?.firstName || ''} ${selectedEsame.patient?.lastName || ''}`;
      const res = await api.post('/relazioni-vocali/diaria', {
        dettatura: nuovaDiaria.trim(),
        contesto,
      });
      setNuovaDiaria(res.data.relazione || '');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore nella generazione AI della diaria.');
      setTimeout(() => setError(''), 4000);
    } finally {
      setGeneratingAiDiaria(false);
    }
  };

  const generaAiReferto = async () => {
    if (!selectedEsame || !testoReferto.trim()) return;
    setGeneratingAiReferto(true);
    try {
      const contesto = `Referto medico — esame ${Array.isArray(selectedEsame.tipoEsame) ? selectedEsame.tipoEsame.join(', ') : selectedEsame.tipoEsame} — paziente ${selectedEsame.patient?.firstName || ''} ${selectedEsame.patient?.lastName || ''}`;
      const res = await api.post('/relazioni-vocali/diaria', {
        dettatura: testoReferto.trim(),
        contesto,
      });
      setTestoReferto(res.data.relazione || '');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore nella generazione AI del referto.');
      setTimeout(() => setError(''), 4000);
    } finally {
      setGeneratingAiReferto(false);
    }
  };

  const salvaReferto = async () => {
    if (!selectedEsame) return;
    setSavingReferto(true);
    try {
      await api.put(`/esami-strumentali/${selectedEsame._id}/referto`, {
        testoReferto: testoReferto.trim(),
      });
      await refreshEsame();
      setEditingReferto(false);
      setSuccess('✅ Referto salvato!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore nel salvataggio del referto.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setSavingReferto(false);
    }
  };

  // ─── Firma referto ──────────────────────────────────────────────────────────
  const firmaReferto = async () => {
    if (!selectedEsame || !firmaRefertoTemp) {
      setError('Disegna la firma del medico prima di confermare.');
      setTimeout(() => setError(''), 3000);
      return;
    }
    setSalvandoFirmaReferto(true);
    try {
      await api.patch(`/esami-strumentali/${selectedEsame._id}/referto/firma`, { firma: firmaRefertoTemp });
      setMostraFirmaReferto(false);
      setFirmaRefertoTemp('');
      await refreshEsame();
      setSuccess('✅ Referto firmato!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore nella firma del referto.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setSalvandoFirmaReferto(false);
    }
  };

  // ─── Carica file referto ────────────────────────────────────────────────────
  const caricaFileReferto = async (file: File) => {
    if (!selectedEsame) return;
    setUploadingRefertoFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/esami-strumentali/${selectedEsame._id}/referto/file`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await refreshEsame();
      setSuccess('✅ File referto caricato!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore nel caricamento del file.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setUploadingRefertoFile(false);
      if (refertoFileRef.current) refertoFileRef.current.value = '';
    }
  };

  // ─── Carica allegato generico ───────────────────────────────────────────────
  const caricaAllegato = async (file: File) => {
    if (!selectedEsame) return;
    setUploadingAllegato(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (descrizioneAllegato.trim()) formData.append('descrizione', descrizioneAllegato.trim());
      await api.post(`/esami-strumentali/${selectedEsame._id}/allegati`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await refreshEsame();
      setDescrizioneAllegato('');
      setSuccess('✅ Allegato caricato!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore nel caricamento dell\'allegato.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setUploadingAllegato(false);
      if (allegatoFileRef.current) allegatoFileRef.current.value = '';
    }
  };

  // ─── Elimina allegato ───────────────────────────────────────────────────────
  const eliminaAllegato = async (allegatoId: string) => {
    if (!selectedEsame || !confirm('Eliminare questo allegato?')) return;
    try {
      await api.delete(`/esami-strumentali/${selectedEsame._id}/allegati/${allegatoId}`);
      await refreshEsame();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore nell\'eliminazione.');
      setTimeout(() => setError(''), 3000);
    }
  };

  // ─── Segna eseguito / Firma esecuzione ─────────────────────────────────────
  const segnaEseguito = async () => {
    if (!selectedEsame) return;
    if (!firmaEsecOperatore) {
      setError('È obbligatorio disegnare la firma dell\'operatore prima di confermare.');
      setTimeout(() => setError(''), 4000);
      return;
    }
    setSegnandoEseguito(true);
    try {
      await api.patch(`/esami-strumentali/${selectedEsame._id}/segna-eseguito`, {
        firmaOperatore: firmaEsecOperatore,
        firmaMedico: medicoPresente ? firmaEsecMedico : undefined,
        nomeMedico: medicoPresente ? nomeMedicoEsec : undefined,
      });
      setMostraFirmaEsecuzione(false);
      setFirmaEsecOperatore('');
      setFirmaEsecMedico('');
      setNomeMedicoEsec('');
      setMedicoPresente(false);
      await refreshEsame();
      await loadData();
      setSuccess('✅ Esame segnato come eseguito e firmato!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore nel segnare l\'esame come eseguito.');
      setTimeout(() => setError(''), 4000);
    } finally {
      setSegnandoEseguito(false);
    }
  };

  // ─── Archivia esame ─────────────────────────────────────────────────────────
  const archiviaEsame = async (esame: EsameItem) => {
    if (!confirm(`Archiviare definitivamente l'esame ${esame.tipoEsame} di ${esame.patient?.firstName || ''} ${esame.patient?.lastName || ''}?`)) return;
    try {
      await api.post(`/esami-strumentali/${esame._id}/archivia`);
      await loadData();
      if (selectedEsame?._id === esame._id) chiudiModal();
      setSuccess('✅ Esame archiviato con successo!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      if (err.response?.status === 400) setError('Esame già archiviato.');
      else setError(err.response?.data?.message || 'Errore durante l\'archiviazione.');
      setTimeout(() => setError(''), 4000);
    }
  };

  // ─── Elimina esame ──────────────────────────────────────────────────────────
  const eliminaEsame = async (id: string) => {
    if (!confirm('Eliminare definitivamente questo esame?')) return;
    try {
      await api.delete(`/esami-strumentali/${id}`);
      await loadData();
      if (selectedEsame?._id === id) chiudiModal();
      setSuccess('✅ Esame eliminato!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore nell\'eliminazione.');
      setTimeout(() => setError(''), 3000);
    }
  };

  // ─── Genera HTML per PDF ───────────────────────────────────────────────────────
  const generaPDFHtml = async (esame: EsameItem): Promise<string | null> => {
    try {
      const res = await api.get(`/esami-strumentali/${esame._id}/pdf-data`);
      const d = res.data;

      const statusLabel = STATUS_CONFIG[d.esame.status]?.label || d.esame.status;

      const diariaHtml = d.diaria.length === 0
        ? '<p style="color:#888;font-style:italic">Nessuna voce di diaria registrata.</p>'
        : d.diaria.map((v: any) => `
          <div style="margin-bottom:12px;padding:10px 14px;background:#f8fafc;border-left:3px solid #1e4d8c;border-radius:4px">
            <div style="font-size:11px;color:#555;margin-bottom:4px">
              <strong>${v.data} ${v.ora}</strong> — ${v.autore}${v.ruolo ? ` (${v.ruolo})` : ''}
              ${v.firmato ? `<span style="margin-left:8px;color:#059669;font-weight:700">✅ Firmato ${v.dataFirma}</span>` : ''}
            </div>
            <p style="margin:0;font-size:12px;white-space:pre-wrap">${v.testo}</p>
          </div>`).join('');

      const refertoHtml = !d.referto || !d.referto.testo
        ? '<p style="color:#888;font-style:italic">Nessun referto disponibile.</p>'
        : `
          <div style="padding:12px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px">
            <div style="font-size:11px;color:#555;margin-bottom:8px">
              Redatto da: <strong>${d.referto.redattoDa}</strong> — ${d.referto.dataReferto}
              ${d.referto.firmato ? `<span style="margin-left:8px;color:#059669;font-weight:700">✅ Firmato ${d.referto.dataFirma}</span>` : ''}
            </div>
            <p style="margin:0;font-size:12px;white-space:pre-wrap">${d.referto.testo}</p>
            ${d.referto.fileReferto ? `<p style="margin:8px 0 0;font-size:11px;color:#555">📎 File allegato: <strong>${d.referto.fileReferto}</strong></p>` : ''}
          </div>`;

      const allegatiHtml = d.allegati.length === 0
        ? '<p style="color:#888;font-style:italic">Nessun allegato.</p>'
        : d.allegati.map((a: any) => `
          <div style="display:flex;justify-content:space-between;padding:6px 10px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;margin-bottom:6px;font-size:11px">
            <span>📎 <strong>${a.nome}</strong></span>
            <span style="color:#888">${a.caricatoDa} — ${a.data}</span>
          </div>`).join('');

      return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Esame Strumentale — ${d.esame.tipoEsame}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #222; margin: 24px; }
    h1 { font-size: 20px; color: #1e4d8c; margin: 0 0 4px; }
    h2 { font-size: 14px; color: #374151; margin: 20px 0 8px; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .logo { font-size: 18px; font-weight: 700; color: #1e4d8c; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
    .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; }
    .info-box label { font-size: 10px; color: #888; display: block; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-box strong { font-size: 13px; }
    .section { margin-bottom: 20px; }
    @media print { body { margin: 12px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">🏥 Abbraccio Cure Domiciliari</div>
      <h1>${d.esame.tipoEsame}</h1>
      <span class="badge" style="background:${STATUS_CONFIG[d.esame.status]?.bg || '#f3f4f6'};color:${STATUS_CONFIG[d.esame.status]?.color || '#374151'}">${statusLabel}</span>
    </div>
    <div style="text-align:right;font-size:11px;color:#888">
      <div>Stampato il: ${new Date().toLocaleDateString('it-IT')}</div>
      <div>${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <label>Paziente</label>
      <strong>${d.paziente.nome}</strong>
      ${d.paziente.dataNascita ? `<div style="font-size:11px;color:#555">Nato/a il: ${d.paziente.dataNascita}</div>` : ''}
      ${d.paziente.codiceFiscale ? `<div style="font-size:11px;color:#555">CF: ${d.paziente.codiceFiscale}</div>` : ''}
    </div>
    <div class="info-box">
      <label>Operatore esecutore</label>
      <strong>${d.operatore.nome}</strong>
      <div style="font-size:11px;color:#555">${d.operatore.ruolo}</div>
    </div>
    <div class="info-box">
      <label>Data esame</label>
      <strong>${d.esame.dataEsame}${d.esame.orario ? ` alle ${d.esame.orario}` : ''}</strong>
    </div>
    <div class="info-box">
      <label>Tipo esame</label>
      <strong>${d.esame.tipoEsame}</strong>
    </div>
  </div>

  ${d.esame.note ? `<div style="padding:10px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;margin-bottom:16px;font-size:12px"><strong>Note:</strong> ${d.esame.note}</div>` : ''}

  <div class="section">
    <h2>📓 Diaria — Descrizione di quanto eseguito</h2>
    ${diariaHtml}
  </div>

  <div class="section">
    <h2>📋 Referto medico</h2>
    ${refertoHtml}
  </div>

  <div class="section">
    <h2>📎 Allegati</h2>
    ${allegatiHtml}
  </div>

  <div style="margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:10px;color:#888">
    <span>App Abbraccio Cure Domiciliari — Documento generato automaticamente</span>
    <span>Pagina 1</span>
  </div>
</body>
</html>`;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore nella generazione del PDF.');
      setTimeout(() => setError(''), 4000);
      return null;
    }
  };

  // ─── Visualizza PDF in nuova tab ────────────────────────────────────────────────
  const visualizzaPDF = async (esame: EsameItem) => {
    // Apri finestra PRIMA dell'await per evitare blocco popup su mobile
    const win = window.open('', '_blank');
    if (!win) { setError('Impossibile aprire la finestra. Controlla il blocco popup.'); return; }
    win.document.write('<p style="text-align:center;margin-top:40px;font-family:sans-serif;color:#666">⏳ Generazione documento...</p>');
    setLoadingPdf(true);
    try {
      const html = await generaPDFHtml(esame);
      if (!html) { win.close(); return; }
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
    } catch (err: any) {
      win.close();
      setError(err.response?.data?.message || 'Errore nella generazione del PDF.');
      setTimeout(() => setError(''), 4000);
    } finally {
      setLoadingPdf(false);
    }
  };

  // ─── Stampa PDF (apre dialogo stampa) ───────────────────────────────────────────
  const stampaPDF = async (esame: EsameItem) => {
    // Apri finestra PRIMA dell'await per evitare blocco popup su mobile
    const win = window.open('', '_blank');
    if (!win) { setError('Impossibile aprire la finestra. Controlla il blocco popup.'); return; }
    win.document.write('<p style="text-align:center;margin-top:40px;font-family:sans-serif;color:#666">⏳ Generazione documento...</p>');
    setLoadingPdf(true);
    try {
      const html = await generaPDFHtml(esame);
      if (!html) { win.close(); return; }
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    } catch (err: any) {
      win.close();
      setError(err.response?.data?.message || 'Errore nella generazione del PDF.');
      setTimeout(() => setError(''), 4000);
    } finally {
      setLoadingPdf(false);
    }
  };

  // ─── Apri file allegato ─────────────────────────────────────────────────────
  const apriFile = (allegato: AllegatoEsame | Referto) => {
    const url = (allegato as any).urlCloudinary;
    if (url) {
      window.open(url, '_blank');
    } else {
      setError('File non disponibile per la visualizzazione diretta.');
      setTimeout(() => setError(''), 3000);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <section>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <HeartPulse size={28} color="#e11d48" />
        Esami Strumentali
      </h2>

      {/* Messaggi globali */}
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

      <div style={{ display: 'grid', gridTemplateColumns: isPrivilegiato ? 'minmax(280px, 360px) 1fr' : '1fr', gap: '24px' }}>

        {/* ── FORM NUOVO ESAME (solo privilegiati) ── */}
        {isPrivilegiato && (
          <div className="dashboard-folder">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0 }}>
              <Plus size={20} color="#e11d48" />
              Nuovo Esame Strumentale
            </h3>
            <form onSubmit={handleSubmit} className="user-form" noValidate>
              <label>
                Paziente *
                <select value={formPatient} onChange={e => setFormPatient(e.target.value)} required>
                  <option value="">Seleziona paziente</option>
                  {patients.map(p => (
                    <option key={p._id} value={p._id}>{p.firstName} {p.lastName}</option>
                  ))}
                </select>
              </label>

              <label>
                Operatore esecutore *
                <select value={formStaff} onChange={e => setFormStaff(e.target.value)} required>
                  <option value="">Seleziona operatore</option>
                  {staffMembers.filter(s => s.active).map(s => (
                    <option key={s._id} value={s._id}>{s.firstName} {s.lastName} — {s.role}</option>
                  ))}
                </select>
              </label>

              <label>
                Tipi esame *
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                  {tariffeEsami.map(v => {
                    const selected = formTipiEsame.includes(v.nome);
                    return (
                      <button
                        key={v._id}
                        type="button"
                        onClick={() => {
                          if (selected) {
                            setFormTipiEsame(prev => prev.filter(t => t !== v.nome));
                          } else {
                            setFormTipiEsame(prev => [...prev, v.nome]);
                          }
                        }}
                        title={v.unitaMisura ? `€${v.prezzo.toFixed(2)} — ${v.unitaMisura}` : `€${v.prezzo.toFixed(2)}`}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: `2px solid ${selected ? '#e11d48' : '#d1d5db'}`,
                          background: selected ? '#fef2f2' : 'white',
                          color: selected ? '#be123c' : '#374151',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          fontWeight: selected ? 600 : 400,
                        }}
                      >
                        {selected && '✓ '}{v.nome} <span style={{ opacity: 0.7, fontSize: '0.7rem' }}>€{v.prezzo.toFixed(2)}</span>
                      </button>
                    );
                  })}
                </div>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label>
                  Data esame *
                  <input type="date" value={formDataEsame} onChange={e => setFormDataEsame(e.target.value)} required />
                </label>
                <label>
                  Orario
                  <input type="time" value={formOrario} onChange={e => setFormOrario(e.target.value)} />
                </label>
              </div>

              <label>
                Note (opzionale)
                <textarea value={formNote} onChange={e => setFormNote(e.target.value)} rows={2} placeholder="Note aggiuntive sull'esame..." />
              </label>

              <button type="submit">
                <Plus size={16} />
                Crea Esame
              </button>
            </form>
          </div>
        )}

        {/* ── TARIFFARIO ESAMI STRUMENTALI (solo admin/coordinator/direttore) ── */}
        {isPrivilegiato && tariffeEsami.length > 0 && (
          <div className="dashboard-folder">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0 }}>
              <FileText size={20} color="#e11d48" />
              Tariffario Esami Strumentali
            </h3>
            {Array.from(tariffePerCategoria.map.entries()).map(([cat, voci]) => (
              <div key={cat} style={{ marginBottom: '16px' }}>
                <h4 style={{ color: '#374151', margin: '0 0 8px', fontSize: '0.95rem' }}>{tariffePerCategoria.labels[cat] || cat}</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '6px 8px' }}>Prestazione</th>
                      <th style={{ padding: '6px 8px' }}>Unità</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Prezzo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voci.map(v => (
                      <tr key={v._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px 8px' }}>{v.nome}</td>
                        <td style={{ padding: '6px 8px', color: '#6b7280' }}>{v.unitaMisura || '—'}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#e11d48' }}>€{v.prezzo.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {/* ── LISTA ESAMI ── */}
        <div className="dashboard-folder">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HeartPulse size={20} color="#e11d48" />
              Esami ({esamiFiltrati.length})
            </h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {isPrivilegiato && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', margin: 0 }}>
                  <input type="checkbox" checked={mostraArchiviati} onChange={e => setMostraArchiviati(e.target.checked)} />
                  Mostra archiviati
                </label>
              )}
            </div>
          </div>

          {/* Barra ricerca + filtro */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
              <input
                type="text"
                placeholder="Cerca per paziente, tipo esame, operatore..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '10px 12px 10px 38px', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-md)', fontSize: '0.9rem' }}
              />
            </div>
            <select
              value={filtroStato}
              onChange={e => setFiltroStato(e.target.value)}
              style={{ padding: '10px 12px', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-md)', fontSize: '0.9rem', minWidth: '150px' }}
            >
              <option value="">Tutti gli stati</option>
              <option value="pianificato">Pianificato</option>
              <option value="eseguito">Eseguito</option>
              <option value="refertato">Refertato</option>
              <option value="archiviato">Archiviato</option>
            </select>
          </div>

          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--gray-500)', padding: '32px' }}>⏳ Caricamento...</p>
          ) : esamiFiltrati.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--gray-500)', padding: '32px' }}>
              {mostraArchiviati ? 'Nessun esame archiviato.' : 'Nessun esame strumentale presente.'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '700px', overflowY: 'auto' }}>
              {esamiFiltrati.map(esame => {
                const sc = STATUS_CONFIG[esame.status] || STATUS_CONFIG.pianificato;
                return (
                  <div
                    key={esame._id}
                    style={{
                      display: 'flex', gap: '12px', padding: '14px',
                      border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)',
                      backgroundColor: 'white', borderLeft: '4px solid #e11d48',
                      opacity: esame.archiviato ? 0.7 : 1,
                    }}
                  >
                    {/* Icona */}
                    <div style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-md)', backgroundColor: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <HeartPulse size={22} color="#e11d48" />
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '0.95rem' }}>{esame.patient?.firstName || '—'} {esame.patient?.lastName || ''}</strong>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', backgroundColor: '#fff1f2', color: '#e11d48' }}>
                          {esame.tipoEsame}
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', backgroundColor: sc.bg, color: sc.color }}>
                          {sc.label}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 3px', fontSize: '0.82rem', color: 'var(--gray-500)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <span><Calendar size={12} style={{ verticalAlign: 'middle' }} /> {fmtDate(esame.dataEsame)}{esame.orario ? ` alle ${esame.orario}` : ''}</span>
                        <span><User size={12} style={{ verticalAlign: 'middle' }} /> {esame.staff?.firstName || '—'} {esame.staff?.lastName || ''}</span>
                      </p>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px', fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                        <span>📓 {esame.diaria.length} diaria</span>
                        {esame.referto?.testoReferto && <span>📋 Referto presente</span>}
                        {esame.allegati.length > 0 && <span>📎 {esame.allegati.length} allegati</span>}
                      </div>
                      {esame.note && <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--gray-600)', fontStyle: 'italic' }}>{esame.note}</p>}
                    </div>

                    {/* Azioni */}
                    <div style={{ display: 'flex', gap: '5px', flexShrink: 0, flexDirection: 'column' }}>
                      <button
                        type="button"
                        onClick={() => apriDettaglio(esame)}
                        style={{ background: '#1e4d8c', padding: '7px' }}
                        title="Apri dettaglio"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => visualizzaPDF(esame)}
                        style={{ background: '#3b82f6', padding: '7px' }}
                        title="Visualizza PDF"
                        disabled={loadingPdf}
                      >
                        <Printer size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => stampaPDF(esame)}
                        style={{ background: '#059669', padding: '7px' }}
                        title="Stampa PDF"
                        disabled={loadingPdf}
                      >
                        🖨️
                      </button>
                      {isPrivilegiato && !esame.archiviato && (
                        <button
                          type="button"
                          onClick={() => archiviaEsame(esame)}
                          style={{ background: '#7c3aed', padding: '7px' }}
                          title="Archivia esame"
                        >
                          <Archive size={15} />
                        </button>
                      )}
                      {isPrivilegiato && (
                        <button
                          type="button"
                          onClick={() => eliminaEsame(esame._id)}
                          style={{ background: 'var(--danger)', padding: '7px' }}
                          title="Elimina"
                        >
                          <Trash2 size={15} />
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

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL DETTAGLIO ESAME
      ═══════════════════════════════════════════════════════════════════════ */}
      {showModal && selectedEsame && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', maxWidth: '820px', width: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}>

            {/* Header modal */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <HeartPulse size={22} color="#e11d48" />
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{Array.isArray(selectedEsame.tipoEsame) ? selectedEsame.tipoEsame.join(', ') : selectedEsame.tipoEsame}</h3>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 10px', borderRadius: '10px', backgroundColor: STATUS_CONFIG[selectedEsame.status]?.bg, color: STATUS_CONFIG[selectedEsame.status]?.color }}>
                    {STATUS_CONFIG[selectedEsame.status]?.label}
                  </span>
                </div>
                <p style={{ margin: 0, color: '#555', fontSize: '0.9rem' }}>
                  <strong>{selectedEsame.patient?.firstName || '—'} {selectedEsame.patient?.lastName || ''}</strong>
                  {' — '}
                  {fmtDate(selectedEsame.dataEsame)}{selectedEsame.orario ? ` alle ${selectedEsame.orario}` : ''}
                </p>
                <p style={{ margin: '2px 0 0', color: '#888', fontSize: '0.82rem' }}>
                  Operatore: {selectedEsame.staff?.firstName || '—'} {selectedEsame.staff?.lastName || ''} ({selectedEsame.staff?.role || ''})
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => visualizzaPDF(selectedEsame)}
                  style={{ background: '#3b82f6', padding: '8px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  disabled={loadingPdf}
                >
                  <Printer size={15} />
                  {loadingPdf ? 'Generazione...' : 'Visualizza PDF'}
                </button>
                <button
                  type="button"
                  onClick={() => stampaPDF(selectedEsame)}
                  style={{ background: '#059669', padding: '8px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  disabled={loadingPdf}
                >
                  🖨️ Stampa PDF
                </button>
                <Button variant="ghost" size="sm" onClick={chiudiModal}>
                  <X size={22} />
                </Button>
              </div>
            </div>

            <div style={{ padding: '20px 24px' }}>

              {/* Note esame */}
              {selectedEsame.note && (
                <div style={{ padding: '10px 14px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', marginBottom: '16px', fontSize: '0.9rem' }}>
                  <strong>Note:</strong> {selectedEsame.note}
                </div>
              )}

              {/* ── PANEL FIRMA ESECUZIONE ── */}
              {!selectedEsame.archiviato && selectedEsame.status === 'pianificato' && (
                <div style={{ background: 'rgba(5,150,105,0.06)', border: '2px solid #059669', borderRadius: '10px', padding: '16px 20px', marginBottom: '20px' }}>
                  <div style={{ fontWeight: '700', color: '#065f46', fontSize: '1rem', marginBottom: '10px' }}>
                    ✅ Conferma esecuzione esame
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#374151', marginBottom: '12px' }}>
                    Disegna la firma con dito o penna per segnare l'esame come <strong>ESEGUITO</strong>.
                  </div>
                  {!mostraFirmaEsecuzione ? (
                    <button
                      type="button"
                      onClick={() => setMostraFirmaEsecuzione(true)}
                      style={{ background: '#059669', color: 'white', padding: '10px 18px', fontSize: '0.9rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                    >
                      <CheckCircle size={18} /> Procedi con le firme
                    </button>
                  ) : (
                    <div>
                      <FirmaCanvas
                        label="✍️ Firma operatore"
                        sublabel="Firma di chi esegue l'esame"
                        onFirmaCompleta={setFirmaEsecOperatore}
                        onCancella={() => setFirmaEsecOperatore('')}
                        altezza={150}
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '12px 0', fontSize: '0.9rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={medicoPresente} onChange={e => setMedicoPresente(e.target.checked)} />
                        È presente anche un medico che deve controfirmare?
                      </label>
                      {medicoPresente && (
                        <>
                          <label style={{ display: 'block', marginBottom: '10px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Nome e cognome medico</span>
                            <input value={nomeMedicoEsec} onChange={e => setNomeMedicoEsec(e.target.value)} placeholder="Dr. ..." style={{ display: 'block', width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', marginTop: '4px' }} />
                          </label>
                          <FirmaCanvas
                            label="✍️ Firma medico"
                            sublabel="Controfirma del medico in sede di esecuzione"
                            onFirmaCompleta={setFirmaEsecMedico}
                            onCancella={() => setFirmaEsecMedico('')}
                            altezza={150}
                          />
                        </>
                      )}
                      <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                        <button type="button" onClick={() => { setMostraFirmaEsecuzione(false); setFirmaEsecOperatore(''); setFirmaEsecMedico(''); setMedicoPresente(false); }} style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer' }}>
                          Annulla
                        </button>
                        <button
                          type="button"
                          onClick={segnaEseguito}
                          disabled={!firmaEsecOperatore || segnandoEseguito}
                          style={{ background: !firmaEsecOperatore ? '#d1fae5' : '#059669', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', cursor: !firmaEsecOperatore ? 'not-allowed' : 'pointer', fontWeight: 700 }}
                        >
                          {segnandoEseguito ? '...' : <><CheckCircle size={18} /> Conferma Eseguito</>}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── BADGE ESEGUITO (se già eseguito) ── */}
              {(selectedEsame.status === 'eseguito' || selectedEsame.status === 'refertato') && (
                <div style={{ background: '#d1fae5', border: '1px solid #059669', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <CheckCircle size={22} color="#059669" />
                  <div>
                    <div style={{ fontWeight: '700', color: '#065f46', fontSize: '0.95rem' }}>
                      ✅ Esame eseguito
                    </div>
                    {selectedEsame.dataEsecuzione && (
                      <div style={{ fontSize: '0.82rem', color: '#374151', marginTop: '2px' }}>
                        Eseguito il <strong>{fmtDateTime(selectedEsame.dataEsecuzione)}</strong>
                        {selectedEsame.eseguitoDa && <> da <strong>{selectedEsame.eseguitoDa}</strong></>}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── SEZIONE DIARIA ── */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '16px', overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setShowDiaria(!showDiaria)}
                  style={{ width: '100%', background: '#f0f9ff', border: 'none', padding: '12px 16px', textAlign: 'left', cursor: 'pointer', fontWeight: '600', fontSize: '0.92rem', color: '#1e4d8c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BookOpen size={18} />
                    Diaria — Descrizione di quanto eseguito ({selectedEsame.diaria.length} voci)
                  </span>
                  {showDiaria ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {showDiaria && (
                  <div style={{ padding: '16px' }}>
                    {/* Form nuova voce */}
                    {!selectedEsame.archiviato && (
                      <div style={{ marginBottom: '16px', padding: '14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontWeight: '600', fontSize: '0.88rem', color: '#374151', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <PenLine size={16} />
                          Aggiungi voce di diaria
                        </div>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', marginBottom: '10px' }}>
                          Data/ora (opzionale — default: adesso)
                          <input
                            type="datetime-local"
                            value={dataDiaria}
                            onChange={e => setDataDiaria(e.target.value)}
                            style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.88rem' }}
                          />
                        </label>
                        <textarea
                          value={nuovaDiaria}
                          onChange={e => setNuovaDiaria(e.target.value)}
                          placeholder="Descrivi quanto eseguito durante l'esame..."
                          rows={3}
                          style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.88rem', resize: 'vertical', fontFamily: 'inherit' }}
                        />
                        <DictationMicButton onTranscribed={t => setNuovaDiaria(prev => (prev.trim() ? `${prev.trim()} ${t}` : t))} />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={generaAiDiaria}
                            disabled={generatingAiDiaria || !nuovaDiaria.trim()}
                            style={{ background: '#0d9488', color: 'white', padding: '8px 16px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', borderRadius: '6px', cursor: 'pointer', opacity: !nuovaDiaria.trim() ? 0.5 : 1 }}
                          >
                            <Wand2 size={15} />
                            {generatingAiDiaria ? 'Generazione...' : 'Riformula con AI'}
                          </button>
                          {mostraFirmaDiaria !== 'nuova' ? (
                            <button
                              type="button"
                              onClick={() => { setMostraFirmaDiaria('nuova'); setFirmaDiariaTemp(''); }}
                              style={{ background: '#f0fdf4', border: '1px solid #059669', color: '#065f46', padding: '8px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '6px', cursor: 'pointer' }}
                            >
                              <PenLine size={15} /> Firma voce
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setMostraFirmaDiaria(null)}
                              style={{ background: '#fee2e2', border: '1px solid #ef4444', color: '#991b1b', padding: '8px 14px', fontSize: '0.85rem', borderRadius: '6px', cursor: 'pointer' }}
                            >
                              Annulla firma
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={aggiungiDiaria}
                            disabled={savingDiaria || !nuovaDiaria.trim()}
                            style={{ background: '#1e4d8c', color: 'white', padding: '8px 16px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', borderRadius: '6px', opacity: !nuovaDiaria.trim() ? 0.5 : 1 }}
                          >
                            <Plus size={15} />
                            {savingDiaria ? 'Salvataggio...' : 'Aggiungi voce'}
                          </button>
                        </div>
                        {mostraFirmaDiaria === 'nuova' && (
                          <div style={{ marginTop: '12px' }}>
                            <FirmaCanvas
                              label="✍️ Firma autore voce diaria"
                              onFirmaCompleta={setFirmaDiariaTemp}
                              onCancella={() => setFirmaDiariaTemp('')}
                              altezza={130}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Lista voci diaria */}
                    {selectedEsame.diaria.length === 0 ? (
                      <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', padding: '16px' }}>Nessuna voce di diaria registrata.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {[...selectedEsame.diaria].reverse().map(voce => (
                          <div key={voce._id} style={{ padding: '12px 14px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', borderLeft: '3px solid #1e4d8c' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                                  <Clock size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                                  {fmtDateTime(voce.data)}
                                </span>
                                <span style={{ fontSize: '0.8rem', color: '#666' }}>
                                  ✍️ {voce.autore}{voce.ruoloAutore ? ` (${voce.ruoloAutore})` : ''}
                                </span>
                                {voce.firmato && (
                                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '1px 8px', borderRadius: '10px', backgroundColor: '#d1fae5', color: '#065f46', border: '1px solid #059669' }}>
                                    ✅ Firmato {voce.dataFirma ? fmtDate(voce.dataFirma) : ''}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                {!voce.firmato && (
                                  <button
                                    type="button"
                                    onClick={() => firmaDiaria(voce._id)}
                                    style={{ background: '#059669', padding: '4px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    title="Firma voce"
                                  >
                                    <CheckCircle size={13} /> Firma
                                  </button>
                                )}
                                {isPrivilegiato && (
                                  <button
                                    type="button"
                                    onClick={() => eliminaDiaria(voce._id)}
                                    style={{ background: 'var(--danger)', padding: '4px 8px', fontSize: '0.78rem' }}
                                    title="Elimina voce"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.88rem', color: '#374151', whiteSpace: 'pre-wrap' }}>{voce.testo}</p>
                            {mostraFirmaDiaria === voce._id && (
                              <div style={{ marginTop: '12px', padding: '12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                                <FirmaCanvas
                                  label="✍️ Firma voce diaria"
                                  onFirmaCompleta={setFirmaDiariaTemp}
                                  onCancella={() => setFirmaDiariaTemp('')}
                                  altezza={130}
                                />
                                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                  <button type="button" onClick={() => { setMostraFirmaDiaria(null); setFirmaDiariaTemp(''); }} style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 14px', cursor: 'pointer', fontSize: '0.85rem' }}>
                                    Annulla
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => firmaDiaria(voce._id, firmaDiariaTemp)}
                                    disabled={!firmaDiariaTemp}
                                    style={{ background: firmaDiariaTemp ? '#059669' : '#d1fae5', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: firmaDiariaTemp ? 'pointer' : 'not-allowed', fontSize: '0.85rem', fontWeight: 600 }}
                                  >
                                    <CheckCircle size={14} /> Conferma firma
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── SEZIONE REFERTO ── */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '16px', overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setShowReferto(!showReferto)}
                  style={{ width: '100%', background: '#eff6ff', border: 'none', padding: '12px 16px', textAlign: 'left', cursor: 'pointer', fontWeight: '600', fontSize: '0.92rem', color: '#1e40af', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={18} />
                    Referto medico
                    {selectedEsame.referto?.testoReferto && (
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '1px 8px', borderRadius: '10px', backgroundColor: '#dbeafe', color: '#1e40af' }}>
                        Presente
                      </span>
                    )}
                    {selectedEsame.referto?.firmato && (
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '1px 8px', borderRadius: '10px', backgroundColor: '#d1fae5', color: '#065f46' }}>
                        ✅ Firmato
                      </span>
                    )}
                  </span>
                  {showReferto ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {showReferto && (
                  <div style={{ padding: '16px' }}>
                    {puoRefertare && !selectedEsame.archiviato && (
                      <>
                        {/* Editor referto */}
                        {editingReferto ? (
                          <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontWeight: '600', fontSize: '0.88rem', color: '#374151', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <PenLine size={16} />
                              {selectedEsame.referto?.testoReferto ? 'Modifica referto' : 'Scrivi referto'}
                            </div>
                            <textarea
                              value={testoReferto}
                              onChange={e => setTestoReferto(e.target.value)}
                              placeholder="Inserisci il testo del referto medico..."
                              rows={6}
                              style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.88rem', resize: 'vertical', fontFamily: 'inherit' }}
                            />
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                              <DictationMicButton onTranscribed={t => setTestoReferto(prev => (prev.trim() ? `${prev.trim()} ${t}` : t))} />
                              <button
                                type="button"
                                onClick={generaAiReferto}
                                disabled={generatingAiReferto || !testoReferto.trim()}
                                style={{ background: '#0d9488', color: 'white', padding: '8px 16px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', borderRadius: '6px', cursor: 'pointer', opacity: !testoReferto.trim() ? 0.5 : 1 }}
                              >
                                <Wand2 size={15} />
                                {generatingAiReferto ? 'Generazione...' : 'Riformula con AI'}
                              </button>
                              <button
                                type="button"
                                onClick={salvaReferto}
                                disabled={savingReferto}
                                style={{ background: '#1e40af', padding: '8px 16px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                              >
                                <CheckCircle size={15} />
                                {savingReferto ? 'Salvataggio...' : 'Salva referto'}
                              </button>
                              <button
                                type="button"
                                onClick={() => { setEditingReferto(false); setTestoReferto(selectedEsame.referto?.testoReferto || ''); }}
                                style={{ background: '#6c757d', padding: '8px 16px', fontSize: '0.88rem' }}
                              >
                                Annulla
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ marginBottom: '12px' }}>
                            {!selectedEsame.referto?.firmato && (
                              <button
                                type="button"
                                onClick={() => setEditingReferto(true)}
                                style={{ background: '#1e40af', padding: '7px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}
                              >
                                <PenLine size={15} />
                                {selectedEsame.referto?.testoReferto ? 'Modifica referto' : 'Scrivi referto'}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Upload file referto */}
                        {!selectedEsame.referto?.firmato && (
                          <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontWeight: '600', fontSize: '0.85rem', color: '#374151', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Upload size={15} />
                              Allega file referto (PDF/immagine)
                            </div>
                            <input
                              type="file"
                              ref={refertoFileRef}
                              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                              onChange={e => { if (e.target.files?.[0]) caricaFileReferto(e.target.files[0]); }}
                              style={{ fontSize: '0.85rem' }}
                            />
                            {uploadingRefertoFile && <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: '#1e40af' }}>⏳ Caricamento in corso...</p>}
                          </div>
                        )}
                      </>
                    )}

                    {/* Visualizzazione referto */}
                    {selectedEsame.referto?.testoReferto ? (
                      <div style={{ padding: '14px 16px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ fontSize: '0.82rem', color: '#555' }}>
                            Redatto da: <strong>{selectedEsame.referto.redattoDa}</strong>
                            {selectedEsame.referto.dataReferto && ` — ${fmtDate(selectedEsame.referto.dataReferto)}`}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {selectedEsame.referto.firmato ? (
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 10px', borderRadius: '10px', backgroundColor: '#d1fae5', color: '#065f46', border: '1px solid #059669' }}>
                                ✅ Firmato {selectedEsame.referto.dataFirma ? fmtDate(selectedEsame.referto.dataFirma) : ''}
                              </span>
                            ) : (
                              puoRefertare && (
                                mostraFirmaReferto ? (
                                  <button
                                    type="button"
                                    onClick={() => { setMostraFirmaReferto(false); setFirmaRefertoTemp(''); }}
                                    style={{ background: '#fee2e2', border: '1px solid #ef4444', color: '#991b1b', padding: '5px 12px', fontSize: '0.8rem', borderRadius: '6px' }}
                                  >
                                    Annulla
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setMostraFirmaReferto(true)}
                                    style={{ background: '#059669', padding: '5px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    <CheckCircle size={13} /> Firma referto
                                  </button>
                                )
                              )
                            )}
                          </div>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#1e3a5f', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                          {selectedEsame.referto.testoReferto}
                        </p>
                        {mostraFirmaReferto && puoRefertare && (
                          <div style={{ marginTop: '14px', padding: '12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                            <FirmaCanvas
                              label="✍️ Firma medico refertante"
                              onFirmaCompleta={setFirmaRefertoTemp}
                              onCancella={() => setFirmaRefertoTemp('')}
                              altezza={150}
                            />
                            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                              <button
                                type="button"
                                onClick={() => { setMostraFirmaReferto(false); setFirmaRefertoTemp(''); }}
                                style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontSize: '0.88rem' }}
                              >
                                Annulla
                              </button>
                              <button
                                type="button"
                                onClick={firmaReferto}
                                disabled={!firmaRefertoTemp || salvandoFirmaReferto}
                                style={{ background: firmaRefertoTemp ? '#059669' : '#d1fae5', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 18px', cursor: firmaRefertoTemp ? 'pointer' : 'not-allowed', fontWeight: 600 }}
                              >
                                {salvandoFirmaReferto ? '...' : <><CheckCircle size={15} /> Conferma firma</>}
                              </button>
                            </div>
                          </div>
                        )}
                        {selectedEsame.referto.firma && !mostraFirmaReferto && (
                          <div style={{ marginTop: '12px', padding: '12px', background: '#f0fdf4', border: '1px solid #059669', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#065f46', marginBottom: '6px' }}>✍️ Firma del medico</div>
                            <img src={selectedEsame.referto.firma} alt="Firma referto" style={{ maxHeight: '120px', border: '1px solid #d1d5db', borderRadius: '4px', background: 'white' }} />
                          </div>
                        )}
                        {/* File referto allegato */}
                        {selectedEsame.referto.nomeFile && (
                          <div style={{ marginTop: '12px', padding: '8px 12px', backgroundColor: '#dbeafe', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Paperclip size={14} />
                              {selectedEsame.referto.nomeFile}
                            </span>
                            {selectedEsame.referto.urlCloudinary && (
                              <button
                                type="button"
                                onClick={() => apriFile(selectedEsame.referto!)}
                                style={{ background: '#1e40af', padding: '5px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Eye size={13} /> Visualizza
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', padding: '16px' }}>
                        {puoRefertare ? 'Nessun referto ancora inserito. Usa il pulsante sopra per scrivere il referto.' : 'Nessun referto disponibile.'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* ── SEZIONE ALLEGATI ── */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '16px', overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setShowAllegati(!showAllegati)}
                  style={{ width: '100%', background: '#f0fdf4', border: 'none', padding: '12px 16px', textAlign: 'left', cursor: 'pointer', fontWeight: '600', fontSize: '0.92rem', color: '#065f46', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Paperclip size={18} />
                    Allegati ({selectedEsame.allegati.length})
                  </span>
                  {showAllegati ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {showAllegati && (
                  <div style={{ padding: '16px' }}>
                    {/* Upload allegato */}
                    {!selectedEsame.archiviato && (
                      <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontWeight: '600', fontSize: '0.85rem', color: '#374151', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Upload size={15} />
                          Carica allegato
                        </div>
                        <input
                          type="text"
                          placeholder="Descrizione allegato (opzionale)"
                          value={descrizioneAllegato}
                          onChange={e => setDescrizioneAllegato(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '8px' }}
                        />
                        <input
                          type="file"
                          ref={allegatoFileRef}
                          accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.txt"
                          onChange={e => { if (e.target.files?.[0]) caricaAllegato(e.target.files[0]); }}
                          style={{ fontSize: '0.85rem' }}
                        />
                        {uploadingAllegato && <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: '#059669' }}>⏳ Caricamento in corso...</p>}
                      </div>
                    )}

                    {/* Lista allegati */}
                    {selectedEsame.allegati.length === 0 ? (
                      <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', padding: '16px' }}>Nessun allegato caricato.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {selectedEsame.allegati.map(allegato => (
                          <div key={allegato._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', gap: '10px', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                <Paperclip size={14} color="#6b7280" />
                                <span style={{ fontWeight: '600', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {allegato.nomeFile}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: '#888' }}>({fmtSize(allegato.dimensione)})</span>
                              </div>
                              {allegato.descrizione && (
                                <p style={{ margin: '0 0 2px', fontSize: '0.8rem', color: '#555', fontStyle: 'italic' }}>{allegato.descrizione}</p>
                              )}
                              <p style={{ margin: 0, fontSize: '0.75rem', color: '#888' }}>
                                Caricato da {allegato.caricatoDa} — {fmtDate(allegato.dataCaricamento)}
                              </p>
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {allegato.urlCloudinary && (
                                <button
                                  type="button"
                                  onClick={() => apriFile(allegato)}
                                  style={{ background: '#1e4d8c', padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <Eye size={13} /> Apri
                                </button>
                              )}
                              {isPrivilegiato && (
                                <button
                                  type="button"
                                  onClick={() => eliminaAllegato(allegato._id)}
                                  style={{ background: 'var(--danger)', padding: '6px 10px', fontSize: '0.8rem' }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── FOOTER MODAL ── */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid #e5e7eb', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {isPrivilegiato && !selectedEsame.archiviato && (
                    <button
                      type="button"
                      onClick={() => archiviaEsame(selectedEsame)}
                      style={{ background: '#7c3aed', padding: '8px 16px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Archive size={15} />
                      Archivia esame
                    </button>
                  )}
                  {selectedEsame.archiviato && (
                    <span style={{ fontSize: '0.85rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', backgroundColor: '#f3f4f6', borderRadius: '6px' }}>
                      🗄️ Archiviato il {fmtDate(selectedEsame.dataArchiviazione || '')} da {selectedEsame.archiviatoDa}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={chiudiModal}
                  style={{ background: '#6c757d', padding: '8px 20px' }}
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
