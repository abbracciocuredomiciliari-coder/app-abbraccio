import { useEffect, useRef, useState } from 'react';

import { useParams } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

import api from '../api/api';

import { VoiceRecorder } from '../components/VoiceRecorder';
import { ChatWidget } from '../components/ChatWidget';
import { ReportGenerator } from '../components/ReportGenerator';
import FirmaCanvas from '../components/FirmaCanvas';

import {

  CheckCircle, LogIn, LogOut, BookOpen, Activity,

  Target, Plus, ChevronDown, ChevronUp, AlertCircle, Trash2, PenLine, Lock,

  Paperclip, FileText, Image, File, ExternalLink, MessageCircle, Shield

} from 'lucide-react';



interface WorkPlanInfo {

  _id: string; task: string; type: string; category: string;

  date: string; time?: string; notes?: string; status: string;

  patient: { _id: string; firstName: string; lastName: string; allergie?: string; caregiverRiferimento?: string; caregiverTelefono?: string; diagnosiAmmissione?: string; };

  staff: { firstName: string; lastName: string; role: string };

}

interface AccessoInfo { _id: string; oraEntrata: string; oraUscita?: string; note?: string; staffName: string; }

interface DiarioEntry {

  _id: string; testo: string; dataRegistrazione: string; staffName: string;

  firmaLogin: string; firmato: boolean; dataFirma?: string;

  parametriVitali?: { pressioneSistolica?: number; pressioneDiastolica?: number; frequenzaCardiaca?: number; frequenzaRespiratoria?: number; temperatura?: number; saturazione?: number; glicemia?: number; peso?: number; dolore?: number; };

  scaleValutazione?: { braden?: number; barthel?: number; conley?: number; bradenLivello?: string; barthelLivello?: string; conleyLivello?: string; };

  terapiaFarmacologica?: Array<{ farmaco: string; dosaggio: string; mattina?: boolean; pomeriggio?: boolean; sera?: boolean; notte?: boolean; }>;

}

interface AllegatoInfo { _id: string; nomeFile: string; mimeType: string; dimensione: number; descrizione?: string; caricatoDa: string; dataCaricamento: string; urlCloudinary?: string; }

interface Obiettivo {

  _id: string; descrizione: string; stato: 'attivo' | 'raggiunto' | 'parziale' | 'non_raggiunto' | 'rivalutato';

  dataInizio: string; dataRivalutazione?: string; createdBy: string;

  valutazioni: Array<{ _id: string; data: string; stato: string; note?: string; valutatoDa: string; }>;

}



const statoObiettivoConfig: Record<string, { label: string; color: string; bg: string }> = {

  attivo:        { label: 'Attivo',         color: '#2563eb', bg: '#eff6ff' },

  raggiunto:     { label: 'Raggiunto ✓',    color: '#16a34a', bg: '#f0fdf4' },

  parziale:      { label: 'Parzialmente',   color: '#d97706', bg: '#fefce8' },

  non_raggiunto: { label: 'Non raggiunto',  color: '#dc2626', bg: '#fef2f2' },

  rivalutato:    { label: 'Rivalutato 🔄',  color: '#7c3aed', bg: '#fdf4ff' },

};



// Assicura che API_BASE termini sempre con /api

const _rawBase = import.meta.env.VITE_API_BASE_URL || 'https://api.abbracciocuredomiciliari.it/api';

const API_BASE = _rawBase.endsWith('/api') ? _rawBase : _rawBase.replace(/\/$/, '') + '/api';



