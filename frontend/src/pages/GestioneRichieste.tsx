import { useEffect, useState, ChangeEvent } from 'react';
import api from '../api/api';
import { Button } from '../components/ui/Button';

// ═════════════════════════════════════════════════════════════════════════════
// Tipi
// ═════════════════════════════════════════════════════════════════════════════
type TipoServizio = 'prelievo' | 'esame_strumentale' | 'prestazione' | 'assistenza';
type StatoRichiesta = 'in_attesa' | 'in_revisione' | 'confermata' | 'modificata' | 'rifiutata' | 'completata';

interface Richiesta {
  _id: string;
  richiedenteNome: string;
  richiedenteEmail: string;
  richiedenteTelefono?: string;
  tipoServizio: TipoServizio;
  tipoSpecifico?: string;
  pazienteNome: string;
  pazienteIndirizzo: string;
  pazienteTelefono?: string;
  dataPreferita: string;
  orarioPreferito?: string;
  dataAlternativa?: string;
  orarioAlternativo?: string;
  priorita?: 'bassa' | 'normale' | 'alta' | 'urgente';
  noteRichiedente?: string;
  stato: StatoRichiesta;
  dataConfermata?: string;
  orarioConfermato?: string;
  staffAssegnatoId?: string;
  staffAssegnatoNome?: string;
  noteAdmin?: string;
  pazienteId?: string;
  createdAt: string;
  updatedAt: string;
}

interface Staff {
  _id: string;
  firstName: string;
  lastName: string;
  role?: string;
  category?: string;
}

