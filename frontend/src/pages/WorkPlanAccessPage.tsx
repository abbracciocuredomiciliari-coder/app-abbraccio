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

  const [primoAccesso, setPrimoAccesso] = useState(false);

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

      setPrimoAccesso((wpRes.data.accessi || []).length === 0);

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

    if (primoAccesso && (!consensoFirmato || !consensoPrestazioneFirmato)) {
      const msg = 'Prima di registrare l\'entrata devi far firmare il consenso GDPR e il consenso alla prestazione sanitaria.';
      window.alert(msg);
      setError(msg);
      return;
    }

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



  if (loading) return <div className="tw-flex tw-justify-center tw-items-center tw-h-screen tw-flex-col tw-gap-4"><div className="tw-text-2xl">⏳</div><p className="tw-text-slate-500">Caricamento...</p></div>;

  if (!workPlan) return <div className="tw-p-8 tw-text-center"><AlertCircle size={48} color="#dc2626" /><p className="tw-text-red-600 tw-mt-4">Piano di lavoro non trovato.</p></div>;



  return (

    <div className="tw-max-w-[680px] tw-mx-auto tw-px-4 tw-py-5 tw-font-sans">



      {/* Header */}

      <div className="tw-bg-blue-800 tw-text-white tw-rounded-xl tw-p-5 tw-mb-4">

        <div className="tw-flex tw-justify-between tw-items-start">

          <div>

            <div className="tw-text-[0.8rem] tw-opacity-80 tw-mb-1">Piano di lavoro</div>

            <h2 className="tw-m-0 tw-mb-1 tw-text-[1.2rem]">{workPlan.task}</h2>

            <div className="tw-text-[0.9rem] tw-opacity-90">👤 {workPlan.patient.firstName} {workPlan.patient.lastName}</div>

            <div className="tw-text-[0.82rem] tw-opacity-75 tw-mt-0.5">🏥 {workPlan.staff.firstName} {workPlan.staff.lastName} — {workPlan.staff.role}</div>

            {workPlan.patient.allergie && <div className="tw-mt-1.5 tw-bg-red-500/20 tw-rounded-md tw-px-2.5 tw-py-1 tw-text-[0.78rem] tw-font-bold tw-text-red-200">⚠️ ALLERGIE: {workPlan.patient.allergie}</div>}

            {workPlan.patient.caregiverRiferimento && <div className="tw-mt-1 tw-text-[0.78rem] tw-opacity-80">👤 Caregiver: {workPlan.patient.caregiverRiferimento}{workPlan.patient.caregiverTelefono ? ` — 📞 ${workPlan.patient.caregiverTelefono}` : ''}</div>}

          </div>

          <div className="tw-text-right">

            <div className="tw-text-[1.6rem] tw-font-bold tw-tabular-nums">{now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>

            <div className="tw-text-[0.8rem] tw-opacity-80">{now.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' })}</div>

          </div>

        </div>

      </div>

      {/* Azioni rapide */}
      <div className="tw-grid tw-grid-cols-2 tw-gap-2.5 tw-mb-4">
        <button
          onClick={() => setShowChat(true)}
          className="tw-bg-slate-50 tw-border tw-border-slate-200 tw-rounded-[10px] tw-p-3 tw-cursor-pointer tw-font-semibold tw-text-[0.9rem] tw-text-blue-800 tw-flex tw-items-center tw-justify-center tw-gap-1.5"
        >
          <MessageCircle size={18} /> Chat coord./ufficio
        </button>
        {workPlan.patient._id && (
          <div className="tw-contents">
            <ReportGenerator patientId={workPlan.patient._id} patientName={`${workPlan.patient.firstName} ${workPlan.patient.lastName}`} />
          </div>
        )}
      </div>

      {/* Consenso GDPR */}
      {!consensoFirmato ? (
        <button
          onClick={() => setShowConsenso(true)}
          className="tw-w-full tw-mb-4 tw-bg-red-50 tw-text-red-800 tw-border tw-border-red-200 tw-rounded-[10px] tw-p-3 tw-cursor-pointer tw-font-semibold tw-text-[0.9rem] tw-flex tw-items-center tw-justify-center tw-gap-1.5"
        >
          <Shield size={18} /> Firma consenso GDPR
        </button>
      ) : (
        <div className="tw-mb-4 tw-bg-green-50 tw-text-green-700 tw-border tw-border-green-200 tw-rounded-[10px] tw-p-3 tw-font-semibold tw-text-[0.9rem] tw-flex tw-items-center tw-justify-center tw-gap-1.5">
          <CheckCircle size={18} /> Consenso GDPR firmato
        </div>
      )}

      {/* Consenso alla prestazione sanitaria */}
      {!consensoPrestazioneFirmato ? (
        <button
          onClick={() => setShowConsensoPrestazione(true)}
          className="tw-w-full tw-mb-4 tw-bg-orange-50 tw-text-orange-800 tw-border tw-border-orange-300 tw-rounded-[10px] tw-p-3 tw-cursor-pointer tw-font-semibold tw-text-[0.9rem] tw-flex tw-items-center tw-justify-center tw-gap-1.5"
        >
          <FileText size={18} /> Firma consenso prestazione e rischi
        </button>
      ) : (
        <div className="tw-mb-4 tw-bg-green-50 tw-text-green-700 tw-border tw-border-green-200 tw-rounded-[10px] tw-p-3 tw-font-semibold tw-text-[0.9rem] tw-flex tw-items-center tw-justify-between tw-gap-2">
          <span className="tw-flex tw-items-center tw-gap-1.5"><CheckCircle size={18} /> Consenso prestazione firmato</span>
          <button onClick={esportaConsensoPrestazionePDF} className="tw-bg-green-700 tw-text-white tw-border-0 tw-rounded-md tw-px-2.5 tw-py-1.5 tw-cursor-pointer tw-font-semibold">Esporta PDF</button>
        </div>
      )}

      {/* Messaggi */}

      {success && <div className="tw-px-4 tw-py-3 tw-bg-green-50 tw-border tw-border-green-200 tw-rounded-lg tw-text-green-600 tw-mb-3 tw-flex tw-items-center tw-gap-2"><CheckCircle size={18} /> {success}</div>}

      {error && <div className="tw-px-4 tw-py-3 tw-bg-red-50 tw-border tw-border-red-200 tw-rounded-lg tw-text-red-600 tw-mb-3 tw-flex tw-items-center tw-gap-2"><AlertCircle size={18} /> {error}<button type="button" onClick={() => setError('')} className="tw-ml-auto tw-bg-transparent tw-border-0 tw-cursor-pointer tw-text-red-600">✕</button></div>}



      {/* Accesso in corso */}

      {accessoCorrente && (

        <div className="tw-px-4 tw-py-3.5 tw-bg-green-50 tw-border-2 tw-border-green-300 tw-rounded-[10px] tw-mb-4">

          <div className="tw-flex tw-items-center tw-gap-2 tw-text-green-600 tw-font-semibold tw-mb-1">

            <div className="tw-w-2.5 tw-h-2.5 tw-rounded-full tw-bg-green-600" /> Accesso in corso

          </div>

          <div className="tw-text-[0.88rem] tw-text-slate-600">Entrata: <strong>{formatOra(accessoCorrente.oraEntrata)}</strong> — Durata: <strong>{calcolaDurata(accessoCorrente.oraEntrata)}</strong></div>

        </div>

      )}



      {/* Pulsanti entrata/uscita */}

      <div className="tw-grid tw-grid-cols-2 tw-gap-3 tw-mb-5">

        <button type="button" onClick={registraEntrata} disabled={!!accessoCorrente} className={`tw-p-4 tw-rounded-[10px] tw-border-0 tw-text-white tw-font-bold tw-text-base tw-flex tw-items-center tw-justify-center tw-gap-2 ${accessoCorrente ? 'tw-bg-green-100 tw-cursor-not-allowed tw-opacity-60' : 'tw-bg-green-600 tw-cursor-pointer'}`}>

          <LogIn size={20} /> ENTRATA

        </button>

        <button type="button" onClick={registraUscita} disabled={!accessoCorrente} className={`tw-p-4 tw-rounded-[10px] tw-border-0 tw-text-white tw-font-bold tw-text-base tw-flex tw-items-center tw-justify-center tw-gap-2 ${!accessoCorrente ? 'tw-bg-red-100 tw-cursor-not-allowed tw-opacity-60' : 'tw-bg-red-600 tw-cursor-pointer'}`}>

          <LogOut size={20} /> USCITA

        </button>

      </div>



      {/* ===== OBIETTIVI ===== */}

      <div className="tw-border tw-border-slate-200 tw-rounded-[10px] tw-mb-4 tw-overflow-hidden">

        <button type="button" onClick={() => setShowObiettivi(!showObiettivi)} className="tw-w-full tw-px-4 tw-py-3.5 tw-bg-fuchsia-50 tw-border-0 tw-cursor-pointer tw-flex tw-justify-between tw-items-center tw-font-semibold tw-text-fuchsia-700 tw-text-[0.95rem]">

          <span className="tw-flex tw-items-center tw-gap-2">

            <Target size={18} /> Obiettivi ({obiettivi.length})

            {obiettivi.filter(o => o.dataRivalutazione && new Date(o.dataRivalutazione) <= new Date() && o.stato === 'attivo').length > 0 && (

              <span className="tw-bg-red-600 tw-text-white tw-rounded-full tw-w-5 tw-h-5 tw-flex tw-items-center tw-justify-center tw-text-[0.75rem]">

                {obiettivi.filter(o => o.dataRivalutazione && new Date(o.dataRivalutazione) <= new Date() && o.stato === 'attivo').length}

              </span>

            )}

          </span>

          {showObiettivi ? <ChevronUp size={18} /> : <ChevronDown size={18} />}

        </button>

        {showObiettivi && (

          <div className="tw-p-4">

            {isAdminOrCoord && (

              <div className="tw-mb-4">

                {!showNuovoObiettivo ? (

                  <button type="button" onClick={() => setShowNuovoObiettivo(true)} className="tw-bg-fuchsia-600 tw-px-3.5 tw-py-2 tw-text-[0.85rem] tw-flex tw-items-center tw-gap-1.5 tw-rounded-md tw-border-0 tw-text-white tw-cursor-pointer"><Plus size={15} /> Nuovo obiettivo</button>

                ) : (

                  <div className="tw-p-3 tw-bg-fuchsia-50 tw-rounded-lg tw-border tw-border-fuchsia-200">

                    <textarea value={nuovoObiettivo} onChange={e => setNuovoObiettivo(e.target.value)} placeholder="Descrivi l'obiettivo..." rows={2} className="tw-w-full tw-p-2 tw-rounded-md tw-border tw-border-slate-300 tw-text-[0.9rem] tw-resize-y tw-box-border" />

                    <div className="tw-flex tw-gap-2 tw-mt-2 tw-items-center tw-flex-wrap">

                      <label className="tw-text-[0.82rem] tw-text-slate-500 tw-flex tw-items-center tw-gap-1">Data rivalutazione: <input type="date" value={nuovaDataRivalutazione} onChange={e => setNuovaDataRivalutazione(e.target.value)} className="tw-px-2 tw-py-1 tw-rounded tw-border tw-border-slate-300 tw-text-[0.82rem]" /></label>

                      <button type="button" onClick={aggiungiObiettivo} className="tw-bg-fuchsia-600 tw-px-3.5 tw-py-1.5 tw-text-[0.85rem] tw-rounded-md tw-border-0 tw-text-white tw-cursor-pointer">Salva</button>

                      <button type="button" onClick={() => setShowNuovoObiettivo(false)} className="tw-bg-slate-500 tw-px-3.5 tw-py-1.5 tw-text-[0.85rem] tw-rounded-md tw-border-0 tw-text-white tw-cursor-pointer">Annulla</button>

                    </div>

                  </div>

                )}

              </div>

            )}

            {obiettivi.length === 0 ? <p className="tw-text-slate-500 tw-italic tw-text-center tw-p-4">Nessun obiettivo definito.</p> : (

              <div className="tw-flex tw-flex-col tw-gap-2.5">

                {obiettivi.map(ob => {

                  const cfg = statoObiettivoConfig[ob.stato] || statoObiettivoConfig.attivo;

                  const scaduto = ob.dataRivalutazione && new Date(ob.dataRivalutazione) <= new Date() && ob.stato === 'attivo';

                  return (

                    <div key={ob._id} style={{ padding: '12px', borderRadius: '8px', border: `1px solid ${scaduto ? '#fca5a5' : '#e5e7eb'}`, backgroundColor: scaduto ? '#fff5f5' : '#fafafa' }}>

                      <div className="tw-flex tw-justify-between tw-items-start tw-gap-2">

                        <div className="tw-flex-1">

                          <p className="tw-m-0 tw-mb-1.5 tw-font-semibold tw-text-[0.9rem]">{ob.descrizione}</p>

                          <div className="tw-flex tw-gap-2 tw-flex-wrap tw-items-center">

                            <span className="tw-text-[0.75rem] tw-px-2 tw-py-0.5 tw-rounded-xl tw-font-semibold" style={{ backgroundColor: cfg.bg, color: cfg.color }}>{cfg.label}</span>

                            {ob.dataRivalutazione && <span className="tw-text-[0.75rem]" style={{ color: scaduto ? '#dc2626' : '#666' }}>🗓️ {new Date(ob.dataRivalutazione).toLocaleDateString('it-IT')}{scaduto && ' ⚠️'}</span>}

                            <span className="tw-text-[0.72rem] tw-text-slate-400">da {ob.createdBy}</span>

                          </div>

                        </div>

                        <button type="button" onClick={() => setValutazioneObiettivo({ id: ob._id, stato: ob.stato, note: '', dataRivalutazione: '' })} className="tw-bg-fuchsia-600 tw-px-2.5 tw-py-1.5 tw-text-[0.78rem] tw-rounded-md tw-border-0 tw-text-white tw-cursor-pointer tw-whitespace-nowrap">Valuta</button>

                      </div>

                      {valutazioneObiettivo?.id === ob._id && (

                        <div className="tw-mt-2.5 tw-p-2.5 tw-bg-fuchsia-100/60 tw-rounded-md tw-border tw-border-fuchsia-200">

                          <div className="tw-grid tw-grid-cols-2 tw-gap-2 tw-mb-2">

                            <label className="tw-text-[0.82rem] tw-flex tw-flex-col tw-gap-0.5">Stato

                              <select value={valutazioneObiettivo.stato} onChange={e => setValutazioneObiettivo({ ...valutazioneObiettivo, stato: e.target.value })} className="tw-p-1.5 tw-rounded tw-border tw-border-slate-300 tw-text-[0.82rem]">

                                <option value="attivo">Attivo</option><option value="raggiunto">Raggiunto</option><option value="parziale">Parzialmente raggiunto</option><option value="non_raggiunto">Non raggiunto</option><option value="rivalutato">Rivalutato</option>

                              </select>

                            </label>

                            {valutazioneObiettivo.stato === 'rivalutato' && <label className="tw-text-[0.82rem] tw-flex tw-flex-col tw-gap-0.5">Nuova data<input type="date" value={valutazioneObiettivo.dataRivalutazione} onChange={e => setValutazioneObiettivo({ ...valutazioneObiettivo, dataRivalutazione: e.target.value })} className="tw-p-1.5 tw-rounded tw-border tw-border-slate-300 tw-text-[0.82rem]" /></label>}

                          </div>

                          <textarea value={valutazioneObiettivo.note} onChange={e => setValutazioneObiettivo({ ...valutazioneObiettivo, note: e.target.value })} placeholder="Note..." rows={2} className="tw-w-full tw-p-1.5 tw-rounded tw-border tw-border-slate-300 tw-text-[0.82rem] tw-resize-y tw-box-border tw-mb-2" />

                          <div className="tw-flex tw-gap-1.5">

                            <button type="button" onClick={valutaObiettivo} className="tw-bg-fuchsia-600 tw-px-3 tw-py-1.5 tw-text-[0.82rem] tw-rounded tw-border-0 tw-text-white tw-cursor-pointer">Conferma</button>

                            <button type="button" onClick={() => setValutazioneObiettivo(null)} className="tw-bg-slate-500 tw-px-3 tw-py-1.5 tw-text-[0.82rem] tw-rounded tw-border-0 tw-text-white tw-cursor-pointer">Annulla</button>

                          </div>

                        </div>

                      )}

                      {ob.valutazioni.length > 0 && (

                        <div className="tw-mt-2 tw-pt-2 tw-border-t tw-border-slate-200">

                          <div className="tw-text-[0.75rem] tw-text-slate-500 tw-mb-1">Storico:</div>

                          {ob.valutazioni.slice(-3).map(v => (

                            <div key={v._id} className="tw-text-[0.78rem] tw-text-slate-600 tw-py-0.5">

                              <span className="tw-font-semibold" style={{ color: statoObiettivoConfig[v.stato]?.color || '#666' }}>{statoObiettivoConfig[v.stato]?.label || v.stato}</span>

                              {' — '}{new Date(v.data).toLocaleDateString('it-IT')} da {v.valutatoDa}{v.note && <span className="tw-italic"> — {v.note}</span>}

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

      <div className="tw-border tw-border-slate-200 tw-rounded-[10px] tw-mb-4 tw-overflow-hidden">

        <button type="button" onClick={() => setShowDiario(!showDiario)} className="tw-w-full tw-px-4 tw-py-3.5 tw-bg-sky-50 tw-border-0 tw-cursor-pointer tw-flex tw-justify-between tw-items-center tw-font-semibold tw-text-sky-600 tw-text-[0.95rem]">

          <span className="tw-flex tw-items-center tw-gap-2"><BookOpen size={18} /> Diario Clinico ({diario.length})</span>

          {showDiario ? <ChevronUp size={18} /> : <ChevronDown size={18} />}

        </button>

        {showDiario && (

          <div className="tw-p-4">

            <div className="tw-mb-4 tw-p-3.5 tw-bg-sky-50 tw-rounded-lg tw-border tw-border-sky-200">

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

              <textarea value={testoDiario} onChange={e => setTestoDiario(e.target.value)} placeholder="Descrivi l'intervento, le osservazioni cliniche..." rows={4} className="tw-w-full tw-p-2.5 tw-rounded-md tw-border tw-border-sky-200 tw-text-[0.9rem] tw-resize-y tw-box-border tw-my-2.5" />

              <div className="tw-flex tw-gap-2 tw-flex-wrap tw-mb-2">

                <button type="button" onClick={() => setShowParametri(!showParametri)} className="tw-bg-transparent tw-border tw-border-sky-600 tw-text-sky-600 tw-px-3 tw-py-1.5 tw-rounded-md tw-cursor-pointer tw-text-[0.82rem] tw-flex tw-items-center tw-gap-1.5">

                  <Activity size={14} /> {showParametri ? 'Nascondi parametri' : '📊 Parametri vitali'}

                </button>

                <button type="button" onClick={() => setShowScale(!showScale)} className="tw-bg-transparent tw-border tw-border-fuchsia-600 tw-text-fuchsia-600 tw-px-3 tw-py-1.5 tw-rounded-md tw-cursor-pointer tw-text-[0.82rem] tw-flex tw-items-center tw-gap-1.5">

                  🧮 {showScale ? 'Nascondi scale' : 'Scale valutazione'}

                </button>

                <button type="button" onClick={() => { setShowTerapia(!showTerapia); if (!showTerapia && terapia.length === 0) setTerapia([{ farmaco: '', dosaggio: '', mattina: false, pomeriggio: false, sera: false, notte: false }]); }} className="tw-bg-transparent tw-border tw-border-emerald-600 tw-text-emerald-600 tw-px-3 tw-py-1.5 tw-rounded-md tw-cursor-pointer tw-text-[0.82rem] tw-flex tw-items-center tw-gap-1.5">

                  💊 {showTerapia ? 'Nascondi terapia' : 'Terapia farmacologica'}

                </button>

              </div>

              {showParametri && (

                <div className="tw-mt-2 tw-p-3 tw-bg-sky-50 tw-rounded-lg tw-border tw-border-sky-200 tw-mb-2">

                  <div className="tw-font-semibold tw-text-[0.8rem] tw-text-sky-600 tw-mb-2 tw-flex tw-items-center tw-gap-1"><Activity size={13} /> Parametri Vitali</div>

                  <div className="tw-grid tw-grid-cols-2 tw-gap-2 tw-mb-2">

                    {[['pressioneSistolica','P. Sistolica (mmHg)','120'],['pressioneDiastolica','P. Diastolica (mmHg)','80'],['frequenzaCardiaca','Freq. Cardiaca (bpm)','72'],['frequenzaRespiratoria','Freq. Resp. (/min)','16'],['temperatura','Temp. (°C)','36.5'],['saturazione','SpO₂ (%)','98'],['glicemia','Glicemia (mg/dL)','95'],['peso','Peso (kg)','70']].map(([key, label, ph]) => (

                      <label key={key} className="tw-flex tw-flex-col tw-gap-0.5 tw-text-[0.8rem] tw-text-slate-600">{label}

                        <input type="number" step="0.1" value={parametri[key as keyof typeof parametri]} onChange={e => setParametri(prev => ({ ...prev, [key]: e.target.value }))} placeholder={`es. ${ph}`} className="tw-px-2 tw-py-1.5 tw-rounded tw-border tw-border-sky-200 tw-text-[0.85rem]" />

                      </label>

                    ))}

                  </div>

                  <label className="tw-flex tw-flex-col tw-gap-0.5 tw-text-[0.8rem] tw-text-slate-600">Dolore NRS (0-10)

                    <input type="range" min="0" max="10" value={parametri.dolore || '0'} onChange={e => setParametri(prev => ({ ...prev, dolore: e.target.value }))} className="tw-w-full" />

                    <span className="tw-text-center tw-font-semibold" style={{ color: parseInt(parametri.dolore || '0') >= 7 ? '#dc2626' : parseInt(parametri.dolore || '0') >= 4 ? '#d97706' : '#16a34a' }}>{parametri.dolore || '0'}/10 — {parseInt(parametri.dolore||'0')===0?'Assente':parseInt(parametri.dolore||'0')<=3?'Lieve':parseInt(parametri.dolore||'0')<=6?'Moderato':'Severo'}</span>

                  </label>

                </div>

              )}

              {showScale && (

                <div className="tw-mt-2 tw-p-3 tw-bg-fuchsia-50 tw-rounded-lg tw-border tw-border-fuchsia-200 tw-mb-2">

                  <div className="tw-font-semibold tw-text-[0.8rem] tw-text-fuchsia-700 tw-mb-2.5">🧮 Scale di Valutazione Multidimensionale</div>

                  <div className="tw-grid tw-grid-cols-1 tw-gap-2.5">

                    <div className="tw-bg-white tw-p-2.5 tw-rounded-md tw-border tw-border-fuchsia-200">

                      <div className="tw-font-semibold tw-text-[0.78rem] tw-text-slate-700 tw-mb-1.5">BRADEN — Rischio lesioni da pressione (6-23, &lt;18 = rischio)</div>

                      <input type="number" min="6" max="23" value={scale.braden} onChange={e => setScale(prev => ({ ...prev, braden: e.target.value }))} placeholder="es. 16" className="tw-w-full tw-p-1.5 tw-rounded tw-border tw-border-slate-300 tw-text-[0.9rem] tw-box-border" />

                      {scale.braden && <div className="tw-text-[0.75rem] tw-mt-1 tw-font-semibold" style={{ color: parseInt(scale.braden)<=12?'#dc2626':parseInt(scale.braden)<=18?'#d97706':'#16a34a' }}>

                        → {parseInt(scale.braden)<=9?'⚠️ Rischio molto alto':parseInt(scale.braden)<=12?'⚠️ Rischio alto':parseInt(scale.braden)<=14?'🟡 Rischio moderato':parseInt(scale.braden)<=18?'🟢 Rischio basso':'✅ Nessun rischio'}

                      </div>}

                    </div>

                    <div className="tw-bg-white tw-p-2.5 tw-rounded-md tw-border tw-border-fuchsia-200">

                      <div className="tw-font-semibold tw-text-[0.78rem] tw-text-slate-700 tw-mb-1.5">BARTHEL — Autonomia ADL (0-100)</div>

                      <input type="number" min="0" max="100" step="5" value={scale.barthel} onChange={e => setScale(prev => ({ ...prev, barthel: e.target.value }))} placeholder="es. 75" className="tw-w-full tw-p-1.5 tw-rounded tw-border tw-border-slate-300 tw-text-[0.9rem] tw-box-border" />

                      {scale.barthel && <div className="tw-text-[0.75rem] tw-mt-1 tw-font-semibold" style={{ color: parseInt(scale.barthel)<=25?'#dc2626':parseInt(scale.barthel)<=50?'#d97706':parseInt(scale.barthel)<=75?'#ca8a04':'#16a34a' }}>

                        → {parseInt(scale.barthel)===100?'✅ Indipendente':parseInt(scale.barthel)>=75?'🟢 Dipendenza minima':parseInt(scale.barthel)>=50?'🟡 Dipendenza moderata':parseInt(scale.barthel)>=25?'🟠 Dipendenza severa':'⚠️ Totalmente dipendente'}

                      </div>}

                    </div>

                    <div className="tw-bg-white tw-p-2.5 tw-rounded-md tw-border tw-border-fuchsia-200">

                      <div className="tw-font-semibold tw-text-[0.78rem] tw-text-slate-700 tw-mb-1.5">CONLEY — Rischio cadute (0-8, ≥2 = rischio)</div>

                      <input type="number" min="0" max="8" value={scale.conley} onChange={e => setScale(prev => ({ ...prev, conley: e.target.value }))} placeholder="es. 1" className="tw-w-full tw-p-1.5 tw-rounded tw-border tw-border-slate-300 tw-text-[0.9rem] tw-box-border" />

                      {scale.conley && <div className="tw-text-[0.75rem] tw-mt-1 tw-font-semibold" style={{ color: parseInt(scale.conley)>=2?'#dc2626':'#16a34a' }}>

                        → {parseInt(scale.conley)>=2?'⚠️ Rischio cadute':'✅ Basso rischio'}

                      </div>}

                    </div>

                  </div>

                </div>

              )}

              {showTerapia && (

                <div className="tw-mt-2 tw-p-3 tw-bg-green-50 tw-rounded-lg tw-border tw-border-green-300 tw-mb-2">

                  <div className="tw-font-semibold tw-text-[0.8rem] tw-text-green-600 tw-mb-2.5 tw-flex tw-justify-between tw-items-center">

                    💊 Terapia Farmacologica

                    <button type="button" onClick={() => setTerapia(prev => [...prev, { farmaco: '', dosaggio: '', mattina: false, pomeriggio: false, sera: false, notte: false }])} className="tw-bg-green-600 tw-text-white tw-border-0 tw-rounded tw-px-2 tw-py-1 tw-cursor-pointer tw-text-[0.75rem]">+ Farmaco</button>

                  </div>

                  {terapia.map((f, i) => (

                    <div key={i} className="tw-bg-white tw-p-2.5 tw-rounded-md tw-border tw-border-green-300 tw-mb-2">

                      <div className="tw-grid tw-grid-cols-2 tw-gap-2 tw-mb-1.5">

                        <input type="text" placeholder="Farmaco" value={f.farmaco} onChange={e => setTerapia(prev => prev.map((x,j)=>j===i?{...x,farmaco:e.target.value}:x))} className="tw-p-1.5 tw-rounded tw-border tw-border-slate-300 tw-text-[0.85rem]" />

                        <input type="text" placeholder="Dosaggio (es. 10mg)" value={f.dosaggio} onChange={e => setTerapia(prev => prev.map((x,j)=>j===i?{...x,dosaggio:e.target.value}:x))} className="tw-p-1.5 tw-rounded tw-border tw-border-slate-300 tw-text-[0.85rem]" />

                      </div>

                      <div className="tw-flex tw-gap-3 tw-text-[0.8rem] tw-items-center tw-flex-wrap">

                        {(['mattina','pomeriggio','sera','notte'] as const).map(t => (

                          <label key={t} className="tw-flex tw-items-center tw-gap-1 tw-cursor-pointer">

                            <input type="checkbox" checked={f[t]} onChange={e => setTerapia(prev => prev.map((x,j)=>j===i?{...x,[t]:e.target.checked}:x))} />

                            {t.charAt(0).toUpperCase()+t.slice(1)}

                          </label>

                        ))}

                        <button type="button" onClick={() => setTerapia(prev => prev.filter((_,j)=>j!==i))} className="tw-ml-auto tw-bg-transparent tw-border-0 tw-text-red-600 tw-cursor-pointer tw-text-[0.78rem]">✕ Rimuovi</button>

                      </div>

                    </div>

                  ))}

                </div>

              )}

              <button type="button" onClick={salvaDiario} disabled={!testoDiario.trim()} className={`tw-mt-3 tw-w-full tw-p-3 tw-text-white tw-border-0 tw-rounded-lg tw-font-semibold tw-text-[0.95rem] ${testoDiario.trim() ? 'tw-bg-sky-600 tw-cursor-pointer' : 'tw-bg-sky-300 tw-cursor-not-allowed'}`}>💾 Salva nel diario clinico</button>

            </div>

            {diario.length === 0 ? <p className="tw-text-slate-500 tw-italic tw-text-center tw-p-4">Nessuna voce nel diario.</p> : (

              <div className="tw-flex tw-flex-col tw-gap-2.5">

                {diario.map(entry => (

                  <div key={entry._id} style={{ padding: '12px', borderRadius: '8px', border: `1px solid ${entry.firmato ? '#86efac' : '#e5e7eb'}`, backgroundColor: entry.firmato ? '#f0fdf4' : '#fafafa' }}>

                    <div className="tw-flex tw-justify-between tw-items-start tw-mb-1.5">

                      <div className="tw-text-[0.78rem] tw-text-slate-500 tw-flex tw-items-center tw-gap-1.5 tw-flex-wrap">

                        📅 {formatDataOra(entry.dataRegistrazione)} — ✍️ {entry.staffName}

                        {entry.firmato && <span className="tw-inline-flex tw-items-center tw-gap-1 tw-bg-green-100 tw-text-green-600 tw-px-1.5 tw-py-px tw-rounded-[10px] tw-text-[0.72rem] tw-font-semibold"><Lock size={10} /> Firmato {entry.dataFirma ? new Date(entry.dataFirma).toLocaleDateString('it-IT') : ''}</span>}

                      </div>

                      <div className="tw-flex tw-gap-1 tw-flex-shrink-0">

                        {!entry.firmato && <button type="button" onClick={() => setDiarioDaFirmare(entry._id)} className="tw-bg-transparent tw-border tw-border-green-600 tw-cursor-pointer tw-text-green-600 tw-px-1.5 tw-py-0.5 tw-rounded tw-text-[0.72rem] tw-flex tw-items-center tw-gap-1"><PenLine size={12} /> Firma con dito/penna</button>}

                        {!entry.firmato && <button type="button" onClick={() => eliminaDiario(entry._id)} title="Elimina voce non firmata" className="tw-bg-transparent tw-border-0 tw-cursor-pointer tw-text-red-600 tw-p-0.5 tw-font-bold">✕</button>}

                      </div>

                    </div>

                    <p className="tw-m-0 tw-mb-2 tw-text-[0.9rem] tw-text-slate-700 tw-leading-normal tw-whitespace-pre-wrap">{entry.testo}</p>

                    {entry.parametriVitali && Object.values(entry.parametriVitali).some(v => v !== undefined && v !== null) && (

                      <div className="tw-p-2 tw-bg-sky-50 tw-rounded-md tw-border tw-border-sky-200 tw-mb-1.5">

                        <div className="tw-text-[0.75rem] tw-text-sky-600 tw-font-semibold tw-mb-1 tw-flex tw-items-center tw-gap-1"><Activity size={12} /> Parametri vitali</div>

                        <div className="tw-flex tw-flex-wrap tw-gap-1.5">

                          {entry.parametriVitali.pressioneSistolica && entry.parametriVitali.pressioneDiastolica && <span className="tw-text-[0.78rem] tw-bg-white tw-px-2 tw-py-0.5 tw-rounded tw-border tw-border-sky-200">🩺 {entry.parametriVitali.pressioneSistolica}/{entry.parametriVitali.pressioneDiastolica} mmHg</span>}

                          {entry.parametriVitali.frequenzaCardiaca && <span className="tw-text-[0.78rem] tw-bg-white tw-px-2 tw-py-0.5 tw-rounded tw-border tw-border-sky-200">❤️ {entry.parametriVitali.frequenzaCardiaca} bpm</span>}

                          {entry.parametriVitali.frequenzaRespiratoria && <span className="tw-text-[0.78rem] tw-bg-white tw-px-2 tw-py-0.5 tw-rounded tw-border tw-border-sky-200">🫁 {entry.parametriVitali.frequenzaRespiratoria} /min</span>}

                          {entry.parametriVitali.temperatura && <span className="tw-text-[0.78rem] tw-bg-white tw-px-2 tw-py-0.5 tw-rounded tw-border tw-border-sky-200">🌡️ {entry.parametriVitali.temperatura}°C</span>}

                          {entry.parametriVitali.saturazione && <span className="tw-text-[0.78rem] tw-bg-white tw-px-2 tw-py-0.5 tw-rounded tw-border tw-border-sky-200">💨 SpO₂ {entry.parametriVitali.saturazione}%</span>}

                          {entry.parametriVitali.glicemia && <span className="tw-text-[0.78rem] tw-bg-white tw-px-2 tw-py-0.5 tw-rounded tw-border tw-border-sky-200">🩸 {entry.parametriVitali.glicemia} mg/dL</span>}

                          {entry.parametriVitali.peso && <span className="tw-text-[0.78rem] tw-bg-white tw-px-2 tw-py-0.5 tw-rounded tw-border tw-border-sky-200">⚖️ {entry.parametriVitali.peso} kg</span>}

                          {entry.parametriVitali.dolore !== undefined && <span className="tw-text-[0.78rem] tw-bg-white tw-px-2 tw-py-0.5 tw-rounded tw-border tw-border-sky-200" style={{ color: entry.parametriVitali.dolore >= 7 ? '#dc2626' : entry.parametriVitali.dolore >= 4 ? '#d97706' : '#16a34a' }}>😣 Dolore: {entry.parametriVitali.dolore}/10</span>}

                        </div>

                      </div>

                    )}

                    {entry.scaleValutazione && (entry.scaleValutazione.braden !== undefined || entry.scaleValutazione.barthel !== undefined || entry.scaleValutazione.conley !== undefined) && (

                      <div className="tw-p-2 tw-bg-fuchsia-50 tw-rounded-md tw-border tw-border-fuchsia-200 tw-mb-1.5">

                        <div className="tw-text-[0.75rem] tw-text-fuchsia-700 tw-font-semibold tw-mb-1">🧮 Scale di Valutazione</div>

                        <div className="tw-flex tw-flex-wrap tw-gap-1.5">

                          {entry.scaleValutazione.braden !== undefined && <span className="tw-text-[0.78rem] tw-bg-white tw-px-2 tw-py-0.5 tw-rounded tw-border tw-border-fuchsia-200">BRADEN: {entry.scaleValutazione.braden} {entry.scaleValutazione.bradenLivello && `— ${entry.scaleValutazione.bradenLivello}`}</span>}

                          {entry.scaleValutazione.barthel !== undefined && <span className="tw-text-[0.78rem] tw-bg-white tw-px-2 tw-py-0.5 tw-rounded tw-border tw-border-fuchsia-200">BARTHEL: {entry.scaleValutazione.barthel} {entry.scaleValutazione.barthelLivello && `— ${entry.scaleValutazione.barthelLivello}`}</span>}

                          {entry.scaleValutazione.conley !== undefined && <span className="tw-text-[0.78rem] tw-bg-white tw-px-2 tw-py-0.5 tw-rounded tw-border tw-border-fuchsia-200" style={{ color: entry.scaleValutazione.conley >= 2 ? '#dc2626' : '#374151' }}>CONLEY: {entry.scaleValutazione.conley} {entry.scaleValutazione.conleyLivello && `— ${entry.scaleValutazione.conleyLivello}`}</span>}

                        </div>

                      </div>

                    )}

                    {entry.terapiaFarmacologica && entry.terapiaFarmacologica.length > 0 && (

                      <div className="tw-p-2 tw-bg-green-50 tw-rounded-md tw-border tw-border-green-300">

                        <div className="tw-text-[0.75rem] tw-text-green-600 tw-font-semibold tw-mb-1">💊 Terapia Farmacologica</div>

                        <div className="tw-flex tw-flex-col tw-gap-1">

                          {entry.terapiaFarmacologica.map((f, i) => (

                            <div key={i} className="tw-text-[0.78rem] tw-bg-white tw-px-2 tw-py-1 tw-rounded tw-border tw-border-green-300 tw-flex tw-justify-between tw-items-center tw-flex-wrap tw-gap-1">

                              <span><strong>{f.farmaco}</strong> — {f.dosaggio}</span>

                              <span className="tw-text-slate-500 tw-text-[0.74rem]">{[f.mattina&&'M',f.pomeriggio&&'P',f.sera&&'S',f.notte&&'N'].filter(Boolean).join('-') || '—'}</span>

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

      <div className="tw-border-2 tw-border-orange-200 tw-rounded-[10px] tw-mb-4 tw-overflow-hidden tw-bg-orange-50">

        <div className="tw-px-4 tw-py-3 tw-bg-orange-50 tw-border-b tw-border-orange-200 tw-flex tw-items-center tw-justify-between">

          <span className="tw-font-bold tw-text-orange-700 tw-text-[0.95rem] tw-flex tw-items-center tw-gap-2">

            <Paperclip size={18} /> Allegati cartella ({allegati.length})

          </span>

          <button type="button" onClick={() => setShowAllegati(!showAllegati)} className="tw-bg-transparent tw-border tw-border-orange-200 tw-rounded-md tw-cursor-pointer tw-text-orange-700 tw-px-2.5 tw-py-1 tw-text-[0.8rem] tw-flex tw-items-center tw-gap-1">

            {showAllegati ? <><ChevronUp size={14} /> Nascondi</> : <><ChevronDown size={14} /> Mostra</>}

          </button>

        </div>



        {/* Form upload — sempre visibile */}

        <div className="tw-px-4 tw-py-3" style={{ borderBottom: allegati.length > 0 ? '1px solid #fed7aa' : 'none' }}>

          <div className="tw-flex tw-gap-2 tw-items-start tw-flex-wrap">

            <div className="tw-flex-1 tw-min-w-[200px]">

              <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={e => setUploadFile(e.target.files?.[0] || null)} className="tw-w-full tw-text-[0.85rem] tw-mb-1.5" />

              {uploadFile && <div className="tw-text-[0.78rem] tw-text-orange-700 tw-mb-1">📄 {uploadFile.name} ({formatDimensione(uploadFile.size)})</div>}

              <input type="text" value={uploadDescrizione} onChange={e => setUploadDescrizione(e.target.value)} placeholder="Descrizione allegato (opzionale)..." className="tw-w-full tw-px-2 tw-py-1.5 tw-rounded-md tw-border tw-border-orange-200 tw-text-[0.85rem] tw-box-border" />

            </div>

            <button type="button" onClick={caricaFile} disabled={!uploadFile || uploadLoading} className={`tw-px-4 tw-py-2.5 tw-text-white tw-border-0 tw-rounded-lg tw-font-semibold tw-text-[0.88rem] tw-flex tw-items-center tw-gap-1.5 tw-whitespace-nowrap tw-self-end ${uploadFile && !uploadLoading ? 'tw-bg-orange-700 tw-cursor-pointer' : 'tw-bg-orange-300 tw-cursor-not-allowed'}`}>

              {uploadLoading ? '⏳' : <><Paperclip size={15} /> Allega</>}

            </button>

          </div>

          <div className="tw-text-[0.72rem] tw-text-slate-400 tw-mt-1">Immagini, PDF, Word, Excel, testo — max 20 MB</div>

        </div>



        {/* Lista allegati */}

        {allegati.length > 0 && showAllegati && (

          <div className="tw-px-4 tw-py-2.5 tw-flex tw-flex-col tw-gap-1.5">

            {allegati.map(all => (

              <div key={all._id} className="tw-px-2.5 tw-py-2 tw-rounded-md tw-border tw-border-orange-200 tw-bg-white tw-flex tw-items-center tw-gap-2">

                <div className="tw-flex-shrink-0">{getFileIcon(all.mimeType)}</div>

                <div className="tw-flex-1 tw-min-w-0">

                  <div className="tw-font-semibold tw-text-[0.85rem] tw-overflow-hidden tw-text-ellipsis tw-whitespace-nowrap">{all.nomeFile}</div>

                  <div className="tw-text-[0.72rem] tw-text-slate-500 tw-flex tw-gap-1.5 tw-flex-wrap">

                    <span>{formatDimensione(all.dimensione)}</span>

                    <span>📅 {new Date(all.dataCaricamento).toLocaleDateString('it-IT')}</span>

                    <span>👤 {all.caricatoDa}</span>

                    {all.descrizione && <span className="tw-italic">{all.descrizione}</span>}

                  </div>

                </div>

                <div className="tw-flex tw-gap-1 tw-flex-shrink-0">

                  <button type="button" onClick={() => apriAllegato(all)} className="tw-bg-sky-600 tw-border-0 tw-cursor-pointer tw-text-white tw-px-2 tw-py-1 tw-rounded tw-flex tw-items-center tw-gap-1 tw-text-[0.72rem]">

                    <ExternalLink size={12} /> Apri

                  </button>

                  {canDeleteAllegato && <button type="button" onClick={() => eliminaAllegato(all._id)} className="tw-bg-transparent tw-border-0 tw-cursor-pointer tw-text-red-600 tw-p-1.5"><Trash2 size={13} /></button>}

                </div>

              </div>

            ))}

          </div>

        )}

        {allegati.length > 0 && !showAllegati && (

          <div className="tw-px-4 tw-py-2 tw-text-[0.8rem] tw-text-orange-700">

            {allegati.length} allegato{allegati.length > 1 ? 'i' : ''} presente{allegati.length > 1 ? 'i' : ''} — clicca "Mostra" per visualizzarli

          </div>

        )}

      </div>



      {/* Note piano */}

      {workPlan.notes && (

        <div className="tw-px-4 tw-py-3 tw-bg-amber-50 tw-border tw-border-amber-200 tw-rounded-lg tw-text-[0.88rem] tw-text-amber-800">

          📋 <strong>Note:</strong> {workPlan.notes}

        </div>

      )}

      {/* Modale Chat */}
      {showChat && (
        <div className="tw-fixed tw-inset-0 tw-bg-black/50 tw-z-[100] tw-flex tw-items-center tw-justify-center tw-p-3" onClick={() => setShowChat(false)}>
          <div className="tw-bg-white tw-rounded-2xl tw-w-full tw-max-w-[600px] tw-max-h-[90vh] tw-overflow-hidden tw-flex tw-flex-col" onClick={e => e.stopPropagation()}>
            <div className="tw-px-4 tw-py-3 tw-border-b tw-border-slate-200 tw-flex tw-justify-between tw-items-center">
              <h3 className="tw-m-0 tw-text-base">Chat con coordinatore / ufficio</h3>
              <button onClick={() => setShowChat(false)} className="tw-bg-transparent tw-border-0 tw-cursor-pointer">✕</button>
            </div>
            <div className="tw-flex-1 tw-overflow-hidden">
              <ChatWidget scope="general" title="Coordinatore / Ufficio" height="100%" />
            </div>
          </div>
        </div>
      )}

      {diarioDaFirmare && (
        <div className="tw-fixed tw-inset-0 tw-bg-black/50 tw-z-[100] tw-flex tw-items-center tw-justify-center tw-p-3" onClick={() => { setDiarioDaFirmare(null); setFirmaDiarioGrafometrica(''); }}>
          <div className="tw-bg-white tw-rounded-2xl tw-w-full tw-max-w-[560px] tw-p-5" onClick={e => e.stopPropagation()}>
            <h3 className="tw-m-0 tw-mb-2 tw-text-green-800">Firma voce del diario</h3>
            <p className="tw-text-slate-600 tw-text-[0.86rem]">Firma con il dito o la penna. Alla conferma la voce sarà bloccata definitivamente.</p>
            <FirmaCanvas label="Firma grafometrica dell’operatore" sublabel="Disegna la firma nel riquadro" onFirmaCompleta={setFirmaDiarioGrafometrica} onCancella={() => setFirmaDiarioGrafometrica('')} altezza={160} />
            <div className="tw-flex tw-gap-2.5">
              <button type="button" onClick={() => { setDiarioDaFirmare(null); setFirmaDiarioGrafometrica(''); }} className="tw-flex-1 tw-p-2.5 tw-bg-slate-100 tw-border tw-border-slate-300 tw-rounded-md tw-cursor-pointer">Annulla</button>
              <button type="button" onClick={firmaDiario} disabled={!firmaDiarioGrafometrica} className={`tw-flex-[2] tw-p-2.5 tw-text-white tw-border-0 tw-rounded-md tw-font-bold ${firmaDiarioGrafometrica ? 'tw-bg-green-600 tw-cursor-pointer' : 'tw-bg-green-200 tw-cursor-not-allowed'}`}>Firma e blocca voce</button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Consenso GDPR */}
      {showConsenso && (
        <div className="tw-fixed tw-inset-0 tw-bg-black/50 tw-z-[100] tw-flex tw-items-center tw-justify-center tw-p-3" onClick={() => setShowConsenso(false)}>
          <div className="tw-bg-white tw-rounded-2xl tw-w-full tw-max-w-[520px] tw-max-h-[90vh] tw-overflow-y-auto tw-p-5" onClick={e => e.stopPropagation()}>
            <h3 className="tw-m-0 tw-mb-2 tw-text-slate-800">Consenso GDPR</h3>
            <p className="tw-text-[0.85rem] tw-text-slate-500 tw-mb-4">
              Il paziente / caregiver firma il consenso al trattamento dei dati per prestazioni sanitarie, fatturazione e finalità interne.
            </p>

            <div className="tw-mb-3">
              <label className="tw-block tw-text-[0.85rem] tw-font-semibold tw-mb-1">Nome firmatario</label>
              <input type="text" value={nomeConsenso} onChange={e => setNomeConsenso(e.target.value)} placeholder="Nome" className="tw-w-full tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-300" />
            </div>
            <div className="tw-mb-4">
              <label className="tw-block tw-text-[0.85rem] tw-font-semibold tw-mb-1">Cognome firmatario</label>
              <input type="text" value={cognomeConsenso} onChange={e => setCognomeConsenso(e.target.value)} placeholder="Cognome" className="tw-w-full tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-300" />
            </div>

            <FirmaCanvas
              label="Firma del paziente / caregiver"
              sublabel="Firma per accettare l'informativa privacy"
              onFirmaCompleta={(firma) => setFirmaConsenso(firma)}
              onCancella={() => setFirmaConsenso('')}
              altezza={160}
            />

            <div className="tw-flex tw-gap-2.5 tw-mt-4">
              <button onClick={() => setShowConsenso(false)} className="tw-flex-1 tw-p-3 tw-rounded-lg tw-border tw-border-slate-300 tw-bg-slate-100 tw-cursor-pointer">Annulla</button>
              <button onClick={salvaConsensoGDPR} disabled={savingConsenso} className="tw-flex-[2] tw-p-3 tw-rounded-lg tw-border-0 tw-bg-green-600 tw-text-white tw-font-semibold tw-cursor-pointer">
                {savingConsenso ? 'Salvataggio...' : 'Salva consenso'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConsensoPrestazione && (
        <div className="tw-fixed tw-inset-0 tw-bg-black/55 tw-z-[110] tw-p-3 tw-overflow-y-auto" onClick={() => setShowConsensoPrestazione(false)}>
          <div className="tw-bg-white tw-rounded-2xl tw-w-full tw-max-w-[620px] tw-mx-auto tw-p-5" onClick={e => e.stopPropagation()}>
            <h3 className="tw-m-0 tw-mb-2 tw-text-orange-800">Consenso alla prestazione sanitaria e rischi</h3>
            <p className="tw-text-[0.85rem] tw-text-slate-600 tw-leading-relaxed tw-mb-3.5">
              Il firmatario dichiara di aver ricevuto informazioni sulle prestazioni sanitarie e assistenziali svolte da Abbraccio Cure Domiciliari e dai suoi operatori incaricati.
            </p>
            <div className="tw-p-3 tw-rounded-lg tw-bg-orange-50 tw-border tw-border-orange-200 tw-text-[0.83rem] tw-text-orange-900 tw-leading-normal tw-mb-4">
              Le prestazioni sono effettuate secondo le procedure aziendali e le condizioni cliniche rilevate. Possono sussistere rischi prevedibili connessi allo stato di salute, alla risposta individuale al trattamento e alle attività svolte al domicilio. In caso di necessità l'operatore attiva il medico o i servizi di emergenza.
            </div>

            <div className="tw-grid tw-grid-cols-2 tw-gap-2.5 tw-mb-3">
              <input type="text" value={nomeConsensoPrestazione} onChange={e => setNomeConsensoPrestazione(e.target.value)} placeholder="Nome firmatario" className="tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-300" />
              <input type="text" value={cognomeConsensoPrestazione} onChange={e => setCognomeConsensoPrestazione(e.target.value)} placeholder="Cognome firmatario" className="tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-300" />
            </div>
            <div className="tw-mb-3.5">
              <label className="tw-block tw-text-[0.85rem] tw-font-semibold tw-mb-1.5">Il firmatario è</label>
              <select value={ruoloConsensoPrestazione} onChange={e => setRuoloConsensoPrestazione(e.target.value as typeof ruoloConsensoPrestazione)} className="tw-w-full tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-300">
                <option value="paziente">Paziente</option>
                <option value="caregiver">Caregiver</option>
                <option value="tutore">Tutore</option>
                <option value="rappresentanteLegale">Rappresentante legale</option>
              </select>
            </div>
            <label className="tw-flex tw-items-start tw-gap-2 tw-text-[0.85rem] tw-mb-2.5 tw-cursor-pointer">
              <input type="checkbox" checked={accettaPrestazione} onChange={e => setAccettaPrestazione(e.target.checked)} className="tw-mt-1" />
              Confermo di aver ricevuto informazioni sulla prestazione sanitaria e di acconsentire alla sua esecuzione.
            </label>
            <label className="tw-flex tw-items-start tw-gap-2 tw-text-[0.85rem] tw-mb-4 tw-cursor-pointer">
              <input type="checkbox" checked={accettaRischi} onChange={e => setAccettaRischi(e.target.checked)} className="tw-mt-1" />
              Dichiaro di aver letto e compreso i rischi e le limitazioni del trattamento descritti sopra.
            </label>

            <FirmaCanvas label="Firma del paziente / firmatario" sublabel="Firmare con il dito sullo schermo" onFirmaCompleta={setFirmaConsensoPrestazione} onCancella={() => setFirmaConsensoPrestazione('')} altezza={160} />
            <div className="tw-flex tw-gap-2.5 tw-mt-4">
              <button onClick={() => setShowConsensoPrestazione(false)} className="tw-flex-1 tw-p-3 tw-rounded-lg tw-border tw-border-slate-300 tw-bg-slate-100 tw-cursor-pointer">Annulla</button>
              <button onClick={salvaConsensoPrestazione} disabled={savingConsensoPrestazione} className="tw-flex-[2] tw-p-3 tw-rounded-lg tw-border-0 tw-bg-orange-700 tw-text-white tw-font-bold tw-cursor-pointer">{savingConsensoPrestazione ? 'Salvataggio...' : 'Firma e archivia consenso'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

}

