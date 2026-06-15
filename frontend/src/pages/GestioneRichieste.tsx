import { useEffect, useState, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { Button } from '../components/ui/Button';
import { Printer } from 'lucide-react';

function apriPDFScheda(s: any) {
  const freq: Record<string, string> = { singola: 'Singola', multipla: 'Multipla', continuata: 'Continuata' };
  const metodo: Record<string, string> = { contanti: 'Contanti', carta_credito: 'Carta di Credito', bonifico: 'Bonifico', altro: 'Altro' };
  const freqPag: Record<string, string> = { giornaliera: 'Giornaliera', settimanale: 'Settimanale', ogni_10_giorni: 'Ogni 10 giorni', mensile: 'Mensile' };
  const dataFirma = s.dataFirma ? new Date(s.dataFirma).toLocaleDateString('it-IT') : new Date(s.createdAt).toLocaleDateString('it-IT');
  const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Scheda Servizi</title>
  <style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:13px;color:#111;margin:30px;max-width:750px}h1{font-size:20px;color:#1e4d8c;margin-bottom:4px;text-align:center}h2{font-size:11px;color:#6b7280;text-align:center;margin:0 0 24px;text-transform:uppercase;letter-spacing:1px}.section{margin-bottom:20px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}.section-title{background:#1e4d8c;color:white;padding:8px 14px;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.5px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:14px}.field label{font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:3px}.field span{font-size:13px;color:#111;font-weight:600}.firma-box{padding:14px;border-top:1px solid #e2e8f0}.firma-box img{max-width:220px;max-height:80px;border:1px solid #d1d5db;display:block;margin-top:8px}.footer{margin-top:24px;font-size:10px;color:#9ca3af;border-top:1px solid #e2e8f0;padding-top:12px;text-align:center}@media print{.no-print{display:none}}</style></head><body>
  <h1>Scheda Servizi Assistenza Domiciliare</h1><h2>Abbraccio Cure Domiciliari</h2>
  <div class="section"><div class="section-title">1. Dati del Paziente</div><div class="grid"><div class="field"><label>Nome e Cognome</label><span>${s.nomeCognomePaziente}</span></div><div class="field"><label>Data di nascita</label><span>${s.dataNascita || '—'}</span></div></div></div>
  <div class="section"><div class="section-title">2. Dettagli della Prestazione</div><div class="grid"><div class="field"><label>Tipo di prestazione</label><span>${s.tipoPrestazione}</span></div><div class="field"><label>Frequenza</label><span>${freq[s.frequenzaPrestazione] || s.frequenzaPrestazione}${s.giorniContinuata ? ` — per ${s.giorniContinuata} giorni` : ''}</span></div><div class="field"><label>Operatore incaricato</label><span>${s.operatoreIncaricato || '—'}</span></div></div></div>
  <div class="section"><div class="section-title">3. Tariffa e Pagamento</div><div class="grid"><div class="field"><label>Costo prestazione</label><span>€ ${Number(s.costoPrestazione || 0).toFixed(2)}${s.ivaPercentuale ? ` + IVA ${s.ivaPercentuale}%` : ''}</span></div><div class="field"><label>Metodo di pagamento</label><span>${metodo[s.metodoPagamento] || s.metodoPagamento}</span></div><div class="field"><label>Frequenza pagamento</label><span>${freqPag[s.frequenzaPagamento] || s.frequenzaPagamento}</span></div><div class="field"><label>Pagamento effettuato</label><span>${s.pagamentoEffettuato ? '✅ Sì' : '❌ No'}</span></div></div><div style="padding:8px 14px;font-size:11px;color:#6b7280;border-top:1px solid #f3f4f6">Intestato a: <strong>Abbraccio Cure Domiciliari</strong></div></div>
  <div class="section"><div class="section-title">Firma del ${s.ruoloFirmatario === 'caregiver' ? 'Caregiver' : 'Paziente'}</div><div class="firma-box"><div class="field"><label>Nome firmatario</label><span>${s.nomeFirmatario} (${s.ruoloFirmatario})</span></div><div class="field" style="margin-top:10px"><label>Data firma</label><span>${dataFirma}</span></div>${s.firmaBase64 ? `<img src="${s.firmaBase64}" alt="Firma" />` : '<p style="color:#9ca3af;font-style:italic">Firma non disponibile</p>'}</div></div>
  ${s.noteAdmin ? `<div class="section"><div class="section-title">Note Amministrazione</div><div style="padding:12px 14px;color:#374151">${s.noteAdmin}</div></div>` : ''}
  <div class="footer">Documento generato — App Abbraccio Cure Domiciliari — ${new Date().toLocaleString('it-IT')}</div>
  <div class="no-print" style="margin-top:24px;text-align:center"><button onclick="window.print()" style="background:#1e4d8c;color:white;border:none;border-radius:8px;padding:12px 28px;font-size:14px;cursor:pointer;font-weight:700">🖨️ Stampa / Salva PDF</button></div>
  </body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (w) w.onload = () => URL.revokeObjectURL(url);
}

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
  const navigate = useNavigate();
  const [richieste, setRichieste] = useState<Richiesta[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tutte' | 'in_attesa' | 'in_revisione' | 'confermata' | 'rifiutata'>('tutte');

  // Richieste registrazione paziente
  const [richiestePaziente, setRichiestePaziente] = useState<RichiestaPaziente[]>([]);
  const [tabPrincipale, setTabPrincipale] = useState<'prenotazioni' | 'pazienti' | 'schede'>('prenotazioni');
  const [approvandoPazId, setApprovandoPazId] = useState<string | null>(null);

  // Schede servizi
  const [schedeServizi, setSchedeServizi] = useState<any[]>([]);
  const [pazientiList, setPazientiList] = useState<{_id: string; firstName: string; lastName: string}[]>([]);
  const [schedaSelezionata, setSchedaSelezionata] = useState<any | null>(null);
  const [schedaNoteAdmin, setSchedaNoteAdmin] = useState('');
  const [schedaPazienteId, setSchedaPazienteId] = useState('');
  const [schedaAzione, setSchedaAzione] = useState<'accetta' | 'archivia' | null>(null);
  const [schedaSaving, setSchedaSaving] = useState(false);
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
      const [richiesteRes, staffRes, pazienteRes, schedeRes, pazientiRes] = await Promise.allSettled([
        api.get('/richieste-prenotazioni'),
        api.get('/staff', { params: { active: 'true' } }),
        api.get('/richieste-paziente'),
        api.get('/scheda-servizio'),
        api.get('/patients'),
      ]);
      setRichieste(richiesteRes.status === 'fulfilled' ? (richiesteRes.value.data || []) : []);
      setStaff(staffRes.status === 'fulfilled' ? (staffRes.value.data || []) : []);
      setRichiestePaziente(pazienteRes.status === 'fulfilled' ? (pazienteRes.value.data || []) : []);
      setSchedeServizi(schedeRes.status === 'fulfilled' ? (schedeRes.value.data || []) : []);
      setPazientiList(pazientiRes.status === 'fulfilled' ? (pazientiRes.value.data || []) : []);
      if (staffRes.status === 'rejected') console.error('Errore caricamento staff:', staffRes.reason);
      if (schedeRes.status === 'rejected') console.warn('Schede servizi non disponibili:', (schedeRes as any).reason?.message);
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
      const pazienteId = res.data.pazienteId || res.data.paziente?._id;
      await caricaDati();
      if (pazienteId) {
        navigate(`/centro-prenotazioni?pazienteId=${pazienteId}&apriPiano=true`);
      }
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

  const cancellaRegistrazionePaziente = async (id: string) => {
    if (!confirm('Sei sicuro di voler cancellare questa richiesta di registrazione? Questa azione non è reversibile.')) return;
    try {
      await api.delete(`/richieste-paziente/${id}`);
      await caricaDati();
      alert('✅ Richiesta di registrazione paziente cancellata');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore durante la cancellazione');
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
        <button type="button" onClick={() => setTabPrincipale('schede')}
          style={{ flex: 1, padding: '9px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '0.88rem', background: tabPrincipale === 'schede' ? 'white' : 'transparent', color: tabPrincipale === 'schede' ? '#0369a1' : '#6b7280', boxShadow: tabPrincipale === 'schede' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
          📄 Schede Servizi ({schedeServizi.filter(s => s.stato === 'inviata').length} nuove)
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
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => approvaRegistrazionePaziente(rp._id)}
                          disabled={approvandoPazId === rp._id}
                          style={{ background: '#15803d', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', opacity: approvandoPazId === rp._id ? 0.6 : 1 }}>
                          {approvandoPazId === rp._id ? '⏳...' : '✅ Approva e crea paziente'}
                        </button>
                        <button type="button" onClick={() => rifiutaRegistrazionePaziente(rp._id)}
                          style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>
                          ❌ Rifiuta
                        </button>
                        <button type="button" onClick={() => cancellaRegistrazionePaziente(rp._id)}
                          style={{ background: '#6b7280', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>
                          🗑️ Cancella
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

      {/* ═══ SEZIONE SCHEDE SERVIZI ═══ */}
      {tabPrincipale === 'schede' && (
        <div>
          {/* Modale dettaglio/azione scheda */}
          {schedaSelezionata && schedaAzione && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <div style={{ background: 'white', borderRadius: '16px', padding: '28px', maxWidth: '580px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                <h3 style={{ margin: '0 0 20px', color: '#1e3a5f', fontSize: '1.2rem' }}>
                  {schedaAzione === 'accetta' ? '✅ Accetta scheda' : '📁 Archivia nella documentazione paziente'}
                </h3>

                {/* Pulsante PDF */}
                <div style={{ marginBottom: '16px', textAlign: 'right' }}>
                  <button
                    onClick={async () => {
                      try {
                        const res = await api.get(`/scheda-servizio/${schedaSelezionata._id}`);
                        apriPDFScheda(res.data);
                      } catch { alert('Errore nel recupero della scheda'); }
                    }}
                    style={{ background: '#0369a1', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Printer size={15} /> Visualizza / Stampa PDF
                  </button>
                </div>

                {/* Riepilogo scheda */}
                <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', marginBottom: '18px', fontSize: '0.88rem', color: '#374151' }}>
                  <div><strong>Paziente:</strong> {schedaSelezionata.nomeCognomePaziente}</div>
                  <div><strong>Prestazione:</strong> {schedaSelezionata.tipoPrestazione}</div>
                  <div><strong>Costo:</strong> €{Number(schedaSelezionata.costoPrestazione).toFixed(2)}{schedaSelezionata.ivaPercentuale ? ` + IVA ${schedaSelezionata.ivaPercentuale}%` : ''}</div>
                  <div><strong>Frequenza:</strong> {schedaSelezionata.frequenzaPrestazione}{schedaSelezionata.giorniContinuata ? ` — ${schedaSelezionata.giorniContinuata} giorni` : ''}</div>
                  <div><strong>Pagamento:</strong> {schedaSelezionata.metodoPagamento?.replace('_', ' ')} — {schedaSelezionata.frequenzaPagamento?.replace(/_/g, ' ')}</div>
                  <div><strong>Firmato da:</strong> {schedaSelezionata.nomeFirmatario} ({schedaSelezionata.ruoloFirmatario})</div>
                  {schedaSelezionata.firmaBase64 && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '4px' }}>Firma:</div>
                      <img src={schedaSelezionata.firmaBase64} alt="Firma" style={{ maxWidth: '200px', border: '1px solid #d1d5db', borderRadius: '6px' }} />
                    </div>
                  )}
                </div>

                {schedaAzione === 'archivia' && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: '0.88rem', color: '#374151', marginBottom: '6px' }}>
                      Seleziona paziente in cui archiviare *
                    </label>
                    <select
                      value={schedaPazienteId || (schedaSelezionata.pazienteId?._id || schedaSelezionata.pazienteId || '')}
                      onChange={e => setSchedaPazienteId(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem' }}
                    >
                      <option value="">— Seleziona paziente —</option>
                      {pazientiList.map(p => (
                        <option key={p._id} value={p._id}>{p.firstName} {p.lastName}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.88rem', color: '#374151', marginBottom: '6px' }}>Note admin (opzionale)</label>
                  <textarea
                    value={schedaNoteAdmin}
                    onChange={e => setSchedaNoteAdmin(e.target.value)}
                    rows={3}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box' }}
                    placeholder="Note interne..."
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => { setSchedaSelezionata(null); setSchedaAzione(null); setSchedaNoteAdmin(''); setSchedaPazienteId(''); }}
                    style={{ flex: 1, background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', padding: '12px', cursor: 'pointer', fontWeight: 700 }}>
                    Annulla
                  </button>
                  <button
                    disabled={schedaSaving || (schedaAzione === 'archivia' && !schedaPazienteId && !schedaSelezionata.pazienteId)}
                    onClick={async () => {
                      setSchedaSaving(true);
                      try {
                        if (schedaAzione === 'accetta') {
                          await api.patch(`/scheda-servizio/${schedaSelezionata._id}/accetta`, { noteAdmin: schedaNoteAdmin });
                        } else {
                          const pazId = schedaPazienteId || schedaSelezionata.pazienteId?._id || schedaSelezionata.pazienteId;
                          await api.patch(`/scheda-servizio/${schedaSelezionata._id}/archivia`, { pazienteId: pazId, noteAdmin: schedaNoteAdmin });
                        }
                        setSchedaSelezionata(null); setSchedaAzione(null); setSchedaNoteAdmin(''); setSchedaPazienteId('');
                        await caricaDati();
                      } catch (err: any) {
                        alert(err?.response?.data?.message || 'Errore');
                      }
                      setSchedaSaving(false);
                    }}
                    style={{ flex: 2, background: schedaAzione === 'archivia' ? '#0369a1' : '#15803d', color: 'white', border: 'none', borderRadius: '8px', padding: '12px', cursor: 'pointer', fontWeight: 700, opacity: schedaSaving ? 0.7 : 1 }}>
                    {schedaSaving ? '⏳ Salvataggio...' : schedaAzione === 'archivia' ? '📁 Archivia' : '✅ Accetta'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Lista schede */}
          {schedeServizi.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📄</div>
              Nessuna scheda servizi ricevuta
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {schedeServizi.map(s => {
                const statoStyle: Record<string, { bg: string; color: string; label: string }> = {
                  inviata:    { bg: '#fff7ed', color: '#c2410c', label: '⏳ Inviata' },
                  accettata:  { bg: '#f0fdf4', color: '#15803d', label: '✅ Accettata' },
                  archiviata: { bg: '#eff6ff', color: '#1d4ed8', label: '📁 Archiviata' },
                  rifiutata:  { bg: '#fef2f2', color: '#dc2626', label: '❌ Rifiutata' },
                };
                const cfg = statoStyle[s.stato] || { bg: '#f3f4f6', color: '#374151', label: s.stato };
                return (
                  <div key={s._id} style={{ background: 'white', borderRadius: '12px', padding: '16px 20px', border: `2px solid ${s.stato === 'inviata' ? '#fcd34d' : '#e2e8f0'}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ flex: 1, minWidth: '260px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '1rem', color: '#1e293b' }}>{s.nomeCognomePaziente}</strong>
                          <span style={{ background: cfg.bg, color: cfg.color, padding: '2px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700 }}>{cfg.label}</span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#555', display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '4px' }}>
                          <span>🏥 {s.tipoPrestazione}</span>
                          <span>💶 €{Number(s.costoPrestazione).toFixed(2)}</span>
                          <span>📅 {new Date(s.createdAt).toLocaleDateString('it-IT')}</span>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>
                          Firmato da: <strong>{s.nomeFirmatario}</strong> ({s.ruoloFirmatario}) — {s.metodoPagamento?.replace('_', ' ')} / {s.frequenzaPagamento?.replace(/_/g, ' ')}
                        </div>
                        {s.noteAdmin && <div style={{ fontSize: '0.8rem', color: '#7c3aed', marginTop: '4px' }}>📝 Note: {s.noteAdmin}</div>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                        {s.stato === 'inviata' && (
                          <>
                            <button onClick={() => { setSchedaSelezionata(s); setSchedaAzione('accetta'); setSchedaNoteAdmin(''); setSchedaPazienteId(''); }}
                              style={{ background: '#15803d', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
                              ✅ Accetta
                            </button>
                            <button onClick={() => { setSchedaSelezionata(s); setSchedaAzione('archivia'); setSchedaNoteAdmin(''); setSchedaPazienteId(s.pazienteId?._id || s.pazienteId || ''); }}
                              style={{ background: '#0369a1', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
                              📁 Archivia
                            </button>
                            <button onClick={async () => { if (!confirm('Rifiutare questa scheda?')) return; await api.patch(`/scheda-servizio/${s._id}/rifiuta`); await caricaDati(); }}
                              style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
                              ❌ Rifiuta
                            </button>
                          </>
                        )}
                        {s.stato === 'accettata' && (
                          <button onClick={() => { setSchedaSelezionata(s); setSchedaAzione('archivia'); setSchedaNoteAdmin(''); setSchedaPazienteId(s.pazienteId?._id || s.pazienteId || ''); }}
                            style={{ background: '#0369a1', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
                            📁 Archivia nella doc paziente
                          </button>
                        )}
                        {s.stato === 'archiviata' && s.documentoArchiviatoId && (
                          <span style={{ fontSize: '0.78rem', color: '#0369a1', background: '#eff6ff', padding: '4px 10px', borderRadius: '8px', fontWeight: 600 }}>
                            ✓ Nella cartella del paziente
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
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
