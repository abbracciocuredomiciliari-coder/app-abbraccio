import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import {
  Calendar,
  Plus,
  TestTube2,
  Bandage,
  Activity,
  Clock,
  Users,
  CalendarDays,
  Trash2,
  CheckCircle,
  AlertCircle,
  Search,
  Link2,
  Copy,
  Euro,
  ClipboardList,
  X,
  Archive,
} from 'lucide-react';

interface PatientOption {
  _id: string;
  firstName: string;
  lastName: string;
}

interface StaffMember {
  _id: string;
  firstName: string;
  lastName: string;
  role: string;
  category: string;
  active: boolean;
}

interface GiornoSettimana {
  giorno: number; // 0=Dom, 1=Lun, ..., 6=Sab
  accessiAlGiorno: number;
  minutiPerAccesso: number;
}

interface WorkPlanItem {
  _id: string;
  type: 'prestazionale' | 'assistenziale';
  category: string;
  patient: PatientOption;
  staff: StaffMember;
  date: string;
  dataFine?: string;
  time?: string;
  duration?: number;
  task: string;
  notes?: string;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: string;
  giorniSettimana?: GiornoSettimana[];
  tipoCompenso?: 'orario' | 'fisso' | 'nessuno';
  tariffa?: number;
  compensoTotale?: number;
  compensoPagato?: boolean;
}

interface Accesso {
  _id: string;
  staffName: string;
  staffRole: string;
  oraEntrata: string;
  oraUscita?: string;
  note?: string;
  firmaLogin: string;
  durataMinuti?: number;
  compensoMaturato?: number;
}

interface RiepilogoAccessi {
  totaleAccessi: number;
  accessiCompletati: number;
  accessiAperti: number;
  minutiTotali: number;
  oreTotali: number;
  compensoCalcolato: number;
  compensoSalvato: number;
  compensoPagato: boolean;
}

const prestazioneCategories = [
  { value: 'esame_ematico', label: 'Esame Ematico', icon: TestTube2, color: '#ef4444' },
  { value: 'medicazione', label: 'Medicazione', icon: Bandage, color: '#f59e0b' },
  { value: 'prestazione_varia', label: 'Prestazione Varia', icon: Activity, color: '#10b981' },
];

const assistenzaCategories = [
  { value: 'assistenza_oraria', label: 'Assistenza Oraria', icon: Clock, color: '#3b82f6' },
  { value: 'variazione_orario', label: 'Variazione Orario', icon: CalendarDays, color: '#8b5cf6' },
  { value: 'visita_programmata', label: 'Visita Programmata', icon: Users, color: '#06b6d4' },
];