interface RichiestaPaziente {
  _id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  codiceFiscale?: string;
  address: string;
  contactPhone?: string;
  email?: string;
  assistanceNeeds: string;
  medicoReferente?: string;
  noteAggiuntive?: string;
  richiedenteNome: string;
  richiedenteRelazione?: string;
  richiedenteEmail?: string;
  richiedenteTelefono?: string;
  stato: 'in_attesa' | 'approvata' | 'rifiutata';
  noteAdmin?: string;
  pazienteCreatId?: string;
  createdAt: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// Componente
// ═════════════════════════════════════════════════════════════════════════════
export default function GestioneRichieste() {
  const [richieste, setRichieste] = useState<Richiesta[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tutte' | 'in_attesa' | 'in_revisione' | 'confermata' | 'rifiutata'>('tutte');

  // Richieste registrazione paziente
  const [richiestePaziente, setRichiestePaziente] = useState<RichiestaPaziente[]>([]);
  const [tabPrincipale, setTabPrincipale] = useState<'prenotazioni' | 'pazienti'>('prenotazioni');
  const [approvandoPazId, setApprovandoPazId] = useState<string | null>(null);
  const [selectedRichiesta, setSelectedRichiesta] = useState<Richiesta | null>(null);
  const [gestioneModal, setGestioneModal] = useState(false);

  // Form gestione
  const [gestioneForm, setGestioneForm] = useState({
    stato: 'confermata' as StatoRichiesta,
    dataConfermata: '',
    orarioConfermato: '',
    staffAssegnatoId: '',
    noteAdmin: '',
    creaAppuntamento: true
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Caricamento dati
  // ════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    caricaDati();
  }, []);

  const caricaDati = async () => {
    try {
      const [richiesteRes, staffRes, pazienteRes] = await Promise.allSettled([
        api.get('/richieste-prenotazioni'),
        api.get('/staff', { params: { active: 'true' } }),
        api.get('/richieste-paziente'),
      ]);
      setRichieste(richiesteRes.status === 'fulfilled' ? (richiesteRes.value.data || []) : []);
      setStaff(staffRes.status === 'fulfilled' ? (staffRes.value.data || []) : []);
      setRichiestePaziente(pazienteRes.status === 'fulfilled' ? (pazienteRes.value.data || []) : []);
      if (staffRes.status === 'rejected') console.error('Errore caricamento staff:', staffRes.reason);
    } catch (err) {
      console.error('Errore caricaDati:', err);
      setRichieste([]);
    } finally {
      setLoading(false);
    }
  };

  const approvaRegistrazionePaziente = async (id: string) => {
    setApprovandoPazId(id);
    try {
      const res = await api.put(`/richieste-paziente/${id}/approva`);
      alert(`✅ Paziente "${res.data.paziente.firstName} ${res.data.paziente.lastName}" creato con successo!`);
      await caricaDati();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore durante l\'approvazione');
    } finally { setApprovandoPazId(null); }
  };

  const rifiutaRegistrazionePaziente = async (id: string) => {
    if (!confirm('Rifiutare questa richiesta di registrazione?')) return;
    try {
      await api.put(`/richieste-paziente/${id}/rifiuta`);
      await caricaDati();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore');
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // Gestione richiesta
  // ════════════════════════════════════════════════════════════════════════════
  const apriGestione = (r: Richiesta) => {
    setSelectedRichiesta(r);
    // staffAssegnatoId may be a populated object {_id, firstName, lastName} or a plain string
    const staffId = r.staffAssegnatoId
      ? (typeof r.staffAssegnatoId === 'object' ? (r.staffAssegnatoId as any)._id : r.staffAssegnatoId)
      : '';
    setGestioneForm({
      stato: r.stato === 'in_attesa' ? 'confermata' : r.stato,
      dataConfermata: r.dataConfermata ? new Date(r.dataConfermata).toISOString().split('T')[0] : r.dataPreferita ? new Date(r.dataPreferita).toISOString().split('T')[0] : '',
      orarioConfermato: r.orarioConfermato || r.orarioPreferito || '',
      staffAssegnatoId: staffId,
      noteAdmin: r.noteAdmin || '',
      creaAppuntamento: true
    });
    setGestioneModal(true);
  };

  const salvaGestione = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRichiesta) return;

    try {
      await api.patch(`/richieste-prenotazioni/${selectedRichiesta._id}/gestisci`, gestioneForm);
      setGestioneModal(false);
      setSelectedRichiesta(null);
      await caricaDati();
      alert('✅ Richiesta aggiornata con successo!');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nella gestione richiesta');
    }
  };

  const eliminaRichiesta = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa richiesta?')) return;
    try {
      await api.delete(`/richieste-prenotazioni/${id}`);
      await caricaDati();
      alert('Richiesta eliminata');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nell\'eliminazione');
    }
  };

  // Approva richiesta e crea appuntamento (usa endpoint unificato /gestisci)
  const approvaRichiesta = async (id: string, data: { dataConfermata: string; orarioConfermato: string }) => {
    try {
      await api.patch(`/richieste-prenotazioni/${id}/gestisci`, {
        stato: 'confermata',
        dataConfermata: data.dataConfermata,
        orarioConfermato: data.orarioConfermato,
        creaAppuntamento: true,
      });
      await caricaDati();
      alert('Richiesta approvata e incarico creato');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nell\'approvazione');
    }
  };

  // Rifiuta richiesta (usa endpoint unificato /gestisci)
  const rifiutaRichiesta = async (id: string, motivo?: string) => {
    try {
      await api.patch(`/richieste-prenotazioni/${id}/gestisci`, {
        stato: 'rifiutata',
        noteAdmin: motivo || 'Richiesta rifiutata',
      });
      await caricaDati();
      alert('Richiesta rifiutata');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nel rifiuto');
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // Helpers
  // ════════════════════════════════════════════════════════════════════════════
  const getStatoBadge = (stato: StatoRichiesta) => {
    const styles: Record<StatoRichiesta, { bg: string; color: string; label: string }> = {
      in_attesa: { bg: '#fef3c7', color: '#92400e', label: '⏳ In attesa' },
      in_revisione: { bg: '#dbeafe', color: '#1e40af', label: '📝 In revisione' },
      confermata: { bg: '#d1fae5', color: '#065f46', label: '✅ Confermata' },
      modificata: { bg: '#e0e7ff', color: '#3730a3', label: '✏️ Modificata' },
      rifiutata: { bg: '#fee2e2', color: '#991b1b', label: '❌ Rifiutata' },
      completata: { bg: '#f3e8ff', color: '#6b21a8', label: '✔️ Completata' }
    };
    const s = styles[stato];
    return (
      <span style={{ background: s.bg, color: s.color, padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
        {s.label}
      </span>
    );
  };

  const getTipoIcon = (tipo: TipoServizio) => {
    const icons: Record<TipoServizio, string> = {
      prelievo: '💉',
      esame_strumentale: '🔬',
      prestazione: '🏥',
      assistenza: '🤝'
    };
    const labels: Record<TipoServizio, string> = {
      prelievo: 'Prelievo',
      esame_strumentale: 'Esame Str.',
      prestazione: 'Prestazione',
      assistenza: 'Assistenza'
    };
    return `${icons[tipo]} ${labels[tipo]}`;
  };

  const getPrioritaBadge = (p?: string) => {
    const styles: Record<string, { bg: string; color: string }> = {
      bassa: { bg: '#dcfce7', color: '#166534' },
      normale: { bg: '#dbeafe', color: '#1e40af' },
      alta: { bg: '#ffedd5', color: '#9a3412' },
      urgente: { bg: '#fee2e2', color: '#991b1b' }
    };
    const s = styles[p || 'normale'];
    return (
      <span style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase' }}>
        {p || 'normale'}
      </span>
    );
  };

  const filteredRichieste = richieste.filter((r: Richiesta) => {
    if (activeTab === 'tutte') return true;
    return r.stato === activeTab;
  });

  const countByStato = (stato: StatoRichiesta) => richieste.filter((r: Richiesta) => r.stato === stato).length;

  // ════════════════════════════════════════════════════════════════════════════
  // Render
  // ════════════════════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <section style={{ padding: '40px 20px', textAlign: 'center' }}>
        <p>Caricamento...</p>
      </section>
    );
  }

  return (
    <section style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: '1.5rem', color: '#1e4d8c' }}>📋 Gestione Richieste</h1>
        <p style={{ margin: 0, color: '#666' }}>Revisiona, conferma e assegna richieste da caregiver e pazienti</p>
      </div>

      {/* Tab principale */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: '#f1f5f9', borderRadius: '10px', padding: '5px' }}>
        <button type="button" onClick={() => setTabPrincipale('prenotazioni')}
          style={{ flex: 1, padding: '9px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '0.88rem', background: tabPrincipale === 'prenotazioni' ? 'white' : 'transparent', color: tabPrincipale === 'prenotazioni' ? '#1e4d8c' : '#6b7280', boxShadow: tabPrincipale === 'prenotazioni' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
          📋 Prenotazioni servizi ({richieste.length})
        </button>
        <button type="button" onClick={() => setTabPrincipale('pazienti')}
          style={{ flex: 1, padding: '9px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '0.88rem', background: tabPrincipale === 'pazienti' ? 'white' : 'transparent', color: tabPrincipale === 'pazienti' ? '#7e22ce' : '#6b7280', boxShadow: tabPrincipale === 'pazienti' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', position: 'relative' as const }}>
          👤 Nuovi pazienti ({richiestePaziente.filter(r => r.stato === 'in_attesa').length} in attesa)
        </button>
      </div>

      {/* ═══ SEZIONE REGISTRAZIONI PAZIENTI ═══ */}
      {tabPrincipale === 'pazienti' && (
        <div>
          {richiestePaziente.filter(rp => rp.stato === 'in_attesa').length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>Nessuna richiesta di registrazione paziente in attesa</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {richiestePaziente.filter(rp => rp.stato === 'in_attesa').map(rp => (
                <div key={rp._id} style={{ background: 'white', borderRadius: '12px', padding: '16px 20px', border: `2px solid ${rp.stato === 'in_attesa' ? '#fcd34d' : rp.stato === 'approvata' ? '#86efac' : '#fca5a5'}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ flex: 1, minWidth: '260px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '1.05rem' }}>{rp.firstName} {rp.lastName}</strong>
                        <span style={{ background: rp.stato === 'in_attesa' ? '#fef3c7' : rp.stato === 'approvata' ? '#dcfce7' : '#fee2e2', color: rp.stato === 'in_attesa' ? '#92400e' : rp.stato === 'approvata' ? '#15803d' : '#991b1b', padding: '2px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700 }}>
                          {rp.stato === 'in_attesa' ? '⏳ In attesa' : rp.stato === 'approvata' ? '✅ Approvata' : '❌ Rifiutata'}
                        </span>
                        {rp.stato === 'approvata' && rp.pazienteCreatId && (
                          <a href={`/patients`} style={{ fontSize: '0.78rem', color: '#2563eb', textDecoration: 'none' }}>→ Vai ai pazienti</a>
                        )}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#555', display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '4px' }}>
                        <span>📅 {new Date(rp.birthDate).toLocaleDateString('it-IT')}</span>
                        {rp.codiceFiscale && <span>🪪 {rp.codiceFiscale}</span>}
                        <span>📍 {rp.address}</span>
                        {rp.contactPhone && <span>📞 {rp.contactPhone}</span>}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#374151', marginTop: '4px' }}>
                        <strong>Necessità:</strong> {rp.assistanceNeeds}
                      </div>
                      {rp.medicoReferente && <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>🩺 Medico: {rp.medicoReferente}</div>}
                      <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '4px' }}>
                        Richiesto da: <strong>{rp.richiedenteNome}</strong>{rp.richiedenteRelazione ? ` (${rp.richiedenteRelazione})` : ''}
                        {rp.richiedenteEmail && ` — ${rp.richiedenteEmail}`}
                        {rp.richiedenteTelefono && ` — ${rp.richiedenteTelefono}`}
                      </div>
                    </div>
                    {rp.stato === 'in_attesa' && (
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button type="button" onClick={() => approvaRegistrazionePaziente(rp._id)}
                          disabled={approvandoPazId === rp._id}
                          style={{ background: '#15803d', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', opacity: approvandoPazId === rp._id ? 0.6 : 1 }}>
                          {approvandoPazId === rp._id ? '⏳...' : '✅ Approva e crea paziente'}
                        </button>
                        <button type="button" onClick={() => rifiutaRegistrazionePaziente(rp._id)}
                          style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>
                          ❌ Rifiuta
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ SEZIONE PRENOTAZIONI SERVIZI ═══ */}
      {tabPrincipale === 'prenotazioni' && <>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {[
          { key: 'in_attesa', label: 'In attesa', count: countByStato('in_attesa'), color: '#f59e0b' },
          { key: 'in_revisione', label: 'In revisione', count: countByStato('in_revisione'), color: '#3b82f6' },
          { key: 'confermata', label: 'Confermate', count: countByStato('confermata'), color: '#16a34a' },
          { key: 'rifiutata', label: 'Rifiutate', count: countByStato('rifiutata'), color: '#dc2626' },
        ].map(stat => (
          <div
            key={stat.key}
            onClick={() => setActiveTab(stat.key as any)}
            style={{
              background: activeTab === stat.key ? stat.color : 'white',
              color: activeTab === stat.key ? 'white' : '#374151',
              padding: '12px 16px',
              borderRadius: '10px',
              cursor: 'pointer',
              border: `2px solid ${activeTab === stat.key ? stat.color : '#e5e7eb'}`,
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{stat.count}</div>
            <div style={{ fontSize: '0.8rem' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {(['tutte', 'in_attesa', 'in_revisione', 'confermata', 'rifiutata'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
              background: activeTab === tab ? '#1e4d8c' : '#f1f5f9',
              color: activeTab === tab ? 'white' : '#475569'
            }}
          >
            {tab === 'tutte' ? 'Tutte' : tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Tabella richieste */}
      {filteredRichieste.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#666' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📋</div>
          <p>Nessuna richiesta {activeTab !== 'tutte' ? 'in questa categoria' : ''}</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.8rem', color: '#64748b' }}>Servizio</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.8rem', color: '#64748b' }}>Paziente</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.8rem', color: '#64748b' }}>Richiedente</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.8rem', color: '#64748b' }}>Data richiesta</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.8rem', color: '#64748b' }}>Stato</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.8rem', color: '#64748b' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filteredRichieste.map((r: Richiesta) => (
                <tr key={r._id} style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 500 }}>{getTipoIcon(r.tipoServizio)}</div>
                    {r.tipoSpecifico && <div style={{ fontSize: '0.75rem', color: '#666' }}>{r.tipoSpecifico}</div>}
                    {getPrioritaBadge(r.priorita)}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 500 }}>{r.pazienteNome}</div>
                    <div style={{ fontSize: '0.75rem', color: '#666' }}>{r.pazienteIndirizzo}</div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 500 }}>{r.richiedenteNome}</div>
                    <div style={{ fontSize: '0.75rem', color: '#666' }}>{r.richiedenteEmail}</div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div>{new Date(r.dataPreferita).toLocaleDateString('it-IT')}</div>
                    {r.orarioPreferito && <div style={{ fontSize: '0.75rem', color: '#666' }}>{r.orarioPreferito}</div>}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {getStatoBadge(r.stato)}
                    {r.staffAssegnatoNome && (
                      <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '4px' }}>
                        👤 {r.staffAssegnatoNome}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => apriGestione(r)}
                        style={{ padding: '6px 12px', background: '#1e4d8c', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}
                      >
                        Gestisci
                      </button>
                      {r.stato === 'in_attesa' && (
                        <>
                          <button
                            onClick={() => {
                              const motivo = prompt('Motivo del rifiuto (opzionale):');
                              if (motivo !== null) {
                                rifiutaRichiesta(r._id, motivo || undefined);
                              }
                            }}
                            style={{ padding: '6px 12px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}
                          >
                            ✕ Rifiuta
                          </button>
                          <button
                            onClick={() => {
                              const dataConfermata = prompt('Data confermata (YYYY-MM-DD):', r.dataPreferita?.split('T')[0]);
                              if (!dataConfermata) return;
                              const orarioConfermato = prompt('Orario confermato (HH:MM):', r.orarioPreferito || '09:00');
                              if (!orarioConfermato) return;
                              approvaRichiesta(r._id, { dataConfermata, orarioConfermato });
                            }}
                            style={{ padding: '6px 12px', background: '#d1fae5', color: '#065f46', border: 'none', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}
                          >
                            ✓ Approva
                          </button>
                          <button
                            onClick={() => eliminaRichiesta(r._id)}
                            style={{ padding: '6px 12px', background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Gestione */}
      {gestioneModal && selectedRichiesta && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px', maxWidth: '600px', width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#1e4d8c' }}>📝 Gestisci Richiesta</h2>
              <Button variant="ghost" size="sm" onClick={() => setGestioneModal(false)}>
                ×
              </Button>
            </div>

            {/* Dettagli richiesta */}
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.9rem' }}>
                <div>
                  <strong>Servizio:</strong> {getTipoIcon(selectedRichiesta.tipoServizio)}
                  {selectedRichiesta.tipoSpecifico && <div style={{ color: '#666' }}>{selectedRichiesta.tipoSpecifico}</div>}
                </div>
                <div>
                  <strong>Priorità:</strong> {getPrioritaBadge(selectedRichiesta.priorita)}
                </div>
                <div>
                  <strong>Paziente:</strong> {selectedRichiesta.pazienteNome}
                </div>
                <div>
                  <strong>Richiedente:</strong> {selectedRichiesta.richiedenteNome}
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <strong>Indirizzo:</strong> {selectedRichiesta.pazienteIndirizzo}
                </div>
              </div>
              {selectedRichiesta.noteRichiedente && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                  <strong>Note richiedente:</strong>
                  <p style={{ margin: '4px 0 0', color: '#666' }}>{selectedRichiesta.noteRichiedente}</p>
                </div>
              )}
            </div>

            <form onSubmit={salvaGestione}>
              {/* Stato */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>Stato *</label>
                <select
                  value={gestioneForm.stato}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setGestioneForm({ ...gestioneForm, stato: e.target.value as StatoRichiesta })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                  required
                >
                  <option value="in_attesa">⏳ In attesa</option>
                  <option value="in_revisione">📝 In revisione</option>
                  <option value="confermata">✅ Confermata</option>
                  <option value="rifiutata">❌ Rifiutata</option>
                  <option value="completata">✔️ Completata</option>
                </select>
              </div>

              {/* Data confermata */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>Data confermata *</label>
                  <input
                    type="date"
                    value={gestioneForm.dataConfermata}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setGestioneForm({ ...gestioneForm, dataConfermata: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                    required={gestioneForm.stato === 'confermata'}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>Orario confermato</label>
                  <input
                    type="time"
                    value={gestioneForm.orarioConfermato}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setGestioneForm({ ...gestioneForm, orarioConfermato: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                  />
                </div>
              </div>

              {/* Assegna operatore */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>Assegna operatore</label>
                <select
                  value={gestioneForm.staffAssegnatoId}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                    setGestioneForm({
                      ...gestioneForm,
                      staffAssegnatoId: e.target.value,
                    });
                  }}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                >
                  <option value="">-- Seleziona operatore --</option>
                  {staff
                    .filter((s: Staff) => !['coordinamento', 'direzione'].includes(s.category || ''))
                    .map((s: Staff) => (
                    <option key={s._id} value={s._id}>
                      {s.firstName} {s.lastName} {s.role ? `(${s.role})` : ''} {s.category ? `[${s.category}]` : ''}
                    </option>
                  ))}
                </select>
                {staff.filter((s: Staff) => !['coordinamento', 'direzione'].includes(s.category || '')).length === 0 && (
                  <p style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '4px' }}>⚠️ Nessun operatore disponibile. Verifica che esistano membri dello staff attivi.</p>
                )}
              </div>

              {/* Note admin */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>
                  Note admin {gestioneForm.stato === 'rifiutata' && '(motivo rifiuto obbligatorio)'}
                </label>
                <textarea
                  value={gestioneForm.noteAdmin}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setGestioneForm({ ...gestioneForm, noteAdmin: e.target.value })}
                  placeholder={gestioneForm.stato === 'rifiutata' ? 'Spiega il motivo del rifiuto...' : 'Note interne...'}
                  rows={3}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', resize: 'vertical' }}
                />
              </div>

              {/* Crea appuntamento */}
              {gestioneForm.stato === 'confermata' && (
                <div style={{ marginBottom: '20px', padding: '12px', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={gestioneForm.creaAppuntamento}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setGestioneForm({ ...gestioneForm, creaAppuntamento: e.target.checked })}
                    />
                    <span>Crea automaticamente l'appuntamento e invia email di conferma</span>
                  </label>
                </div>
              )}

              {/* Azioni */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '14px', background: gestioneForm.stato === 'rifiutata' ? '#dc2626' : '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {gestioneForm.stato === 'rifiutata' ? '❌ Conferma Rifiuto' : '✅ Salva Gestione'}
                </button>
                <button
                  type="button"
                  onClick={() => setGestioneModal(false)}
                  style={{ padding: '14px 24px', background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Annulla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </>}
    </section>
  );
}