export default function WorkPlanAccessPage() {

  const { workPlanId } = useParams<{ workPlanId: string }>();

  const { user } = useAuth();

  const fileInputRef = useRef<HTMLInputElement>(null);



  const [now, setNow] = useState(new Date());

  const [workPlan, setWorkPlan] = useState<WorkPlanInfo | null>(null);

  const [accessoCorrente, setAccessoCorrente] = useState<AccessoInfo | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');

  const [success, setSuccess] = useState('');



  // Diario

  const [diario, setDiario] = useState<DiarioEntry[]>([]);

  const [showDiario, setShowDiario] = useState(false);
  const [diarioDaFirmare, setDiarioDaFirmare] = useState<string | null>(null);
  const [firmaDiarioGrafometrica, setFirmaDiarioGrafometrica] = useState('');

  const [testoDiario, setTestoDiario] = useState('');

  const [showParametri, setShowParametri] = useState(false);

  const [parametri, setParametri] = useState({ pressioneSistolica: '', pressioneDiastolica: '', frequenzaCardiaca: '', frequenzaRespiratoria: '', temperatura: '', saturazione: '', glicemia: '', peso: '', dolore: '' });

  // Scale di valutazione
  const [showScale, setShowScale] = useState(false);
  const [scale, setScale] = useState({ braden: '', barthel: '', conley: '' });

  // Terapia farmacologica
  const [showTerapia, setShowTerapia] = useState(false);
  const [terapia, setTerapia] = useState<Array<{ farmaco: string; dosaggio: string; mattina: boolean; pomeriggio: boolean; sera: boolean; notte: boolean }>>([]);



  // Allegati

  const [allegati, setAllegati] = useState<AllegatoInfo[]>([]);

  const [showAllegati, setShowAllegati] = useState(false);

  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [uploadDescrizione, setUploadDescrizione] = useState('');

  const [uploadLoading, setUploadLoading] = useState(false);



  // Obiettivi

  const [obiettivi, setObiettivi] = useState<Obiettivo[]>([]);

  const [showObiettivi, setShowObiettivi] = useState(false);

  const [valutazioneObiettivo, setValutazioneObiettivo] = useState<{ id: string; stato: string; note: string; dataRivalutazione: string } | null>(null);

  const [nuovoObiettivo, setNuovoObiettivo] = useState('');

  const [nuovaDataRivalutazione, setNuovaDataRivalutazione] = useState('');

  const [showNuovoObiettivo, setShowNuovoObiettivo] = useState(false);

  // Chat, relazione e consenso
  const [showChat, setShowChat] = useState(false);
  const [showConsenso, setShowConsenso] = useState(false);
  const [consensoFirmato, setConsensoFirmato] = useState(false);
  const [nomeConsenso, setNomeConsenso] = useState('');
  const [cognomeConsenso, setCognomeConsenso] = useState('');
  const [firmaConsenso, setFirmaConsenso] = useState('');
  const [savingConsenso, setSavingConsenso] = useState(false);
  const [showConsensoPrestazione, setShowConsensoPrestazione] = useState(false);
  const [consensoPrestazioneFirmato, setConsensoPrestazioneFirmato] = useState(false);
  const [nomeConsensoPrestazione, setNomeConsensoPrestazione] = useState('');
  const [cognomeConsensoPrestazione, setCognomeConsensoPrestazione] = useState('');
  const [ruoloConsensoPrestazione, setRuoloConsensoPrestazione] = useState<'paziente' | 'caregiver' | 'tutore' | 'rappresentanteLegale'>('paziente');
  const [firmaConsensoPrestazione, setFirmaConsensoPrestazione] = useState('');
  const [accettaPrestazione, setAccettaPrestazione] = useState(false);
  const [accettaRischi, setAccettaRischi] = useState(false);
  const [savingConsensoPrestazione, setSavingConsensoPrestazione] = useState(false);
  const [consensoPrestazione, setConsensoPrestazione] = useState<any>(null);

  const isAdminOrCoord = user?.role === 'admin' || user?.role === 'coordinator';

  const canDelete = user?.role === 'admin' || user?.role === 'direttore';

  const canDeleteAllegato = user?.role === 'admin' || user?.role === 'direttore' || user?.role === 'coordinator';



  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  useEffect(() => { if (workPlanId) loadAll(); }, [workPlanId]);



  const loadAll = async () => {

    setLoading(true);

    try {

      const [wpRes, diarioRes, obiettiviRes, allegatiRes] = await Promise.all([

        api.get(`/workplan-access/piano/${workPlanId}/info`),

        api.get(`/diario/${workPlanId}`),

        api.get(`/obiettivi/${workPlanId}`),

        api.get(`/allegati/${workPlanId}`),

      ]);

      setWorkPlan(wpRes.data.workPlan);

      setAccessoCorrente(wpRes.data.accessoApertoUtente || null);

      const patientId = wpRes.data.workPlan?.patient?._id;
      if (patientId) {
        try {
          const [consensoRes, consensoPrestazioneRes] = await Promise.allSettled([
            api.get(`/gdpr/consenso/${patientId}`),
            api.get(`/gdpr/consenso-prestazione/${patientId}`),
          ]);
          setConsensoFirmato(consensoRes.status === 'fulfilled' && !!consensoRes.value.data?.consensoAttivo);
          if (consensoPrestazioneRes.status === 'fulfilled') {
            setConsensoPrestazioneFirmato(!!consensoPrestazioneRes.value.data?.consensoAttivo);
            setConsensoPrestazione(consensoPrestazioneRes.value.data?.consenso || null);
          } else {
            setConsensoPrestazioneFirmato(false);
            setConsensoPrestazione(null);
          }
        } catch {
          setConsensoFirmato(false);
          setConsensoPrestazioneFirmato(false);
          setConsensoPrestazione(null);
        }
      }

      setDiario(diarioRes.data);

      setObiettivi(obiettiviRes.data);

      setAllegati(allegatiRes.data);

    } catch (err: any) {

      setError(err.response?.data?.message || 'Errore nel caricamento');

    } finally {

      setLoading(false);

    }

  };



  const registraEntrata = async () => {

    try {

      const res = await api.post(`/workplan-access/${workPlanId}/entrata`);

      setAccessoCorrente(res.data);

      setSuccess('✅ Entrata registrata!');

      setTimeout(() => setSuccess(''), 3000);

    } catch (err: any) { setError(err.response?.data?.message || 'Errore entrata'); }

  };



  const registraUscita = async () => {

    if (!accessoCorrente) return;

    try {

      await api.patch(`/workplan-access/${accessoCorrente._id}/uscita`);

      setAccessoCorrente(null);

      setSuccess('✅ Uscita registrata!');

      setTimeout(() => setSuccess(''), 3000);

      await loadAll();

    } catch (err: any) { setError(err.response?.data?.message || 'Errore uscita'); }

  };



  const salvaConsensoGDPR = async () => {
    const patientId = workPlan?.patient._id;
    if (!patientId) return;
    if (!nomeConsenso.trim() || !cognomeConsenso.trim() || !firmaConsenso) {
      setError('Inserire nome, cognome e firma del firmatario');
      return;
    }
    setSavingConsenso(true);
    setError('');
    try {
      await api.post('/gdpr/consenso', {
        patientId,
        finalita: { prestazioneSanitaria: true, auditInterno: true, fatturazione: true, ricercaScientifica: false },
        modalita: { informatico: true, cartaceo: true, telefonico: true },
        datiSensibili: { datiSanitari: true, datiEconomici: false, immagini: true },
        comunicazioneTerzi: { mediciSpecialisti: true, struttureSanitarie: true, familiari: false, assicurazioni: false },
        firmatoDa: 'paziente',
        nomeFirmatario: nomeConsenso.trim(),
        cognomeFirmatario: cognomeConsenso.trim(),
        versioneInformativa: 'v2025.1',
        firmaDigitale: firmaConsenso,
      });
      setConsensoFirmato(true);
      setShowConsenso(false);
      setSuccess('Consenso GDPR firmato e archiviato');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore salvataggio consenso');
    } finally {
      setSavingConsenso(false);
    }
  };

  const salvaConsensoPrestazione = async () => {
    const patientId = workPlan?.patient._id;
    if (!patientId) return;
    if (!nomeConsensoPrestazione.trim() || !cognomeConsensoPrestazione.trim() || !firmaConsensoPrestazione) {
      setError('Inserire nome, cognome e firma del firmatario');
      return;
    }
    if (!accettaPrestazione || !accettaRischi) {
      setError('È necessario confermare sia la prestazione sanitaria sia l\'informativa sui rischi');
      return;
    }
    setSavingConsensoPrestazione(true);
    setError('');
    try {
      const res = await api.post('/gdpr/consenso-prestazione', {
        patientId,
        firmatoDa: ruoloConsensoPrestazione,
        nomeFirmatario: nomeConsensoPrestazione.trim(),
        cognomeFirmatario: cognomeConsensoPrestazione.trim(),
        relazioneConPaziente: ruoloConsensoPrestazione === 'paziente' ? 'Paziente' : ruoloConsensoPrestazione,
        prestazioneSanitaria: accettaPrestazione,
        rischiTrattamento: accettaRischi,
        firmaDigitale: firmaConsensoPrestazione,
      });
      setConsensoPrestazioneFirmato(true);
      setConsensoPrestazione(res.data.consenso);
      setShowConsensoPrestazione(false);
      setSuccess('Consenso alla prestazione sanitaria firmato e archiviato');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore salvataggio consenso alla prestazione');
    } finally {
      setSavingConsensoPrestazione(false);
    }
  };

  const esportaConsensoPrestazionePDF = () => {
    if (!workPlan || !consensoPrestazione) return;
    const dataFirma = new Date(consensoPrestazione.dataFirma).toLocaleDateString('it-IT');
    const nomePaziente = `${workPlan.patient.firstName} ${workPlan.patient.lastName}`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Consenso prestazione sanitaria - ${nomePaziente}</title><style>body{font-family:Arial,sans-serif;color:#1f2937;line-height:1.5;padding:32px;max-width:800px;margin:auto}h1{font-size:20px;color:#1e4d8c;text-align:center}h2{font-size:15px;color:#1e4d8c;margin-top:24px}.box{border:1px solid #bfdbfe;background:#eff6ff;border-radius:8px;padding:14px;margin:16px 0}.firma{max-width:260px;max-height:120px;border-bottom:1px solid #374151}footer{font-size:11px;color:#64748b;margin-top:28px;border-top:1px solid #cbd5e1;padding-top:12px}@media print{body{padding:16px}}</style></head><body><h1>CONSENSO INFORMATO ALLA PRESTAZIONE SANITARIA E AI RISCHI DEL TRATTAMENTO</h1><p style="text-align:center">Abbraccio Cure Domiciliari</p><div class="box"><strong>Paziente:</strong> ${nomePaziente}<br><strong>Firmatario:</strong> ${consensoPrestazione.nomeFirmatario} ${consensoPrestazione.cognomeFirmatario} (${consensoPrestazione.firmatoDa})<br><strong>Data firma:</strong> ${dataFirma}</div><h2>Informativa</h2><p>Il sottoscritto dichiara di aver ricevuto informazioni chiare e comprensibili sulle prestazioni sanitarie e assistenziali erogate da Abbraccio Cure Domiciliari e dai suoi operatori incaricati.</p><p>Dichiara inoltre di essere stato informato che le prestazioni sono svolte nel rispetto delle procedure aziendali, delle competenze professionali degli operatori e delle condizioni cliniche rilevate al momento dell'intervento.</p><h2>Rischi e limitazioni</h2><p>Il firmatario prende atto che ogni prestazione sanitaria può comportare rischi prevedibili connessi alle condizioni cliniche, alla risposta individuale al trattamento e alle attività assistenziali eseguite al domicilio. L'operatore informa tempestivamente il paziente o il caregiver di eventuali anomalie e, quando necessario, attiva il medico o i servizi di emergenza.</p><div class="box"><strong>☑ Prestazione sanitaria:</strong> consenso espresso.<br><strong>☑ Informativa sui rischi:</strong> presa visione e accettata.</div><h2>Firma del firmatario</h2><img class="firma" src="${consensoPrestazione.firmaDigitale}" alt="Firma digitale"><p>${consensoPrestazione.nomeFirmatario} ${consensoPrestazione.cognomeFirmatario}</p><footer>Documento archiviato digitalmente. Versione v2026.1 — Generato il ${new Date().toLocaleDateString('it-IT')}</footer><script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
    win.focus();
  };

  const salvaDiario = async () => {

    if (!testoDiario.trim()) return;

    try {

      const parametriVitali: Record<string, number> = {};

      Object.entries(parametri).forEach(([k, v]) => { if (v !== '') parametriVitali[k] = parseFloat(v); });

      const scaleValutazione: Record<string, any> = {};

      if (scale.braden !== '') scaleValutazione['braden'] = parseInt(scale.braden);

      if (scale.barthel !== '') scaleValutazione['barthel'] = parseInt(scale.barthel);

      if (scale.conley !== '') scaleValutazione['conley'] = parseInt(scale.conley);

      // Calcola livelli

      if (scaleValutazione['braden'] !== undefined) {

        const b = scaleValutazione['braden'];

        scaleValutazione['bradenLivello'] = b <= 9 ? 'Rischio molto alto' : b <= 12 ? 'Rischio alto' : b <= 14 ? 'Rischio moderato' : b <= 18 ? 'Rischio basso' : 'Nessun rischio';

      }

      if (scaleValutazione['barthel'] !== undefined) {

        const v = scaleValutazione['barthel'];

        scaleValutazione['barthelLivello'] = v === 100 ? 'Indipendente' : v >= 75 ? 'Dipendenza minima' : v >= 50 ? 'Dipendenza moderata' : v >= 25 ? 'Dipendenza severa' : 'Totalmente dipendente';

      }

      if (scaleValutazione['conley'] !== undefined) {

        scaleValutazione['conleyLivello'] = scaleValutazione['conley'] >= 2 ? 'Rischio cadute' : 'Basso rischio';

      }

      await api.post(`/diario/${workPlanId}`, {

        testo: testoDiario,

        parametriVitali: Object.keys(parametriVitali).length > 0 ? parametriVitali : undefined,

        scaleValutazione: Object.keys(scaleValutazione).length > 0 ? scaleValutazione : undefined,

        terapiaFarmacologica: terapia.filter(f => f.farmaco.trim()).length > 0 ? terapia.filter(f => f.farmaco.trim()) : undefined,

        workPlanAccess: accessoCorrente?._id

      });

      setTestoDiario('');

      setParametri({ pressioneSistolica: '', pressioneDiastolica: '', frequenzaCardiaca: '', frequenzaRespiratoria: '', temperatura: '', saturazione: '', glicemia: '', peso: '', dolore: '' });

      setScale({ braden: '', barthel: '', conley: '' });

      setTerapia([]);

      setShowParametri(false);

      setShowScale(false);

      setShowTerapia(false);

      setSuccess('📝 Voce diario salvata!');

      setTimeout(() => setSuccess(''), 3000);

      const res = await api.get(`/diario/${workPlanId}`);

      setDiario(res.data);

    } catch (err: any) { setError(err.response?.data?.message || 'Errore salvataggio diario'); }

  };



  const firmaDiario = async () => {
    if (!diarioDaFirmare || !firmaDiarioGrafometrica) return;
    try {
      const res = await api.post(`/diario/firma/${diarioDaFirmare}`, { firmaGrafometrica: firmaDiarioGrafometrica });
      setDiario(prev => prev.map(d => d._id === diarioDaFirmare ? { ...d, firmato: true, dataFirma: res.data.entry?.dataFirma } : d));
      setDiarioDaFirmare(null);
      setFirmaDiarioGrafometrica('');
      setSuccess('✍️ Voce firmata e bloccata!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) { setError(err.response?.data?.message || 'Errore firma'); }
  };



  const eliminaDiario = async (id: string) => {

    if (!confirm('Eliminare questa voce del diario?')) return;

    try {

      await api.delete(`/diario/entry/${id}`);

      setDiario(prev => prev.filter(d => d._id !== id));

    } catch (err: any) { setError(err.response?.data?.message || 'Errore eliminazione'); }

  };



  // Allegati

  const caricaFile = async () => {

    if (!uploadFile) return;

    setUploadLoading(true);

    try {

      const formData = new FormData();

      formData.append('file', uploadFile);

      if (uploadDescrizione.trim()) formData.append('descrizione', uploadDescrizione.trim());

      const res = await api.post(`/allegati/${workPlanId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

      setAllegati(prev => [res.data, ...prev]);

      setUploadFile(null);

      setUploadDescrizione('');

      if (fileInputRef.current) fileInputRef.current.value = '';

      setSuccess('📎 File allegato con successo!');

      setTimeout(() => setSuccess(''), 3000);

    } catch (err: any) { setError(err.response?.data?.message || 'Errore caricamento file'); }

    finally { setUploadLoading(false); }

  };



  const eliminaAllegato = async (id: string) => {

    if (!confirm('Eliminare questo allegato?')) return;

    try {

      await api.delete(`/allegati/${id}`);

      setAllegati(prev => prev.filter(a => a._id !== id));

    } catch (err: any) { setError(err.response?.data?.message || 'Errore eliminazione allegato'); }

  };



  const apriAllegato = (allegato: AllegatoInfo) => {

    // Se l'allegato è su Cloudinary, apri direttamente l'URL (nessun token necessario)

    if (allegato.urlCloudinary) {

      window.open(allegato.urlCloudinary, '_blank');

      return;

    }

    // Fallback: usa l'endpoint backend con token (storage locale)

    const token = localStorage.getItem('authToken');

    if (!token) {

      alert('Sessione scaduta. Effettua nuovamente il login.');

      return;

    }

    window.open(`${API_BASE}/allegati/file/${allegato._id}?token=${encodeURIComponent(token)}`, '_blank');

  };



  const formatDimensione = (bytes: number) => {

    if (bytes < 1024) return `${bytes} B`;

    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  };



  const getFileIcon = (mimeType: string) => {

    if (mimeType.startsWith('image/')) return <Image size={16} color="#0284c7" />;

    if (mimeType === 'application/pdf') return <FileText size={16} color="#dc2626" />;

    return <File size={16} color="#6b7280" />;

  };



  // Obiettivi

  const valutaObiettivo = async () => {

    if (!valutazioneObiettivo) return;

    try {

      await api.post(`/obiettivi/valuta/${valutazioneObiettivo.id}`, { stato: valutazioneObiettivo.stato, note: valutazioneObiettivo.note, dataRivalutazione: valutazioneObiettivo.dataRivalutazione || undefined });

      setValutazioneObiettivo(null);

      setSuccess('🎯 Obiettivo valutato!');

      setTimeout(() => setSuccess(''), 3000);

      const res = await api.get(`/obiettivi/${workPlanId}`);

      setObiettivi(res.data);

    } catch (err: any) { setError(err.response?.data?.message || 'Errore valutazione'); }

  };



  const aggiungiObiettivo = async () => {

    if (!nuovoObiettivo.trim()) return;

    try {

      await api.post(`/obiettivi/${workPlanId}`, { descrizione: nuovoObiettivo, dataRivalutazione: nuovaDataRivalutazione || undefined });

      setNuovoObiettivo(''); setNuovaDataRivalutazione(''); setShowNuovoObiettivo(false);

      setSuccess('🎯 Obiettivo aggiunto!');

      setTimeout(() => setSuccess(''), 3000);

      const res = await api.get(`/obiettivi/${workPlanId}`);

      setObiettivi(res.data);

    } catch (err: any) { setError(err.response?.data?.message || 'Errore aggiunta obiettivo'); }

  };



  const formatOra = (d: string) => new Date(d).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  const formatDataOra = (d: string) => new Date(d).toLocaleString('it-IT');

  const calcolaDurata = (e: string, u?: string) => {

    const min = Math.round(((u ? new Date(u) : new Date()).getTime() - new Date(e).getTime()) / 60000);

    return min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}min` : `${min}min`;

  };



  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '16px' }}><div style={{ fontSize: '2rem' }}>⏳</div><p style={{ color: '#666' }}>Caricamento...</p></div>;

  if (!workPlan) return <div style={{ padding: '32px', textAlign: 'center' }}><AlertCircle size={48} color="#dc2626" /><p style={{ color: '#dc2626', marginTop: '16px' }}>Piano di lavoro non trovato.</p></div>;



  return (

    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '20px 16px', fontFamily: 'system-ui, sans-serif' }}>



      {/* Header */}

      <div style={{ backgroundColor: '#1e40af', color: 'white', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>

          <div>

            <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '4px' }}>Piano di lavoro</div>

            <h2 style={{ margin: '0 0 4px', fontSize: '1.2rem' }}>{workPlan.task}</h2>

            <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>👤 {workPlan.patient.firstName} {workPlan.patient.lastName}</div>

            <div style={{ fontSize: '0.82rem', opacity: 0.75, marginTop: '2px' }}>🏥 {workPlan.staff.firstName} {workPlan.staff.lastName} — {workPlan.staff.role}</div>

            {workPlan.patient.allergie && <div style={{ marginTop: '6px', background: 'rgba(239,68,68,0.2)', borderRadius: '6px', padding: '4px 10px', fontSize: '0.78rem', fontWeight: '700', color: '#fecaca' }}>⚠️ ALLERGIE: {workPlan.patient.allergie}</div>}

            {workPlan.patient.caregiverRiferimento && <div style={{ marginTop: '4px', fontSize: '0.78rem', opacity: 0.8 }}>👤 Caregiver: {workPlan.patient.caregiverRiferimento}{workPlan.patient.caregiverTelefono ? ` — 📞 ${workPlan.patient.caregiverTelefono}` : ''}</div>}

          </div>

          <div style={{ textAlign: 'right' }}>

            <div style={{ fontSize: '1.6rem', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>{now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>

            <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{now.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' })}</div>

          </div>

        </div>

      </div>

      {/* Azioni rapide */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
        <button
          onClick={() => setShowChat(true)}
          style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <MessageCircle size={18} /> Chat coord./ufficio
        </button>
        {workPlan.patient._id && (
          <div style={{ display: 'contents' }}>
            <ReportGenerator patientId={workPlan.patient._id} patientName={`${workPlan.patient.firstName} ${workPlan.patient.lastName}`} />
          </div>
        )}
      </div>

      {/* Consenso GDPR */}
      {!consensoFirmato ? (
        <button
          onClick={() => setShowConsenso(true)}
          style={{ width: '100%', marginBottom: '16px', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <Shield size={18} /> Firma consenso GDPR
        </button>
      ) : (
        <div style={{ marginBottom: '16px', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <CheckCircle size={18} /> Consenso GDPR firmato
        </div>
      )}

      {/* Consenso alla prestazione sanitaria */}
      {!consensoPrestazioneFirmato ? (
        <button
          onClick={() => setShowConsensoPrestazione(true)}
          style={{ width: '100%', marginBottom: '16px', background: '#fff7ed', color: '#9a3412', border: '1px solid #fdba74', borderRadius: '10px', padding: '12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <FileText size={18} /> Firma consenso prestazione e rischi
        </button>
      ) : (
        <div style={{ marginBottom: '16px', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle size={18} /> Consenso prestazione firmato</span>
          <button onClick={esportaConsensoPrestazionePDF} style={{ background: '#166534', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontWeight: 600 }}>Esporta PDF</button>
        </div>
      )}

      {/* Messaggi */}

      {success && <div style={{ padding: '12px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#16a34a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle size={18} /> {success}</div>}

      {error && <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertCircle size={18} /> {error}<button type="button" onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>✕</button></div>}



      {/* Accesso in corso */}

      {accessoCorrente && (

        <div style={{ padding: '14px 16px', backgroundColor: '#f0fdf4', border: '2px solid #86efac', borderRadius: '10px', marginBottom: '16px' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', fontWeight: '600', marginBottom: '4px' }}>

            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#16a34a' }} /> Accesso in corso

          </div>

          <div style={{ fontSize: '0.88rem', color: '#555' }}>Entrata: <strong>{formatOra(accessoCorrente.oraEntrata)}</strong> — Durata: <strong>{calcolaDurata(accessoCorrente.oraEntrata)}</strong></div>

        </div>

      )}



      {/* Pulsanti entrata/uscita */}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>

        <button type="button" onClick={registraEntrata} disabled={!!accessoCorrente} style={{ padding: '16px', borderRadius: '10px', border: 'none', cursor: accessoCorrente ? 'not-allowed' : 'pointer', backgroundColor: accessoCorrente ? '#d1fae5' : '#16a34a', color: 'white', fontWeight: '700', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: accessoCorrente ? 0.6 : 1 }}>

          <LogIn size={20} /> ENTRATA

        </button>

        <button type="button" onClick={registraUscita} disabled={!accessoCorrente} style={{ padding: '16px', borderRadius: '10px', border: 'none', cursor: !accessoCorrente ? 'not-allowed' : 'pointer', backgroundColor: !accessoCorrente ? '#fee2e2' : '#dc2626', color: 'white', fontWeight: '700', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: !accessoCorrente ? 0.6 : 1 }}>

          <LogOut size={20} /> USCITA

        </button>

      </div>



      {/* ===== OBIETTIVI ===== */}

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', marginBottom: '16px', overflow: 'hidden' }}>

        <button type="button" onClick={() => setShowObiettivi(!showObiettivi)} style={{ width: '100%', padding: '14px 16px', background: '#fdf4ff', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '600', color: '#7c3aed', fontSize: '0.95rem' }}>

          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

            <Target size={18} /> Obiettivi ({obiettivi.length})

            {obiettivi.filter(o => o.dataRivalutazione && new Date(o.dataRivalutazione) <= new Date() && o.stato === 'attivo').length > 0 && (

              <span style={{ backgroundColor: '#dc2626', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>

                {obiettivi.filter(o => o.dataRivalutazione && new Date(o.dataRivalutazione) <= new Date() && o.stato === 'attivo').length}

              </span>

            )}

          </span>

          {showObiettivi ? <ChevronUp size={18} /> : <ChevronDown size={18} />}

        </button>

        {showObiettivi && (

          <div style={{ padding: '16px' }}>

            {isAdminOrCoord && (

              <div style={{ marginBottom: '16px' }}>

                {!showNuovoObiettivo ? (

                  <button type="button" onClick={() => setShowNuovoObiettivo(true)} style={{ background: '#7c3aed', padding: '8px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '6px', border: 'none', color: 'white', cursor: 'pointer' }}><Plus size={15} /> Nuovo obiettivo</button>

                ) : (

                  <div style={{ padding: '12px', backgroundColor: '#fdf4ff', borderRadius: '8px', border: '1px solid #e9d5ff' }}>

                    <textarea value={nuovoObiettivo} onChange={e => setNuovoObiettivo(e.target.value)} placeholder="Descrivi l'obiettivo..." rows={2} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box' }} />

                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>

                      <label style={{ fontSize: '0.82rem', color: '#666', display: 'flex', alignItems: 'center', gap: '4px' }}>Data rivalutazione: <input type="date" value={nuovaDataRivalutazione} onChange={e => setNuovaDataRivalutazione(e.target.value)} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.82rem' }} /></label>

                      <button type="button" onClick={aggiungiObiettivo} style={{ background: '#7c3aed', padding: '6px 14px', fontSize: '0.85rem', borderRadius: '6px', border: 'none', color: 'white', cursor: 'pointer' }}>Salva</button>

                      <button type="button" onClick={() => setShowNuovoObiettivo(false)} style={{ background: '#6c757d', padding: '6px 14px', fontSize: '0.85rem', borderRadius: '6px', border: 'none', color: 'white', cursor: 'pointer' }}>Annulla</button>

                    </div>

                  </div>

                )}

              </div>

            )}

            {obiettivi.length === 0 ? <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', padding: '16px' }}>Nessun obiettivo definito.</p> : (

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                {obiettivi.map(ob => {

                  const cfg = statoObiettivoConfig[ob.stato] || statoObiettivoConfig.attivo;

                  const scaduto = ob.dataRivalutazione && new Date(ob.dataRivalutazione) <= new Date() && ob.stato === 'attivo';

                  return (

                    <div key={ob._id} style={{ padding: '12px', borderRadius: '8px', border: `1px solid ${scaduto ? '#fca5a5' : '#e5e7eb'}`, backgroundColor: scaduto ? '#fff5f5' : '#fafafa' }}>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>

                        <div style={{ flex: 1 }}>

                          <p style={{ margin: '0 0 6px', fontWeight: '600', fontSize: '0.9rem' }}>{ob.descrizione}</p>

                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>

                            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', backgroundColor: cfg.bg, color: cfg.color, fontWeight: '600' }}>{cfg.label}</span>

                            {ob.dataRivalutazione && <span style={{ fontSize: '0.75rem', color: scaduto ? '#dc2626' : '#666' }}>🗓️ {new Date(ob.dataRivalutazione).toLocaleDateString('it-IT')}{scaduto && ' ⚠️'}</span>}

                            <span style={{ fontSize: '0.72rem', color: '#999' }}>da {ob.createdBy}</span>

                          </div>

                        </div>

                        <button type="button" onClick={() => setValutazioneObiettivo({ id: ob._id, stato: ob.stato, note: '', dataRivalutazione: '' })} style={{ background: '#7c3aed', padding: '6px 10px', fontSize: '0.78rem', borderRadius: '6px', border: 'none', color: 'white', cursor: 'pointer', whiteSpace: 'nowrap' }}>Valuta</button>

                      </div>

                      {valutazioneObiettivo?.id === ob._id && (

                        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f5f3ff', borderRadius: '6px', border: '1px solid #ddd6fe' }}>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>

                            <label style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>Stato

                              <select value={valutazioneObiettivo.stato} onChange={e => setValutazioneObiettivo({ ...valutazioneObiettivo, stato: e.target.value })} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.82rem' }}>

                                <option value="attivo">Attivo</option><option value="raggiunto">Raggiunto</option><option value="parziale">Parzialmente raggiunto</option><option value="non_raggiunto">Non raggiunto</option><option value="rivalutato">Rivalutato</option>

                              </select>

                            </label>

                            {valutazioneObiettivo.stato === 'rivalutato' && <label style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>Nuova data<input type="date" value={valutazioneObiettivo.dataRivalutazione} onChange={e => setValutazioneObiettivo({ ...valutazioneObiettivo, dataRivalutazione: e.target.value })} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.82rem' }} /></label>}

                          </div>

                          <textarea value={valutazioneObiettivo.note} onChange={e => setValutazioneObiettivo({ ...valutazioneObiettivo, note: e.target.value })} placeholder="Note..." rows={2} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.82rem', resize: 'vertical', boxSizing: 'border-box', marginBottom: '8px' }} />

                          <div style={{ display: 'flex', gap: '6px' }}>

                            <button type="button" onClick={valutaObiettivo} style={{ background: '#7c3aed', padding: '6px 12px', fontSize: '0.82rem', borderRadius: '4px', border: 'none', color: 'white', cursor: 'pointer' }}>Conferma</button>

                            <button type="button" onClick={() => setValutazioneObiettivo(null)} style={{ background: '#6c757d', padding: '6px 12px', fontSize: '0.82rem', borderRadius: '4px', border: 'none', color: 'white', cursor: 'pointer' }}>Annulla</button>

                          </div>

                        </div>

                      )}

                      {ob.valutazioni.length > 0 && (

                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>

                          <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '4px' }}>Storico:</div>

                          {ob.valutazioni.slice(-3).map(v => (

                            <div key={v._id} style={{ fontSize: '0.78rem', color: '#555', padding: '2px 0' }}>

                              <span style={{ color: statoObiettivoConfig[v.stato]?.color || '#666', fontWeight: '600' }}>{statoObiettivoConfig[v.stato]?.label || v.stato}</span>

                              {' — '}{new Date(v.data).toLocaleDateString('it-IT')} da {v.valutatoDa}{v.note && <span style={{ fontStyle: 'italic' }}> — {v.note}</span>}

                            </div>

                          ))}

                        </div>

                      )}

                    </div>

                  );

                })}

              </div>

            )}

          </div>

        )}

      </div>



      {/* ===== DIARIO CLINICO ===== */}

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', marginBottom: '16px', overflow: 'hidden' }}>

        <button type="button" onClick={() => setShowDiario(!showDiario)} style={{ width: '100%', padding: '14px 16px', background: '#f0f9ff', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '600', color: '#0284c7', fontSize: '0.95rem' }}>

          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><BookOpen size={18} /> Diario Clinico ({diario.length})</span>

          {showDiario ? <ChevronUp size={18} /> : <ChevronDown size={18} />}

        </button>

        {showDiario && (

          <div style={{ padding: '16px' }}>

            <div style={{ marginBottom: '16px', padding: '14px', backgroundColor: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>

              <VoiceRecorder
                workPlanId={workPlanId!}
                onResult={data => {
                  setTestoDiario(prev => (prev ? `${prev.trim()}\n\n${data.testo}`.trim() : data.testo));
                  if (data.parametriVitali) {
                    setParametri(prev => ({
                      ...prev,
                      ...Object.fromEntries(
                        Object.entries(data.parametriVitali!).map(([k, v]) => [k, String(v)])
                      ),
                    }));
                  }
                  if (data.scaleValutazione) {
                    setScale(prev => ({
                      ...prev,
                      ...Object.fromEntries(
                        Object.entries(data.scaleValutazione!).map(([k, v]) => [k, String(v)])
                      ),
                    }));
                    setShowScale(true);
                  }
                  if (data.terapiaFarmacologica?.length) {
                    setTerapia(data.terapiaFarmacologica.map(item => ({
                      farmaco: item.farmaco,
                      dosaggio: item.dosaggio || '',
                      mattina: !!item.mattina,
                      pomeriggio: !!item.pomeriggio,
                      sera: !!item.sera,
                      notte: !!item.notte,
                    })));
                    setShowTerapia(true);
                  }
                }}
              />

              <textarea value={testoDiario} onChange={e => setTestoDiario(e.target.value)} placeholder="Descrivi l'intervento, le osservazioni cliniche..." rows={4} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #bae6fd', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box', marginBottom: '10px', marginTop: '10px' }} />

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>

                <button type="button" onClick={() => setShowParametri(!showParametri)} style={{ background: 'none', border: '1px solid #0284c7', color: '#0284c7', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>

                  <Activity size={14} /> {showParametri ? 'Nascondi parametri' : '📊 Parametri vitali'}

                </button>

                <button type="button" onClick={() => setShowScale(!showScale)} style={{ background: 'none', border: '1px solid #7c3aed', color: '#7c3aed', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>

                  🧮 {showScale ? 'Nascondi scale' : 'Scale valutazione'}

                </button>

                <button type="button" onClick={() => { setShowTerapia(!showTerapia); if (!showTerapia && terapia.length === 0) setTerapia([{ farmaco: '', dosaggio: '', mattina: false, pomeriggio: false, sera: false, notte: false }]); }} style={{ background: 'none', border: '1px solid #059669', color: '#059669', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>

                  💊 {showTerapia ? 'Nascondi terapia' : 'Terapia farmacologica'}

                </button>

              </div>

              {showParametri && (

                <div style={{ marginTop: '8px', padding: '12px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd', marginBottom: '8px' }}>

                  <div style={{ fontWeight: '600', fontSize: '0.8rem', color: '#0284c7', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}><Activity size={13} /> Parametri Vitali</div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>

                    {[['pressioneSistolica','P. Sistolica (mmHg)','120'],['pressioneDiastolica','P. Diastolica (mmHg)','80'],['frequenzaCardiaca','Freq. Cardiaca (bpm)','72'],['frequenzaRespiratoria','Freq. Resp. (/min)','16'],['temperatura','Temp. (°C)','36.5'],['saturazione','SpO₂ (%)','98'],['glicemia','Glicemia (mg/dL)','95'],['peso','Peso (kg)','70']].map(([key, label, ph]) => (

                      <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.8rem', color: '#555' }}>{label}

                        <input type="number" step="0.1" value={parametri[key as keyof typeof parametri]} onChange={e => setParametri(prev => ({ ...prev, [key]: e.target.value }))} placeholder={`es. ${ph}`} style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #bae6fd', fontSize: '0.85rem' }} />

                      </label>

                    ))}

                  </div>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.8rem', color: '#555' }}>Dolore NRS (0-10)

                    <input type="range" min="0" max="10" value={parametri.dolore || '0'} onChange={e => setParametri(prev => ({ ...prev, dolore: e.target.value }))} style={{ width: '100%' }} />

                    <span style={{ textAlign: 'center', fontWeight: '600', color: parseInt(parametri.dolore || '0') >= 7 ? '#dc2626' : parseInt(parametri.dolore || '0') >= 4 ? '#d97706' : '#16a34a' }}>{parametri.dolore || '0'}/10 — {parseInt(parametri.dolore||'0')===0?'Assente':parseInt(parametri.dolore||'0')<=3?'Lieve':parseInt(parametri.dolore||'0')<=6?'Moderato':'Severo'}</span>

                  </label>

                </div>

              )}

              {showScale && (

                <div style={{ marginTop: '8px', padding: '12px', background: '#fdf4ff', borderRadius: '8px', border: '1px solid #e9d5ff', marginBottom: '8px' }}>

                  <div style={{ fontWeight: '600', fontSize: '0.8rem', color: '#7c3aed', marginBottom: '10px' }}>🧮 Scale di Valutazione Multidimensionale</div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>

                    <div style={{ background: 'white', padding: '10px', borderRadius: '6px', border: '1px solid #e9d5ff' }}>

                      <div style={{ fontWeight: '600', fontSize: '0.78rem', color: '#374151', marginBottom: '6px' }}>BRADEN — Rischio lesioni da pressione (6-23, &lt;18 = rischio)</div>

                      <input type="number" min="6" max="23" value={scale.braden} onChange={e => setScale(prev => ({ ...prev, braden: e.target.value }))} placeholder="es. 16" style={{ width: '100%', padding: '7px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' }} />

                      {scale.braden && <div style={{ fontSize: '0.75rem', marginTop: '4px', color: parseInt(scale.braden)<=12?'#dc2626':parseInt(scale.braden)<=18?'#d97706':'#16a34a', fontWeight:'600' }}>

                        → {parseInt(scale.braden)<=9?'⚠️ Rischio molto alto':parseInt(scale.braden)<=12?'⚠️ Rischio alto':parseInt(scale.braden)<=14?'🟡 Rischio moderato':parseInt(scale.braden)<=18?'🟢 Rischio basso':'✅ Nessun rischio'}

                      </div>}

                    </div>

                    <div style={{ background: 'white', padding: '10px', borderRadius: '6px', border: '1px solid #e9d5ff' }}>

                      <div style={{ fontWeight: '600', fontSize: '0.78rem', color: '#374151', marginBottom: '6px' }}>BARTHEL — Autonomia ADL (0-100)</div>

                      <input type="number" min="0" max="100" step="5" value={scale.barthel} onChange={e => setScale(prev => ({ ...prev, barthel: e.target.value }))} placeholder="es. 75" style={{ width: '100%', padding: '7px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' }} />

                      {scale.barthel && <div style={{ fontSize: '0.75rem', marginTop: '4px', color: parseInt(scale.barthel)<=25?'#dc2626':parseInt(scale.barthel)<=50?'#d97706':parseInt(scale.barthel)<=75?'#ca8a04':'#16a34a', fontWeight:'600' }}>

                        → {parseInt(scale.barthel)===100?'✅ Indipendente':parseInt(scale.barthel)>=75?'🟢 Dipendenza minima':parseInt(scale.barthel)>=50?'🟡 Dipendenza moderata':parseInt(scale.barthel)>=25?'🟠 Dipendenza severa':'⚠️ Totalmente dipendente'}

                      </div>}

                    </div>

                    <div style={{ background: 'white', padding: '10px', borderRadius: '6px', border: '1px solid #e9d5ff' }}>

                      <div style={{ fontWeight: '600', fontSize: '0.78rem', color: '#374151', marginBottom: '6px' }}>CONLEY — Rischio cadute (0-8, ≥2 = rischio)</div>

                      <input type="number" min="0" max="8" value={scale.conley} onChange={e => setScale(prev => ({ ...prev, conley: e.target.value }))} placeholder="es. 1" style={{ width: '100%', padding: '7px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' }} />

                      {scale.conley && <div style={{ fontSize: '0.75rem', marginTop: '4px', color: parseInt(scale.conley)>=2?'#dc2626':'#16a34a', fontWeight:'600' }}>

                        → {parseInt(scale.conley)>=2?'⚠️ Rischio cadute':'✅ Basso rischio'}

                      </div>}

                    </div>

                  </div>

                </div>

              )}

              {showTerapia && (

                <div style={{ marginTop: '8px', padding: '12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac', marginBottom: '8px' }}>

                  <div style={{ fontWeight: '600', fontSize: '0.8rem', color: '#059669', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

                    💊 Terapia Farmacologica

                    <button type="button" onClick={() => setTerapia(prev => [...prev, { farmaco: '', dosaggio: '', mattina: false, pomeriggio: false, sera: false, notte: false }])} style={{ background: '#059669', color: 'white', border: 'none', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '0.75rem' }}>+ Farmaco</button>

                  </div>

                  {terapia.map((f, i) => (

                    <div key={i} style={{ background: 'white', padding: '10px', borderRadius: '6px', border: '1px solid #86efac', marginBottom: '8px' }}>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '6px' }}>

                        <input type="text" placeholder="Farmaco" value={f.farmaco} onChange={e => setTerapia(prev => prev.map((x,j)=>j===i?{...x,farmaco:e.target.value}:x))} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.85rem' }} />

                        <input type="text" placeholder="Dosaggio (es. 10mg)" value={f.dosaggio} onChange={e => setTerapia(prev => prev.map((x,j)=>j===i?{...x,dosaggio:e.target.value}:x))} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.85rem' }} />

                      </div>

                      <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>

                        {(['mattina','pomeriggio','sera','notte'] as const).map(t => (

                          <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>

                            <input type="checkbox" checked={f[t]} onChange={e => setTerapia(prev => prev.map((x,j)=>j===i?{...x,[t]:e.target.checked}:x))} />

                            {t.charAt(0).toUpperCase()+t.slice(1)}

                          </label>

                        ))}

                        <button type="button" onClick={() => setTerapia(prev => prev.filter((_,j)=>j!==i))} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.78rem' }}>✕ Rimuovi</button>

                      </div>

                    </div>

                  ))}

                </div>

              )}

              <button type="button" onClick={salvaDiario} disabled={!testoDiario.trim()} style={{ marginTop: '12px', width: '100%', padding: '12px', backgroundColor: testoDiario.trim() ? '#0284c7' : '#93c5fd', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: testoDiario.trim() ? 'pointer' : 'not-allowed', fontSize: '0.95rem' }}>💾 Salva nel diario clinico</button>

            </div>

            {diario.length === 0 ? <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', padding: '16px' }}>Nessuna voce nel diario.</p> : (

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                {diario.map(entry => (

                  <div key={entry._id} style={{ padding: '12px', borderRadius: '8px', border: `1px solid ${entry.firmato ? '#86efac' : '#e5e7eb'}`, backgroundColor: entry.firmato ? '#f0fdf4' : '#fafafa' }}>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>

                      <div style={{ fontSize: '0.78rem', color: '#888', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>

                        📅 {formatDataOra(entry.dataRegistrazione)} — ✍️ {entry.staffName}

                        {entry.firmato && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', backgroundColor: '#dcfce7', color: '#16a34a', padding: '1px 6px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: '600' }}><Lock size={10} /> Firmato {entry.dataFirma ? new Date(entry.dataFirma).toLocaleDateString('it-IT') : ''}</span>}

                      </div>

                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>

                        {!entry.firmato && <button type="button" onClick={() => setDiarioDaFirmare(entry._id)} style={{ background: 'none', border: '1px solid #16a34a', cursor: 'pointer', color: '#16a34a', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '3px' }}><PenLine size={12} /> Firma con dito/penna</button>}

                        {!entry.firmato && <button type="button" onClick={() => eliminaDiario(entry._id)} title="Elimina voce non firmata" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '2px', fontWeight: 700 }}>✕</button>}

                      </div>

                    </div>

                    <p style={{ margin: '0 0 8px', fontSize: '0.9rem', color: '#333', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{entry.testo}</p>

                    {entry.parametriVitali && Object.values(entry.parametriVitali).some(v => v !== undefined && v !== null) && (

                      <div style={{ padding: '8px', backgroundColor: '#f0f9ff', borderRadius: '6px', border: '1px solid #bae6fd', marginBottom: '6px' }}>

                        <div style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: '600', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><Activity size={12} /> Parametri vitali</div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>

                          {entry.parametriVitali.pressioneSistolica && entry.parametriVitali.pressioneDiastolica && <span style={{ fontSize: '0.78rem', backgroundColor: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bae6fd' }}>🩺 {entry.parametriVitali.pressioneSistolica}/{entry.parametriVitali.pressioneDiastolica} mmHg</span>}

                          {entry.parametriVitali.frequenzaCardiaca && <span style={{ fontSize: '0.78rem', backgroundColor: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bae6fd' }}>❤️ {entry.parametriVitali.frequenzaCardiaca} bpm</span>}

                          {entry.parametriVitali.frequenzaRespiratoria && <span style={{ fontSize: '0.78rem', backgroundColor: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bae6fd' }}>🫁 {entry.parametriVitali.frequenzaRespiratoria} /min</span>}

                          {entry.parametriVitali.temperatura && <span style={{ fontSize: '0.78rem', backgroundColor: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bae6fd' }}>🌡️ {entry.parametriVitali.temperatura}°C</span>}

                          {entry.parametriVitali.saturazione && <span style={{ fontSize: '0.78rem', backgroundColor: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bae6fd' }}>💨 SpO₂ {entry.parametriVitali.saturazione}%</span>}

                          {entry.parametriVitali.glicemia && <span style={{ fontSize: '0.78rem', backgroundColor: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bae6fd' }}>🩸 {entry.parametriVitali.glicemia} mg/dL</span>}

                          {entry.parametriVitali.peso && <span style={{ fontSize: '0.78rem', backgroundColor: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bae6fd' }}>⚖️ {entry.parametriVitali.peso} kg</span>}

                          {entry.parametriVitali.dolore !== undefined && <span style={{ fontSize: '0.78rem', backgroundColor: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bae6fd', color: entry.parametriVitali.dolore >= 7 ? '#dc2626' : entry.parametriVitali.dolore >= 4 ? '#d97706' : '#16a34a' }}>😣 Dolore: {entry.parametriVitali.dolore}/10</span>}

                        </div>

                      </div>

                    )}

                    {entry.scaleValutazione && (entry.scaleValutazione.braden !== undefined || entry.scaleValutazione.barthel !== undefined || entry.scaleValutazione.conley !== undefined) && (

                      <div style={{ padding: '8px', backgroundColor: '#fdf4ff', borderRadius: '6px', border: '1px solid #e9d5ff', marginBottom: '6px' }}>

                        <div style={{ fontSize: '0.75rem', color: '#7c3aed', fontWeight: '600', marginBottom: '4px' }}>🧮 Scale di Valutazione</div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>

                          {entry.scaleValutazione.braden !== undefined && <span style={{ fontSize: '0.78rem', backgroundColor: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #e9d5ff' }}>BRADEN: {entry.scaleValutazione.braden} {entry.scaleValutazione.bradenLivello && `— ${entry.scaleValutazione.bradenLivello}`}</span>}

                          {entry.scaleValutazione.barthel !== undefined && <span style={{ fontSize: '0.78rem', backgroundColor: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #e9d5ff' }}>BARTHEL: {entry.scaleValutazione.barthel} {entry.scaleValutazione.barthelLivello && `— ${entry.scaleValutazione.barthelLivello}`}</span>}

                          {entry.scaleValutazione.conley !== undefined && <span style={{ fontSize: '0.78rem', backgroundColor: 'white', padding: '2px 8px', borderRadius: '4px', border: '1px solid #e9d5ff', color: entry.scaleValutazione.conley >= 2 ? '#dc2626' : '#374151' }}>CONLEY: {entry.scaleValutazione.conley} {entry.scaleValutazione.conleyLivello && `— ${entry.scaleValutazione.conleyLivello}`}</span>}

                        </div>

                      </div>

                    )}

                    {entry.terapiaFarmacologica && entry.terapiaFarmacologica.length > 0 && (

                      <div style={{ padding: '8px', backgroundColor: '#f0fdf4', borderRadius: '6px', border: '1px solid #86efac' }}>

                        <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: '600', marginBottom: '4px' }}>💊 Terapia Farmacologica</div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>

                          {entry.terapiaFarmacologica.map((f, i) => (

                            <div key={i} style={{ fontSize: '0.78rem', backgroundColor: 'white', padding: '4px 8px', borderRadius: '4px', border: '1px solid #86efac', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>

                              <span><strong>{f.farmaco}</strong> — {f.dosaggio}</span>

                              <span style={{ color: '#6b7280', fontSize: '0.74rem' }}>{[f.mattina&&'M',f.pomeriggio&&'P',f.sera&&'S',f.notte&&'N'].filter(Boolean).join('-') || '—'}</span>

                            </div>

                          ))}

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



      {/* ===== ALLEGATI — sempre visibili, integrati nel flusso ===== */}

      <div style={{ border: '2px solid #fed7aa', borderRadius: '10px', marginBottom: '16px', overflow: 'hidden', backgroundColor: '#fffbf7' }}>

        <div style={{ padding: '12px 16px', backgroundColor: '#fff7ed', borderBottom: '1px solid #fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          <span style={{ fontWeight: '700', color: '#c2410c', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>

            <Paperclip size={18} /> Allegati cartella ({allegati.length})

          </span>

          <button type="button" onClick={() => setShowAllegati(!showAllegati)} style={{ background: 'none', border: '1px solid #fed7aa', borderRadius: '6px', cursor: 'pointer', color: '#c2410c', padding: '4px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>

            {showAllegati ? <><ChevronUp size={14} /> Nascondi</> : <><ChevronDown size={14} /> Mostra</>}

          </button>

        </div>



        {/* Form upload — sempre visibile */}

        <div style={{ padding: '12px 16px', borderBottom: allegati.length > 0 ? '1px solid #fed7aa' : 'none' }}>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap' }}>

            <div style={{ flex: 1, minWidth: '200px' }}>

              <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={e => setUploadFile(e.target.files?.[0] || null)} style={{ width: '100%', fontSize: '0.85rem', marginBottom: '6px' }} />

              {uploadFile && <div style={{ fontSize: '0.78rem', color: '#c2410c', marginBottom: '4px' }}>📄 {uploadFile.name} ({formatDimensione(uploadFile.size)})</div>}

              <input type="text" value={uploadDescrizione} onChange={e => setUploadDescrizione(e.target.value)} placeholder="Descrizione allegato (opzionale)..." style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #fed7aa', fontSize: '0.85rem', boxSizing: 'border-box' }} />

            </div>

            <button type="button" onClick={caricaFile} disabled={!uploadFile || uploadLoading} style={{ padding: '10px 16px', backgroundColor: uploadFile && !uploadLoading ? '#c2410c' : '#fdba74', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: uploadFile && !uploadLoading ? 'pointer' : 'not-allowed', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', alignSelf: 'flex-end' }}>

              {uploadLoading ? '⏳' : <><Paperclip size={15} /> Allega</>}

            </button>

          </div>

          <div style={{ fontSize: '0.72rem', color: '#999', marginTop: '4px' }}>Immagini, PDF, Word, Excel, testo — max 20 MB</div>

        </div>



        {/* Lista allegati */}

        {allegati.length > 0 && showAllegati && (

          <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>

            {allegati.map(all => (

              <div key={all._id} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #fed7aa', backgroundColor: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>

                <div style={{ flexShrink: 0 }}>{getFileIcon(all.mimeType)}</div>

                <div style={{ flex: 1, minWidth: 0 }}>

                  <div style={{ fontWeight: '600', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{all.nomeFile}</div>

                  <div style={{ fontSize: '0.72rem', color: '#888', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>

                    <span>{formatDimensione(all.dimensione)}</span>

                    <span>📅 {new Date(all.dataCaricamento).toLocaleDateString('it-IT')}</span>

                    <span>👤 {all.caricatoDa}</span>

                    {all.descrizione && <span style={{ fontStyle: 'italic' }}>{all.descrizione}</span>}

                  </div>

                </div>

                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>

                  <button type="button" onClick={() => apriAllegato(all)} style={{ background: '#0284c7', border: 'none', cursor: 'pointer', color: 'white', padding: '5px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem' }}>

                    <ExternalLink size={12} /> Apri

                  </button>

                  {canDeleteAllegato && <button type="button" onClick={() => eliminaAllegato(all._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '5px' }}><Trash2 size={13} /></button>}

                </div>

              </div>

            ))}

          </div>

        )}

        {allegati.length > 0 && !showAllegati && (

          <div style={{ padding: '8px 16px', fontSize: '0.8rem', color: '#c2410c' }}>

            {allegati.length} allegato{allegati.length > 1 ? 'i' : ''} presente{allegati.length > 1 ? 'i' : ''} — clicca "Mostra" per visualizzarli

          </div>

        )}

      </div>



      {/* Note piano */}

      {workPlan.notes && (

        <div style={{ padding: '12px 16px', backgroundColor: '#fefce8', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '0.88rem', color: '#92400e' }}>

          📋 <strong>Note:</strong> {workPlan.notes}

        </div>

      )}

      {/* Modale Chat */}
      {showChat && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }} onClick={() => setShowChat(false)}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Chat con coordinatore / ufficio</h3>
              <button onClick={() => setShowChat(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <ChatWidget scope="general" title="Coordinatore / Ufficio" height="100%" />
            </div>
          </div>
        </div>
      )}

      {diarioDaFirmare && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }} onClick={() => { setDiarioDaFirmare(null); setFirmaDiarioGrafometrica(''); }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '560px', padding: '20px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', color: '#065f46' }}>Firma voce del diario</h3>
            <p style={{ color: '#475569', fontSize: '0.86rem' }}>Firma con il dito o la penna. Alla conferma la voce sarà bloccata definitivamente.</p>
            <FirmaCanvas label="Firma grafometrica dell’operatore" sublabel="Disegna la firma nel riquadro" onFirmaCompleta={setFirmaDiarioGrafometrica} onCancella={() => setFirmaDiarioGrafometrica('')} altezza={160} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => { setDiarioDaFirmare(null); setFirmaDiarioGrafometrica(''); }} style={{ flex: 1, padding: '11px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '7px', cursor: 'pointer' }}>Annulla</button>
              <button type="button" onClick={firmaDiario} disabled={!firmaDiarioGrafometrica} style={{ flex: 2, padding: '11px', background: firmaDiarioGrafometrica ? '#16a34a' : '#bbf7d0', color: 'white', border: 'none', borderRadius: '7px', fontWeight: 700, cursor: firmaDiarioGrafometrica ? 'pointer' : 'not-allowed' }}>Firma e blocca voce</button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Consenso GDPR */}
      {showConsenso && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }} onClick={() => setShowConsenso(false)}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', padding: '20px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', color: '#1e3a5f' }}>Consenso GDPR</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px' }}>
              Il paziente / caregiver firma il consenso al trattamento dei dati per prestazioni sanitarie, fatturazione e finalità interne.
            </p>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Nome firmatario</label>
              <input type="text" value={nomeConsenso} onChange={e => setNomeConsenso(e.target.value)} placeholder="Nome" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Cognome firmatario</label>
              <input type="text" value={cognomeConsenso} onChange={e => setCognomeConsenso(e.target.value)} placeholder="Cognome" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
            </div>

            <FirmaCanvas
              label="Firma del paziente / caregiver"
              sublabel="Firma per accettare l'informativa privacy"
              onFirmaCompleta={(firma) => setFirmaConsenso(firma)}
              onCancella={() => setFirmaConsenso('')}
              altezza={160}
            />

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button onClick={() => setShowConsenso(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#f3f4f6', cursor: 'pointer' }}>Annulla</button>
              <button onClick={salvaConsensoGDPR} disabled={savingConsenso} style={{ flex: 2, padding: '12px', borderRadius: '8px', border: 'none', background: '#16a34a', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
                {savingConsenso ? 'Salvataggio...' : 'Salva consenso'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConsensoPrestazione && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 110, padding: '12px', overflowY: 'auto' }} onClick={() => setShowConsensoPrestazione(false)}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '620px', margin: 'auto', padding: '20px', minHeight: 'min-content' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', color: '#9a3412' }}>Consenso alla prestazione sanitaria e rischi</h3>
            <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.55, marginBottom: '14px' }}>
              Il firmatario dichiara di aver ricevuto informazioni sulle prestazioni sanitarie e assistenziali svolte da Abbraccio Cure Domiciliari e dai suoi operatori incaricati.
            </p>
            <div style={{ padding: '12px', borderRadius: '8px', background: '#fff7ed', border: '1px solid #fed7aa', fontSize: '0.83rem', color: '#7c2d12', lineHeight: 1.5, marginBottom: '16px' }}>
              Le prestazioni sono effettuate secondo le procedure aziendali e le condizioni cliniche rilevate. Possono sussistere rischi prevedibili connessi allo stato di salute, alla risposta individuale al trattamento e alle attività svolte al domicilio. In caso di necessità l'operatore attiva il medico o i servizi di emergenza.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <input type="text" value={nomeConsensoPrestazione} onChange={e => setNomeConsensoPrestazione(e.target.value)} placeholder="Nome firmatario" style={{ padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
              <input type="text" value={cognomeConsensoPrestazione} onChange={e => setCognomeConsensoPrestazione(e.target.value)} placeholder="Cognome firmatario" style={{ padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '5px' }}>Il firmatario è</label>
              <select value={ruoloConsensoPrestazione} onChange={e => setRuoloConsensoPrestazione(e.target.value as typeof ruoloConsensoPrestazione)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
                <option value="paziente">Paziente</option>
                <option value="caregiver">Caregiver</option>
                <option value="tutore">Tutore</option>
                <option value="rappresentanteLegale">Rappresentante legale</option>
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.85rem', marginBottom: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={accettaPrestazione} onChange={e => setAccettaPrestazione(e.target.checked)} style={{ marginTop: '3px' }} />
              Confermo di aver ricevuto informazioni sulla prestazione sanitaria e di acconsentire alla sua esecuzione.
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.85rem', marginBottom: '16px', cursor: 'pointer' }}>
              <input type="checkbox" checked={accettaRischi} onChange={e => setAccettaRischi(e.target.checked)} style={{ marginTop: '3px' }} />
              Dichiaro di aver letto e compreso i rischi e le limitazioni del trattamento descritti sopra.
            </label>

            <FirmaCanvas label="Firma del paziente / firmatario" sublabel="Firmare con il dito sullo schermo" onFirmaCompleta={setFirmaConsensoPrestazione} onCancella={() => setFirmaConsensoPrestazione('')} altezza={160} />
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button onClick={() => setShowConsensoPrestazione(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#f3f4f6', cursor: 'pointer' }}>Annulla</button>
              <button onClick={salvaConsensoPrestazione} disabled={savingConsensoPrestazione} style={{ flex: 2, padding: '12px', borderRadius: '8px', border: 'none', background: '#c2410c', color: 'white', fontWeight: 700, cursor: 'pointer' }}>{savingConsensoPrestazione ? 'Salvataggio...' : 'Firma e archivia consenso'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

}

