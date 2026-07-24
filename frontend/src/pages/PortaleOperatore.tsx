import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useModalita } from '../context/ModalitaContext';
import FirmaCanvas from '../components/FirmaCanvas';
import { VoiceRecorder } from '../components/VoiceRecorder';
import { ChatWidget } from '../components/ChatWidget';
import { ReportGenerator } from '../components/ReportGenerator';
import { CustomerSatisfactionModal } from '../components/CustomerSatisfactionModal';
import { SchedaDimissioneModal } from '../components/SchedaDimissioneModal';
import { Printer, Eye, CheckCircle, Plus, Calendar, User, Syringe, Clock, FileText, AlertTriangle, X } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

// ─── Interfacce ───────────────────────────────────────────────────────────────

interface Paziente {
  _id: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
  address?: string;
  contactPhone?: string;
  assistanceNeeds?: string;
  pianiAssegnati?: number;
  tipoGestione?: 'privato' | 'convenzione';
  siat?: { npi?: string; tipologiaCura?: string; asl?: string; distretto?: string; dataScadenzaAutorizzazione?: string };
}

interface Piano {
  _id: string;
  type: string;
  category: string;
  task: string;
  notes?: string;
  date: string;
  dataFine?: string;
  status: string;
  tipoCompenso?: string;
  tariffa?: number;
  compensoTotale?: number;
  compensoPagato?: boolean;
  costoPrestazione?: number;
  tariffaAsl?: number;
  patient: { _id: string; firstName: string; lastName: string; tipoGestione?: string };
  staff: { _id: string; firstName: string; lastName: string; role: string };
  statoAccettazione?: 'in_attesa' | 'accettato' | 'rifiutato';
}

interface PrelievoOperatore {
  _id: string;
  patient: { _id: string; firstName: string; lastName: string; tipoGestione?: string; siat?: { asl?: string } };
  staff: { _id: string; firstName: string; lastName: string; role: string };
  dataPrelievo: string;
  orario?: string;
  tipoPrelievo: string;
  note?: string;
  status: 'pianificato' | 'eseguito' | 'annullato';
  tipoGestione: 'privato' | 'convenzione';
  dataEsecuzione?: string;
  eseguitoDa?: string;
  noteEsecuzione?: string;
  diaria: { _id: string; autore: string; testo: string; data: string; firmato: boolean }[];
  allegati: any[];
  firmaOperatore?: string;
  firmaPaziente?: string;
  nomeFirmatarioPaziente?: string;
  ruoloFirmatario?: 'paziente' | 'caregiver';
}

interface Accesso {
  _id: string;
  staffName: string;
  staffRole: string;
  oraEntrata: string;
  oraUscita?: string;
  note?: string;
  firmaLogin: string;
  durataMinuti: number;
  compensoMaturato: number;
  firmaOperatore?: string;
  firmaPaziente?: string;
  nomeFirmatarioPaziente?: string;
  ruoloFirmatario?: 'paziente' | 'caregiver';
  firmatoAllaPartenza?: boolean;
}

interface DiarioEntry {
  _id: string;
  testo: string;
  staffName: string;
  dataRegistrazione: string;
  firmato: boolean;
  dataFirma?: string;
  firmaLogin: string;
  parametriVitali?: {
    pressioneSistolica?: number;
    pressioneDiastolica?: number;
    frequenzaCardiaca?: number;
    frequenzaRespiratoria?: number;
    temperatura?: number;
    saturazione?: number;
    glicemia?: number;
    peso?: number;
    dolore?: number;
  };
}

interface Allegato {
  _id: string;
  nomeFile: string;
  mimeType: string;
  dimensione: number;
  descrizione?: string;
  caricatoDa: string;
  dataCaricamento: string;
  urlCloudinary?: string;
}

interface Obiettivo {
  _id: string;
  descrizione: string;
  stato: string;
  dataInizio: string;
  dataRivalutazione?: string;
  valutazioni?: { data: string; stato: string; note?: string; valutatoDa: string }[];
}

// ─── Costanti ─────────────────────────────────────────────────────────────────

const statoObiettivoBadge: Record<string, { bg: string; color: string; label: string }> = {
  attivo:        { bg: 'rgba(30,77,140,0.1)',  color: '#1e4d8c', label: '🎯 Attivo' },
  raggiunto:     { bg: 'rgba(5,150,105,0.1)',  color: '#065f46', label: '✅ Raggiunto' },
  parziale:      { bg: 'rgba(245,158,11,0.1)', color: '#92400e', label: '⚠️ Parziale' },
  non_raggiunto: { bg: 'rgba(220,38,38,0.1)',  color: '#7f1d1d', label: '❌ Non raggiunto' },
  rivalutato:    { bg: 'rgba(107,114,128,0.1)',color: '#374151', label: '🔄 Rivalutato' },
};

const STATI_OBIETTIVO = ['attivo', 'raggiunto', 'parziale', 'non_raggiunto', 'rivalutato'];