function WorkPlan() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [workplans, setWorkplans] = useState<WorkPlanItem[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [activeTab, setActiveTab] = useState<'prestazionale' | 'assistenziale'>('prestazionale');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredWorkplans, setFilteredWorkplans] = useState<WorkPlanItem[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal storico accessi + compenso
  const [showAccessiModal, setShowAccessiModal] = useState(false);
  const [selectedWorkPlan, setSelectedWorkPlan] = useState<WorkPlanItem | null>(null);
  const [accessi, setAccessi] = useState<Accesso[]>([]);
  const [riepilogo, setRiepilogo] = useState<RiepilogoAccessi | null>(null);
  const [loadingAccessi, setLoadingAccessi] = useState(false);

  // Diario clinico nel modal
  const [diarioModal, setDiarioModal] = useState<any[]>([]);
  const [showDiarioModal, setShowDiarioModal] = useState(false);

  // Obiettivi nel modal
  const [obiettiviModal, setObiettiviModal] = useState<any[]>([]);
  const [showObiettiviModal, setShowObiettiviModal] = useState(false);

  // Export PDF nel modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDaData, setExportDaData] = useState('');
  const [exportAData, setExportAData] = useState('');
  const [exportDataModal, setExportDataModal] = useState<any>(null);
  const [loadingExportModal, setLoadingExportModal] = useState(false);

  // Form compenso
  const [editCompenso, setEditCompenso] = useState(false);
  const [formTipoCompenso, setFormTipoCompenso] = useState<'orario' | 'fisso' | 'nessuno'>('nessuno');
  const [formTariffa, setFormTariffa] = useState<number>(0);
  const [formCompensoPagato, setFormCompensoPagato] = useState(false);

  // Form stati per nuovo incarico
  const [task, setTask] = useState('');
  const [date, setDate] = useState('');
  const [dataFine, setDataFine] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [patient, setPatient] = useState('');
  const [staff, setStaff] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [tipoCompenso, setTipoCompenso] = useState<'orario' | 'fisso' | 'nessuno'>('nessuno');
  const [tariffa, setTariffa] = useState<number>(0);
  // Giorni settimana: array di {giorno, attivo, accessiAlGiorno, minutiPerAccesso}
  const [giorniForm, setGiorniForm] = useState([
    { giorno: 1, label: 'Lun', attivo: false, accessiAlGiorno: 1, minutiPerAccesso: 60 },
    { giorno: 2, label: 'Mar', attivo: false, accessiAlGiorno: 1, minutiPerAccesso: 60 },
    { giorno: 3, label: 'Mer', attivo: false, accessiAlGiorno: 1, minutiPerAccesso: 60 },
    { giorno: 4, label: 'Gio', attivo: false, accessiAlGiorno: 1, minutiPerAccesso: 60 },
    { giorno: 5, label: 'Ven', attivo: false, accessiAlGiorno: 1, minutiPerAccesso: 60 },
    { giorno: 6, label: 'Sab', attivo: false, accessiAlGiorno: 1, minutiPerAccesso: 60 },
    { giorno: 0, label: 'Dom', attivo: false, accessiAlGiorno: 1, minutiPerAccesso: 60 },
  ]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterWorkplans();
  }, [searchTerm, workplans, activeTab]);

  const loadData = async () => {
    try {
      const [workplanRes, patientRes, staffRes] = await Promise.all([
        api.get('/workplan'),
        api.get('/patients'),
        api.get('/staff')
      ]);
      setWorkplans(workplanRes.data);
      setPatients(patientRes.data);
      setStaffMembers(staffRes.data);
    } catch (err) {
      console.error('Errore caricamento piano di lavoro', err);
    }
  };

  const filterWorkplans = () => {
    let filtered = workplans.filter(w => w.type === activeTab);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(w =>
        w.patient.firstName.toLowerCase().includes(term) ||
        w.patient.lastName.toLowerCase().includes(term) ||
        w.staff.firstName.toLowerCase().includes(term) ||
        w.staff.lastName.toLowerCase().includes(term) ||
        w.task.toLowerCase().includes(term)
      );
    }
    setFilteredWorkplans(filtered);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (!patient || !staff || !task || !date) {
        setError('Compila tutti i campi obbligatori.');
        return;
      }
      const giorniAttivi = giorniForm
        .filter(g => g.attivo)
        .map(g => ({
          giorno: g.giorno,
          accessiAlGiorno: g.accessiAlGiorno,
          minutiPerAccesso: g.minutiPerAccesso,
        }));

      await api.post('/workplan', {
        type: activeTab,
        category,
        patient,
        staff,
        task,
        date,
        dataFine: dataFine || undefined,
        time,
        duration,
        notes,
        giorniSettimana: giorniAttivi.length > 0 ? giorniAttivi : undefined,
        tipoCompenso,
        tariffa: tipoCompenso !== 'nessuno' ? tariffa : 0,
      });
      await loadData();
      setTask(''); setDate(''); setDataFine(''); setTime(''); setDuration(60);
      setPatient(''); setStaff(''); setCategory(''); setNotes('');
      setTipoCompenso('nessuno'); setTariffa(0);
      setGiorniForm(prev => prev.map(g => ({ ...g, attivo: false, accessiAlGiorno: 1, minutiPerAccesso: 60 })));
      setSuccess('Incarico aggiunto con successo!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Impossibile salvare l\'incarico. Riprova.');
    }
  };

  const completeWorkplan = async (id: string) => {
    try {
      await api.patch(`/workplan/${id}`, { status: 'completed' });
      await loadData();
      setSuccess('Incarico completato!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Errore completamento incarico', err);
    }
  };

  const deleteWorkplan = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo incarico?')) return;
    try {
      await api.delete(`/workplan/${id}`);
      await loadData();
      setSuccess('Incarico eliminato!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Errore eliminazione incarico', err);
    }
  };

  const apriAccesso = (id: string) => navigate(`/accesso/${id}`);

  // Archivia incarico (snapshot completo in archivio permanente)
  const archiviaIncarico = async (item: WorkPlanItem) => {
    if (!confirm(`Archiviare definitivamente la cartella clinica di ${item.patient.firstName} ${item.patient.lastName}?\n\nVerrà creato uno snapshot permanente di tutto il piano, diario clinico, accessi e allegati.\nL'incarico rimarrà anche nel Piano di Lavoro.`)) return;
    try {
      await api.post(`/archivio/${item._id}`);
      setSuccess(`✅ Cartella di ${item.patient.firstName} ${item.patient.lastName} archiviata con successo!`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      if (err.response?.status === 400) {
        setError('Questo incarico è già stato archiviato.');
      } else {
        setError(err.response?.data?.message || 'Errore durante l\'archiviazione.');
      }
      setTimeout(() => setError(''), 4000);
    }
  };

  const copiaLink = async (id: string) => {
    const url = `${window.location.origin}/accesso/${id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement('input');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Apri modal storico accessi
  const apriStorico = async (item: WorkPlanItem) => {
    setSelectedWorkPlan(item);
    setFormTipoCompenso(item.tipoCompenso || 'nessuno');
    setFormTariffa(item.tariffa || 0);
    setFormCompensoPagato(item.compensoPagato || false);
    setEditCompenso(false);
    setLoadingAccessi(true);
    setShowAccessiModal(true);
    setShowDiarioModal(false);
    setShowObiettiviModal(false);
    setShowExportModal(false);
    setExportDataModal(null);
    setExportDaData('');
    setExportAData('');
    try {
      const [accessiRes, diarioRes, obiettiviRes] = await Promise.allSettled([
        api.get(`/workplan/${item._id}/accessi`),
        api.get(`/diario/${item._id}`),
        api.get(`/obiettivi/${item._id}`),
      ]);
      if (accessiRes.status === 'fulfilled') {
        setAccessi(accessiRes.value.data.accessi);
        setRiepilogo(accessiRes.value.data.riepilogo);
      }
      if (diarioRes.status === 'fulfilled') setDiarioModal(diarioRes.value.data || []);
      if (obiettiviRes.status === 'fulfilled') setObiettiviModal(obiettiviRes.value.data || []);
    } catch (err) {
      console.error('Errore caricamento accessi', err);
    } finally {
      setLoadingAccessi(false);
    }
  };

  // Carica export PDF nel modal
  const caricaExportModal = async () => {
    if (!selectedWorkPlan) return;
    setLoadingExportModal(true);
    try {
      const params: any = {};
      if (exportDaData) params.dataInizio = exportDaData;
      if (exportAData) params.dataFine = exportAData;
      const res = await api.get(`/workplan/${selectedWorkPlan._id}/accessi/export`, { params });
      setExportDataModal(res.data);
    } catch (err: any) {
      console.error('Errore export', err);
    } finally {
      setLoadingExportModal(false);
    }
  };

  // Stampa PDF senza tariffa (solo rendicontazione accessi)
  const stampaExportModal = () => {
    if (!exportDataModal) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const righe = exportDataModal.accessi.map((acc: any) => `<tr>
      <td>${acc.data}</td><td>${acc.oraEntrata}</td><td>${acc.oraUscita || '—'}</td>
      <td>${acc.durataOre}</td><td>${acc.note || '—'}</td>
    </tr>`).join('');
    win.document.write(`<html><head><title>Registro Accessi</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:12px;color:#222;margin:20px}
      h1{font-size:18px;color:#1e4d8c;margin-bottom:4px}
      h2{font-size:14px;color:#444;margin:0 0 16px}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th{background:#1e4d8c;color:#fff;padding:8px;text-align:left;font-size:11px}
      td{padding:7px 8px;border-bottom:1px solid #e2e8f0;font-size:11px}
      tr:nth-child(even) td{background:#f8fafc}
      .riepilogo{margin-top:20px;background:#f1f5f9;padding:12px;border-radius:6px}
      .riepilogo p{margin:4px 0}
      @media print{body{margin:0}}
    </style></head><body>
    <h1>Registro Accessi — ${exportDataModal.piano.paziente}</h1>
    <h2>Operatore: ${exportDataModal.piano.operatore} (${exportDataModal.piano.ruoloOperatore})</h2>
    <p><strong>Attività:</strong> ${exportDataModal.piano.task}</p>
    <p><strong>Periodo:</strong> ${exportDataModal.periodo.da} — ${exportDataModal.periodo.a}</p>
    <table>
      <thead><tr>
        <th>Data</th><th>Entrata</th><th>Uscita</th><th>Durata</th><th>Note</th>
      </tr></thead>
      <tbody>${righe}</tbody>
    </table>
    <div class="riepilogo">
      <p><strong>Totale accessi:</strong> ${exportDataModal.riepilogo.totaleAccessi}</p>
      <p><strong>Ore totali:</strong> ${exportDataModal.riepilogo.oreTotali}</p>
    </div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  // Salva compenso
  const salvaCompenso = async (ricalcola = false) => {
    if (!selectedWorkPlan) return;
    try {
      await api.patch(`/workplan/${selectedWorkPlan._id}/compenso`, {
        tipoCompenso: formTipoCompenso,
        tariffa: formTariffa,
        compensoPagato: formCompensoPagato,
        ricalcola,
      });
      // Ricarica
      const res = await api.get(`/workplan/${selectedWorkPlan._id}/accessi`);
      setRiepilogo(res.data.riepilogo);
      setSelectedWorkPlan({ ...selectedWorkPlan, tipoCompenso: formTipoCompenso, tariffa: formTariffa, compensoPagato: formCompensoPagato, compensoTotale: res.data.riepilogo.compensoSalvato });
      await loadData();
      setEditCompenso(false);
      setSuccess('Compenso aggiornato!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('Errore salvataggio compenso', err);
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' });

  const formatOra = (data: string) =>
    new Date(data).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  const formatDataOra = (data: string) =>
    new Date(data).toLocaleString('it-IT');

  const calcolaDurata = (entrata: string, uscita?: string) => {
    const fine = uscita ? new Date(uscita) : new Date();
    const minuti = Math.round((fine.getTime() - new Date(entrata).getTime()) / 60000);
    const ore = Math.floor(minuti / 60);
    const min = minuti % 60;
    return ore > 0 ? `${ore}h ${min}min` : `${min}min`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'cancelled': return '#6b7280';
      default: return '#f59e0b';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Completato';
      case 'cancelled': return 'Annullato';
      default: return 'In attesa';
    }
  };

  const getCategoryInfo = (catValue: string) => {
    const allCategories = [...prestazioneCategories, ...assistenzaCategories];
    return allCategories.find(c => c.value === catValue) || { label: catValue, icon: Calendar, color: '#6b7280' };
  };

  const currentCategories = activeTab === 'prestazionale' ? prestazioneCategories : assistenzaCategories;

  return (
    <section>
      <h2>
        <Calendar size={28} />
        Piano di Lavoro
      </h2>

      {success && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', backgroundColor: 'var(--success-bg)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 'var(--radius-md)', color: 'var(--success)', marginBottom: '16px' }}>
          <CheckCircle size={18} />
          {success}
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '2px solid var(--gray-200)', paddingBottom: '8px' }}>
        <button type="button" onClick={() => setActiveTab('prestazionale')} style={{ padding: '12px 24px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: activeTab === 'prestazionale' ? '600' : '400', color: activeTab === 'prestazionale' ? 'var(--primary)' : 'var(--gray-500)', borderBottom: activeTab === 'prestazionale' ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: '-10px' }}>
          <Activity size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          Prestazionale
        </button>
        <button type="button" onClick={() => setActiveTab('assistenziale')} style={{ padding: '12px 24px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: activeTab === 'assistenziale' ? '600' : '400', color: activeTab === 'assistenziale' ? 'var(--primary)' : 'var(--gray-500)', borderBottom: activeTab === 'assistenziale' ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: '-10px' }}>
          <Users size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          Assistenziale
        </button>
      </div>

      {/* Search Bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
          <input type="text" placeholder="Cerca per paziente, operatore o attività..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '12px 14px 12px 44px', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-md)', fontSize: '0.95rem', outline: 'none' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 380px) 1fr', gap: '24px' }}>
        {/* Form Section */}
        <div className="dashboard-folder">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0 }}>
            <Plus size={20} />
            Nuovo Incarico {activeTab === 'prestazionale' ? 'Prestazionale' : 'Assistenziale'}
          </h3>

          <form onSubmit={handleSubmit} className="user-form">
            <label>
              Paziente *
              <select value={patient} onChange={(e) => setPatient(e.target.value)} required>
                <option value="">Seleziona un paziente</option>
                {patients.map((item) => (
                  <option key={item._id} value={item._id}>{item.firstName} {item.lastName}</option>
                ))}
              </select>
            </label>

            <label>
              Operatore *
              <select value={staff} onChange={(e) => setStaff(e.target.value)} required>
                <option value="">Seleziona un operatore</option>
                {staffMembers.filter(s => s.active).map((item) => (
                  <option key={item._id} value={item._id}>{item.firstName} {item.lastName} - {item.role}</option>
                ))}
              </select>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <label>
                Data inizio *
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </label>
              <label>
                Data fine (opzionale)
                <input type="date" value={dataFine} onChange={(e) => setDataFine(e.target.value)} min={date} />
              </label>
            </div>

            <label>
              Orario
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>

            {/* Giorni settimana */}
            <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '12px', marginTop: '4px' }}>
              <div style={{ fontWeight: '600', color: 'var(--gray-700)', marginBottom: '10px', fontSize: '0.9rem' }}>
                📅 Giorni di intervento settimanali
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {giorniForm.map((g, idx) => (
                  <div key={g.giorno} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '6px', backgroundColor: g.attivo ? '#eff6ff' : '#f9fafb', border: `1px solid ${g.attivo ? '#bfdbfe' : '#e5e7eb'}` }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', minWidth: '60px', margin: 0, fontWeight: g.attivo ? '600' : '400' }}>
                      <input
                        type="checkbox"
                        checked={g.attivo}
                        onChange={e => {
                          const updated = [...giorniForm];
                          updated[idx] = { ...updated[idx], attivo: e.target.checked };
                          setGiorniForm(updated);
                        }}
                        style={{ width: '16px', height: '16px' }}
                      />
                      {g.label}
                    </label>
                    {g.attivo && activeTab === 'prestazionale' && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', margin: 0 }}>
                        Accessi/giorno:
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={g.accessiAlGiorno}
                          onChange={e => {
                            const updated = [...giorniForm];
                            updated[idx] = { ...updated[idx], accessiAlGiorno: parseInt(e.target.value) || 1 };
                            setGiorniForm(updated);
                          }}
                          style={{ width: '60px', padding: '4px 6px', borderRadius: '4px', border: '1px solid #bfdbfe', fontSize: '0.85rem' }}
                        />
                      </label>
                    )}
                    {g.attivo && activeTab === 'assistenziale' && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', margin: 0 }}>
                        Minuti/accesso:
                        <input
                          type="number"
                          min="15"
                          step="15"
                          max="480"
                          value={g.minutiPerAccesso}
                          onChange={e => {
                            const updated = [...giorniForm];
                            updated[idx] = { ...updated[idx], minutiPerAccesso: parseInt(e.target.value) || 60 };
                            setGiorniForm(updated);
                          }}
                          style={{ width: '70px', padding: '4px 6px', borderRadius: '4px', border: '1px solid #bfdbfe', fontSize: '0.85rem' }}
                        />
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <label>
              Categoria *
              <select value={category} onChange={(e) => setCategory(e.target.value)} required>
                <option value="">Seleziona categoria</option>
                {currentCategories.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </label>

            <label>
              Attività / Descrizione *
              <input value={task} onChange={(e) => setTask(e.target.value)} placeholder={activeTab === 'prestazionale' ? 'Es. Prelievo ematico, Medicazione...' : 'Es. Assistenza igienica, Cambio postura...'} required />
            </label>

            {activeTab === 'assistenziale' && (
              <label>
                Durata (minuti)
                <input type="number" min="15" step="15" value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 60)} />
              </label>
            )}

            <label>
              Note (opzionale)
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Note aggiuntive..." />
            </label>

            {/* Sezione Compenso */}
            <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '12px', marginTop: '4px' }}>
              <label style={{ fontWeight: '600', color: 'var(--gray-700)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Euro size={16} />
                Compenso operatore
              </label>
              <label>
                Tipo compenso
                <select value={tipoCompenso} onChange={(e) => setTipoCompenso(e.target.value as any)}>
                  <option value="nessuno">Nessuno</option>
                  <option value="orario">Tariffa oraria (€/ora)</option>
                  <option value="fisso">Compenso fisso (€)</option>
                </select>
              </label>
              {tipoCompenso !== 'nessuno' && (
                <label>
                  {tipoCompenso === 'orario' ? 'Tariffa oraria (€/ora)' : 'Compenso fisso (€)'}
                  <input type="number" min="0" step="0.5" value={tariffa} onChange={(e) => setTariffa(parseFloat(e.target.value) || 0)} placeholder="0.00" />
                </label>
              )}
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', backgroundColor: 'var(--danger-bg)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: '0.92rem' }}>
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            <button type="submit">
              <Plus size={16} />
              Aggiungi Incarico
            </button>
          </form>
        </div>

        {/* List Section */}
        <div className="dashboard-folder">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0 }}>
            <Calendar size={20} />
            Incarichi {activeTab === 'prestazionale' ? 'Prestazionali' : 'Assistenziali'} ({filteredWorkplans.length})
          </h3>

          {filteredWorkplans.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '32px', color: 'var(--gray-500)' }}>Nessun incarico presente.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '700px', overflowY: 'auto' }}>
              {filteredWorkplans.map((item) => {
                const catInfo = getCategoryInfo(item.category);
                const Icon = catInfo.icon;
                return (
                  <div key={item._id} style={{ display: 'flex', gap: '12px', padding: '14px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)', backgroundColor: 'white', borderLeft: `4px solid ${catInfo.color}`, opacity: item.status === 'completed' ? 0.75 : 1 }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-md)', backgroundColor: `${catInfo.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={22} color={catInfo.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <strong>{item.patient.firstName} {item.patient.lastName}</strong>
                        <span style={{ fontSize: '0.72rem', padding: '2px 7px', backgroundColor: `${catInfo.color}20`, color: catInfo.color, borderRadius: 'var(--radius-full)', fontWeight: 600 }}>{catInfo.label}</span>
                        <span style={{ fontSize: '0.72rem', padding: '2px 7px', backgroundColor: `${getStatusColor(item.status)}20`, color: getStatusColor(item.status), borderRadius: 'var(--radius-full)', fontWeight: 600 }}>{getStatusLabel(item.status)}</span>
                        {item.tipoCompenso && item.tipoCompenso !== 'nessuno' && (
                          <span style={{ fontSize: '0.72rem', padding: '2px 7px', backgroundColor: '#f0fdf4', color: '#16a34a', borderRadius: 'var(--radius-full)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Euro size={10} />
                            {item.tipoCompenso === 'orario' ? `${item.tariffa}€/h` : `${item.tariffa}€ fisso`}
                            {item.compensoTotale ? ` → ${item.compensoTotale}€` : ''}
                            {item.compensoPagato && ' ✓ Pagato'}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '0 0 3px', fontSize: '0.9rem', color: 'var(--gray-700)' }}>{item.task}</p>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--gray-500)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <span>📅 {formatDate(item.date)}{item.dataFine ? ` → ${formatDate(item.dataFine)}` : ''}{item.time && ` alle ${item.time}`}</span>
                        <span>👤 {item.staff.firstName} {item.staff.lastName}</span>
                        {item.duration && <span>⏱️ {item.duration} min</span>}
                      </p>
                      {item.giorniSettimana && item.giorniSettimana.length > 0 && (
                        <div style={{ marginTop: '4px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {['Dom','Lun','Mar','Mer','Gio','Ven','Sab'].map((label, idx) => {
                            const g = item.giorniSettimana!.find(x => x.giorno === idx);
                            return g ? (
                              <span key={idx} style={{ fontSize: '0.7rem', padding: '1px 6px', backgroundColor: '#eff6ff', color: '#1e40af', borderRadius: '10px', fontWeight: '600', border: '1px solid #bfdbfe' }}>
                                {label}
                                {item.type === 'prestazionale' && g.accessiAlGiorno > 1 ? ` ×${g.accessiAlGiorno}` : ''}
                                {item.type === 'assistenziale' ? ` ${g.minutiPerAccesso}min` : ''}
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}
                      {item.notes && <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: 'var(--gray-600)', fontStyle: 'italic' }}>{item.notes}</p>}
                    </div>
                    <div style={{ display: 'flex', gap: '5px', flexShrink: 0, flexDirection: 'column' }}>
                      {/* Storico accessi + compenso */}
                      <button type="button" onClick={() => apriStorico(item)} style={{ background: '#8b5cf6', padding: '7px' }} title="Storico accessi e compenso">
                        <ClipboardList size={15} />
                      </button>
                      {/* Accesso remoto */}
                      <button type="button" onClick={() => apriAccesso(item._id)} style={{ background: '#3b82f6', padding: '7px' }} title="Apri pagina registrazione accessi">
                        <Link2 size={15} />
                      </button>
                      {/* Copia link */}
                      <button type="button" onClick={() => copiaLink(item._id)} style={{ background: copiedId === item._id ? '#10b981' : '#6c757d', padding: '7px' }} title={copiedId === item._id ? 'Link copiato!' : 'Copia link accesso'}>
                        <Copy size={15} />
                      </button>
                      {item.status === 'pending' && (
                        <button type="button" onClick={() => completeWorkplan(item._id)} style={{ background: 'var(--success)', padding: '7px' }} title="Segna come completato">
                          <CheckCircle size={15} />
                        </button>
                      )}
                      {(user?.role === 'admin' || user?.role === 'coordinator') && (
                        <button type="button" onClick={() => archiviaIncarico(item)} style={{ background: '#7c3aed', padding: '7px' }} title="Archivia cartella clinica">
                          <Archive size={15} />
                        </button>
                      )}
                      <button type="button" onClick={() => deleteWorkplan(item._id)} style={{ background: 'var(--danger)', padding: '7px' }} title="Elimina">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ===== MODAL STORICO ACCESSI + COMPENSO ===== */}
      {showAccessiModal && selectedWorkPlan && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '12px', maxWidth: '760px', width: '95%', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            {/* Header modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ClipboardList size={20} color="#8b5cf6" />
                  Storico Accessi & Compenso
                </h3>
                <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                  {selectedWorkPlan.patient.firstName} {selectedWorkPlan.patient.lastName} — {selectedWorkPlan.task}
                </p>
                <p style={{ margin: '2px 0 0', color: '#888', fontSize: '0.82rem' }}>
                  Operatore: {selectedWorkPlan.staff.firstName} {selectedWorkPlan.staff.lastName}
                </p>
              </div>
              <button type="button" onClick={() => setShowAccessiModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666', padding: '4px' }}>
                <X size={22} />
              </button>
            </div>

            {loadingAccessi ? (
              <p style={{ textAlign: 'center', color: '#666', padding: '32px' }}>⏳ Caricamento...</p>
            ) : (
              <>
                {/* Riepilogo */}
                {riepilogo && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ padding: '12px', backgroundColor: '#f0f9ff', borderRadius: '8px', textAlign: 'center', border: '1px solid #bae6fd' }}>
                      <div style={{ fontSize: '1.6rem', fontWeight: '700', color: '#0284c7' }}>{riepilogo.totaleAccessi}</div>
                      <div style={{ fontSize: '0.78rem', color: '#666' }}>Accessi totali</div>
                    </div>
                    <div style={{ padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '8px', textAlign: 'center', border: '1px solid #bbf7d0' }}>
                      <div style={{ fontSize: '1.6rem', fontWeight: '700', color: '#16a34a' }}>{riepilogo.accessiCompletati}</div>
                      <div style={{ fontSize: '0.78rem', color: '#666' }}>Completati</div>
                    </div>
                    <div style={{ padding: '12px', backgroundColor: '#fefce8', borderRadius: '8px', textAlign: 'center', border: '1px solid #fde68a' }}>
                      <div style={{ fontSize: '1.6rem', fontWeight: '700', color: '#d97706' }}>{riepilogo.oreTotali}h</div>
                      <div style={{ fontSize: '0.78rem', color: '#666' }}>Ore lavorate</div>
                    </div>
                    <div style={{ padding: '12px', backgroundColor: riepilogo.compensoPagato ? '#f0fdf4' : '#fdf4ff', borderRadius: '8px', textAlign: 'center', border: `1px solid ${riepilogo.compensoPagato ? '#bbf7d0' : '#e9d5ff'}` }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: '700', color: riepilogo.compensoPagato ? '#16a34a' : '#7c3aed' }}>
                        €{riepilogo.compensoSalvato > 0 ? riepilogo.compensoSalvato : riepilogo.compensoCalcolato}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#666' }}>{riepilogo.compensoPagato ? '✓ Pagato' : 'Compenso'}</div>
                    </div>
                  </div>
                )}

                {/* Sezione Compenso */}
                <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#fdf4ff', borderRadius: '8px', border: '1px solid #e9d5ff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px', color: '#7c3aed' }}>
                      <Euro size={18} />
                      Gestione Compenso
                    </h4>
                    {!editCompenso && (
                      <button type="button" onClick={() => setEditCompenso(true)} style={{ background: '#7c3aed', padding: '6px 14px', fontSize: '0.85rem' }}>
                        Modifica
                      </button>
                    )}
                  </div>

                  {!editCompenso ? (
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '0.9rem' }}>
                      <div>
                        <span style={{ color: '#666' }}>Tipo: </span>
                        <strong>{selectedWorkPlan.tipoCompenso === 'orario' ? 'Tariffa oraria' : selectedWorkPlan.tipoCompenso === 'fisso' ? 'Compenso fisso' : 'Nessuno'}</strong>
                      </div>
                      {selectedWorkPlan.tipoCompenso !== 'nessuno' && (
                        <div>
                          <span style={{ color: '#666' }}>Tariffa: </span>
                          <strong>€{selectedWorkPlan.tariffa}{selectedWorkPlan.tipoCompenso === 'orario' ? '/ora' : ''}</strong>
                        </div>
                      )}
                      {riepilogo && riepilogo.compensoCalcolato > 0 && (
                        <div>
                          <span style={{ color: '#666' }}>Calcolato dagli accessi: </span>
                          <strong style={{ color: '#7c3aed' }}>€{riepilogo.compensoCalcolato}</strong>
                        </div>
                      )}
                      <div>
                        <span style={{ color: '#666' }}>Compenso salvato: </span>
                        <strong style={{ color: '#16a34a' }}>€{selectedWorkPlan.compensoTotale || 0}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#666' }}>Stato pagamento: </span>
                        <strong style={{ color: selectedWorkPlan.compensoPagato ? '#16a34a' : '#dc2626' }}>
                          {selectedWorkPlan.compensoPagato ? '✓ Pagato' : '⏳ Da pagare'}
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.88rem' }}>
                          Tipo compenso
                          <select value={formTipoCompenso} onChange={(e) => setFormTipoCompenso(e.target.value as any)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                            <option value="nessuno">Nessuno</option>
                            <option value="orario">Tariffa oraria (€/ora)</option>
                            <option value="fisso">Compenso fisso (€)</option>
                          </select>
                        </label>
                        {formTipoCompenso !== 'nessuno' && (
                          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.88rem' }}>
                            {formTipoCompenso === 'orario' ? 'Tariffa €/ora' : 'Compenso fisso €'}
                            <input type="number" min="0" step="0.5" value={formTariffa} onChange={(e) => setFormTariffa(parseFloat(e.target.value) || 0)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                          </label>
                        )}
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={formCompensoPagato} onChange={(e) => setFormCompensoPagato(e.target.checked)} />
                        Compenso pagato
                      </label>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => salvaCompenso(false)} style={{ background: '#7c3aed', padding: '8px 16px', fontSize: '0.88rem' }}>
                          💾 Salva
                        </button>
                        {formTipoCompenso === 'orario' && (
                          <button type="button" onClick={() => salvaCompenso(true)} style={{ background: '#16a34a', padding: '8px 16px', fontSize: '0.88rem' }}>
                            🔄 Ricalcola dagli accessi
                          </button>
                        )}
                        <button type="button" onClick={() => setEditCompenso(false)} style={{ background: '#6c757d', padding: '8px 16px', fontSize: '0.88rem' }}>
                          Annulla
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Lista accessi */}
                <div>
                  <h4 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={16} />
                    Registro Accessi ({accessi.length})
                  </h4>

                  {accessi.length === 0 ? (
                    <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
                      Nessun accesso registrato per questo incarico.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                      {accessi.map((acc) => (
                        <div key={acc._id} style={{ padding: '12px', borderRadius: '6px', border: `1px solid ${acc.oraUscita ? '#e5e7eb' : '#86efac'}`, backgroundColor: acc.oraUscita ? '#f9fafb' : '#f0fdf4' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                              <div style={{ fontWeight: '600', marginBottom: '4px', fontSize: '0.9rem' }}>
                                {acc.staffName}
                                <span style={{ fontWeight: '400', color: '#666', marginLeft: '8px', fontSize: '0.82rem' }}>({acc.staffRole})</span>
                              </div>
                              <div style={{ fontSize: '0.85rem', color: '#555', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                <span>🟢 Entrata: <strong>{formatOra(acc.oraEntrata)}</strong></span>
                                {acc.oraUscita
                                  ? <span>🔴 Uscita: <strong>{formatOra(acc.oraUscita)}</strong></span>
                                  : <span style={{ color: '#16a34a', fontWeight: '600' }}>● In corso</span>
                                }
                                {acc.oraUscita && (
                                  <span style={{ color: '#7c3aed' }}>⏱️ <strong>{calcolaDurata(acc.oraEntrata, acc.oraUscita)}</strong></span>
                                )}
                                {acc.oraUscita && acc.compensoMaturato !== undefined && acc.compensoMaturato > 0 && (
                                  <span style={{ color: '#16a34a', fontWeight: '700', backgroundColor: '#f0fdf4', padding: '1px 8px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                                    💶 €{acc.compensoMaturato}
                                  </span>
                                )}
                              </div>
                              {acc.note && <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '4px', fontStyle: 'italic' }}>📝 {acc.note}</div>}
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#888' }}>
                              <div>✍️ {acc.firmaLogin}</div>
                              <div>{new Date(acc.oraEntrata).toLocaleDateString('it-IT')}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── SEZIONE DIARIO CLINICO ── */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', marginTop: '20px', overflow: 'hidden' }}>
                  <button type="button" onClick={() => setShowDiarioModal(!showDiarioModal)}
                    style={{ width: '100%', background: '#f8fafc', border: 'none', padding: '12px 16px', textAlign: 'left', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', color: '#374151', display: 'flex', justifyContent: 'space-between' }}>
                    <span>📓 Diario clinico ({diarioModal.length} voci)</span>
                    <span>{showDiarioModal ? '▲' : '▼'}</span>
                  </button>
                  {showDiarioModal && (
                    <div style={{ padding: '16px', maxHeight: '400px', overflowY: 'auto' }}>
                      {diarioModal.length === 0 ? (
                        <p style={{ color: '#888', fontStyle: 'italic', margin: 0 }}>Nessuna voce nel diario.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {diarioModal.map((entry: any) => (
                            <div key={entry._id} style={{ padding: '12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                                  📅 {new Date(entry.dataRegistrazione).toLocaleDateString('it-IT')} {new Date(entry.dataRegistrazione).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span style={{ fontSize: '0.8rem', color: '#888' }}>✍️ {entry.staffName}</span>
                                {entry.firmato && (
                                  <span style={{ background: 'rgba(5,150,105,0.1)', color: '#065f46', border: '1px solid #059669', borderRadius: '10px', padding: '1px 8px', fontSize: '0.72rem', fontWeight: '700' }}>✅ Firmato</span>
                                )}
                              </div>
                              <p style={{ margin: '0 0 8px', color: '#374151', fontSize: '0.88rem', whiteSpace: 'pre-wrap' }}>{entry.testo}</p>
                              {entry.parametriVitali && Object.values(entry.parametriVitali).some((v: any) => v !== undefined && v !== null) && (
                                <div style={{ background: '#f1f5f9', borderRadius: '6px', padding: '6px 10px', fontSize: '0.8rem', color: '#555', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                  {entry.parametriVitali.pressioneSistolica !== undefined && <span>🩸 {entry.parametriVitali.pressioneSistolica}/{entry.parametriVitali.pressioneDiastolica} mmHg</span>}
                                  {entry.parametriVitali.frequenzaCardiaca !== undefined && <span>❤️ {entry.parametriVitali.frequenzaCardiaca} bpm</span>}
                                  {entry.parametriVitali.frequenzaRespiratoria !== undefined && <span>🫁 {entry.parametriVitali.frequenzaRespiratoria} atti/min</span>}
                                  {entry.parametriVitali.temperatura !== undefined && <span>🌡️ {entry.parametriVitali.temperatura}°C</span>}
                                  {entry.parametriVitali.saturazione !== undefined && <span>💨 SpO2 {entry.parametriVitali.saturazione}%</span>}
                                  {entry.parametriVitali.glicemia !== undefined && <span>🍬 {entry.parametriVitali.glicemia} mg/dL</span>}
                                  {entry.parametriVitali.peso !== undefined && <span>⚖️ {entry.parametriVitali.peso} kg</span>}
                                  {entry.parametriVitali.dolore !== undefined && <span>😣 Dolore {entry.parametriVitali.dolore}/10</span>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── SEZIONE OBIETTIVI ── */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', marginTop: '12px', overflow: 'hidden' }}>
                  <button type="button" onClick={() => setShowObiettiviModal(!showObiettiviModal)}
                    style={{ width: '100%', background: '#f8fafc', border: 'none', padding: '12px 16px', textAlign: 'left', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', color: '#374151', display: 'flex', justifyContent: 'space-between' }}>
                    <span>🎯 Obiettivi del piano ({obiettiviModal.length})</span>
                    <span>{showObiettiviModal ? '▲' : '▼'}</span>
                  </button>
                  {showObiettiviModal && (
                    <div style={{ padding: '16px' }}>
                      {obiettiviModal.length === 0 ? (
                        <p style={{ color: '#888', fontStyle: 'italic', margin: 0 }}>Nessun obiettivo definito.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {obiettiviModal.map((ob: any) => {
                            const statoColors: Record<string, { bg: string; color: string; label: string }> = {
                              attivo:        { bg: 'rgba(30,77,140,0.08)',  color: '#1e4d8c', label: '🎯 Attivo' },
                              raggiunto:     { bg: 'rgba(5,150,105,0.08)',  color: '#065f46', label: '✅ Raggiunto' },
                              parziale:      { bg: 'rgba(245,158,11,0.08)', color: '#92400e', label: '⚠️ Parziale' },
                              non_raggiunto: { bg: 'rgba(220,38,38,0.08)',  color: '#7f1d1d', label: '❌ Non raggiunto' },
                              rivalutato:    { bg: 'rgba(107,114,128,0.08)',color: '#374151', label: '🔄 Rivalutato' },
                            };
                            const badge = statoColors[ob.stato] || statoColors.attivo;
                            return (
                              <div key={ob._id} style={{ background: badge.bg, border: `1px solid ${badge.color}30`, borderRadius: '6px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                                <div style={{ flex: 1 }}>
                                  <p style={{ margin: '0 0 4px', fontWeight: '600', fontSize: '0.88rem', color: '#374151' }}>{ob.descrizione}</p>
                                  <div style={{ fontSize: '0.78rem', color: '#888', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    <span>📅 {new Date(ob.dataInizio).toLocaleDateString('it-IT')}</span>
                                    {ob.dataRivalutazione && <span>🔄 Rivalutazione: {new Date(ob.dataRivalutazione).toLocaleDateString('it-IT')}</span>}
                                    {ob.valutazioni?.length > 0 && <span>📋 {ob.valutazioni.length} valutazioni</span>}
                                  </div>
                                </div>
                                <span style={{ color: badge.color, fontWeight: '700', fontSize: '0.8rem', background: badge.bg, border: `1px solid ${badge.color}`, borderRadius: '10px', padding: '2px 8px', whiteSpace: 'nowrap' }}>{badge.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── EXPORT PDF ACCESSI ── */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', marginTop: '12px', overflow: 'hidden' }}>
                  <button type="button" onClick={() => setShowExportModal(!showExportModal)}
                    style={{ width: '100%', background: '#f8fafc', border: 'none', padding: '12px 16px', textAlign: 'left', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', color: '#374151', display: 'flex', justifyContent: 'space-between' }}>
                    <span>📄 Esporta registro accessi (PDF)</span>
                    <span>{showExportModal ? '▲' : '▼'}</span>
                  </button>
                  {showExportModal && (
                    <div style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '8px' }}>
                        <label style={{ flex: 1, minWidth: '130px', fontSize: '0.85rem' }}>
                          Da data
                          <input type="date" value={exportDaData} onChange={e => setExportDaData(e.target.value)} style={{ marginTop: '4px', padding: '7px 10px', border: '1px solid #ced4da', borderRadius: '4px', width: '100%' }} />
                        </label>
                        <label style={{ flex: 1, minWidth: '130px', fontSize: '0.85rem' }}>
                          A data
                          <input type="date" value={exportAData} onChange={e => setExportAData(e.target.value)} style={{ marginTop: '4px', padding: '7px 10px', border: '1px solid #ced4da', borderRadius: '4px', width: '100%' }} />
                        </label>
                        <button type="button" onClick={caricaExportModal} disabled={loadingExportModal}
                          style={{ background: '#1e4d8c', padding: '9px 16px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                          {loadingExportModal ? '⏳' : '🔍 Carica'}
                        </button>
                        {exportDataModal && (
                          <button type="button" onClick={stampaExportModal}
                            style={{ background: '#059669', padding: '9px 16px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                            🖨️ Stampa PDF
                          </button>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: '#888' }}>Lascia vuoto per il mese corrente</p>
                        {exportDataModal && (
                          <div style={{ marginTop: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', fontSize: '0.82rem' }}>
                          <p style={{ margin: '0 0 4px' }}><strong>Periodo:</strong> {exportDataModal.periodo.da} — {exportDataModal.periodo.a}</p>
                          <p style={{ margin: 0 }}><strong>Accessi:</strong> {exportDataModal.riepilogo.totaleAccessi} | <strong>Ore:</strong> {exportDataModal.riepilogo.oreTotali}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer modal */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                  <button type="button" onClick={() => apriAccesso(selectedWorkPlan._id)} style={{ background: '#3b82f6', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Link2 size={16} />
                    Apri pagina accesso
                  </button>
                  <button type="button" onClick={() => setShowAccessiModal(false)} style={{ background: '#6c757d' }}>
                    Chiudi
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default WorkPlan;