const PARAMETRI_VITALI = [
  { key: 'pressioneSistolica',    label: '🩸 P. Sistolica',    unit: 'mmHg',     step: '1' },
  { key: 'pressioneDiastolica',   label: '🩸 P. Diastolica',   unit: 'mmHg',     step: '1' },
  { key: 'frequenzaCardiaca',     label: '❤️ Freq. Cardiaca',  unit: 'bpm',      step: '1' },
  { key: 'frequenzaRespiratoria', label: '🫁 Freq. Resp.',      unit: 'atti/min', step: '1' },
  { key: 'temperatura',           label: '🌡️ Temperatura',     unit: '°C',       step: '0.1' },
  { key: 'saturazione',           label: '💨 Saturazione',      unit: '%',        step: '1' },
  { key: 'glicemia',              label: '🍬 Glicemia',         unit: 'mg/dL',    step: '1' },
  { key: 'peso',                  label: '⚖️ Peso',             unit: 'kg',       step: '0.1' },
  { key: 'dolore',                label: '😣 Dolore (0-10)',    unit: '/10',      step: '1' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDurata(min: number) {
  if (!min) return '—';
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}
function formatData(d: string) {
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatOra(d: string) {
  return new Date(d).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}
function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Costanti scheda ufficiale Evento Avverso ───────────────────────────────
const eventoFormDefault = {
  patientId: '',
  ruoloOperatore: '' as string,
  ruoloOperatoreAltro: '',
  direzioneDiArea: '',
  pazienteNomeCognome: '',
  pazienteCSTV: '',
  pazienteEta: '',
  pazienteSesso: '' as ''|'M'|'F',
  dataEvento: new Date().toISOString().slice(0, 10),
  oraEvento: '',
  luogoEvento: '',
  descrizioneEvento: '',
  svolgimentoFatti: '',
  fattoriPaziente:      [] as string[],
  fattoriStaff:         [] as string[],
  fattoriComunicazione: [] as string[],
  fattoriAmbiente:      [] as string[],
  suggerimenti: '',
  dannoRiscontrato: 'nessuno' as 'nessuno'|'lieve'|'moderato'|'grave'|'decesso',
};

const FATTORI_PAZIENTE = [
  'Condizioni generali precarie / fragilità / infermità',
  'Non cosciente / scarsamente orientato',
  'Poca / mancata autonomia',
  'Barriere linguistiche / culturali',
  'Mancata adesione al progetto',
];
const FATTORI_STAFF = [
  'Staff inadeguato / insufficiente',
  'Insufficiente addestramento / inserimento',
  'Gruppo nuovo / inesperto',
  'Elevato turn-over',
  'Scarsa continuità assistenziale',
  'Protocollo / procedura inesistente o ambigua',
  'Insuccesso nel far rispettare protocolli / procedure',
];
const FATTORI_COMUNICAZIONE = [
  'Difficoltà nel seguire istruzioni / procedure',
  'Inadeguate conoscenze / inesperienza',
  'Mancato coordinamento',
  'Mancata / inadeguata comunicazione',
  'Presa scorciatoia / regola non seguita',
  'Mancata supervisione',
  'Scarso lavoro di gruppo',
];
const FATTORI_AMBIENTE = [
  'Ambiente inadeguato',
  'Mancata verifica preventiva apparecchiatura',
  'Mancata / inadeguata manutenzione attrezzature',
];

const GRADI_DANNO: { value: string; label: string; color: string }[] = [
  { value: 'nessuno',  label: '✅ Nessun danno',  color: '#16a34a' },
  { value: 'lieve',    label: '🟡 Danno lieve',    color: '#d97706' },
  { value: 'moderato', label: '🟠 Danno moderato', color: '#ea580c' },
  { value: 'grave',    label: '🔴 Danno grave',    color: '#dc2626' },
  { value: 'decesso',  label: '⚫ Decesso',         color: '#1f2937' },
];

// ─── Componente principale ────────────────────────────────────────────────────

interface PortaleOperatoreProps {
  mode?: 'dashboard' | 'piani';
}

export default function PortaleOperatore({ mode = 'dashboard' }: PortaleOperatoreProps) {
  const { user } = useAuth();
  const { modalita, isConvenzione } = useModalita();
  const navigate = useNavigate();

  // Selezione paziente / piano
  const [pazienti, setPazienti] = useState<Paziente[]>([]);
  const [tuttiIPazienti, setTuttiIPazienti] = useState<Paziente[]>([]);
  const [pazienteSelezionato, setPazienteSelezionato] = useState<Paziente | null>(null);
  const [piani, setPiani] = useState<Piano[]>([]);
  const [pianoSelezionato, setPianoSelezionato] = useState<Piano | null>(null);
  const [tuttiIPiani, setTuttiIPiani] = useState<Piano[]>([]);
  const [mostraTuttiPiani, setMostraTuttiPiani] = useState(false);
  const [esamiAttivi, setEsamiAttivi] = useState(0);

  // Accessi
  const [accessi, setAccessi] = useState<Accesso[]>([]);
  const [riepilogo, setRiepilogo] = useState<any>(null);
  const [accessoAperto, setAccessoAperto] = useState<Accesso | null>(null);

  // Diario clinico
  const [diario, setDiario] = useState<DiarioEntry[]>([]);
  const [testoDiario, setTestoDiario] = useState('');
  const [parametri, setParametri] = useState<Record<string, string>>({});
  const [salvandoDiario, setSalvandoDiario] = useState(false);
  const [diarioDaFirmare, setDiarioDaFirmare] = useState<string | null>(null);
  const [firmaDiarioGrafometrica, setFirmaDiarioGrafometrica] = useState('');
  const [showDiario, setShowDiario] = useState(false);

  // Allegati
  const [allegati, setAllegati] = useState<Allegato[]>([]);
  const [fileAllegato, setFileAllegato] = useState<File | null>(null);
  const [descrizioneAllegato, setDescrizioneAllegato] = useState('');
  const [caricandoAllegato, setCaricandoAllegato] = useState(false);
  const [showAllegati, setShowAllegati] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Obiettivi
  const [obiettivi, setObiettivi] = useState<Obiettivo[]>([]);
  const [showObiettivi, setShowObiettivi] = useState(false);
  const [rivalutandoId, setRivalutandoId] = useState<string | null>(null);
  const [statoRivalutazione, setStatoRivalutazione] = useState('');
  const [noteRivalutazione, setNoteRivalutazione] = useState('');
  const [salvandoRivalutazione, setSalvandoRivalutazione] = useState(false);

  // Export PDF
  const [showExport, setShowExport] = useState(false);
  const [exportDaData, setExportDaData] = useState('');
  const [exportAData, setExportAData] = useState('');
  const [exportData, setExportData] = useState<any>(null);
  const [loadingExport, setLoadingExport] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [loadingPiano, setLoadingPiano] = useState(false);

  // Prelievi giornalieri
  const [prelieviOggi, setPrelieviOggi] = useState<PrelievoOperatore[]>([]);
  const [prelievoAperto, setPrelievoAperto] = useState<string | null>(null);
  const [testoDiariaPrelievo, setTestoDiariaPrelievo] = useState('');
  const [salvandoDiariaPrelievo, setSalvandoDiariaPrelievo] = useState(false);
  const [noteEsecuzione, setNoteEsecuzione] = useState('');
  const [registrandoPrelievo, setRegistrandoPrelievo] = useState<string | null>(null);
  // Flusso firma prelievo: null | 'firma-operatore' | 'firma-paziente'
  const [stepFirmaPrelievo, setStepFirmaPrelievo] = useState<Record<string, 'firma-operatore' | 'firma-paziente'>>({});
  const [firmaOpPrelievo, setFirmaOpPrelievo] = useState<Record<string, string>>({});
  const [firmaPazPrelievo, setFirmaPazPrelievo] = useState<Record<string, string>>({});
  const [nomeFirmatarioPrelievo, setNomeFirmatarioPrelievo] = useState<Record<string, string>>({});
  const [ruoloFirmatarioPrelievo, setRuoloFirmatarioPrelievo] = useState<Record<string, 'paziente' | 'caregiver'>>({});

  // ─── Accettazione incarico da email ─────────────────────────────────────────
  const [pianoDaAccettare, setPianoDaAccettare] = useState<Piano | null>(null);
  const [mostraModalAccettazione, setMostraModalAccettazione] = useState(false);
  const [motivoRifiuto, setMotivoRifiuto] = useState('');
  const [loadingAccettazione, setLoadingAccettazione] = useState(false);

  // ─── Evento Avverso ─────────────────────────────────────────────────────────
  const [showEventoAvverso, setShowEventoAvverso] = useState(false);
  const [eventoForm, setEventoForm] = useState({ ...eventoFormDefault });
  const [firmaEventoOp, setFirmaEventoOp] = useState('');
  const [salvandoEvento, setSalvandoEvento] = useState(false);
  const [eventoSalvato, setEventoSalvato] = useState(false);
  const [dettaturaEventoAttiva, setDettaturaEventoAttiva] = useState(false);
  const [showChatPaziente, setShowChatPaziente] = useState(false);
  const [showConsensoGDPR, setShowConsensoGDPR] = useState(false);
  const [showCustomerSatisfaction, setShowCustomerSatisfaction] = useState(false);
  const [showSchedaDimissione, setShowSchedaDimissione] = useState(false);
  const [showConsensoPrestazione, setShowConsensoPrestazione] = useState(false);
  const [consensoGDPRFirmato, setConsensoGDPRFirmato] = useState(false);
  const [consensoPrestazioneFirmato, setConsensoPrestazioneFirmato] = useState(false);
  const [consensoGDPR, setConsensoGDPR] = useState<any>(null);
  const [consensoPrestazione, setConsensoPrestazione] = useState<any>(null);
  const [emailConsensoGDPR, setEmailConsensoGDPR] = useState('');
  const [emailConsensoPrestazione, setEmailConsensoPrestazione] = useState('');
  const [nomeFirmatarioGDPR, setNomeFirmatarioGDPR] = useState('');
  const [cognomeFirmatarioGDPR, setCognomeFirmatarioGDPR] = useState('');
  const [firmaGDPR, setFirmaGDPR] = useState('');
  const [nomeFirmatarioPrestazione, setNomeFirmatarioPrestazione] = useState('');
  const [cognomeFirmatarioPrestazione, setCognomeFirmatarioPrestazione] = useState('');
  const [firmaPrestazione, setFirmaPrestazione] = useState('');
  const [ruoloFirmatarioPrestazione, setRuoloFirmatarioPrestazione] = useState<'paziente' | 'caregiver' | 'tutore' | 'rappresentanteLegale'>('paziente');
  const [accettaPrestazione, setAccettaPrestazione] = useState(false);
  const [accettaRischiPrestazione, setAccettaRischiPrestazione] = useState(false);
  const [salvandoConsenso, setSalvandoConsenso] = useState(false);

  const avviaDettaturaEvento = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('La dettatura non è supportata da questo browser. Usa Chrome aggiornato e autorizza il microfono.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'it-IT';
    recognition.continuous = false;
    recognition.interimResults = false;
    setDettaturaEventoAttiva(true);
    recognition.onresult = (event: any) => {
      const testo = event.results?.[0]?.[0]?.transcript?.trim();
      if (testo) setEventoForm(p => ({ ...p, descrizioneEvento: [p.descrizioneEvento, testo].filter(Boolean).join(p.descrizioneEvento ? ' ' : '') }));
    };
    recognition.onerror = () => alert('Impossibile trascrivere l\'audio. Verifica l\'autorizzazione del microfono e riprova.');
    recognition.onend = () => setDettaturaEventoAttiva(false);
    recognition.start();
  };

  // ─── Genera HTML per PDF prelievo ───────────────────────────────────────────
  const generaHTMLPrelievo = (prel: PrelievoOperatore) => {
    return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <title>Verbale Prelievo - ${prel.patient?.firstName || 'N/D'} ${prel.patient?.lastName || ''}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
    h1 { color: #0d9488; border-bottom: 2px solid #0d9488; padding-bottom: 10px; }
    .info { margin: 15px 0; }
    .label { font-weight: bold; color: #666; }
    .value { color: #333; }
    .box { border: 1px solid #ddd; padding: 15px; margin: 15px 0; border-radius: 8px; }
    .status-eseguito { background: #f0fdf4; border-left: 4px solid #059669; }
    .firma { margin-top: 10px; }
    .firma img { max-width: 300px; max-height: 150px; border: 1px solid #ccc; border-radius: 4px; }
    .footer { margin-top: 30px; font-size: 12px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 10px; }
    @media print { body { margin: 10mm; } }
  </style>
</head>
<body>
  <h1>📋 Verbale Prelievo</h1>
  <div class="box status-eseguito">
    <div class="info"><span class="label">Stato:</span> <span class="value">✅ ESEGUITO</span></div>
    <div class="info"><span class="label">Data prelievo:</span> <span class="value">${new Date(prel.dataPrelievo).toLocaleDateString('it-IT')}</span></div>
    ${prel.orario ? `<div class="info"><span class="label">Orario:</span> <span class="value">${prel.orario}</span></div>` : ''}
  </div>
  
  <div class="box">
    <h3>👤 Paziente</h3>
    <div class="info"><span class="label">Nome:</span> <span class="value">${prel.patient?.firstName || 'N/D'} ${prel.patient?.lastName || ''}</span></div>
    <div class="info"><span class="label">Tipo gestione:</span> <span class="value">${prel.patient.tipoGestione === 'convenzione' ? 'Convenzione' : 'Privato'}</span></div>
  </div>
  
  <div class="box">
    <h3>💉 Dettagli Prelievo</h3>
    <div class="info"><span class="label">Tipi prelievo:</span> <span class="value">${prel.tipoPrelievo}</span></div>
    ${prel.note ? `<div class="info"><span class="label">Note:</span> <span class="value">${prel.note}</span></div>` : ''}
  </div>
  
  <div class="box">
    <h3>✍️ Esecuzione</h3>
    <div class="info"><span class="label">Eseguito da:</span> <span class="value">${prel.eseguitoDa || 'N/A'}</span></div>
    <div class="info"><span class="label">Data esecuzione:</span> <span class="value">${prel.dataEsecuzione ? new Date(prel.dataEsecuzione).toLocaleDateString('it-IT') : 'N/A'}</span></div>
    ${prel.noteEsecuzione ? `<div class="info"><span class="label">Note esecuzione:</span> <span class="value">${prel.noteEsecuzione}</span></div>` : ''}
  </div>
  
  ${prel.firmaOperatore ? `<div class="box firma">
    <h3>✍️ Firma Operatore</h3>
    <img src="${prel.firmaOperatore}" alt="Firma operatore" />
  </div>` : ''}
  
  ${prel.firmaPaziente ? `<div class="box firma">
    <h3>✍️ Firma ${prel.ruoloFirmatario === 'caregiver' ? 'Caregiver' : 'Paziente'} ${prel.nomeFirmatarioPaziente ? `(${prel.nomeFirmatarioPaziente})` : ''}</h3>
    <img src="${prel.firmaPaziente}" alt="Firma paziente" />
  </div>` : ''}
  
  <div class="footer">
    Documento generato da App Abbraccio - ${new Date().toLocaleString('it-IT')}
  </div>
</body>
</html>`;
  };

  // ─── Stampa PDF prelievo ────────────────────────────────────────────────────
  const stampaPrelievoPDF = (prel: PrelievoOperatore) => {
    const html = generaHTMLPrelievo(prel);
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  // ─── Visualizza PDF prelievo ────────────────────────────────────────────────
  const visualizzaPrelievoPDF = (prel: PrelievoOperatore) => {
    const html = generaHTMLPrelievo(prel);
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
  };

  // ─── Caricamento iniziale + polling ogni 30s ───────────────────────────────

  const caricaDati = async (silent = false) => {
    try {
      const [pazientiRes, pianiRes, esamiRes] = await Promise.all([
        api.get('/workplan/miei-pazienti'),
        api.get('/workplan'),
        api.get('/esami-strumentali').catch(() => ({ data: [] })),
      ]);
      const tuttiPiani: Piano[] = pianiRes.data || [];
      setTuttiIPiani(tuttiPiani);
      const tuttiPazientiAttivi = pazientiRes.data.filter((paz: Paziente) =>
        tuttiPiani.some(p => p.patient?._id === paz._id && p.status === 'pending')
      );
      setTuttiIPazienti(tuttiPazientiAttivi);
      const pazientiPerModalita = tuttiPazientiAttivi.filter((paz: Paziente) =>
        isConvenzione ? paz.tipoGestione === 'convenzione' : (paz.tipoGestione === 'privato' || !paz.tipoGestione)
      );
      setPazienti(pazientiPerModalita);
      const esami: any[] = esamiRes.data || [];
      setEsamiAttivi(esami.filter(e => e.status === 'pianificato' && !e.archiviato).length);
      // Prelievi di oggi per l'operatore
      try {
        const prelRes = await api.get('/prelievi/miei-oggi', {
          params: { tipoGestione: isConvenzione ? 'convenzione' : 'privato' }
        });
        setPrelieviOggi(prelRes.data || []);
      } catch { setPrelieviOggi([]); }
    } catch {}
    finally { if (!silent) setLoading(false); }
  };

  useEffect(() => {
    caricaDati();
    const interval = setInterval(() => caricaDati(true), 30000);
    return () => clearInterval(interval);
  }, []);

  // Rifiltra pazienti e resetta selezione quando cambia modalità
  useEffect(() => {
    const filtrati = tuttiIPazienti.filter((paz: Paziente) =>
      isConvenzione ? paz.tipoGestione === 'convenzione' : (paz.tipoGestione === 'privato' || !paz.tipoGestione)
    );
    setPazienti(filtrati);
    setPazienteSelezionato(null);
    setPiani([]);
    setPianoSelezionato(null);
    setMostraTuttiPiani(false);
  }, [modalita]);

  // ─── Leggi parametri URL per accettazione da email ───────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pianoId = params.get('piano');
    const azione = params.get('azione');
    if (pianoId && azione === 'accettazione' && tuttiIPiani.length > 0) {
      const piano = tuttiIPiani.find(p => p._id === pianoId);
      if (piano && piano.statoAccettazione === 'in_attesa') {
        setPianoDaAccettare(piano);
        setMostraModalAccettazione(true);
      }
    }
  }, [tuttiIPiani]);

  // ─── Selezione paziente ────────────────────────────────────────────────────

  const selezionaPaziente = async (paz: Paziente) => {
    setPazienteSelezionato(paz);
    setPianoSelezionato(null);
    setMostraTuttiPiani(false);
    resetDettagliPiano();
    setConsensoGDPRFirmato(false); setConsensoPrestazioneFirmato(false);
    caricaConsensiPaziente(paz._id);
    try {
      const res = await api.get('/workplan');
      const pianiPaz = res.data.filter((p: Piano) => p.patient?._id === paz._id);
      setPiani(pianiPaz);
      const pianiAttivi = pianiPaz.filter((p: Piano) => p.status === 'pending');
      if (pianiAttivi.length === 1) {
        selezionaPiano(pianiAttivi[0]);
      }
    } catch {}
  };

  const resetDettagliPiano = () => {
    setAccessi([]); setRiepilogo(null); setAccessoAperto(null);
    setDiario([]); setAllegati([]); setObiettivi([]);
    setShowDiario(false); setShowAllegati(false); setShowObiettivi(false);
    setShowExport(false); setExportData(null); setShowChatPaziente(false);
  };

  const caricaConsensiPaziente = async (patientId: string) => {
    const [gdpr, prestazione] = await Promise.allSettled([
      api.get(`/gdpr/consenso/${patientId}`),
      api.get(`/gdpr/consenso-prestazione/${patientId}`),
    ]);
    const gdprAttivo = gdpr.status === 'fulfilled' && !!gdpr.value.data?.consensoAttivo;
    const prestazioneAttiva = prestazione.status === 'fulfilled' && !!prestazione.value.data?.consensoAttivo;
    setConsensoGDPRFirmato(gdprAttivo);
    setConsensoPrestazioneFirmato(prestazioneAttiva);
    setConsensoGDPR(gdprAttivo ? gdpr.value.data.consenso : null);
    setConsensoPrestazione(prestazioneAttiva ? prestazione.value.data.consenso : null);
  };

  const esportaConsensoPdf = (tipo: 'gdpr' | 'prestazione') => {
    const consenso = tipo === 'gdpr' ? consensoGDPR : consensoPrestazione;
    if (!consenso || !pazienteSelezionato) return;
    const titolo = tipo === 'gdpr' ? 'CONSENSO AL TRATTAMENTO DEI DATI PERSONALI (GDPR)' : 'CONSENSO INFORMATO ALLA PRESTAZIONE SANITARIA E AI RISCHI DEL TRATTAMENTO';
    const dataFirma = new Date(consenso.dataFirma).toLocaleDateString('it-IT');
    const firma = consenso.firmaDigitale ? `<img src="${consenso.firmaDigitale}" style="max-width:260px;max-height:100px;border-bottom:1px solid #334155;" />` : 'Firma digitale archiviata';
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>${titolo}</title><style>body{font-family:Arial,sans-serif;color:#1f2937;line-height:1.55;padding:32px;max-width:820px;margin:auto}h1{font-size:18px;color:#1e4d8c;text-align:center}h2{font-size:14px;color:#1e4d8c;margin-top:24px}.box{border:1px solid #bfdbfe;background:#eff6ff;border-radius:8px;padding:14px;margin:16px 0}.firma{margin-top:22px}@media print{body{padding:16px}}</style></head><body><h1>${titolo}</h1><p style="text-align:center">Abbraccio Cure Domiciliari</p><div class="box"><strong>Paziente:</strong> ${pazienteSelezionato.firstName} ${pazienteSelezionato.lastName}<br><strong>Firmatario:</strong> ${consenso.nomeFirmatario} ${consenso.cognomeFirmatario} (${consenso.firmatoDa})<br><strong>Data firma:</strong> ${dataFirma}<br><strong>Operatore:</strong> ${consenso.operatoreEmail || 'N/D'}</div><h2>Attestazione</h2><p>${tipo === 'gdpr' ? 'Il firmatario autorizza il trattamento dei dati personali e sanitari necessari all’erogazione dei servizi, ai sensi del Regolamento UE 2016/679.' : 'Il firmatario conferma di aver ricevuto informazioni sulla prestazione sanitaria, sui rischi prevedibili e sulle limitazioni del trattamento.'}</p><div class="firma"><strong>Firma digitale del firmatario</strong><br>${firma}</div><p style="font-size:11px;color:#64748b;border-top:1px solid #cbd5e1;padding-top:12px;margin-top:28px;">Documento archiviato il ${dataFirma} — Abbraccio Cure Domiciliari</p><script>window.onload=function(){window.print()}</script></body></html>`);
    win.document.close();
    win.focus();
  };

  const inviaEmailConsenso = async (tipo: 'gdpr' | 'prestazione') => {
    if (!pazienteSelezionato) return;
    const email = window.prompt('Inserisci l’email del paziente o del firmatario');
    if (!email?.trim()) return;
    try {
      const endpoint = tipo === 'gdpr' ? `/gdpr/consenso/${pazienteSelezionato._id}/invia-email` : `/gdpr/consenso-prestazione/${pazienteSelezionato._id}/invia-email`;
      await api.post(endpoint, { email: email.trim() });
      alert('Copia del consenso inviata e registrata nello storico.');
      caricaConsensiPaziente(pazienteSelezionato._id);
    } catch (error: any) { alert(error.response?.data?.message || 'Errore durante l’invio email'); }
  };

  const salvaConsensoGDPR = async () => {
    if (!pazienteSelezionato || !nomeFirmatarioGDPR.trim() || !cognomeFirmatarioGDPR.trim() || !firmaGDPR) return;
    setSalvandoConsenso(true);
    try {
      await api.post('/gdpr/consenso', {
        patientId: pazienteSelezionato._id,
        finalita: { prestazioneSanitaria: true, auditInterno: true, fatturazione: true, ricercaScientifica: false },
        modalita: { informatico: true, cartaceo: true, telefonico: true },
        datiSensibili: { datiSanitari: true, datiEconomici: false, immagini: true },
        comunicazioneTerzi: { mediciSpecialisti: true, struttureSanitarie: true, familiari: false, assicurazioni: false },
        firmatoDa: 'paziente', nomeFirmatario: nomeFirmatarioGDPR.trim(), cognomeFirmatario: cognomeFirmatarioGDPR.trim(), versioneInformativa: 'v2025.1', firmaDigitale: firmaGDPR, emailNotifica: emailConsensoGDPR.trim() || undefined,
      });
      setConsensoGDPRFirmato(true); setShowConsensoGDPR(false); caricaConsensiPaziente(pazienteSelezionato._id);
    } catch (error: any) { alert(error.response?.data?.message || 'Errore nel salvataggio del consenso GDPR'); }
    setSalvandoConsenso(false);
  };

  const salvaConsensoPrestazione = async () => {
    if (!pazienteSelezionato || !nomeFirmatarioPrestazione.trim() || !cognomeFirmatarioPrestazione.trim() || !firmaPrestazione || !accettaPrestazione || !accettaRischiPrestazione) return;
    setSalvandoConsenso(true);
    try {
      await api.post('/gdpr/consenso-prestazione', {
        patientId: pazienteSelezionato._id, firmatoDa: ruoloFirmatarioPrestazione, nomeFirmatario: nomeFirmatarioPrestazione.trim(), cognomeFirmatario: cognomeFirmatarioPrestazione.trim(), relazioneConPaziente: ruoloFirmatarioPrestazione, prestazioneSanitaria: true, rischiTrattamento: true, firmaDigitale: firmaPrestazione, emailNotifica: emailConsensoPrestazione.trim() || undefined,
      });
      setConsensoPrestazioneFirmato(true); setShowConsensoPrestazione(false); caricaConsensiPaziente(pazienteSelezionato._id);
    } catch (error: any) { alert(error.response?.data?.message || 'Errore nel salvataggio del consenso alla prestazione'); }
    setSalvandoConsenso(false);
  };

  // ─── Vista tutti i piani attivi ───────────────────────────────────────────

  const apriTuttiPiani = () => {
    setMostraTuttiPiani(true);
    setPazienteSelezionato(null);
    setPianoSelezionato(null);
    resetDettagliPiano();
  };

  const selezionaPianoDaLista = async (piano: Piano) => {
    setMostraTuttiPiani(false);
    const paz = pazienti.find(p => p._id === piano.patient._id);
    if (paz) {
      setPazienteSelezionato(paz);
      setConsensoGDPRFirmato(false); setConsensoPrestazioneFirmato(false);
      caricaConsensiPaziente(paz._id);
      const res = await api.get('/workplan');
      setPiani(res.data.filter((p: Piano) => p.patient?._id === paz._id));
    }
    selezionaPiano(piano);
  };

  // ─── Selezione piano ───────────────────────────────────────────────────────

  const selezionaPiano = async (piano: Piano) => {
    setPianoSelezionato(piano);
    setLoadingPiano(true);
    resetDettagliPiano();
    try {
      const [accessiRes, diarioRes, allegatiRes, obiettiviRes] = await Promise.allSettled([
        api.get(`/workplan/${piano._id}/accessi`),
        api.get(`/diario/${piano._id}`),
        api.get(`/allegati/${piano._id}`),
        api.get(`/obiettivi/${piano._id}`),
      ]);
      if (accessiRes.status === 'fulfilled') {
        const data = accessiRes.value.data;
        setAccessi(data.accessi || []);
        setRiepilogo(data.riepilogo || null);
        const tuttiAccessi: Accesso[] = data.accessi || [];
        setAccessoAperto(tuttiAccessi.find((a: Accesso) => !a.oraUscita) || null);
      }
      if (diarioRes.status === 'fulfilled') setDiario(diarioRes.value.data || []);
      if (allegatiRes.status === 'fulfilled') setAllegati(allegatiRes.value.data || []);
      if (obiettiviRes.status === 'fulfilled') setObiettivi(obiettiviRes.value.data || []);
    } finally {
      setLoadingPiano(false);
    }
  };


  // ─── Diario clinico ────────────────────────────────────────────────────────

  const salvaDiario = async () => {
    if (!pianoSelezionato || !testoDiario.trim()) return;
    setSalvandoDiario(true);
    try {
      const pv: Record<string, number> = {};
      Object.entries(parametri).forEach(([k, v]) => { if (v !== '') pv[k] = parseFloat(v); });
      await api.post(`/diario/${pianoSelezionato._id}`, {
        testo: testoDiario,
        parametriVitali: Object.keys(pv).length > 0 ? pv : undefined,
        workPlanAccess: accessoAperto?._id,
      });
      setTestoDiario('');
      setParametri({});
      const res = await api.get(`/diario/${pianoSelezionato._id}`);
      setDiario(res.data || []);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nel salvataggio del diario');
    } finally {
      setSalvandoDiario(false);
    }
  };

  const firmaDiario = async () => {
    if (!diarioDaFirmare || !firmaDiarioGrafometrica) return;
    try {
      const res = await api.post(`/diario/firma/${diarioDaFirmare}`, { firmaGrafometrica: firmaDiarioGrafometrica });
      setDiario(prev => prev.map(e => e._id === diarioDaFirmare ? { ...e, firmato: true, dataFirma: res.data.entry?.dataFirma } : e));
      setDiarioDaFirmare(null);
      setFirmaDiarioGrafometrica('');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nella firma');
    }
  };

  const eliminaDiario = async (entryId: string) => {
    if (!confirm('Eliminare questa voce non firmata?')) return;
    try {
      await api.delete(`/diario/entry/${entryId}`);
      setDiario(prev => prev.filter(e => e._id !== entryId));
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nell’eliminazione');
    }
  };

  // ─── Allegati ──────────────────────────────────────────────────────────────

  const caricaAllegato = async () => {
    if (!pianoSelezionato || !fileAllegato) return;
    setCaricandoAllegato(true);
    try {
      const formData = new FormData();
      formData.append('file', fileAllegato);
      if (descrizioneAllegato) formData.append('descrizione', descrizioneAllegato);
      await api.post(`/allegati/${pianoSelezionato._id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFileAllegato(null);
      setDescrizioneAllegato('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      const res = await api.get(`/allegati/${pianoSelezionato._id}`);
      setAllegati(res.data || []);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nel caricamento allegato');
    } finally {
      setCaricandoAllegato(false);
    }
  };

  const apriAllegato = (all: Allegato) => {
    if (all.urlCloudinary) {
      window.open(all.urlCloudinary, '_blank');
    } else {
      const token = localStorage.getItem('authToken');
      window.open(`${import.meta.env.VITE_API_BASE_URL}/allegati/file/${all._id}?token=${token}`, '_blank');
    }
  };

  // ─── Obiettivi ─────────────────────────────────────────────────────────────

  const salvaRivalutazione = async (obId: string) => {
    if (!statoRivalutazione) return;
    setSalvandoRivalutazione(true);
    try {
      const res = await api.post(`/obiettivi/valuta/${obId}`, {
        stato: statoRivalutazione,
        note: noteRivalutazione,
      });
      setObiettivi(prev => prev.map(o => o._id === obId ? res.data : o));
      setRivalutandoId(null);
      setStatoRivalutazione('');
      setNoteRivalutazione('');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nella rivalutazione');
    } finally {
      setSalvandoRivalutazione(false);
    }
  };

  // ─── Export PDF ────────────────────────────────────────────────────────────

  const caricaExport = async () => {
    if (!pianoSelezionato) return;
    setLoadingExport(true);
    try {
      const params: any = {};
      if (exportDaData) params.dataInizio = exportDaData;
      if (exportAData) params.dataFine = exportAData;
      const res = await api.get(`/workplan/${pianoSelezionato._id}/accessi/export`, { params });
      setExportData(res.data);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nel caricamento export');
    } finally {
      setLoadingExport(false);
    }
  };

  const generaPDFHtml = () => {
    if (!exportData) return '';

    const righe = exportData.accessi.map((acc: any, idx: number) => {
      const haFirmaOp = !!acc.firmaOperatore;
      const haFirmaPaz = !!acc.firmaPaziente;
      const firmaOpHtml = haFirmaOp
        ? `<img src="${acc.firmaOperatore}" style="max-width:180px;max-height:60px;border:1px solid #d1d5db;border-radius:4px;display:block" />`
        : '<span style="color:#9ca3af;font-size:10px">Non raccolta</span>';
      const firmaPazHtml = haFirmaPaz
        ? `<div><img src="${acc.firmaPaziente}" style="max-width:180px;max-height:60px;border:1px solid #d1d5db;border-radius:4px;display:block" />
           ${acc.nomeFirmatarioPaziente ? `<span style="font-size:9px;color:#6b7280">${acc.ruoloFirmatario === 'caregiver' ? 'Caregiver' : 'Paziente'}: ${acc.nomeFirmatarioPaziente}</span>` : ''}</div>`
        : '<span style="color:#9ca3af;font-size:10px">Non raccolta</span>';
      return `
      <tr style="background:${idx % 2 === 0 ? '#fff' : '#f8fafc'}">
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;vertical-align:top">${acc.data}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;vertical-align:top">${acc.oraEntrata}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;vertical-align:top">${acc.oraUscita || '—'}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;vertical-align:top">${acc.durataOre}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;vertical-align:top">${acc.note || '—'}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;vertical-align:top">${firmaOpHtml}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;vertical-align:top">${firmaPazHtml}</td>
      </tr>`;
    }).join('');

    return `<html><head><title>Registro Accessi</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:12px;color:#222;margin:20px}
      h1{font-size:18px;color:#1e4d8c;margin-bottom:4px}
      h2{font-size:14px;color:#444;margin:0 0 16px}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th{background:#1e4d8c;color:#fff;padding:8px;text-align:left;font-size:11px}
      .riepilogo{margin-top:20px;background:#f1f5f9;padding:12px;border-radius:6px}
      .riepilogo p{margin:4px 0}
      @media print{body{margin:0} img{max-width:160px!important}}
    </style></head><body>
    <h1>Registro Accessi — ${exportData.piano.paziente}</h1>
    <h2>Operatore: ${exportData.piano.operatore} (${exportData.piano.ruoloOperatore})</h2>
    <p><strong>Attività:</strong> ${exportData.piano.task}</p>
    <p><strong>Periodo:</strong> ${exportData.periodo.da} — ${exportData.periodo.a}</p>
    <table>
      <thead>
        <tr>
          <th>Data</th><th>Entrata</th><th>Uscita</th><th>Durata</th><th>Note</th>
          <th>Firma Operatore</th><th>Firma Paziente/Caregiver</th>
        </tr>
      </thead>
      <tbody>${righe}</tbody>
    </table>
    <div class="riepilogo">
      <p><strong>Totale accessi:</strong> ${exportData.riepilogo.totaleAccessi}</p>
      <p><strong>Ore totali:</strong> ${exportData.riepilogo.oreTotali}</p>
    </div>
    </body></html>`;
  };

  const visualizzaPDF = () => {
    const html = generaPDFHtml();
    if (!html) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
  };

  const stampaPDF = () => {
    const html = generaPDFHtml();
    if (!html) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  // ─── Accettazione/Rifiuto incarico ─────────────────────────────────────────
  const accettaIncarico = async () => {
    if (!pianoDaAccettare) return;
    setLoadingAccettazione(true);
    try {
      await api.post(`/workplan/${pianoDaAccettare._id}/accetta`);
      setMostraModalAccettazione(false);
      setPianoDaAccettare(null);
      await caricaDati();
      alert('✅ Incarico accettato con successo!');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nell\'accettazione');
    } finally {
      setLoadingAccettazione(false);
    }
  };

  const rifiutaIncarico = async () => {
    if (!pianoDaAccettare) return;
    setLoadingAccettazione(true);
    try {
      await api.post(`/workplan/${pianoDaAccettare._id}/rifiuta`, { motivo: motivoRifiuto || 'Rifiutato dall\'operatore' });
      setMostraModalAccettazione(false);
      setPianoDaAccettare(null);
      setMotivoRifiuto('');
      await caricaDati();
      alert('❌ Incarico rifiutato. Il coordinatore verrà notificato.');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nel rifiuto');
    } finally {
      setLoadingAccettazione(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) return <section><p>Caricamento...</p></section>;

  // Filtra piani per modalità corrente
  const pianiModalita = tuttiIPiani.filter(p =>
    isConvenzione
      ? p.patient?.tipoGestione === 'convenzione'
      : (p.patient?.tipoGestione === 'privato' || !p.patient?.tipoGestione)
  );
  const pianiAttiviTutti = pianiModalita.filter(p => p.status === 'pending');
  const compensoTotaleGlobale = pianiModalita
    .filter(p => p.tipoCompenso && p.tipoCompenso !== 'nessuno')
    .reduce((sum, p) => sum + (p.compensoTotale || 0), 0);
  const compensoPagatoGlobale = pianiModalita
    .filter(p => p.tipoCompenso && p.tipoCompenso !== 'nessuno' && p.compensoPagato)
    .reduce((sum, p) => sum + (p.compensoTotale || 0), 0);

  return (
    <section>
      <h2>
        {mode === 'piani' ? '📋 Piani Lavorativi' : (pazienteSelezionato || mostraTuttiPiani ? '🏥 Il mio Piano di Lavoro' : '📊 Dashboard')}
      </h2>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL ACCETTAZIONE INCARICO (da email)
      ══════════════════════════════════════════════════════════════════════ */}
      {mostraModalAccettazione && pianoDaAccettare && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '28px', maxWidth: '480px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 8px', color: '#1e4d8c', fontSize: '1.3rem' }}>📋 Nuovo incarico assegnato</h3>
            <p style={{ color: '#666', margin: '0 0 20px', fontSize: '0.95rem' }}>
              Ti è stato assegnato un nuovo piano di lavoro. Accetta o rifiuta l'incarico.
            </p>

            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '0.9rem' }}><strong>Paziente:</strong> {pianoDaAccettare.patient?.firstName} {pianoDaAccettare.patient?.lastName}</p>
              <p style={{ margin: '0 0 8px', fontSize: '0.9rem' }}><strong>Attività:</strong> {pianoDaAccettare.task}</p>
              <p style={{ margin: 0, fontSize: '0.9rem' }}><strong>Data inizio:</strong> {new Date(pianoDaAccettare.date).toLocaleDateString('it-IT')}</p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', color: '#374151' }}>
                Motivo rifiuto (solo se rifiuti):
              </label>
              <textarea
                value={motivoRifiuto}
                onChange={e => setMotivoRifiuto(e.target.value)}
                placeholder="Es. impegnato in altro incarico, indisponibilità..."
                rows={2}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={accettaIncarico}
                disabled={loadingAccettazione}
                style={{ flex: 1, padding: '14px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '1rem', cursor: loadingAccettazione ? 'not-allowed' : 'pointer', opacity: loadingAccettazione ? 0.7 : 1 }}
              >
                {loadingAccettazione ? '⏳...' : '✅ Accetta'}
              </button>
              <button
                onClick={rifiutaIncarico}
                disabled={loadingAccettazione}
                style={{ flex: 1, padding: '14px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '1rem', cursor: loadingAccettazione ? 'not-allowed' : 'pointer', opacity: loadingAccettazione ? 0.7 : 1 }}
              >
                {loadingAccettazione ? '⏳...' : '❌ Rifiuta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          DASHBOARD OPERATORE (solo mode=dashboard)
      ══════════════════════════════════════════════════════════════════════ */}
      {mode === 'dashboard' && !pazienteSelezionato && !mostraTuttiPiani && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <button
              type="button"
              onClick={() => navigate('/piani-lavorativi')}
              style={{ background: 'rgba(5,150,105,0.07)', border: '1px solid rgba(5,150,105,0.3)', borderRadius: '10px', padding: '14px 12px', textAlign: 'center', cursor: 'pointer', minWidth: 0 }}
            >
              <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px', whiteSpace: 'nowrap' }}>Pazienti</div>
              <div style={{ fontSize: '2rem', fontWeight: '800', color: '#059669', lineHeight: 1 }}>{pazienti.length}</div>
            </button>
            <button
              type="button"
              onClick={() => navigate('/piani-lavorativi')}
              style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', padding: '14px 12px', textAlign: 'center', cursor: 'pointer', minWidth: 0 }}
            >
              <div style={{ fontSize: '0.7rem', color: '#d97706', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px', whiteSpace: 'nowrap' }}>Incarichi</div>
              <div style={{ fontSize: '2rem', fontWeight: '800', color: '#d97706', lineHeight: 1 }}>{pianiAttiviTutti.length}</div>
            </button>
            {/* Esami strumentali solo in modalità privata */}
            {!isConvenzione && (
              <button
                type="button"
                onClick={() => navigate('/esami-strumentali')}
                style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '10px', padding: '14px 10px', textAlign: 'center', cursor: 'pointer', minWidth: 0, overflow: 'hidden' }}
              >
                <div style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Esami Strumentali</div>
                <div style={{ fontSize: '2rem', fontWeight: '800', color: '#dc2626', lineHeight: 1 }}>{esamiAttivi}</div>
              </button>
            )}
            {/* Gestione Prelievi */}
            <button
              type="button"
              onClick={() => navigate('/centro-prelievi')}
              style={{ background: 'rgba(14,165,233,0.07)', border: '1px solid rgba(14,165,233,0.3)', borderRadius: '10px', padding: '14px 10px', textAlign: 'center', cursor: 'pointer', minWidth: 0, overflow: 'hidden' }}
            >
              <div style={{ fontSize: '0.7rem', color: '#0ea5e9', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Gestione Prelievi</div>
              <div style={{ fontSize: '2rem', fontWeight: '800', color: '#0ea5e9', lineHeight: 1 }}>💉</div>
            </button>
            <button
              type="button"
              onClick={() => { setShowEventoAvverso(true); setEventoSalvato(false); setFirmaEventoOp(''); setEventoForm({ ...eventoFormDefault }); }}
              style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '10px', padding: '14px 10px', textAlign: 'center', cursor: 'pointer', minWidth: 0, overflow: 'hidden' }}
            >
              <div style={{ fontSize: '0.68rem', color: '#dc2626', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>⚠️ Evento Avverso</div>
              <div style={{ fontSize: '1.8rem', lineHeight: 1 }}>🚨</div>
            </button>
            <button
              type="button"
              onClick={() => navigate('/chat')}
              style={{ background: 'rgba(13,148,136,0.07)', border: '1px solid rgba(13,148,136,0.3)', borderRadius: '10px', padding: '14px 10px', textAlign: 'center', cursor: 'pointer', minWidth: 0, overflow: 'hidden' }}
            >
              <div style={{ fontSize: '0.68rem', color: '#0f766e', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Chat coordinatore</div>
              <div style={{ fontSize: '1.8rem', lineHeight: 1 }}>💬</div>
            </button>
            <button
              type="button"
              onClick={() => navigate('/piani-lavorativi')}
              style={{ background: 'rgba(30,77,140,0.07)', border: '1px solid rgba(30,77,140,0.3)', borderRadius: '10px', padding: '14px 10px', textAlign: 'center', cursor: 'pointer', minWidth: 0, overflow: 'hidden' }}
            >
              <div style={{ fontSize: '0.68rem', color: '#1e4d8c', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Consensi e firme</div>
              <div style={{ fontSize: '1.8rem', lineHeight: 1 }}>✍️</div>
            </button>
            {compensoTotaleGlobale > 0 && (
              <button
                type="button"
                onClick={() => navigate('/compenso-incarichi')}
                style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '10px', padding: '12px 10px', textAlign: 'center', cursor: 'pointer', minWidth: 0, overflow: 'hidden' }}
              >
                <div style={{ fontSize: '0.7rem', color: '#7c3aed', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Compenso</div>
                <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#7c3aed', lineHeight: 1.1 }}>€{compensoTotaleGlobale.toFixed(0)}</div>
                {compensoPagatoGlobale > 0 && (
                  <div style={{ fontSize: '0.65rem', color: '#059669', fontWeight: '600', marginTop: '2px', whiteSpace: 'nowrap' }}>✓ €{compensoPagatoGlobale.toFixed(0)}</div>
                )}
              </button>
            )}
          </div>

          {/* ─── PLANNING PRELIEVI OGGI ─────────────────────────────────── */}
          {prelieviOggi.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0369a1', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                💉 Prelievi pianificati oggi ({prelieviOggi.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {prelieviOggi.map(prel => {
                  const aperto = prelievoAperto === prel._id;
                  return (
                    <div key={prel._id} style={{ background: 'white', border: '1px solid #bae6fd', borderLeft: `4px solid ${prel.status === 'eseguito' ? '#059669' : '#0369a1'}`, borderRadius: '8px', overflow: 'hidden' }}>
                      <button
                        type="button"
                        onClick={() => { setPrelievoAperto(aperto ? null : prel._id); setTestoDiariaPrelievo(''); setNoteEsecuzione(''); }}
                        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 14px', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, color: '#0369a1', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {prel.orario && <span style={{ background: '#eff6ff', padding: '1px 6px', borderRadius: '4px', fontSize: '0.78rem' }}>⏰ {prel.orario}</span>}
                            {prel.patient?.firstName || 'N/D'} {prel.patient?.lastName || ''}
                            <span style={{ padding: '1px 7px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 700, background: prel.status === 'eseguito' ? '#f0fdf4' : '#eff6ff', color: prel.status === 'eseguito' ? '#059669' : '#0369a1' }}>
                              {prel.status === 'eseguito' ? '✅ Eseguito' : '🔵 Da eseguire'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>💉 {prel.tipoPrelievo}</div>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{aperto ? '▲' : '▼'}</span>
                      </button>

                      {aperto && (
                        <div style={{ borderTop: '1px solid #e0f2fe', padding: '14px' }}>
                          {prel.note && <p style={{ fontSize: '0.83rem', color: '#475569', marginBottom: '10px' }}>📝 {prel.note}</p>}

                          {/* Registra esecuzione con firma touch */}
                          {prel.status === 'pianificato' && !stepFirmaPrelievo[prel._id] && (
                            <div style={{ marginBottom: '12px' }}>
                              <textarea
                                value={noteEsecuzione}
                                onChange={e => setNoteEsecuzione(e.target.value)}
                                placeholder="Note sull'esecuzione (facoltativo)..."
                                rows={2}
                                style={{ width: '100%', borderRadius: '6px', border: '1px solid #bae6fd', padding: '8px', fontSize: '0.83rem', resize: 'vertical', marginBottom: '8px' }}
                              />
                              <button
                                type="button"
                                onClick={() => setStepFirmaPrelievo(s => ({ ...s, [prel._id]: 'firma-operatore' }))}
                                style={{ background: '#0369a1', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontWeight: 700, fontSize: '0.83rem', width: '100%' }}
                              >
                                ✍️ Procedi con firma
                              </button>
                            </div>
                          )}

                          {/* Step 1: Firma operatore */}
                          {prel.status === 'pianificato' && stepFirmaPrelievo[prel._id] === 'firma-operatore' && (
                            <div style={{ background: '#f0f9ff', borderRadius: '10px', padding: '14px', marginBottom: '12px' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0369a1', marginBottom: '10px' }}>✍️ Step 1 — Firma Operatore</div>
                              <FirmaCanvas
                                label="Firma Operatore"
                                sublabel={`${user?.name}`}
                                onFirmaCompleta={(f: string) => setFirmaOpPrelievo(s => ({ ...s, [prel._id]: f }))}
                                onCancella={() => setFirmaOpPrelievo(s => ({ ...s, [prel._id]: '' }))}
                                altezza={140}
                              />
                              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                <button type="button" onClick={() => setStepFirmaPrelievo(s => { const n = { ...s }; delete n[prel._id]; return n; })} style={{ flex: 1, background: '#f1f5f9', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px', cursor: 'pointer', fontSize: '0.83rem' }}>Annulla</button>
                                <button
                                  type="button"
                                  disabled={!firmaOpPrelievo[prel._id]}
                                  onClick={() => setStepFirmaPrelievo(s => ({ ...s, [prel._id]: 'firma-paziente' }))}
                                  style={{ flex: 2, background: firmaOpPrelievo[prel._id] ? '#0369a1' : '#bae6fd', color: 'white', border: 'none', borderRadius: '6px', padding: '8px', cursor: firmaOpPrelievo[prel._id] ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '0.83rem' }}
                                >
                                  Avanti → Firma Paziente
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Step 2: Firma paziente */}
                          {prel.status === 'pianificato' && stepFirmaPrelievo[prel._id] === 'firma-paziente' && (
                            <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '14px', marginBottom: '12px' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#059669', marginBottom: '10px' }}>👇 Step 2 — Consegna al Paziente</div>
                              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                {(['paziente', 'caregiver'] as const).map(r => (
                                  <button key={r} type="button"
                                    onClick={() => setRuoloFirmatarioPrelievo(s => ({ ...s, [prel._id]: r }))}
                                    style={{ flex: 1, padding: '8px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.83rem', background: ruoloFirmatarioPrelievo[prel._id] === r ? '#059669' : '#f3f4f6', color: ruoloFirmatarioPrelievo[prel._id] === r ? 'white' : '#374151', border: `2px solid ${ruoloFirmatarioPrelievo[prel._id] === r ? '#059669' : '#d1d5db'}` }}
                                  >{r === 'paziente' ? '🧑 Paziente' : '👨‍👩‍👧 Caregiver'}</button>
                                ))}
                              </div>
                              <input
                                type="text"
                                placeholder={`Nome ${ruoloFirmatarioPrelievo[prel._id] === 'caregiver' ? 'caregiver' : `${prel.patient?.firstName || 'N/D'} ${prel.patient?.lastName || ''}`}`}
                                value={nomeFirmatarioPrelievo[prel._id] || ''}
                                onChange={e => setNomeFirmatarioPrelievo(s => ({ ...s, [prel._id]: e.target.value }))}
                                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', marginBottom: '10px', fontSize: '0.83rem' }}
                              />
                              <FirmaCanvas
                                label={`Firma ${ruoloFirmatarioPrelievo[prel._id] === 'caregiver' ? 'Caregiver' : 'Paziente'}`}
                                sublabel="Firma per confermare il prelievo eseguito"
                                onFirmaCompleta={(f: string) => setFirmaPazPrelievo(s => ({ ...s, [prel._id]: f }))}
                                onCancella={() => setFirmaPazPrelievo(s => ({ ...s, [prel._id]: '' }))}
                                altezza={140}
                              />
                              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                <button type="button" onClick={() => setStepFirmaPrelievo(s => ({ ...s, [prel._id]: 'firma-operatore' }))} style={{ flex: 1, background: '#f1f5f9', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px', cursor: 'pointer', fontSize: '0.83rem' }}>← Indietro</button>
                                <button
                                  type="button"
                                  disabled={registrandoPrelievo === prel._id || !firmaPazPrelievo[prel._id]}
                                  onClick={async () => {
                                    setRegistrandoPrelievo(prel._id);
                                    try {
                                      await api.post(`/prelievi/${prel._id}/esegui`, {
                                        noteEsecuzione,
                                        firmaOperatore: firmaOpPrelievo[prel._id],
                                        firmaPaziente: firmaPazPrelievo[prel._id],
                                        nomeFirmatarioPaziente: nomeFirmatarioPrelievo[prel._id] || `${prel.patient?.firstName || 'N/D'} ${prel.patient?.lastName || ''}`,
                                        ruoloFirmatario: ruoloFirmatarioPrelievo[prel._id] || 'paziente',
                                      });
                                      setNoteEsecuzione('');
                                      setPrelievoAperto(null);
                                      setStepFirmaPrelievo(s => { const n = { ...s }; delete n[prel._id]; return n; });
                                      setFirmaOpPrelievo(s => { const n = { ...s }; delete n[prel._id]; return n; });
                                      setFirmaPazPrelievo(s => { const n = { ...s }; delete n[prel._id]; return n; });
                                      await caricaDati(true);
                                    } catch { /* noop */ }
                                    setRegistrandoPrelievo(null);
                                  }}
                                  style={{ flex: 2, background: firmaPazPrelievo[prel._id] ? '#059669' : '#d1fae5', color: 'white', border: 'none', borderRadius: '6px', padding: '8px', cursor: firmaPazPrelievo[prel._id] ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '0.83rem' }}
                                >
                                  {registrandoPrelievo === prel._id ? '...' : '✅ Conferma e salva'}
                                </button>
                              </div>
                            </div>
                          )}
                          {prel.status === 'eseguito' && prel.dataEsecuzione && (
                            <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '10px', marginBottom: '12px', fontSize: '0.83rem', color: '#166534' }}>
                              ✅ Eseguito il {new Date(prel.dataEsecuzione).toLocaleString('it-IT')}
                              {prel.noteEsecuzione && <div style={{ marginTop: '4px', color: '#374151' }}>{prel.noteEsecuzione}</div>}
                            </div>
                          )}

                          {/* Firme */}
                          {prel.status === 'eseguito' && (prel.firmaOperatore || prel.firmaPaziente) && (
                            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px', marginBottom: '12px', border: '1px solid #e2e8f0' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#374151', marginBottom: '10px' }}>✍️ Firme Registrate</div>
                              {prel.firmaOperatore && (
                                <div style={{ marginBottom: '10px' }}>
                                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Firma Operatore:</div>
                                  <img src={prel.firmaOperatore} alt="Firma operatore" style={{ maxWidth: '200px', maxHeight: '100px', border: '1px solid #d1d5db', borderRadius: '4px', background: 'white' }} />
                                </div>
                              )}
                              {prel.firmaPaziente && (
                                <div>
                                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>
                                    Firma {prel.ruoloFirmatario === 'caregiver' ? 'Caregiver' : 'Paziente'} {prel.nomeFirmatarioPaziente && `(${prel.nomeFirmatarioPaziente})`}:
                                  </div>
                                  <img src={prel.firmaPaziente} alt="Firma paziente" style={{ maxWidth: '200px', maxHeight: '100px', border: '1px solid #d1d5db', borderRadius: '4px', background: 'white' }} />
                                </div>
                              )}
                            </div>
                          )}

                          {/* Pulsanti PDF */}
                          {prel.status === 'eseguito' && (
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                              <button
                                onClick={() => stampaPrelievoPDF(prel)}
                                style={{ flex: 1, background: '#0d9488', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.83rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                              >
                                <Printer size={14} /> Stampa Verbale
                              </button>
                              <button
                                onClick={() => visualizzaPrelievoPDF(prel)}
                                style={{ flex: 1, background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.83rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                              >
                                <Eye size={14} /> Visualizza Verbale
                              </button>
                            </div>
                          )}

                          {/* Diaria */}
                          <div style={{ fontWeight: 600, fontSize: '0.83rem', color: '#374151', marginBottom: '6px' }}>
                            📋 Diaria ({prel.diaria.length})
                          </div>
                          {prel.diaria.map(d => (
                            <div key={d._id} style={{ background: '#f8fafc', borderRadius: '6px', padding: '6px 10px', marginBottom: '4px', fontSize: '0.8rem' }}>
                              <div style={{ fontWeight: 600, color: '#475569' }}>{d.autore} · {new Date(d.data).toLocaleString('it-IT')}</div>
                              <div style={{ color: '#334155' }}>{d.testo}</div>
                            </div>
                          ))}
                          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                            <textarea
                              value={testoDiariaPrelievo}
                              onChange={e => setTestoDiariaPrelievo(e.target.value)}
                              placeholder="Aggiungi nota clinica..."
                              rows={2}
                              style={{ flex: 1, borderRadius: '6px', border: '1px solid #d1d5db', padding: '6px 8px', fontSize: '0.8rem', resize: 'vertical' }}
                            />
                            <button
                              type="button"
                              disabled={salvandoDiariaPrelievo || !testoDiariaPrelievo.trim()}
                              onClick={async () => {
                                setSalvandoDiariaPrelievo(true);
                                try {
                                  await api.post(`/prelievi/${prel._id}/diaria`, { testo: testoDiariaPrelievo });
                                  setTestoDiariaPrelievo('');
                                  await caricaDati(true);
                                } catch { /* noop */ }
                                setSalvandoDiariaPrelievo(false);
                              }}
                              style={{ background: '#0369a1', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', alignSelf: 'flex-end' }}
                            >
                              {salvandoDiariaPrelievo ? '...' : 'Salva'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <p style={{ color: 'var(--gray-500)', margin: 0, fontSize: '0.95rem' }}>
              Seleziona un paziente per operare, oppure visualizza tutti i piani attivi.
            </p>
            <button
              type="button"
              onClick={apriTuttiPiani}
              style={{ background: '#1e4d8c', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}
            >
              📋 Tutti i piani attivi ({pianiAttiviTutti.length})
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          LISTA PAZIENTI/PIANI (mode=piani o dopo click "Tutti i piani attivi")
      ══════════════════════════════════════════════════════════════════════ */}
      {(mode === 'piani' || mostraTuttiPiani) && !pazienteSelezionato && (
        <div>
          {mode === 'piani' && (
            <div style={{ marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => navigate('/portale-operatore')}
                style={{ background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 14px', cursor: 'pointer', fontSize: '0.88rem' }}
              >
                ← Torna alla dashboard
              </button>
            </div>
          )}
          {pazienti.length === 0 ? (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid #f59e0b', borderRadius: '8px', padding: '16px', color: '#92400e' }}>
              ⚠️ Nessun paziente assegnato. Contatta il coordinatore.
            </div>
          ) : (
            <div>
              <div style={{ fontWeight: '600', marginBottom: '12px', fontSize: '0.95rem', color: '#374151' }}>
                {isConvenzione ? '🏥 Pazienti in convenzione' : '👤 Pazienti in carico'} ({pazienti.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pazienti.map(paz => {
                  const pianiPaz = tuttiIPiani.filter(p => p.patient?._id === paz._id && p.status === 'pending');
                  const compensoTotale = tuttiIPiani
                    .filter(p => p.patient?._id === paz._id && p.tipoCompenso && p.tipoCompenso !== 'nessuno')
                    .reduce((sum, p) => sum + (p.compensoTotale || 0), 0);
                  const compensoPagato = tuttiIPiani
                    .filter(p => p.patient?._id === paz._id && p.tipoCompenso && p.tipoCompenso !== 'nessuno' && p.compensoPagato)
                    .reduce((sum, p) => sum + (p.compensoTotale || 0), 0);
                  const haCompenso = tuttiIPiani.some(p => p.patient?._id === paz._id && p.tipoCompenso && p.tipoCompenso !== 'nessuno');
                  return (
                    <button
                      key={paz._id}
                      type="button"
                      onClick={() => selezionaPaziente(paz)}
                      style={{
                        background: '#fff', border: '1px solid #e2e8f0', borderLeft: '4px solid #1e4d8c',
                        borderRadius: '8px', padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '700', fontSize: '1rem', color: '#1e4d8c', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          {paz.tipoGestione === 'convenzione' ? '🏥' : '👤'} {paz?.firstName || 'N/D'} {paz?.lastName || ''}
                          {paz.tipoGestione === 'convenzione' && (
                            <span style={{ background: '#0284c7', color: 'white', fontSize: '0.68rem', fontWeight: '700', padding: '2px 7px', borderRadius: '4px', letterSpacing: '0.03em' }}>CONVENZIONE</span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.83rem', color: '#555', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                          {paz.address && <span>📍 {paz.address}</span>}
                          {paz.contactPhone && <span>📞 {paz.contactPhone}</span>}
                          {paz.tipoGestione === 'convenzione' && paz.siat?.tipologiaCura
                            ? <span>🩺 {paz.siat.tipologiaCura}</span>
                            : paz.assistanceNeeds && <span>🩺 {paz.assistanceNeeds}</span>}
                          {paz.siat?.asl && <span>🏛 {paz.siat.asl}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
                        {haCompenso && (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.72rem', color: '#7c3aed', fontWeight: '600', textTransform: 'uppercase' }}>Compenso maturato</div>
                            <div style={{ fontWeight: '800', color: '#7c3aed', fontSize: '1rem' }}>€ {compensoTotale.toFixed(2)}</div>
                            {compensoPagato > 0 && (
                              <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: '600' }}>✅ € {compensoPagato.toFixed(2)} pagato</div>
                            )}
                          </div>
                        )}
                        <span style={{
                          background: pianiPaz.length > 0 ? 'rgba(5,150,105,0.1)' : 'rgba(107,114,128,0.1)',
                          color: pianiPaz.length > 0 ? '#065f46' : '#6b7280',
                          border: `1px solid ${pianiPaz.length > 0 ? '#059669' : '#9ca3af'}`,
                          borderRadius: '20px', padding: '4px 12px', fontSize: '0.82rem', fontWeight: '700',
                        }}>
                          {pianiPaz.length} {pianiPaz.length === 1 ? 'piano attivo' : 'piani attivi'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VISTA: Tutti i piani attivi
      ══════════════════════════════════════════════════════════════════════ */}
      {mostraTuttiPiani && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setMostraTuttiPiani(false)}
              style={{ background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 14px', cursor: 'pointer', fontSize: '0.88rem' }}
            >
              ← Torna ai pazienti
            </button>
            <h3 style={{ margin: 0, color: '#1e4d8c', fontSize: '1.05rem' }}>
              📋 Tutti i piani attivi ({pianiAttiviTutti.length})
            </h3>
          </div>

          {pianiAttiviTutti.length === 0 ? (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid #f59e0b', borderRadius: '8px', padding: '16px', color: '#92400e' }}>
              ⚠️ Nessun piano attivo al momento.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pianiAttiviTutti.map(piano => (
                <button
                  key={piano._id}
                  type="button"
                  onClick={() => selezionaPianoDaLista(piano)}
                  style={{
                    background: '#fff', border: '1px solid #e2e8f0', borderLeft: '4px solid #059669',
                    borderRadius: '8px', padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#1e4d8c', marginBottom: '3px' }}>
                      👤 {piano.patient?.firstName || 'N/D'} {piano.patient?.lastName || ''}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#374151', marginBottom: '2px' }}>
                      {piano.category} — {piano.task}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#888' }}>
                      📅 {formatData(piano.date)}{piano.dataFine ? ` → ${formatData(piano.dataFine)}` : ''}
                    </div>
                  </div>
                  <span style={{ background: 'rgba(5,150,105,0.1)', color: '#065f46', border: '1px solid #059669', borderRadius: '20px', padding: '4px 12px', fontSize: '0.8rem', fontWeight: '700', flexShrink: 0 }}>
                    ✅ Attivo
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PAZIENTE SELEZIONATO: info + lista piani
      ══════════════════════════════════════════════════════════════════════ */}
      {pazienteSelezionato && !pianoSelezionato && (
        <div>
          <div style={{ marginBottom: '12px' }}>
            <button
              type="button"
              onClick={() => { setPazienteSelezionato(null); setPianoSelezionato(null); resetDettagliPiano(); }}
              style={{ background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 14px', cursor: 'pointer', fontSize: '0.88rem' }}
            >
              ← Torna ai pazienti
            </button>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
              <strong>📋 {pazienteSelezionato?.firstName || 'N/D'} {pazienteSelezionato?.lastName || ''}</strong>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setShowChatPaziente(v => !v)} style={{ background: '#0d9488', color: 'white', border: 'none', borderRadius: '7px', padding: '8px 12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>💬 {showChatPaziente ? 'Chiudi chat' : 'Apri chat paziente'}</button>
                <ReportGenerator patientId={pazienteSelezionato._id} patientName={`${pazienteSelezionato.firstName} ${pazienteSelezionato.lastName}`} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
              <button type="button" onClick={() => setShowConsensoGDPR(true)} style={{ background: consensoGDPRFirmato ? '#dcfce7' : '#dc2626', color: consensoGDPRFirmato ? '#166534' : 'white', border: `1px solid ${consensoGDPRFirmato ? '#86efac' : '#b91c1c'}`, borderRadius: '7px', padding: '8px 12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>{consensoGDPRFirmato ? '✅ Consenso GDPR firmato' : '⚠️ Firma consenso GDPR'}</button>
              <button type="button" onClick={() => setShowConsensoPrestazione(true)} style={{ background: consensoPrestazioneFirmato ? '#dcfce7' : '#c2410c', color: consensoPrestazioneFirmato ? '#166534' : 'white', border: `1px solid ${consensoPrestazioneFirmato ? '#86efac' : '#9a3412'}`, borderRadius: '7px', padding: '8px 12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>{consensoPrestazioneFirmato ? '✅ Consenso prestazione firmato' : '⚠️ Firma consenso prestazione e rischi'}</button>
              <button type="button" onClick={() => setShowCustomerSatisfaction(true)} style={{ background: '#ede9fe', color: '#5b21b6', border: '1px solid #c4b5fd', borderRadius: '7px', padding: '8px 12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>⭐ Customer Satisfaction</button>
              <button type="button" onClick={() => setShowSchedaDimissione(true)} style={{ background: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd', borderRadius: '7px', padding: '8px 12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>📋 Scheda dimissione</button>
              {consensoGDPRFirmato && <><button type="button" onClick={() => esportaConsensoPdf('gdpr')} style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #93c5fd', borderRadius: '7px', padding: '8px 12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>📄 PDF GDPR</button><button type="button" onClick={() => inviaEmailConsenso('gdpr')} style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #93c5fd', borderRadius: '7px', padding: '8px 12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>✉️ Invia GDPR</button></>}
              {consensoPrestazioneFirmato && <><button type="button" onClick={() => esportaConsensoPdf('prestazione')} style={{ background: '#fff7ed', color: '#9a3412', border: '1px solid #fdba74', borderRadius: '7px', padding: '8px 12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>📄 PDF prestazione</button><button type="button" onClick={() => inviaEmailConsenso('prestazione')} style={{ background: '#fff7ed', color: '#9a3412', border: '1px solid #fdba74', borderRadius: '7px', padding: '8px 12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>✉️ Invia prestazione</button></>}
            </div>
            <div style={{ fontSize: '0.88rem', color: '#555', marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {pazienteSelezionato.address && <span>📍 {pazienteSelezionato.address}</span>}
              {pazienteSelezionato.contactPhone && <span>📞 {pazienteSelezionato.contactPhone}</span>}
              {pazienteSelezionato.assistanceNeeds && <span>🩺 {pazienteSelezionato.assistanceNeeds}</span>}
            </div>
          </div>

          {showChatPaziente && (
            <div style={{ marginBottom: '20px' }}>
              <ChatWidget
                scope="patient"
                patientId={pazienteSelezionato._id}
                title={`💬 Chat con coordinatore — ${pazienteSelezionato.firstName} ${pazienteSelezionato.lastName}`}
                height={420}
              />
            </div>
          )}

          {piani.length === 0 ? (
            <p style={{ color: '#888', fontStyle: 'italic' }}>Nessun piano assegnato per questo paziente.</p>
          ) : (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontWeight: '600', marginBottom: '10px', fontSize: '0.95rem', color: '#374151' }}>
                📋 Piani di lavoro ({piani.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {piani.map(piano => (
                  <button
                    key={piano._id}
                    type="button"
                    onClick={() => selezionaPiano(piano)}
                    style={{
                      background: piano.status === 'pending' ? '#fff' : '#f9fafb',
                      border: `1px solid ${piano.status === 'pending' ? '#059669' : '#e2e8f0'}`,
                      borderLeft: `4px solid ${piano.status === 'pending' ? '#059669' : '#9ca3af'}`,
                      borderRadius: '6px', padding: '10px 16px', cursor: 'pointer', fontSize: '0.9rem',
                      textAlign: 'left', minWidth: '180px',
                    }}
                  >
                    <div style={{ fontWeight: '600', color: '#1e4d8c' }}>{piano.category}</div>
                    <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '2px' }}>
                      {formatData(piano.date)}{piano.dataFine ? ` → ${formatData(piano.dataFine)}` : ''}
                    </div>
                    <div style={{ fontSize: '0.75rem', marginTop: '3px', color: piano.status === 'pending' ? '#059669' : '#6b7280', fontWeight: '600' }}>
                      {piano.status === 'pending' ? '✅ Attivo' : piano.status === 'completed' ? '✔ Completato' : '✕ Annullato'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          DETTAGLIO PIANO
      ══════════════════════════════════════════════════════════════════════ */}
      {pianoSelezionato && (
        loadingPiano ? <p>Caricamento piano...</p> : (
          <div>
            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => { setPianoSelezionato(null); resetDettagliPiano(); }}
                style={{ background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                ← Torna ai piani
              </button>
              {pazienteSelezionato && (
                <span style={{ fontSize: '0.85rem', color: '#888' }}>
                  {pazienteSelezionato?.firstName || 'N/D'} {pazienteSelezionato?.lastName || ''} › {pianoSelezionato?.category || 'N/D'}
                </span>
              )}
            </div>

            {/* Info piano */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 6px', color: '#1e4d8c' }}>📋 {pianoSelezionato.category}</h3>
              <p style={{ margin: '0 0 4px', color: '#374151' }}>{pianoSelezionato.task}</p>
              {pianoSelezionato.notes && <p style={{ margin: '0 0 12px', color: '#666', fontSize: '0.9rem' }}>📝 {pianoSelezionato.notes}</p>}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: pianoSelezionato.notes ? 0 : '10px' }}>
                <button type="button" onClick={() => setShowChatPaziente(v => !v)} style={{ background: '#0d9488', color: 'white', border: 'none', borderRadius: '7px', padding: '9px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.84rem' }}>💬 {showChatPaziente ? 'Chiudi chat' : 'Apri chat paziente'}</button>
                {pazienteSelezionato && <ReportGenerator patientId={pazienteSelezionato._id} patientName={`${pazienteSelezionato.firstName} ${pazienteSelezionato.lastName}`} />}
                <button type="button" onClick={() => setShowConsensoGDPR(true)} style={{ background: consensoGDPRFirmato ? '#dcfce7' : '#dc2626', color: consensoGDPRFirmato ? '#166534' : 'white', border: `1px solid ${consensoGDPRFirmato ? '#86efac' : '#b91c1c'}`, borderRadius: '7px', padding: '9px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.84rem' }}>{consensoGDPRFirmato ? '✅ GDPR firmato' : '⚠️ Firma GDPR'}</button>
                <button type="button" onClick={() => setShowConsensoPrestazione(true)} style={{ background: consensoPrestazioneFirmato ? '#dcfce7' : '#c2410c', color: consensoPrestazioneFirmato ? '#166534' : 'white', border: `1px solid ${consensoPrestazioneFirmato ? '#86efac' : '#9a3412'}`, borderRadius: '7px', padding: '9px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.84rem' }}>{consensoPrestazioneFirmato ? '✅ Prestazione firmata' : '⚠️ Firma prestazione e rischi'}</button>
                <button type="button" onClick={() => setShowCustomerSatisfaction(true)} style={{ background: '#ede9fe', color: '#5b21b6', border: '1px solid #c4b5fd', borderRadius: '7px', padding: '9px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.84rem' }}>⭐ Customer Satisfaction</button>
                <button type="button" onClick={() => setShowSchedaDimissione(true)} style={{ background: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd', borderRadius: '7px', padding: '9px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.84rem' }}>📋 Scheda dimissione</button>
                {consensoGDPRFirmato && <><button type="button" onClick={() => esportaConsensoPdf('gdpr')} style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #93c5fd', borderRadius: '7px', padding: '9px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.84rem' }}>📄 PDF GDPR</button><button type="button" onClick={() => inviaEmailConsenso('gdpr')} style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #93c5fd', borderRadius: '7px', padding: '9px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.84rem' }}>✉️ Invia GDPR</button></>}
                {consensoPrestazioneFirmato && <><button type="button" onClick={() => esportaConsensoPdf('prestazione')} style={{ background: '#fff7ed', color: '#9a3412', border: '1px solid #fdba74', borderRadius: '7px', padding: '9px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.84rem' }}>📄 PDF prestazione</button><button type="button" onClick={() => inviaEmailConsenso('prestazione')} style={{ background: '#fff7ed', color: '#9a3412', border: '1px solid #fdba74', borderRadius: '7px', padding: '9px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.84rem' }}>✉️ Invia prestazione</button></>}
              </div>
            </div>

            {showChatPaziente && pazienteSelezionato && (
              <div style={{ marginBottom: '16px' }}>
                <ChatWidget scope="patient" patientId={pazienteSelezionato._id} title={`💬 Chat con coordinatore — ${pazienteSelezionato.firstName} ${pazienteSelezionato.lastName}`} height={420} />
              </div>
            )}

            {/* ── COMPENSO MATURATO ── */}
            {pianoSelezionato.tipoCompenso && pianoSelezionato.tipoCompenso !== 'nessuno' && (
              <div style={{ background: riepilogo?.compensoPagato ? 'rgba(5,150,105,0.06)' : 'rgba(124,58,237,0.06)', border: `1px solid ${riepilogo?.compensoPagato ? 'rgba(5,150,105,0.3)' : 'rgba(124,58,237,0.3)'}`, borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 12px', color: riepilogo?.compensoPagato ? '#065f46' : '#7c3aed', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  💰 Compenso maturato
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                  <div style={{ background: '#f5f3ff', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: '#7c3aed', fontWeight: '600', marginBottom: '2px', textTransform: 'uppercase' }}>
                      {pianoSelezionato.tipoCompenso === 'orario' ? 'Tariffa/ora' : 'Compenso fisso'}
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#7c3aed' }}>
                      € {(pianoSelezionato.tariffa || 0).toFixed(2)}
                      {pianoSelezionato.tipoCompenso === 'orario' && <span style={{ fontSize: '0.7rem', fontWeight: '400' }}>/h</span>}
                    </div>
                  </div>
                  {pianoSelezionato.tipoCompenso === 'orario' && riepilogo && (
                    <div style={{ background: '#f0f9ff', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: '600', marginBottom: '2px', textTransform: 'uppercase' }}>Ore lavorate</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0284c7' }}>{riepilogo.oreTotali}h</div>
                    </div>
                  )}
                  {riepilogo && (
                    <div style={{ background: '#fefce8', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: '600', marginBottom: '2px', textTransform: 'uppercase' }}>Accessi</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#d97706' }}>{riepilogo.accessiCompletati}</div>
                    </div>
                  )}
                  {riepilogo && (
                    <div style={{ background: riepilogo.compensoPagato ? '#f0fdf4' : '#fdf4ff', borderRadius: '8px', padding: '10px 14px', textAlign: 'center', border: `1px solid ${riepilogo.compensoPagato ? '#bbf7d0' : '#e9d5ff'}` }}>
                      <div style={{ fontSize: '0.72rem', color: riepilogo.compensoPagato ? '#059669' : '#7c3aed', fontWeight: '600', marginBottom: '2px', textTransform: 'uppercase' }}>
                        {riepilogo.compensoPagato ? '✅ Pagato' : '💰 Maturato'}
                      </div>
                      <div style={{ fontSize: '1.3rem', fontWeight: '800', color: riepilogo.compensoPagato ? '#059669' : '#7c3aed' }}>
                        € {(riepilogo.compensoSalvato > 0 ? riepilogo.compensoSalvato : riepilogo.compensoCalcolato).toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
                {riepilogo && !riepilogo.compensoPagato && (
                  <p style={{ margin: '10px 0 0', fontSize: '0.8rem', color: '#888', fontStyle: 'italic' }}>
                    ⏳ In attesa di pagamento da parte del coordinatore.
                  </p>
                )}
                {riepilogo?.compensoPagato && (
                  <p style={{ margin: '10px 0 0', fontSize: '0.8rem', color: '#059669', fontWeight: '600' }}>
                    ✅ Compenso già pagato.
                  </p>
                )}
              </div>
            )}

            {/* ── REGISTRAZIONE ACCESSO (apre pagina dedicata ottimizzata tablet) ── */}
            <div style={{ background: accessoAperto ? 'rgba(5,150,105,0.06)' : 'rgba(30,77,140,0.04)', border: `1px solid ${accessoAperto ? 'rgba(5,150,105,0.3)' : 'rgba(30,77,140,0.2)'}`, borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 10px', color: accessoAperto ? '#065f46' : '#1e4d8c' }}>
                {accessoAperto ? '🟢 Accesso in corso' : '🔵 Registra accesso'}
              </h4>
              {accessoAperto && (
                <p style={{ margin: '0 0 12px', fontSize: '0.9rem', color: '#374151' }}>
                  Entrata: <strong>{formatOra(accessoAperto.oraEntrata)}</strong> del <strong>{formatData(accessoAperto.oraEntrata)}</strong>
                </p>
              )}
              <button
                type="button"
                onClick={() => pianoSelezionato && navigate(`/registrazione-accesso/${pianoSelezionato._id}`)}
                style={{
                  width: '100%', padding: '16px', borderRadius: '10px', border: 'none',
                  cursor: 'pointer', backgroundColor: accessoAperto ? '#16a34a' : '#1e4d8c',
                  color: 'white', fontWeight: '700', fontSize: '1.05rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                }}
              >
                {accessoAperto ? '⏹️ Registra Uscita con Firma' : '▶️ Registra Entrata'}
                <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>(ottimizzato tablet)</span>
              </button>
            </div>

            {/* ── SEZIONE DIARIO CLINICO ── */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '16px', overflow: 'hidden' }}>
              <button type="button" onClick={() => setShowDiario(!showDiario)}
                style={{ width: '100%', background: '#f8fafc', border: 'none', padding: '14px 16px', textAlign: 'left', cursor: 'pointer', fontWeight: '600', fontSize: '0.95rem', color: '#374151', display: 'flex', justifyContent: 'space-between' }}>
                <span>📓 Diario clinico ({diario.length} voci)</span>
                <span>{showDiario ? '▲' : '▼'}</span>
              </button>
              {showDiario && (
                <div style={{ padding: '16px' }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                    <h5 style={{ margin: '0 0 12px', color: '#1e4d8c' }}>✏️ Nuova voce diario</h5>
                    {pianoSelezionato && (
                      <div style={{ marginBottom: '12px' }}>
                        <VoiceRecorder
                          workPlanId={pianoSelezionato._id}
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
                          }}
                          disabled={salvandoDiario}
                        />
                      </div>
                    )}
                    <label style={{ display: 'block', marginBottom: '12px' }}>
                      Diaria *
                      <textarea
                        value={testoDiario}
                        onChange={e => setTestoDiario(e.target.value)}
                        placeholder="Descrivi le attività svolte, le condizioni del paziente, le osservazioni cliniche..."
                        rows={4}
                        style={{ width: '100%', marginTop: '4px', padding: '8px 12px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box' }}
                      />
                    </label>
                    <h6 style={{ margin: '0 0 10px', color: '#374151', fontWeight: '600' }}>📊 Parametri vitali (opzionali)</h6>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                      {PARAMETRI_VITALI.map(({ key, label, unit, step }) => (
                        <label key={key} style={{ fontSize: '0.82rem' }}>
                          {label}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <input
                              type="number"
                              value={parametri[key] || ''}
                              onChange={e => setParametri(prev => ({ ...prev, [key]: e.target.value }))}
                              step={step}
                              min={key === 'dolore' ? '0' : undefined}
                              max={key === 'dolore' ? '10' : undefined}
                              placeholder="—"
                              style={{ flex: 1, padding: '5px 8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '0.85rem' }}
                            />
                            <span style={{ fontSize: '0.75rem', color: '#888', whiteSpace: 'nowrap' }}>{unit}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                    <Button
                      onClick={salvaDiario}
                      loading={salvandoDiario}
                      disabled={!testoDiario.trim()}
                      variant="primary"
                      icon={<FileText size={16} />}
                    >
                      Salva voce diario
                    </Button>
                  </div>

                  {diario.length === 0 ? (
                    <p style={{ color: '#888', fontStyle: 'italic' }}>Nessuna voce nel diario.</p>
                  ) : (
                    <div className="document-list">
                      <ul>
                        {diario.map(entry => (
                          <li key={entry._id}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: '600', fontSize: '0.88rem' }}>📅 {formatData(entry.dataRegistrazione)} {formatOra(entry.dataRegistrazione)}</span>
                                  <span style={{ fontSize: '0.8rem', color: '#888' }}>✍️ {entry.staffName}</span>
                                  {entry.firmato && (
                                    <span style={{ background: 'rgba(5,150,105,0.1)', color: '#065f46', border: '1px solid #059669', borderRadius: '10px', padding: '1px 8px', fontSize: '0.75rem', fontWeight: '700' }}>
                                      ✅ Firmato {entry.dataFirma ? formatData(entry.dataFirma) : ''}
                                    </span>
                                  )}
                                </div>
                                <p style={{ margin: '0 0 8px', color: '#374151', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{entry.testo}</p>
                                {entry.parametriVitali && Object.values(entry.parametriVitali).some(v => v !== undefined && v !== null) && (
                                  <div style={{ background: '#f1f5f9', borderRadius: '6px', padding: '8px 12px', fontSize: '0.82rem', color: '#555', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
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
                              {!entry.firmato && entry.firmaLogin === user?.name && (
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button type="button" onClick={() => setDiarioDaFirmare(entry._id)} style={{ background: '#059669', fontSize: '0.82rem', padding: '5px 12px', whiteSpace: 'nowrap' }}>✍️ Firma con dito/penna</button>
                                  <button type="button" onClick={() => eliminaDiario(entry._id)} title="Elimina voce non firmata" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontWeight: 700 }}>✕</button>
                                </div>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── SEZIONE ALLEGATI ── */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '16px', overflow: 'hidden' }}>
              <button type="button" onClick={() => setShowAllegati(!showAllegati)}
                style={{ width: '100%', background: '#f8fafc', border: 'none', padding: '14px 16px', textAlign: 'left', cursor: 'pointer', fontWeight: '600', fontSize: '0.95rem', color: '#374151', display: 'flex', justifyContent: 'space-between' }}>
                <span>📎 Allegati ({allegati.length})</span>
                <span>{showAllegati ? '▲' : '▼'}</span>
              </button>
              {showAllegati && (
                <div style={{ padding: '16px' }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                    <h5 style={{ margin: '0 0 12px', color: '#1e4d8c' }}>📤 Carica documento</h5>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <label style={{ flex: 2, minWidth: '200px' }}>
                        File *
                        <input ref={fileInputRef} type="file" onChange={e => setFileAllegato(e.target.files?.[0] || null)}
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.txt"
                          style={{ marginTop: '4px', display: 'block' }} />
                      </label>
                      <label style={{ flex: 2, minWidth: '200px' }}>
                        Descrizione (opzionale)
                        <input value={descrizioneAllegato} onChange={e => setDescrizioneAllegato(e.target.value)}
                          placeholder="Es. Referto ECG, Prescrizione..." style={{ marginTop: '4px' }} />
                      </label>
                      <button type="button" onClick={caricaAllegato} disabled={caricandoAllegato || !fileAllegato}
                        style={{ background: '#1e4d8c', padding: '10px 18px', opacity: !fileAllegato ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                        {caricandoAllegato ? '⏳' : '📤 Carica'}
                      </button>
                    </div>
                    <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#888' }}>Formati accettati: PDF, immagini, Word, Excel, testo. Max 20 MB.</p>
                  </div>
                  {allegati.length === 0 ? (
                    <p style={{ color: '#888', fontStyle: 'italic' }}>Nessun allegato.</p>
                  ) : (
                    <div className="document-list">
                      <ul>
                        {allegati.map(all => (
                          <li key={all._id}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                              <div>
                                <div style={{ fontWeight: '600', marginBottom: '2px' }}>
                                  {all.mimeType.startsWith('image/') ? '🖼️' : all.mimeType === 'application/pdf' ? '📄' : '📎'} {all.nomeFile}
                                </div>
                                <div style={{ fontSize: '0.82rem', color: '#888', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                  {all.descrizione && <span>{all.descrizione}</span>}
                                  <span>{formatBytes(all.dimensione)}</span>
                                  <span>📅 {formatData(all.dataCaricamento)}</span>
                                  <span>👤 {all.caricatoDa}</span>
                                </div>
                              </div>
                              <button type="button" onClick={() => apriAllegato(all)}
                                style={{ background: '#1e4d8c', fontSize: '0.85rem', padding: '6px 14px' }}>
                                👁️ Apri
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── SEZIONE OBIETTIVI ── */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '16px', overflow: 'hidden' }}>
              <button type="button" onClick={() => setShowObiettivi(!showObiettivi)}
                style={{ width: '100%', background: '#f8fafc', border: 'none', padding: '14px 16px', textAlign: 'left', cursor: 'pointer', fontWeight: '600', fontSize: '0.95rem', color: '#374151', display: 'flex', justifyContent: 'space-between' }}>
                <span>🎯 Obiettivi del piano ({obiettivi.length})</span>
                <span>{showObiettivi ? '▲' : '▼'}</span>
              </button>
              {showObiettivi && (
                <div style={{ padding: '16px' }}>
                  {obiettivi.length === 0 ? (
                    <p style={{ color: '#888', fontStyle: 'italic' }}>Nessun obiettivo definito. Gli obiettivi vengono formulati dal coordinatore.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {obiettivi.map(ob => {
                        const badge = statoObiettivoBadge[ob.stato] || statoObiettivoBadge.attivo;
                        const isRivalutando = rivalutandoId === ob._id;
                        return (
                          <div key={ob._id} style={{ background: badge.bg, border: `1px solid ${badge.color}30`, borderRadius: '8px', padding: '14px 16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                              <div style={{ flex: 1 }}>
                                <p style={{ margin: '0 0 4px', fontWeight: '600', color: '#374151' }}>{ob.descrizione}</p>
                                <div style={{ fontSize: '0.82rem', color: '#888', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                  <span>📅 Inizio: {formatData(ob.dataInizio)}</span>
                                  {ob.dataRivalutazione && <span>🔄 Rivalutazione: {formatData(ob.dataRivalutazione)}</span>}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ color: badge.color, fontWeight: '700', fontSize: '0.85rem', background: badge.bg, border: `1px solid ${badge.color}`, borderRadius: '12px', padding: '2px 10px' }}>{badge.label}</span>
                                <button type="button"
                                  onClick={() => { setRivalutandoId(isRivalutando ? null : ob._id); setStatoRivalutazione(ob.stato); setNoteRivalutazione(''); }}
                                  style={{ background: isRivalutando ? '#6c757d' : '#f59e0b', fontSize: '0.82rem', padding: '5px 12px' }}>
                                  {isRivalutando ? '✕ Annulla' : '🔄 Rivaluta'}
                                </button>
                              </div>
                            </div>
                            {isRivalutando && (
                              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', marginTop: '8px' }}>
                                <h6 style={{ margin: '0 0 10px', color: '#374151' }}>🔄 Rivaluta obiettivo</h6>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                  <label style={{ flex: 1, minWidth: '160px' }}>
                                    Nuovo stato *
                                    <select value={statoRivalutazione} onChange={e => setStatoRivalutazione(e.target.value)}
                                      style={{ marginTop: '4px', padding: '7px 10px', border: '1px solid #ced4da', borderRadius: '4px', width: '100%' }}>
                                      <option value="">— Seleziona —</option>
                                      {STATI_OBIETTIVO.map(s => (
                                        <option key={s} value={s}>{statoObiettivoBadge[s]?.label || s}</option>
                                      ))}
                                    </select>
                                  </label>
                                  <label style={{ flex: 2, minWidth: '200px' }}>
                                    Note rivalutazione
                                    <input value={noteRivalutazione} onChange={e => setNoteRivalutazione(e.target.value)}
                                      placeholder="Osservazioni sulla rivalutazione..." style={{ marginTop: '4px' }} />
                                  </label>
                                  <Button
                                    onClick={() => salvaRivalutazione(ob._id)}
                                    loading={salvandoRivalutazione}
                                    disabled={!statoRivalutazione}
                                    variant="success"
                                    size="sm"
                                  >
                                    Salva
                                  </Button>
                                </div>
                              </div>
                            )}
                            {ob.valutazioni && ob.valutazioni.length > 0 && (
                              <details style={{ marginTop: '8px' }}>
                                <summary style={{ cursor: 'pointer', fontSize: '0.82rem', color: '#888' }}>📋 Storico valutazioni ({ob.valutazioni.length})</summary>
                                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {ob.valutazioni.map((v, i) => (
                                    <div key={i} style={{ fontSize: '0.82rem', color: '#555', background: '#f8fafc', padding: '6px 10px', borderRadius: '4px' }}>
                                      <strong>{formatData(v.data)}</strong> — {statoObiettivoBadge[v.stato]?.label || v.stato}
                                      {v.note && ` — ${v.note}`}
                                      <span style={{ color: '#888', marginLeft: '8px' }}>({v.valutatoDa})</span>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── STORICO ACCESSI + EXPORT PDF ── */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ background: '#f8fafc', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontWeight: '600', fontSize: '0.95rem', color: '#374151' }}>📅 Storico accessi ({accessi.length})</span>
                <button type="button" onClick={() => setShowExport(!showExport)}
                  style={{ background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', padding: '6px 14px', fontSize: '0.85rem' }}>
                  📄 Esporta / Visualizza PDF
                </button>
              </div>

              {showExport && (
                <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0', background: '#fafafa' }}>
                  <h5 style={{ margin: '0 0 12px', color: '#374151' }}>📄 Esporta registro accessi (rendicontazione)</h5>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '8px' }}>
                    <label style={{ flex: 1, minWidth: '140px' }}>
                      Da data
                      <input type="date" value={exportDaData} onChange={e => setExportDaData(e.target.value)} style={{ marginTop: '4px' }} />
                    </label>
                    <label style={{ flex: 1, minWidth: '140px' }}>
                      A data
                      <input type="date" value={exportAData} onChange={e => setExportAData(e.target.value)} style={{ marginTop: '4px' }} />
                    </label>
                    <button type="button" onClick={caricaExport} disabled={loadingExport}
                      style={{ background: '#1e4d8c', padding: '10px 18px', whiteSpace: 'nowrap' }}>
                      {loadingExport ? '⏳' : '🔍 Carica'}
                    </button>
                    {exportData && (
                      <>
                        <button type="button" onClick={visualizzaPDF}
                          style={{ background: '#3b82f6', padding: '10px 18px', whiteSpace: 'nowrap' }}>
                          👁️ Visualizza PDF
                        </button>
                        <button type="button" onClick={stampaPDF}
                          style={{ background: '#059669', padding: '10px 18px', whiteSpace: 'nowrap' }}>
                          🖨️ Stampa PDF
                        </button>
                      </>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#888' }}>Lascia vuoto per il mese corrente. Il PDF non include le tariffe.</p>

                  {exportData && (
                    <div ref={printRef} style={{ marginTop: '16px', background: '#fff', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                      <h1>Registro Accessi — {exportData.piano.paziente}</h1>
                      <h2>Operatore: {exportData.piano.operatore} ({exportData.piano.ruoloOperatore})</h2>
                      <p><strong>Attività:</strong> {exportData.piano.task}</p>
                      <p><strong>Periodo:</strong> {exportData.periodo.da} — {exportData.periodo.a}</p>
                      <table>
                        <thead>
                          <tr>
                            <th>Data</th><th>Entrata</th><th>Uscita</th><th>Durata</th><th>Note</th>
                            <th>Firma Operatore</th><th>Firma Paziente/Caregiver</th>
                          </tr>
                        </thead>
                        <tbody>
                          {exportData.accessi.map((acc: any, i: number) => (
                            <tr key={i}>
                              <td>{acc.data}</td>
                              <td>{acc.oraEntrata}</td>
                              <td>{acc.oraUscita || '—'}</td>
                              <td>{acc.durataOre}</td>
                              <td>{acc.note || '—'}</td>
                              <td style={{ verticalAlign: 'top' }}>
                                {acc.firmaOperatore
                                  ? <img src={acc.firmaOperatore} alt="Firma op" style={{ maxWidth: '160px', maxHeight: '55px', border: '1px solid #d1d5db', borderRadius: '4px', display: 'block' }} />
                                  : <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Non raccolta</span>}
                              </td>
                              <td style={{ verticalAlign: 'top' }}>
                                {acc.firmaPaziente
                                  ? <div>
                                      <img src={acc.firmaPaziente} alt="Firma paz" style={{ maxWidth: '160px', maxHeight: '55px', border: '1px solid #d1d5db', borderRadius: '4px', display: 'block' }} />
                                      {acc.nomeFirmatarioPaziente && <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>{acc.ruoloFirmatario === 'caregiver' ? 'Caregiver' : 'Paziente'}: {acc.nomeFirmatarioPaziente}</span>}
                                    </div>
                                  : <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Non raccolta</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="riepilogo">
                        <p><strong>Totale accessi:</strong> {exportData.riepilogo.totaleAccessi}</p>
                        <p><strong>Ore totali:</strong> {exportData.riepilogo.oreTotali}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ padding: accessi.length > 0 ? '0' : '16px' }}>
                {accessi.length === 0 ? (
                  <p style={{ color: '#888', fontStyle: 'italic', margin: 0 }}>Nessun accesso registrato.</p>
                ) : (
                  <div className="document-list" style={{ margin: 0 }}>
                    <ul>
                      {accessi.map(acc => (
                        <li key={acc._id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                                📅 {formatData(acc.oraEntrata)} — {formatOra(acc.oraEntrata)}
                                {acc.oraUscita ? ` → ${formatOra(acc.oraUscita)}` : ' 🟢 In corso'}
                              </div>
                              <div style={{ fontSize: '0.85rem', color: '#555', display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                {acc.durataMinuti > 0 && <span>⏱️ {formatDurata(acc.durataMinuti)}</span>}
                                {acc.note && <span>📝 {acc.note}</span>}
                              </div>
                              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '6px' }}>
                                <div style={{ fontSize: '0.78rem' }}>
                                  <span style={{ color: '#6b7280', fontWeight: 600 }}>Firma operatore: </span>
                                  {acc.firmaOperatore
                                    ? <img src={acc.firmaOperatore} alt="Firma op" style={{ maxWidth: '120px', maxHeight: '40px', verticalAlign: 'middle', border: '1px solid #d1d5db', borderRadius: '4px', marginLeft: '4px' }} />
                                    : <span style={{ color: '#f59e0b' }}>⚠️ non raccolta</span>}
                                </div>
                                <div style={{ fontSize: '0.78rem' }}>
                                  <span style={{ color: '#6b7280', fontWeight: 600 }}>Firma paziente: </span>
                                  {acc.firmaPaziente
                                    ? <span>
                                        <img src={acc.firmaPaziente} alt="Firma paz" style={{ maxWidth: '120px', maxHeight: '40px', verticalAlign: 'middle', border: '1px solid #d1d5db', borderRadius: '4px', marginLeft: '4px' }} />
                                        {acc.nomeFirmatarioPaziente && <span style={{ color: '#6b7280', marginLeft: '4px' }}>({acc.nomeFirmatarioPaziente})</span>}
                                      </span>
                                    : <span style={{ color: '#9ca3af' }}>non raccolta</span>}
                                </div>
                              </div>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#888', textAlign: 'right' }}>
                              <div>✍️ {acc.staffName}</div>
                              <div>({acc.staffRole})</div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

          </div>
        )
      )}
      {/* ══════════════════════════════════════════════════════════════════════
          MODAL SCHEDA SEGNALAZIONE EVENTO AVVERSO — ABBRACCIO (scheda ufficiale)
      ══════════════════════════════════════════════════════════════════════ */}
      {showEventoAvverso && (() => {
        const toggleFattore = (campo: 'fattoriPaziente'|'fattoriStaff'|'fattoriComunicazione'|'fattoriAmbiente', val: string) => {
          setEventoForm(p => {
            const arr = p[campo] as string[];
            return { ...p, [campo]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] };
          });
        };
        const sezLabel = (txt: string) => (
          <div style={{ fontWeight: '700', fontSize: '0.8rem', color: '#1e4d8c', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #1e4d8c', paddingBottom: '4px', marginBottom: '10px', marginTop: '4px' }}>{txt}</div>
        );
        const checkRow = (campo: 'fattoriPaziente'|'fattoriStaff'|'fattoriComunicazione'|'fattoriAmbiente', val: string) => (
          <label key={val} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '0.86rem', lineHeight: 1.4, padding: '4px 0' }}>
            <input type="checkbox" checked={(eventoForm[campo] as string[]).includes(val)} onChange={() => toggleFattore(campo, val)}
              style={{ width: '16px', height: '16px', flexShrink: 0, marginTop: '2px', cursor: 'pointer', accentColor: '#1e4d8c' }} />
            <span>{val}</span>
          </label>
        );
        const canSend = eventoForm.patientId && eventoForm.ruoloOperatore && eventoForm.dataEvento && eventoForm.luogoEvento && eventoForm.descrizioneEvento && firmaEventoOp;
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '12px' }}>
            <div style={{ background: 'white', borderRadius: '14px', width: '100%', maxWidth: '660px', marginTop: '16px', marginBottom: '24px', boxShadow: '0 24px 64px rgba(0,0,0,0.35)', fontFamily: 'Arial, sans-serif' }}>

              {/* ── Intestazione scheda ── */}
              <div style={{ background: 'linear-gradient(135deg,#1e4d8c,#1e3a5f)', color: 'white', borderRadius: '14px 14px 0 0', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', opacity: 0.8, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>Abbraccio Cure Domiciliari</div>
                  <div style={{ fontWeight: '700', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={20} /> SCHEDA SEGNALAZIONE EVENTO AVVERSO
                  </div>
                </div>
                <button onClick={() => setShowEventoAvverso(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex' }}>
                  <X size={20} />
                </button>
              </div>

              {eventoSalvato ? (
                <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: '3.5rem', marginBottom: '14px' }}>✅</div>
                  <div style={{ fontWeight: '700', fontSize: '1.15rem', color: '#16a34a', marginBottom: '8px' }}>Segnalazione registrata con successo</div>
                  <div style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '28px' }}>La scheda è stata inviata e sarà esaminata dalla Direzione di Area.</div>
                  <button onClick={() => setShowEventoAvverso(false)} style={{ background: '#1e4d8c', color: 'white', border: 'none', borderRadius: '8px', padding: '12px 32px', fontWeight: '700', cursor: 'pointer', fontSize: '1rem' }}>Chiudi</button>
                </div>
              ) : (
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  {/* ── SEZIONE 1: Chi segnala ── */}
                  {sezLabel('Operatore che segnala l\'evento')}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ fontWeight: '600', fontSize: '0.83rem', color: '#374151', display: 'block', marginBottom: '4px' }}>Direzione di area</label>
                      <input type="text" value={eventoForm.direzioneDiArea} onChange={e => setEventoForm(p => ({ ...p, direzioneDiArea: e.target.value }))}
                        placeholder="es. Distretto Sud, Area Metropolitana..."
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1px solid #d1d5db', fontSize: '0.88rem', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontWeight: '700', fontSize: '0.83rem', color: '#374151', display: 'block', marginBottom: '8px' }}>Ruolo operatore *</label>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {[
                          { val: 'infermiere_oss', label: '👩‍⚕️ Infermiere / OSS' },
                          { val: 'medico', label: '🩺 Medico' },
                          { val: 'altro', label: '✏️ Altro' },
                        ].map(r => (
                          <label key={r.val} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem', padding: '8px 14px', borderRadius: '8px', border: `2px solid ${eventoForm.ruoloOperatore === r.val ? '#1e4d8c' : '#e5e7eb'}`, background: eventoForm.ruoloOperatore === r.val ? '#eff6ff' : 'white', fontWeight: eventoForm.ruoloOperatore === r.val ? '700' : '400' }}>
                            <input type="radio" name="ruoloOp" value={r.val} checked={eventoForm.ruoloOperatore === r.val} onChange={() => setEventoForm(p => ({ ...p, ruoloOperatore: r.val }))} style={{ accentColor: '#1e4d8c' }} />
                            {r.label}
                          </label>
                        ))}
                      </div>
                      {eventoForm.ruoloOperatore === 'altro' && (
                        <input type="text" value={eventoForm.ruoloOperatoreAltro} onChange={e => setEventoForm(p => ({ ...p, ruoloOperatoreAltro: e.target.value }))}
                          placeholder="Specificare ruolo..."
                          style={{ marginTop: '8px', width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1px solid #d1d5db', fontSize: '0.88rem', boxSizing: 'border-box' }} />
                      )}
                    </div>
                  </div>

                  {/* ── SEZIONE 2: Dati paziente (facoltativi) ── */}
                  {sezLabel('Dati relativi al paziente (facoltativi)')}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ fontWeight: '700', fontSize: '0.83rem', color: '#374151', display: 'block', marginBottom: '4px' }}>Paziente in carico *</label>
                      <select value={eventoForm.patientId} onChange={e => {
                        const paz = pazienti.find(p => p._id === e.target.value);
                        setEventoForm(p => ({ ...p, patientId: e.target.value, pazienteNomeCognome: paz ? `${paz.firstName} ${paz.lastName}` : '' }));
                      }} style={{ width: '100%', padding: '9px 10px', borderRadius: '7px', border: `2px solid ${eventoForm.patientId ? '#d1d5db' : '#fca5a5'}`, fontSize: '0.88rem', background: 'white' }}>
                        <option value="">— Seleziona paziente —</option>
                        {pazienti.map(p => <option key={p._id} value={p._id}>{p.firstName} {p.lastName}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontWeight: '600', fontSize: '0.8rem', color: '#6b7280', display: 'block', marginBottom: '3px' }}>CSTV di appartenenza</label>
                        <input type="text" value={eventoForm.pazienteCSTV} onChange={e => setEventoForm(p => ({ ...p, pazienteCSTV: e.target.value }))}
                          placeholder="es. ASL Roma 1" style={{ width: '100%', padding: '7px 9px', borderRadius: '7px', border: '1px solid #d1d5db', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ fontWeight: '600', fontSize: '0.8rem', color: '#6b7280', display: 'block', marginBottom: '3px' }}>Età</label>
                        <input type="number" value={eventoForm.pazienteEta} onChange={e => setEventoForm(p => ({ ...p, pazienteEta: e.target.value }))}
                          min={0} max={130} placeholder="anni" style={{ width: '100%', padding: '7px 9px', borderRadius: '7px', border: '1px solid #d1d5db', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ fontWeight: '600', fontSize: '0.8rem', color: '#6b7280', display: 'block', marginBottom: '3px' }}>Sesso</label>
                        <select value={eventoForm.pazienteSesso} onChange={e => setEventoForm(p => ({ ...p, pazienteSesso: e.target.value as any }))}
                          style={{ width: '100%', padding: '7px 9px', borderRadius: '7px', border: '1px solid #d1d5db', fontSize: '0.85rem', background: 'white' }}>
                          <option value="">—</option>
                          <option value="M">M</option>
                          <option value="F">F</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* ── SEZIONE 3: Descrizione evento ── */}
                  {sezLabel('Descrizione dell\'evento')}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ fontWeight: '600', fontSize: '0.83rem', color: '#374151', display: 'block', marginBottom: '4px' }}>
                        Cos'è successo? Dove? Quando? Come e perché è successo? Chi si è accorto? *
                      </label>
                      <textarea value={eventoForm.descrizioneEvento} onChange={e => setEventoForm(p => ({ ...p, descrizioneEvento: e.target.value }))}
                        placeholder="Descrivi l'evento in modo sintetico ma esaustivo..."
                        rows={4} style={{ width: '100%', padding: '9px 10px', borderRadius: '7px', border: `1px solid ${eventoForm.descrizioneEvento ? '#d1d5db' : '#fca5a5'}`, fontSize: '0.88rem', resize: 'vertical', boxSizing: 'border-box' }} />
                      <button type="button" onClick={avviaDettaturaEvento} disabled={dettaturaEventoAttiva} style={{ marginTop: '8px', background: dettaturaEventoAttiva ? '#94a3b8' : '#7c3aed', color: 'white', border: 'none', borderRadius: '7px', padding: '8px 12px', fontWeight: 700, cursor: dettaturaEventoAttiva ? 'not-allowed' : 'pointer', fontSize: '0.82rem' }}>
                        {dettaturaEventoAttiva ? '🎙️ Ascolto in corso...' : '🤖 AI - detta e trascrivi evento'}
                      </button>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Premi il pulsante, descrivi l'evento a voce e la trascrizione verrà inserita nella scheda.</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontWeight: '600', fontSize: '0.8rem', color: '#374151', display: 'block', marginBottom: '3px' }}>📅 Data *</label>
                        <input type="date" value={eventoForm.dataEvento} onChange={e => setEventoForm(p => ({ ...p, dataEvento: e.target.value }))}
                          style={{ width: '100%', padding: '7px 8px', borderRadius: '7px', border: '1px solid #d1d5db', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ fontWeight: '600', fontSize: '0.8rem', color: '#374151', display: 'block', marginBottom: '3px' }}>⏰ Ora</label>
                        <input type="time" value={eventoForm.oraEvento} onChange={e => setEventoForm(p => ({ ...p, oraEvento: e.target.value }))}
                          style={{ width: '100%', padding: '7px 8px', borderRadius: '7px', border: '1px solid #d1d5db', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ fontWeight: '600', fontSize: '0.8rem', color: '#374151', display: 'block', marginBottom: '3px' }}>📍 Luogo *</label>
                        <input type="text" value={eventoForm.luogoEvento} onChange={e => setEventoForm(p => ({ ...p, luogoEvento: e.target.value }))}
                          placeholder="es. Domicilio paziente" style={{ width: '100%', padding: '7px 8px', borderRadius: '7px', border: `1px solid ${eventoForm.luogoEvento ? '#d1d5db' : '#fca5a5'}`, fontSize: '0.85rem', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontWeight: '600', fontSize: '0.83rem', color: '#374151', display: 'block', marginBottom: '4px' }}>Come si sono svolti i fatti</label>
                      <textarea value={eventoForm.svolgimentoFatti} onChange={e => setEventoForm(p => ({ ...p, svolgimentoFatti: e.target.value }))}
                        placeholder="Descrivi la sequenza degli eventi, il contesto, le azioni intraprese..."
                        rows={3} style={{ width: '100%', padding: '9px 10px', borderRadius: '7px', border: '1px solid #d1d5db', fontSize: '0.88rem', resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                  </div>

                  {/* ── SEZIONE 4: Esito / Grado danno ── */}
                  {sezLabel('Esito dell\'evento')}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {GRADI_DANNO.map(g => (
                      <button key={g.value} type="button" onClick={() => setEventoForm(p => ({ ...p, dannoRiscontrato: g.value as any }))}
                        style={{ padding: '7px 13px', borderRadius: '8px', border: `2px solid ${eventoForm.dannoRiscontrato === g.value ? g.color : '#e5e7eb'}`, background: eventoForm.dannoRiscontrato === g.value ? g.color + '18' : 'white', color: eventoForm.dannoRiscontrato === g.value ? g.color : '#374151', fontWeight: eventoForm.dannoRiscontrato === g.value ? '700' : '400', cursor: 'pointer', fontSize: '0.82rem' }}>
                        {g.label}
                      </button>
                    ))}
                  </div>

                  {/* ── SEZIONE 5: Fattori contribuenti ── */}
                  {sezLabel('Fattori che possono aver contribuito all\'evento (più risposte possibili)')}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ background: '#f0f9ff', borderRadius: '10px', padding: '14px', border: '1px solid #bae6fd' }}>
                      <div style={{ fontWeight: '700', fontSize: '0.78rem', color: '#0369a1', marginBottom: '10px', textTransform: 'uppercase' }}>👤 Fattori paziente</div>
                      {FATTORI_PAZIENTE.map(v => checkRow('fattoriPaziente', v))}
                    </div>
                    <div style={{ background: '#fdf4ff', borderRadius: '10px', padding: '14px', border: '1px solid #e9d5ff' }}>
                      <div style={{ fontWeight: '700', fontSize: '0.78rem', color: '#7c3aed', marginBottom: '10px', textTransform: 'uppercase' }}>👥 Fattori staff / organizzazione</div>
                      {FATTORI_STAFF.map(v => checkRow('fattoriStaff', v))}
                    </div>
                    <div style={{ background: '#fff7ed', borderRadius: '10px', padding: '14px', border: '1px solid #fed7aa' }}>
                      <div style={{ fontWeight: '700', fontSize: '0.78rem', color: '#c2410c', marginBottom: '10px', textTransform: 'uppercase' }}>💬 Comunicazione / task</div>
                      {FATTORI_COMUNICAZIONE.map(v => checkRow('fattoriComunicazione', v))}
                    </div>
                    <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '14px', border: '1px solid #bbf7d0' }}>
                      <div style={{ fontWeight: '700', fontSize: '0.78rem', color: '#15803d', marginBottom: '10px', textTransform: 'uppercase' }}>🏠 Ambiente / attrezzatura</div>
                      {FATTORI_AMBIENTE.map(v => checkRow('fattoriAmbiente', v))}
                    </div>
                  </div>

                  {/* ── SEZIONE 6: Suggerimenti ── */}
                  {sezLabel('Suggerimenti per prevenire / evitare il ripetersi dell\'evento')}
                  <textarea value={eventoForm.suggerimenti} onChange={e => setEventoForm(p => ({ ...p, suggerimenti: e.target.value }))}
                    placeholder="Inserisci eventuali proposte migliorative, raccomandazioni o azioni correttive suggerite..."
                    rows={3} style={{ width: '100%', padding: '9px 10px', borderRadius: '7px', border: '1px solid #d1d5db', fontSize: '0.88rem', resize: 'vertical', boxSizing: 'border-box' }} />

                  {/* ── SEZIONE 7: Firma ── */}
                  {sezLabel('Firma dell\'operatore segnalante')}
                  <FirmaCanvas
                    label="Firma"
                    sublabel="Firma obbligatoria per validare e inviare la segnalazione"
                    onFirmaCompleta={f => setFirmaEventoOp(f)}
                    onCancella={() => setFirmaEventoOp('')}
                    firmaEsistente={firmaEventoOp}
                    altezza={140}
                  />

                  {/* ── Pulsante invio ── */}
                  <button
                    type="button"
                    disabled={!canSend || salvandoEvento}
                    onClick={async () => {
                      setSalvandoEvento(true);
                      try {
                        await api.post('/eventi-avversi', {
                          patientId: eventoForm.patientId,
                          ruoloOperatore: eventoForm.ruoloOperatore,
                          ruoloOperatoreAltro: eventoForm.ruoloOperatoreAltro || undefined,
                          direzioneDiArea: eventoForm.direzioneDiArea || undefined,
                          pazienteNomeCognome: eventoForm.pazienteNomeCognome || undefined,
                          pazienteCSTV: eventoForm.pazienteCSTV || undefined,
                          pazienteEta: eventoForm.pazienteEta ? Number(eventoForm.pazienteEta) : undefined,
                          pazienteSesso: eventoForm.pazienteSesso || undefined,
                          dataEvento: eventoForm.dataEvento,
                          oraEvento: eventoForm.oraEvento || undefined,
                          luogoEvento: eventoForm.luogoEvento,
                          descrizioneEvento: eventoForm.descrizioneEvento,
                          svolgimentoFatti: eventoForm.svolgimentoFatti || undefined,
                          fattoriPaziente: eventoForm.fattoriPaziente,
                          fattoriStaff: eventoForm.fattoriStaff,
                          fattoriComunicazione: eventoForm.fattoriComunicazione,
                          fattoriAmbiente: eventoForm.fattoriAmbiente,
                          suggerimenti: eventoForm.suggerimenti || undefined,
                          dannoRiscontrato: eventoForm.dannoRiscontrato,
                          firmaOperatore: firmaEventoOp,
                        });
                        setEventoSalvato(true);
                      } catch (err: any) {
                        alert(err?.response?.data?.message || 'Errore nel salvataggio della segnalazione');
                      } finally {
                        setSalvandoEvento(false);
                      }
                    }}
                    style={{
                      width: '100%', padding: '14px', borderRadius: '10px', border: 'none', fontWeight: '700', fontSize: '1rem', cursor: canSend && !salvandoEvento ? 'pointer' : 'not-allowed',
                      background: canSend && !salvandoEvento ? '#dc2626' : '#d1d5db',
                      color: canSend && !salvandoEvento ? 'white' : '#9ca3af',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    }}
                  >
                    <AlertTriangle size={18} />
                    {salvandoEvento ? 'Invio in corso...' : 'Invia segnalazione evento avverso'}
                  </button>
                  <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>
                    * Campi obbligatori. La firma è necessaria per validare la segnalazione.
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {showCustomerSatisfaction && pazienteSelezionato && <CustomerSatisfactionModal patient={pazienteSelezionato} onClose={() => setShowCustomerSatisfaction(false)} />}
      {showSchedaDimissione && pazienteSelezionato && <SchedaDimissioneModal patient={pazienteSelezionato} dataInizioServizio={pianoSelezionato?.date} onClose={() => setShowSchedaDimissione(false)} />}

      {diarioDaFirmare && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }} onClick={() => { setDiarioDaFirmare(null); setFirmaDiarioGrafometrica(''); }}>
          <div style={{ background: 'white', borderRadius: '14px', padding: '20px', width: '100%', maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', color: '#065f46' }}>Firma voce del diario</h3>
            <p style={{ fontSize: '0.86rem', color: '#475569' }}>Firma con il dito o con la penna. Dopo la conferma la voce sarà bloccata e non potrà essere eliminata.</p>
            <FirmaCanvas label="Firma grafometrica dell’operatore" sublabel="Disegna la firma nel riquadro" onFirmaCompleta={setFirmaDiarioGrafometrica} onCancella={() => setFirmaDiarioGrafometrica('')} altezza={160} />
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button type="button" onClick={() => { setDiarioDaFirmare(null); setFirmaDiarioGrafometrica(''); }} style={{ flex: 1, padding: '11px', borderRadius: '7px', border: '1px solid #d1d5db', background: '#f3f4f6', cursor: 'pointer' }}>Annulla</button>
              <button type="button" disabled={!firmaDiarioGrafometrica} onClick={firmaDiario} style={{ flex: 2, padding: '11px', borderRadius: '7px', border: 'none', background: firmaDiarioGrafometrica ? '#059669' : '#a7f3d0', color: 'white', fontWeight: 700, cursor: firmaDiarioGrafometrica ? 'pointer' : 'not-allowed' }}>Firma e blocca voce</button>
            </div>
          </div>
        </div>
      )}

      {showConsensoGDPR && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }} onClick={() => setShowConsensoGDPR(false)}>
          <div style={{ background: 'white', borderRadius: '14px', padding: '20px', width: '100%', maxWidth: '540px', maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', color: '#991b1b' }}>Consenso GDPR</h3>
            <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '14px' }}>Il paziente o il firmatario autorizza il trattamento dei dati per le prestazioni sanitarie e assistenziali.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
              <input value={nomeFirmatarioGDPR} onChange={e => setNomeFirmatarioGDPR(e.target.value)} placeholder="Nome firmatario" style={{ padding: '10px', borderRadius: '7px', border: '1px solid #d1d5db' }} />
              <input value={cognomeFirmatarioGDPR} onChange={e => setCognomeFirmatarioGDPR(e.target.value)} placeholder="Cognome firmatario" style={{ padding: '10px', borderRadius: '7px', border: '1px solid #d1d5db' }} />
            </div>
            <input type="email" value={emailConsensoGDPR} onChange={e => setEmailConsensoGDPR(e.target.value)} placeholder="Email del paziente / firmatario (facoltativa)" style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '7px', border: '1px solid #d1d5db', marginBottom: '14px' }} />
            <FirmaCanvas label="Firma del paziente / firmatario" sublabel="Firma per accettare l'informativa privacy" onFirmaCompleta={setFirmaGDPR} onCancella={() => setFirmaGDPR('')} altezza={160} />
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button type="button" onClick={() => setShowConsensoGDPR(false)} style={{ flex: 1, padding: '11px', borderRadius: '7px', border: '1px solid #d1d5db', background: '#f3f4f6', cursor: 'pointer' }}>Annulla</button>
              <button type="button" disabled={salvandoConsenso || !nomeFirmatarioGDPR.trim() || !cognomeFirmatarioGDPR.trim() || !firmaGDPR} onClick={salvaConsensoGDPR} style={{ flex: 2, padding: '11px', borderRadius: '7px', border: 'none', background: '#dc2626', color: 'white', fontWeight: 700, cursor: 'pointer', opacity: salvandoConsenso ? 0.7 : 1 }}>{salvandoConsenso ? 'Salvataggio...' : 'Firma e archivia consenso'}</button>
            </div>
          </div>
        </div>
      )}

      {showConsensoPrestazione && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }} onClick={() => setShowConsensoPrestazione(false)}>
          <div style={{ background: 'white', borderRadius: '14px', padding: '20px', width: '100%', maxWidth: '620px', maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', color: '#9a3412' }}>Consenso alla prestazione sanitaria e rischi</h3>
            <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>Il firmatario dichiara di aver ricevuto informazioni sulle prestazioni assistenziali e sanitarie, sui rischi prevedibili e sulle limitazioni connesse alle condizioni cliniche.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', margin: '14px 0' }}>
              <input value={nomeFirmatarioPrestazione} onChange={e => setNomeFirmatarioPrestazione(e.target.value)} placeholder="Nome firmatario" style={{ padding: '10px', borderRadius: '7px', border: '1px solid #d1d5db' }} />
              <input value={cognomeFirmatarioPrestazione} onChange={e => setCognomeFirmatarioPrestazione(e.target.value)} placeholder="Cognome firmatario" style={{ padding: '10px', borderRadius: '7px', border: '1px solid #d1d5db' }} />
            </div>
            <select value={ruoloFirmatarioPrestazione} onChange={e => setRuoloFirmatarioPrestazione(e.target.value as typeof ruoloFirmatarioPrestazione)} style={{ width: '100%', padding: '10px', borderRadius: '7px', border: '1px solid #d1d5db', marginBottom: '12px' }}><option value="paziente">Paziente</option><option value="caregiver">Caregiver</option><option value="tutore">Tutore</option><option value="rappresentanteLegale">Rappresentante legale</option></select>
            <label style={{ display: 'flex', gap: '8px', fontSize: '0.85rem', marginBottom: '10px' }}><input type="checkbox" checked={accettaPrestazione} onChange={e => setAccettaPrestazione(e.target.checked)} /> Confermo di aver ricevuto informazioni sulla prestazione e di acconsentire alla sua esecuzione.</label>
            <label style={{ display: 'flex', gap: '8px', fontSize: '0.85rem', marginBottom: '14px' }}><input type="checkbox" checked={accettaRischiPrestazione} onChange={e => setAccettaRischiPrestazione(e.target.checked)} /> Dichiaro di aver letto e compreso rischi e limitazioni del trattamento.</label>
            <input type="email" value={emailConsensoPrestazione} onChange={e => setEmailConsensoPrestazione(e.target.value)} placeholder="Email del paziente / firmatario (facoltativa)" style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '7px', border: '1px solid #d1d5db', marginBottom: '14px' }} />
            <FirmaCanvas label="Firma del paziente / firmatario" sublabel="Firmare con il dito sullo schermo" onFirmaCompleta={setFirmaPrestazione} onCancella={() => setFirmaPrestazione('')} altezza={160} />
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button type="button" onClick={() => setShowConsensoPrestazione(false)} style={{ flex: 1, padding: '11px', borderRadius: '7px', border: '1px solid #d1d5db', background: '#f3f4f6', cursor: 'pointer' }}>Annulla</button>
              <button type="button" disabled={salvandoConsenso || !nomeFirmatarioPrestazione.trim() || !cognomeFirmatarioPrestazione.trim() || !firmaPrestazione || !accettaPrestazione || !accettaRischiPrestazione} onClick={salvaConsensoPrestazione} style={{ flex: 2, padding: '11px', borderRadius: '7px', border: 'none', background: '#c2410c', color: 'white', fontWeight: 700, cursor: 'pointer', opacity: salvandoConsenso ? 0.7 : 1 }}>{salvandoConsenso ? 'Salvataggio...' : 'Firma e archivia consenso'}</button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
