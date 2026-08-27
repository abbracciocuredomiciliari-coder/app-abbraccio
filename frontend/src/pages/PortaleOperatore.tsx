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
import { RiformulazionePAIModal } from '../components/RiformulazionePAIModal';
import { DatiCliniciADIModal } from '../components/DatiCliniciADIModal';
import { FormazioneSanitariaModal } from '../components/FormazioneSanitariaModal';
import { Printer, Eye, CheckCircle, Plus, Calendar, User, Syringe, Clock, FileText, AlertTriangle, X, Video } from 'lucide-react';
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
  const [showRiformulazionePAI, setShowRiformulazionePAI] = useState(false);
  const [showDatiCliniciADI, setShowDatiCliniciADI] = useState(false);
  const [showFormazioneSanitaria, setShowFormazioneSanitaria] = useState(false);
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
  const pazientiDaAccettare = pianiModalita.filter(p => p.status === 'pending' && p.statoAccettazione === 'in_attesa');
  const pianiAttiviTutti = pianiModalita.filter(p => p.status === 'pending' && p.statoAccettazione !== 'in_attesa');
  const compensoTotaleGlobale = pianiModalita
    .filter(p => p.tipoCompenso && p.tipoCompenso !== 'nessuno')
    .reduce((sum, p) => sum + (p.compensoTotale || 0), 0);
  const compensoPagatoGlobale = pianiModalita
    .filter(p => p.tipoCompenso && p.tipoCompenso !== 'nessuno' && p.compensoPagato)
    .reduce((sum, p) => sum + (p.compensoTotale || 0), 0);

  return (
    <section className="tw-max-w-none">
      <h2 className="tw-flex tw-items-center tw-gap-2">
        {mode === 'piani' ? '📋 Piani Lavorativi' : (pazienteSelezionato || mostraTuttiPiani ? '🏥 Il mio Piano di Lavoro' : '📊 Dashboard')}
      </h2>

      {!pazienteSelezionato && !mostraTuttiPiani && pazientiDaAccettare.length > 0 && (
        <div className="tw-mb-5 tw-p-4 tw-rounded-xl tw-bg-blue-50 tw-border tw-border-blue-300">
          <h3 className="tw-m-0 tw-mb-1.5 tw-text-blue-700">📋 Pazienti da accettare ({pazientiDaAccettare.length})</h3>
          <p className="tw-m-0 tw-mb-3 tw-text-slate-600 tw-text-[0.9rem]">Accetta o rifiuta l'incarico prima di accedere ai dati del paziente.</p>
          <div className="tw-grid tw-gap-2">
            {pazientiDaAccettare.map(piano => <div key={piano._id} className="tw-flex tw-items-center tw-justify-between tw-gap-2.5 tw-bg-white tw-rounded-lg tw-px-3 tw-py-2.5">
              <div><strong>{piano.patient?.firstName} {piano.patient?.lastName}</strong><br /><small>{piano.task} · {new Date(piano.date).toLocaleDateString('it-IT')}</small></div>
              <button onClick={() => { setPianoDaAccettare(piano); setMostraModalAccettazione(true); }} className="tw-px-2.5 tw-py-2 tw-bg-blue-700 tw-text-white tw-border-0 tw-rounded-md tw-font-bold tw-cursor-pointer hover:tw-bg-blue-800">Apri richiesta</button>
            </div>)}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL ACCETTAZIONE INCARICO (da email)
      ══════════════════════════════════════════════════════════════════════ */}
      {mostraModalAccettazione && pianoDaAccettare && (
        <div className="tw-fixed tw-inset-0 tw-z-50 tw-bg-black/60 tw-flex tw-items-center tw-justify-center tw-p-5" onClick={() => setMostraModalAccettazione(false)}>
          <div className="tw-bg-white tw-rounded-2xl tw-p-7 tw-w-full tw-max-w-[480px] tw-shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="tw-m-0 tw-mb-2 tw-text-brand tw-text-xl">📋 Nuovo incarico assegnato</h3>
            <p className="tw-text-slate-500 tw-m-0 tw-mb-5 tw-text-[0.95rem]">
              Ti è stato assegnato un nuovo piano di lavoro. Accetta o rifiuta l'incarico.
            </p>

            <div className="tw-bg-slate-50 tw-rounded-lg tw-p-4 tw-mb-5">
              <p className="tw-m-0 tw-mb-2 tw-text-[0.9rem]"><strong>Paziente:</strong> {pianoDaAccettare.patient?.firstName} {pianoDaAccettare.patient?.lastName}</p>
              <p className="tw-m-0 tw-mb-2 tw-text-[0.9rem]"><strong>Attività:</strong> {pianoDaAccettare.task}</p>
              <p className="tw-m-0 tw-text-[0.9rem]"><strong>Data inizio:</strong> {new Date(pianoDaAccettare.date).toLocaleDateString('it-IT')}</p>
            </div>

            <div className="tw-mb-5">
              <label className="tw-block tw-mb-1.5 tw-text-[0.9rem] tw-text-slate-700">
                Motivo rifiuto (solo se rifiuti):
              </label>
              <textarea
                value={motivoRifiuto}
                onChange={e => setMotivoRifiuto(e.target.value)}
                placeholder="Es. impegnato in altro incarico, indisponibilità..."
                rows={2}
                className="tw-w-full tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-300 tw-text-[0.9rem] tw-resize-y"
              />
            </div>

            <div className="tw-flex tw-flex-wrap tw-gap-3">
              <button
                onClick={accettaIncarico}
                disabled={loadingAccettazione}
                className={`tw-flex-1 tw-py-3.5 tw-rounded-lg tw-text-white tw-font-bold tw-text-base tw-border-0 tw-cursor-pointer ${loadingAccettazione ? 'tw-bg-green-500 tw-cursor-not-allowed tw-opacity-70' : 'tw-bg-green-600 hover:tw-bg-green-700'}`}
              >
                {loadingAccettazione ? '⏳...' : '✅ Accetta'}
              </button>
              <button
                onClick={rifiutaIncarico}
                disabled={loadingAccettazione}
                className={`tw-flex-1 tw-py-3.5 tw-rounded-lg tw-text-white tw-font-bold tw-text-base tw-border-0 tw-cursor-pointer ${loadingAccettazione ? 'tw-bg-red-500 tw-cursor-not-allowed tw-opacity-70' : 'tw-bg-red-600 hover:tw-bg-red-700'}`}
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
          <div className="tw-grid tw-grid-cols-2 md:tw-grid-cols-3 xl:tw-grid-cols-4 tw-gap-3 tw-mb-5">
            <button
              type="button"
              onClick={() => navigate('/piani-lavorativi')}
              className="tw-bg-emerald-50 tw-border tw-border-emerald-200 tw-rounded-xl tw-px-2.5 tw-py-3.5 tw-text-center tw-cursor-pointer tw-min-w-0 hover:tw-bg-emerald-100"
            >
              <div className="tw-text-[0.7rem] tw-text-emerald-600 tw-font-bold tw-uppercase tw-mb-1 tw-whitespace-nowrap">Pazienti</div>
              <div className="tw-text-2xl tw-font-extrabold tw-text-emerald-600 tw-leading-none">{pazienti.length}</div>
            </button>
            <button
              type="button"
              onClick={() => navigate('/piani-lavorativi')}
              className="tw-bg-amber-50 tw-border tw-border-amber-200 tw-rounded-xl tw-px-2.5 tw-py-3.5 tw-text-center tw-cursor-pointer tw-min-w-0 hover:tw-bg-amber-100"
            >
              <div className="tw-text-[0.7rem] tw-text-amber-600 tw-font-bold tw-uppercase tw-mb-1 tw-whitespace-nowrap">Incarichi</div>
              <div className="tw-text-2xl tw-font-extrabold tw-text-amber-600 tw-leading-none">{pianiAttiviTutti.length}</div>
            </button>
            {/* Esami strumentali solo in modalità privata */}
            {!isConvenzione && (
              <button
                type="button"
                onClick={() => navigate('/esami-strumentali')}
                className="tw-bg-red-50 tw-border tw-border-red-200 tw-rounded-xl tw-px-2.5 tw-py-3.5 tw-text-center tw-cursor-pointer tw-min-w-0 tw-overflow-hidden hover:tw-bg-red-100"
              >
                <div className="tw-text-[0.7rem] tw-text-red-600 tw-font-bold tw-uppercase tw-mb-1 tw-whitespace-nowrap tw-overflow-hidden tw-text-ellipsis">Esami Strumentali</div>
                <div className="tw-text-2xl tw-font-extrabold tw-text-red-600 tw-leading-none">{esamiAttivi}</div>
              </button>
            )}
            {/* Gestione Prelievi */}
            <button
              type="button"
              onClick={() => navigate('/centro-prelievi')}
              className="tw-bg-sky-50 tw-border tw-border-sky-200 tw-rounded-xl tw-px-2.5 tw-py-3.5 tw-text-center tw-cursor-pointer tw-min-w-0 tw-overflow-hidden hover:tw-bg-sky-100"
            >
              <div className="tw-text-[0.7rem] tw-text-sky-500 tw-font-bold tw-uppercase tw-mb-1 tw-whitespace-nowrap tw-overflow-hidden tw-text-ellipsis">Gestione Prelievi</div>
              <div className="tw-text-2xl tw-font-extrabold tw-text-sky-500 tw-leading-none">💉</div>
            </button>
            <button
              type="button"
              onClick={() => { setShowEventoAvverso(true); setEventoSalvato(false); setFirmaEventoOp(''); setEventoForm({ ...eventoFormDefault }); }}
              className="tw-bg-red-50 tw-border tw-border-red-200 tw-rounded-xl tw-px-2.5 tw-py-3.5 tw-text-center tw-cursor-pointer tw-min-w-0 tw-overflow-hidden hover:tw-bg-red-100"
            >
              <div className="tw-text-[0.68rem] tw-text-red-600 tw-font-bold tw-uppercase tw-mb-1 tw-whitespace-nowrap tw-overflow-hidden tw-text-ellipsis">⚠️ Evento Avverso</div>
              <div className="tw-text-[1.8rem] tw-leading-none">🚨</div>
            </button>
            <button
              type="button"
              onClick={() => navigate('/chat')}
              className="tw-bg-teal-50 tw-border tw-border-teal-200 tw-rounded-xl tw-px-2.5 tw-py-3.5 tw-text-center tw-cursor-pointer tw-min-w-0 tw-overflow-hidden hover:tw-bg-teal-100"
            >
              <div className="tw-text-[0.68rem] tw-text-teal-700 tw-font-bold tw-uppercase tw-mb-1 tw-whitespace-nowrap tw-overflow-hidden tw-text-ellipsis">Chat coordinatore</div>
              <div className="tw-text-[1.8rem] tw-leading-none">💬</div>
            </button>
            <button
              type="button"
              onClick={() => navigate('/piani-lavorativi')}
              className="tw-bg-blue-50 tw-border tw-border-blue-200 tw-rounded-xl tw-px-2.5 tw-py-3.5 tw-text-center tw-cursor-pointer tw-min-w-0 tw-overflow-hidden hover:tw-bg-blue-100"
            >
              <div className="tw-text-[0.68rem] tw-text-brand tw-font-bold tw-uppercase tw-mb-1 tw-whitespace-nowrap tw-overflow-hidden tw-text-ellipsis">Consensi e firme</div>
              <div className="tw-text-[1.8rem] tw-leading-none">✍️</div>
            </button>
            <button
              type="button"
              onClick={() => navigate('/telemedicina')}
              className="tw-bg-teal-50 tw-border tw-border-teal-200 tw-rounded-xl tw-px-2.5 tw-py-3.5 tw-text-center tw-cursor-pointer tw-min-w-0 tw-overflow-hidden hover:tw-bg-teal-100"
            >
              <div className="tw-text-[0.68rem] tw-text-teal-700 tw-font-bold tw-uppercase tw-mb-1 tw-whitespace-nowrap tw-overflow-hidden tw-text-ellipsis">Telemedicina</div>
              <div className="tw-text-[1.8rem] tw-leading-none">🎥</div>
            </button>
            {compensoTotaleGlobale > 0 && (
              <button
                type="button"
                onClick={() => navigate('/compenso-incarichi')}
                className="tw-bg-violet-50 tw-border tw-border-violet-200 tw-rounded-xl tw-px-2.5 tw-py-3 tw-text-center tw-cursor-pointer tw-min-w-0 tw-overflow-hidden hover:tw-bg-violet-100"
              >
                <div className="tw-text-[0.7rem] tw-text-violet-600 tw-font-bold tw-uppercase tw-mb-0.5 tw-whitespace-nowrap tw-overflow-hidden tw-text-ellipsis">Compenso</div>
                <div className="tw-text-[1.4rem] tw-font-extrabold tw-text-violet-600 tw-leading-tight">€{compensoTotaleGlobale.toFixed(0)}</div>
                {compensoPagatoGlobale > 0 && (
                  <div className="tw-text-[0.65rem] tw-text-emerald-600 tw-font-semibold tw-mt-0.5 tw-whitespace-nowrap">✓ €{compensoPagatoGlobale.toFixed(0)}</div>
                )}
              </button>
            )}
          </div>

          {/* ─── PLANNING PRELIEVI OGGI ─────────────────────────────────── */}
          {prelieviOggi.length > 0 && (
            <div className="tw-mb-5">
              <div className="tw-font-bold tw-text-[0.9rem] tw-text-sky-700 tw-mb-2.5 tw-flex tw-items-center tw-gap-2">
                💉 Prelievi pianificati oggi ({prelieviOggi.length})
              </div>
              <div className="tw-flex tw-flex-col tw-gap-2">
                {prelieviOggi.map(prel => {
                  const aperto = prelievoAperto === prel._id;
                  return (
                    <div key={prel._id} className="tw-bg-white tw-border tw-border-sky-200 tw-rounded-lg tw-overflow-hidden" style={{ borderLeftWidth: '4px', borderLeftColor: prel.status === 'eseguito' ? '#059669' : '#0369a1' }}>
                      <button
                        type="button"
                        onClick={() => { setPrelievoAperto(aperto ? null : prel._id); setTestoDiariaPrelievo(''); setNoteEsecuzione(''); }}
                        className="tw-w-full tw-bg-transparent tw-border-0 tw-cursor-pointer tw-px-3.5 tw-py-3 tw-text-left tw-flex tw-justify-between tw-items-center tw-gap-2.5"
                      >
                        <div className="tw-flex-1">
                          <div className="tw-font-bold tw-text-sky-700 tw-text-[0.9rem] tw-flex tw-items-center tw-gap-2 tw-flex-wrap">
                            {prel.orario && <span className="tw-bg-blue-50 tw-px-1.5 tw-py-px tw-rounded tw-text-[0.78rem]">⏰ {prel.orario}</span>}
                            {prel.patient?.firstName || 'N/D'} {prel.patient?.lastName || ''}
                            <span className="tw-px-1.5 tw-py-px tw-rounded-full tw-text-[0.7rem] tw-font-bold" style={{ background: prel.status === 'eseguito' ? '#f0fdf4' : '#eff6ff', color: prel.status === 'eseguito' ? '#059669' : '#0369a1' }}>
                              {prel.status === 'eseguito' ? '✅ Eseguito' : '🔵 Da eseguire'}
                            </span>
                          </div>
                          <div className="tw-text-[0.8rem] tw-text-slate-500 tw-mt-0.5">💉 {prel.tipoPrelievo}</div>
                        </div>
                        <span className="tw-text-[0.75rem] tw-text-slate-400">{aperto ? '▲' : '▼'}</span>
                      </button>

                      {aperto && (
                        <div className="tw-border-t tw-border-sky-100 tw-p-3.5">
                          {prel.note && <p className="tw-text-[0.83rem] tw-text-slate-600 tw-mb-2.5">📝 {prel.note}</p>}

                          {/* Registra esecuzione con firma touch */}
                          {prel.status === 'pianificato' && !stepFirmaPrelievo[prel._id] && (
                            <div className="tw-mb-3">
                              <textarea
                                value={noteEsecuzione}
                                onChange={e => setNoteEsecuzione(e.target.value)}
                                placeholder="Note sull'esecuzione (facoltativo)..."
                                rows={2}
                                className="tw-w-full tw-rounded-md tw-border tw-border-sky-200 tw-p-2 tw-text-[0.83rem] tw-resize-y tw-mb-2"
                              />
                              <button
                                type="button"
                                onClick={() => setStepFirmaPrelievo(s => ({ ...s, [prel._id]: 'firma-operatore' }))}
                                className="tw-w-full tw-bg-sky-700 tw-text-white tw-border-0 tw-rounded-md tw-px-4 tw-py-2 tw-cursor-pointer tw-font-bold tw-text-[0.83rem] hover:tw-bg-sky-800"
                              >
                                ✍️ Procedi con firma
                              </button>
                            </div>
                          )}

                          {/* Step 1: Firma operatore */}
                          {prel.status === 'pianificato' && stepFirmaPrelievo[prel._id] === 'firma-operatore' && (
                            <div className="tw-bg-sky-50 tw-rounded-lg tw-p-3.5 tw-mb-3">
                              <div className="tw-font-bold tw-text-[0.85rem] tw-text-sky-700 tw-mb-2.5">✍️ Step 1 — Firma Operatore</div>
                              <FirmaCanvas
                                label="Firma Operatore"
                                sublabel={`${user?.name}`}
                                onFirmaCompleta={(f: string) => setFirmaOpPrelievo(s => ({ ...s, [prel._id]: f }))}
                                onCancella={() => setFirmaOpPrelievo(s => ({ ...s, [prel._id]: '' }))}
                                altezza={140}
                              />
                              <div className="tw-flex tw-gap-2 tw-mt-1">
                                <button type="button" onClick={() => setStepFirmaPrelievo(s => { const n = { ...s }; delete n[prel._id]; return n; })} className="tw-flex-1 tw-bg-slate-100 tw-border tw-border-slate-300 tw-rounded-md tw-p-2 tw-cursor-pointer tw-text-[0.83rem] hover:tw-bg-slate-200">Annulla</button>
                                <button
                                  type="button"
                                  disabled={!firmaOpPrelievo[prel._id]}
                                  onClick={() => setStepFirmaPrelievo(s => ({ ...s, [prel._id]: 'firma-paziente' }))}
                                  className={`tw-flex-[2] tw-rounded-md tw-text-white tw-border-0 tw-p-2 tw-cursor-pointer tw-font-bold tw-text-[0.83rem] ${firmaOpPrelievo[prel._id] ? 'tw-bg-sky-700 tw-cursor-pointer hover:tw-bg-sky-800' : 'tw-bg-sky-300 tw-cursor-not-allowed'}`}
                                >
                                  Avanti → Firma Paziente
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Step 2: Firma paziente */}
                          {prel.status === 'pianificato' && stepFirmaPrelievo[prel._id] === 'firma-paziente' && (
                            <div className="tw-bg-emerald-50 tw-rounded-lg tw-p-3.5 tw-mb-3">
                              <div className="tw-font-bold tw-text-[0.85rem] tw-text-emerald-700 tw-mb-2.5">👇 Step 2 — Consegna al Paziente</div>
                              <div className="tw-flex tw-gap-2 tw-mb-2.5">
                                {(['paziente', 'caregiver'] as const).map(r => (
                                  <button key={r} type="button"
                                    onClick={() => setRuoloFirmatarioPrelievo(s => ({ ...s, [prel._id]: r }))}
                                    className={`tw-flex-1 tw-p-2 tw-rounded-lg tw-cursor-pointer tw-font-semibold tw-text-[0.83rem] tw-border-2 ${ruoloFirmatarioPrelievo[prel._id] === r ? 'tw-bg-emerald-600 tw-border-emerald-600 tw-text-white' : 'tw-bg-slate-100 tw-border-slate-300 tw-text-slate-700'}`}
                                  >{r === 'paziente' ? '🧑 Paziente' : '👨‍👩‍👧 Caregiver'}</button>
                                ))}
                              </div>
                              <input
                                type="text"
                                placeholder={`Nome ${ruoloFirmatarioPrelievo[prel._id] === 'caregiver' ? 'caregiver' : `${prel.patient?.firstName || 'N/D'} ${prel.patient?.lastName || ''}`}`}
                                value={nomeFirmatarioPrelievo[prel._id] || ''}
                                onChange={e => setNomeFirmatarioPrelievo(s => ({ ...s, [prel._id]: e.target.value }))}
                                className="tw-w-full tw-p-2 tw-rounded-md tw-border tw-border-slate-300 tw-mb-2.5 tw-text-[0.83rem]"
                              />
                              <FirmaCanvas
                                label={`Firma ${ruoloFirmatarioPrelievo[prel._id] === 'caregiver' ? 'Caregiver' : 'Paziente'}`}
                                sublabel="Firma per confermare il prelievo eseguito"
                                onFirmaCompleta={(f: string) => setFirmaPazPrelievo(s => ({ ...s, [prel._id]: f }))}
                                onCancella={() => setFirmaPazPrelievo(s => ({ ...s, [prel._id]: '' }))}
                                altezza={140}
                              />
                              <div className="tw-flex tw-gap-2 tw-mt-1">
                                <button type="button" onClick={() => setStepFirmaPrelievo(s => ({ ...s, [prel._id]: 'firma-operatore' }))} className="tw-flex-1 tw-bg-slate-100 tw-border tw-border-slate-300 tw-rounded-md tw-p-2 tw-cursor-pointer tw-text-[0.83rem] hover:tw-bg-slate-200">← Indietro</button>
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
                                  className={`tw-flex-[2] tw-rounded-md tw-text-white tw-border-0 tw-p-2 tw-cursor-pointer tw-font-bold tw-text-[0.83rem] ${firmaPazPrelievo[prel._id] ? 'tw-bg-emerald-600 hover:tw-bg-emerald-700' : 'tw-bg-emerald-200 tw-cursor-not-allowed'}`}
                                >
                                  {registrandoPrelievo === prel._id ? '...' : '✅ Conferma e salva'}
                                </button>
                              </div>
                            </div>
                          )}
                          {prel.status === 'eseguito' && prel.dataEsecuzione && (
                            <div className="tw-bg-emerald-50 tw-rounded-lg tw-p-2.5 tw-mb-3 tw-text-[0.83rem] tw-text-green-800">
                              ✅ Eseguito il {new Date(prel.dataEsecuzione).toLocaleString('it-IT')}
                              {prel.noteEsecuzione && <div className="tw-mt-1 tw-text-slate-700">{prel.noteEsecuzione}</div>}
                            </div>
                          )}

                          {/* Firme */}
                          {prel.status === 'eseguito' && (prel.firmaOperatore || prel.firmaPaziente) && (
                            <div className="tw-bg-slate-50 tw-rounded-lg tw-p-3 tw-mb-3 tw-border tw-border-slate-200">
                              <div className="tw-font-bold tw-text-[0.85rem] tw-text-slate-700 tw-mb-2.5">✍️ Firme Registrate</div>
                              {prel.firmaOperatore && (
                                <div className="tw-mb-2.5">
                                  <div className="tw-text-[0.8rem] tw-text-slate-500 tw-mb-1">Firma Operatore:</div>
                                  <img src={prel.firmaOperatore} alt="Firma operatore" className="tw-max-w-[200px] tw-max-h-[100px] tw-border tw-border-slate-300 tw-rounded tw-bg-white" />
                                </div>
                              )}
                              {prel.firmaPaziente && (
                                <div>
                                  <div className="tw-text-[0.8rem] tw-text-slate-500 tw-mb-1">
                                    Firma {prel.ruoloFirmatario === 'caregiver' ? 'Caregiver' : 'Paziente'} {prel.nomeFirmatarioPaziente && `(${prel.nomeFirmatarioPaziente})`}:
                                  </div>
                                  <img src={prel.firmaPaziente} alt="Firma paziente" className="tw-max-w-[200px] tw-max-h-[100px] tw-border tw-border-slate-300 tw-rounded tw-bg-white" />
                                </div>
                              )}
                            </div>
                          )}

                          {/* Pulsanti PDF */}
                          {prel.status === 'eseguito' && (
                            <div className="tw-flex tw-gap-2 tw-mb-3">
                              <button
                                onClick={() => stampaPrelievoPDF(prel)}
                                className="tw-flex-1 tw-bg-teal-600 tw-text-white tw-border-0 tw-rounded-md tw-px-3 tw-py-2 tw-cursor-pointer tw-font-semibold tw-text-[0.83rem] tw-flex tw-items-center tw-justify-center tw-gap-1.5 hover:tw-bg-teal-700"
                              >
                                <Printer size={14} /> Stampa Verbale
                              </button>
                              <button
                                onClick={() => visualizzaPrelievoPDF(prel)}
                                className="tw-flex-1 tw-bg-blue-500 tw-text-white tw-border-0 tw-rounded-md tw-px-3 tw-py-2 tw-cursor-pointer tw-font-semibold tw-text-[0.83rem] tw-flex tw-items-center tw-justify-center tw-gap-1.5 hover:tw-bg-blue-600"
                              >
                                <Eye size={14} /> Visualizza Verbale
                              </button>
                            </div>
                          )}

                          {/* Diaria */}
                          <div className="tw-font-semibold tw-text-[0.83rem] tw-text-slate-700 tw-mb-1.5">
                            📋 Diaria ({prel.diaria.length})
                          </div>
                          {prel.diaria.map(d => (
                            <div key={d._id} className="tw-bg-slate-50 tw-rounded-md tw-px-2.5 tw-py-1.5 tw-mb-1 tw-text-[0.8rem]">
                              <div className="tw-font-semibold tw-text-slate-600">{d.autore} · {new Date(d.data).toLocaleString('it-IT')}</div>
                              <div className="tw-text-slate-700">{d.testo}</div>
                            </div>
                          ))}
                          <div className="tw-flex tw-gap-1.5 tw-mt-2">
                            <textarea
                              value={testoDiariaPrelievo}
                              onChange={e => setTestoDiariaPrelievo(e.target.value)}
                              placeholder="Aggiungi nota clinica..."
                              rows={2}
                              className="tw-flex-1 tw-rounded-md tw-border tw-border-slate-300 tw-px-2 tw-py-1.5 tw-text-[0.8rem] tw-resize-y"
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
                              className="tw-bg-sky-700 tw-text-white tw-border-0 tw-rounded-md tw-px-3 tw-py-1.5 tw-cursor-pointer tw-font-semibold tw-text-[0.8rem] tw-self-end hover:tw-bg-sky-800"
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

          <div className="tw-flex tw-justify-between tw-items-center tw-mb-4 tw-flex-wrap tw-gap-2.5">
            <p className="tw-text-slate-500 tw-m-0 tw-text-[0.95rem]">
              Seleziona un paziente per operare, oppure visualizza tutti i piani attivi.
            </p>
            <button
              type="button"
              onClick={apriTuttiPiani}
              className="tw-bg-brand tw-text-white tw-border-0 tw-rounded-lg tw-px-4.5 tw-py-2.5 tw-cursor-pointer tw-font-semibold tw-text-[0.9rem] hover:tw-bg-brand-dark"
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
            <div className="tw-mb-4">
              <button
                type="button"
                onClick={() => navigate('/portale-operatore')}
                className="tw-bg-slate-100 tw-text-slate-700 tw-border tw-border-slate-200 tw-rounded-md tw-px-3.5 tw-py-2 tw-cursor-pointer tw-text-[0.88rem] hover:tw-bg-slate-200"
              >
                ← Torna alla dashboard
              </button>
            </div>
          )}
          {pazienti.length === 0 ? (
            <div className="tw-bg-amber-50 tw-border tw-border-amber-400 tw-rounded-lg tw-p-4 tw-text-amber-800">
              ⚠️ Nessun paziente assegnato. Contatta il coordinatore.
            </div>
          ) : (
            <div>
              <div className="tw-font-semibold tw-mb-3 tw-text-[0.95rem] tw-text-slate-700">
                {isConvenzione ? '🏥 Pazienti in convenzione' : '👤 Pazienti in carico'} ({pazienti.length})
              </div>
              <div className="tw-flex tw-flex-col tw-gap-2.5">
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
                      className="tw-bg-white tw-border tw-border-slate-200 tw-border-l-4 tw-border-l-brand tw-rounded-lg tw-px-4 tw-py-3.5 tw-cursor-pointer tw-text-left tw-flex tw-justify-between tw-items-center tw-gap-3 tw-flex-wrap hover:tw-bg-slate-50"
                    >
                      <div className="tw-flex-1">
                        <div className="tw-font-bold tw-text-base tw-text-brand tw-mb-1 tw-flex tw-items-center tw-gap-2 tw-flex-wrap">
                          {paz.tipoGestione === 'convenzione' ? '🏥' : '👤'} {paz?.firstName || 'N/D'} {paz?.lastName || ''}
                          {paz.tipoGestione === 'convenzione' && (
                            <span className="tw-bg-sky-600 tw-text-white tw-text-[0.68rem] tw-font-bold tw-px-1.5 tw-py-0.5 tw-rounded tw-tracking-wide">CONVENZIONE</span>
                          )}
                        </div>
                        <div className="tw-text-[0.83rem] tw-text-slate-600 tw-flex tw-flex-wrap tw-gap-2.5">
                          {paz.address && <span>📍 {paz.address}</span>}
                          {paz.contactPhone && <span>📞 {paz.contactPhone}</span>}
                          {paz.tipoGestione === 'convenzione' && paz.siat?.tipologiaCura
                            ? <span>🩺 {paz.siat.tipologiaCura}</span>
                            : paz.assistanceNeeds && <span>🩺 {paz.assistanceNeeds}</span>}
                          {paz.siat?.asl && <span>🏛 {paz.siat.asl}</span>}
                        </div>
                      </div>
                      <div className="tw-flex tw-gap-2 tw-flex-wrap tw-items-center tw-flex-shrink-0">
                        {haCompenso && (
                          <div className="tw-text-right">
                            <div className="tw-text-[0.72rem] tw-text-violet-600 tw-font-semibold tw-uppercase">Compenso maturato</div>
                            <div className="tw-font-extrabold tw-text-violet-600 tw-text-base">€ {compensoTotale.toFixed(2)}</div>
                            {compensoPagato > 0 && (
                              <div className="tw-text-[0.72rem] tw-text-emerald-600 tw-font-semibold">✅ € {compensoPagato.toFixed(2)} pagato</div>
                            )}
                          </div>
                        )}
                        <span className="tw-rounded-full tw-px-3 tw-py-1 tw-text-[0.82rem] tw-font-bold" style={{
                          background: pianiPaz.length > 0 ? 'rgba(5,150,105,0.1)' : 'rgba(107,114,128,0.1)',
                          color: pianiPaz.length > 0 ? '#065f46' : '#6b7280',
                          border: `1px solid ${pianiPaz.length > 0 ? '#059669' : '#9ca3af'}`,
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
          <div className="tw-flex tw-items-center tw-gap-3 tw-mb-4 tw-flex-wrap">
            <button
              type="button"
              onClick={() => setMostraTuttiPiani(false)}
              className="tw-bg-slate-100 tw-text-slate-700 tw-border tw-border-slate-200 tw-rounded-md tw-px-3.5 tw-py-2 tw-cursor-pointer tw-text-[0.88rem] hover:tw-bg-slate-200"
            >
              ← Torna ai pazienti
            </button>
            <h3 className="tw-m-0 tw-text-brand tw-text-[1.05rem]">
              📋 Tutti i piani attivi ({pianiAttiviTutti.length})
            </h3>
          </div>

          {pianiAttiviTutti.length === 0 ? (
            <div className="tw-bg-amber-50 tw-border tw-border-amber-400 tw-rounded-lg tw-p-4 tw-text-amber-800">
              ⚠️ Nessun piano attivo al momento.
            </div>
          ) : (
            <div className="tw-flex tw-flex-col tw-gap-2.5">
              {pianiAttiviTutti.map(piano => (
                <button
                  key={piano._id}
                  type="button"
                  onClick={() => selezionaPianoDaLista(piano)}
                  className="tw-bg-white tw-border tw-border-slate-200 tw-border-l-4 tw-border-l-emerald-600 tw-rounded-lg tw-px-4 tw-py-3.5 tw-cursor-pointer tw-text-left tw-flex tw-justify-between tw-items-center tw-gap-3 tw-flex-wrap hover:tw-bg-slate-50"
                >
                  <div className="tw-flex-1">
                    <div className="tw-font-bold tw-text-[0.95rem] tw-text-brand tw-mb-0.5">
                      👤 {piano.patient?.firstName || 'N/D'} {piano.patient?.lastName || ''}
                    </div>
                    <div className="tw-text-[0.85rem] tw-text-slate-700 tw-mb-0.5">
                      {piano.category} — {piano.task}
                    </div>
                    <div className="tw-text-[0.78rem] tw-text-slate-400">
                      📅 {formatData(piano.date)}{piano.dataFine ? ` → ${formatData(piano.dataFine)}` : ''}
                    </div>
                  </div>
                  <span className="tw-bg-emerald-50 tw-text-emerald-800 tw-border tw-border-emerald-600 tw-rounded-full tw-px-3 tw-py-1 tw-text-[0.8rem] tw-font-bold tw-flex-shrink-0">
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
          <div className="tw-mb-3">
            <button
              type="button"
              onClick={() => { setPazienteSelezionato(null); setPianoSelezionato(null); resetDettagliPiano(); }}
              className="tw-bg-slate-100 tw-text-slate-700 tw-border tw-border-slate-200 tw-rounded-md tw-px-3.5 tw-py-2 tw-cursor-pointer tw-text-[0.88rem] hover:tw-bg-slate-200"
            >
              ← Torna ai pazienti
            </button>
          </div>

          <div className="tw-bg-slate-50 tw-border tw-border-slate-200 tw-rounded-lg tw-p-3.5 tw-mb-5">
            <div className="tw-flex tw-justify-between tw-items-start tw-flex-wrap tw-gap-2.5">
              <strong className="tw-text-base">📋 {pazienteSelezionato?.firstName || 'N/D'} {pazienteSelezionato?.lastName || ''}</strong>
              <div className="tw-flex tw-gap-2 tw-flex-wrap">
                <button type="button" onClick={() => setShowChatPaziente(v => !v)} className="tw-bg-teal-600 tw-text-white tw-border-0 tw-rounded-md tw-px-3 tw-py-2 tw-cursor-pointer tw-font-bold tw-text-[0.8rem] hover:tw-bg-teal-700">💬 {showChatPaziente ? 'Chiudi chat' : 'Apri chat paziente'}</button>
                <ReportGenerator patientId={pazienteSelezionato._id} patientName={`${pazienteSelezionato.firstName} ${pazienteSelezionato.lastName}`} />
              </div>
            </div>
            <div className="tw-flex tw-gap-2 tw-flex-wrap tw-mt-3">
              <button type="button" onClick={() => setShowConsensoGDPR(true)} className={`tw-border tw-rounded-md tw-px-3 tw-py-2 tw-cursor-pointer tw-font-bold tw-text-[0.8rem] ${consensoGDPRFirmato ? 'tw-bg-green-100 tw-text-green-800 tw-border-green-300' : 'tw-bg-red-600 tw-text-white tw-border-red-700 hover:tw-bg-red-700'}`}>{consensoGDPRFirmato ? '✅ Consenso GDPR firmato' : '⚠️ Firma consenso GDPR'}</button>
              <button type="button" onClick={() => setShowConsensoPrestazione(true)} className={`tw-border tw-rounded-md tw-px-3 tw-py-2 tw-cursor-pointer tw-font-bold tw-text-[0.8rem] ${consensoPrestazioneFirmato ? 'tw-bg-green-100 tw-text-green-800 tw-border-green-300' : 'tw-bg-orange-700 tw-text-white tw-border-orange-800 hover:tw-bg-orange-800'}`}>{consensoPrestazioneFirmato ? '✅ Consenso prestazione firmato' : '⚠️ Firma consenso prestazione e rischi'}</button>
              <button type="button" onClick={() => setShowCustomerSatisfaction(true)} className="tw-bg-violet-100 tw-text-violet-800 tw-border tw-border-violet-300 tw-rounded-md tw-px-3 tw-py-2 tw-cursor-pointer tw-font-bold tw-text-[0.8rem] hover:tw-bg-violet-200">⭐ Customer Satisfaction</button>
              <button type="button" onClick={() => setShowSchedaDimissione(true)} className="tw-bg-blue-100 tw-text-blue-700 tw-border tw-border-blue-300 tw-rounded-md tw-px-3 tw-py-2 tw-cursor-pointer tw-font-bold tw-text-[0.8rem] hover:tw-bg-blue-200">📋 Scheda dimissione</button>
              <button type="button" onClick={() => setShowRiformulazionePAI(true)} className="tw-bg-sky-100 tw-text-sky-700 tw-border tw-border-sky-300 tw-rounded-md tw-px-3 tw-py-2 tw-cursor-pointer tw-font-bold tw-text-[0.8rem] hover:tw-bg-sky-200">🔄 Riformula / rinnova PAI</button>
              <button type="button" onClick={() => setShowDatiCliniciADI(true)} className="tw-bg-cyan-100 tw-text-cyan-800 tw-border tw-border-cyan-300 tw-rounded-md tw-px-3 tw-py-2 tw-cursor-pointer tw-font-bold tw-text-[0.8rem] hover:tw-bg-cyan-200">🩺 Dati clinici ADI</button>
              {consensoGDPRFirmato && <><button type="button" onClick={() => esportaConsensoPdf('gdpr')} className="tw-bg-blue-50 tw-text-blue-700 tw-border tw-border-blue-300 tw-rounded-md tw-px-3 tw-py-2 tw-cursor-pointer tw-font-bold tw-text-[0.8rem] hover:tw-bg-blue-100">📄 PDF GDPR</button><button type="button" onClick={() => inviaEmailConsenso('gdpr')} className="tw-bg-blue-50 tw-text-blue-700 tw-border tw-border-blue-300 tw-rounded-md tw-px-3 tw-py-2 tw-cursor-pointer tw-font-bold tw-text-[0.8rem] hover:tw-bg-blue-100">✉️ Invia GDPR</button></>}
              {consensoPrestazioneFirmato && <><button type="button" onClick={() => esportaConsensoPdf('prestazione')} className="tw-bg-orange-50 tw-text-orange-800 tw-border tw-border-orange-300 tw-rounded-md tw-px-3 tw-py-2 tw-cursor-pointer tw-font-bold tw-text-[0.8rem] hover:tw-bg-orange-100">📄 PDF prestazione</button><button type="button" onClick={() => inviaEmailConsenso('prestazione')} className="tw-bg-orange-50 tw-text-orange-800 tw-border tw-border-orange-300 tw-rounded-md tw-px-3 tw-py-2 tw-cursor-pointer tw-font-bold tw-text-[0.8rem] hover:tw-bg-orange-100">✉️ Invia prestazione</button></>}
            </div>
            <div className="tw-text-[0.88rem] tw-text-slate-600 tw-mt-1.5 tw-flex tw-flex-wrap tw-gap-3">
              {pazienteSelezionato.address && <span>📍 {pazienteSelezionato.address}</span>}
              {pazienteSelezionato.contactPhone && <span>📞 {pazienteSelezionato.contactPhone}</span>}
              {pazienteSelezionato.assistanceNeeds && <span>🩺 {pazienteSelezionato.assistanceNeeds}</span>}
            </div>
          </div>

          {showChatPaziente && (
            <div className="tw-mb-5">
              <ChatWidget
                scope="patient"
                patientId={pazienteSelezionato._id}
                title={`💬 Chat con coordinatore — ${pazienteSelezionato.firstName} ${pazienteSelezionato.lastName}`}
                height={420}
              />
            </div>
          )}

          {piani.length === 0 ? (
            <p className="tw-text-slate-500 tw-italic">Nessun piano assegnato per questo paziente.</p>
          ) : (
            <div className="tw-mb-5">
              <div className="tw-font-semibold tw-mb-2.5 tw-text-[0.95rem] tw-text-slate-700">
                📋 Piani di lavoro ({piani.length})
              </div>
              <div className="tw-flex tw-flex-wrap tw-gap-2.5">
                {piani.map(piano => (
                  <button
                    key={piano._id}
                    type="button"
                    onClick={() => selezionaPiano(piano)}
                    className="tw-cursor-pointer tw-text-left tw-px-4 tw-py-2.5 tw-text-[0.9rem] tw-rounded-md tw-min-w-[180px]"
                    style={{
                      background: piano.status === 'pending' ? '#fff' : '#f9fafb',
                      border: `1px solid ${piano.status === 'pending' ? '#059669' : '#e2e8f0'}`,
                      borderLeftWidth: '4px',
                      borderLeftColor: piano.status === 'pending' ? '#059669' : '#9ca3af',
                    }}
                  >
                    <div className="tw-font-semibold tw-text-brand">{piano.category}</div>
                    <div className="tw-text-[0.8rem] tw-text-slate-600 tw-mt-0.5">
                      {formatData(piano.date)}{piano.dataFine ? ` → ${formatData(piano.dataFine)}` : ''}
                    </div>
                    <div className="tw-text-[0.75rem] tw-mt-0.5 tw-font-semibold" style={{ color: piano.status === 'pending' ? '#059669' : '#6b7280' }}>
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
            <div className="tw-flex tw-items-center tw-gap-2 tw-mb-3 tw-flex-wrap">
              <button
                type="button"
                onClick={() => { setPianoSelezionato(null); resetDettagliPiano(); }}
                className="tw-bg-slate-100 tw-text-slate-700 tw-border tw-border-slate-200 tw-rounded-md tw-px-3 tw-py-1.5 tw-cursor-pointer tw-text-[0.85rem] hover:tw-bg-slate-200"
              >
                ← Torna ai piani
              </button>
              {pazienteSelezionato && (
                <span className="tw-text-[0.85rem] tw-text-slate-500">
                  {pazienteSelezionato?.firstName || 'N/D'} {pazienteSelezionato?.lastName || ''} › {pianoSelezionato?.category || 'N/D'}
                </span>
              )}
            </div>

            {/* Info piano */}
            <div className="tw-bg-slate-50 tw-border tw-border-slate-200 tw-rounded-lg tw-p-4 tw-mb-4">
              <h3 className="tw-m-0 tw-mb-1.5 tw-text-brand">📋 {pianoSelezionato.category}</h3>
              <p className="tw-m-0 tw-mb-1 tw-text-slate-700">{pianoSelezionato.task}</p>
              {pianoSelezionato.notes && <p className="tw-m-0 tw-mb-3 tw-text-slate-500 tw-text-[0.9rem]">📝 {pianoSelezionato.notes}</p>}
              <div className="tw-flex tw-gap-2 tw-flex-wrap" style={{ marginTop: pianoSelezionato.notes ? 0 : '10px' }}>
                <button type="button" onClick={() => setShowChatPaziente(v => !v)} className="tw-bg-teal-600 tw-text-white tw-border-0 tw-rounded-md tw-px-3.5 tw-py-2 tw-cursor-pointer tw-font-bold tw-text-[0.84rem] hover:tw-bg-teal-700">💬 {showChatPaziente ? 'Chiudi chat' : 'Apri chat paziente'}</button>
                {pazienteSelezionato && <ReportGenerator patientId={pazienteSelezionato._id} patientName={`${pazienteSelezionato.firstName} ${pazienteSelezionato.lastName}`} />}
                <button type="button" onClick={() => setShowConsensoGDPR(true)} className={`tw-border tw-rounded-md tw-px-3.5 tw-py-2 tw-cursor-pointer tw-font-bold tw-text-[0.84rem] ${consensoGDPRFirmato ? 'tw-bg-green-100 tw-text-green-800 tw-border-green-300' : 'tw-bg-red-600 tw-text-white tw-border-red-700 hover:tw-bg-red-700'}`}>{consensoGDPRFirmato ? '✅ GDPR firmato' : '⚠️ Firma GDPR'}</button>
                <button type="button" onClick={() => setShowConsensoPrestazione(true)} className={`tw-border tw-rounded-md tw-px-3.5 tw-py-2 tw-cursor-pointer tw-font-bold tw-text-[0.84rem] ${consensoPrestazioneFirmato ? 'tw-bg-green-100 tw-text-green-800 tw-border-green-300' : 'tw-bg-orange-700 tw-text-white tw-border-orange-800 hover:tw-bg-orange-800'}`}>{consensoPrestazioneFirmato ? '✅ Prestazione firmata' : '⚠️ Firma prestazione e rischi'}</button>
                <button type="button" onClick={() => setShowCustomerSatisfaction(true)} className="tw-bg-violet-100 tw-text-violet-800 tw-border tw-border-violet-300 tw-rounded-md tw-px-3.5 tw-py-2 tw-cursor-pointer tw-font-bold tw-text-[0.84rem] hover:tw-bg-violet-200">⭐ Customer Satisfaction</button>
                <button type="button" onClick={() => setShowSchedaDimissione(true)} className="tw-bg-blue-100 tw-text-blue-700 tw-border tw-border-blue-300 tw-rounded-md tw-px-3.5 tw-py-2 tw-cursor-pointer tw-font-bold tw-text-[0.84rem] hover:tw-bg-blue-200">📋 Scheda dimissione</button>
                <button type="button" onClick={() => setShowRiformulazionePAI(true)} className="tw-bg-sky-100 tw-text-sky-700 tw-border tw-border-sky-300 tw-rounded-md tw-px-3.5 tw-py-2 tw-cursor-pointer tw-font-bold tw-text-[0.84rem] hover:tw-bg-sky-200">🔄 Riformula / rinnova PAI</button>
                <button type="button" onClick={() => setShowDatiCliniciADI(true)} className="tw-bg-cyan-100 tw-text-cyan-800 tw-border tw-border-cyan-300 tw-rounded-md tw-px-3.5 tw-py-2 tw-cursor-pointer tw-font-bold tw-text-[0.84rem] hover:tw-bg-cyan-200">🩺 Dati clinici ADI</button>
                {consensoGDPRFirmato && <><button type="button" onClick={() => esportaConsensoPdf('gdpr')} className="tw-bg-blue-50 tw-text-blue-700 tw-border tw-border-blue-300 tw-rounded-md tw-px-3.5 tw-py-2 tw-cursor-pointer tw-font-bold tw-text-[0.84rem] hover:tw-bg-blue-100">📄 PDF GDPR</button><button type="button" onClick={() => inviaEmailConsenso('gdpr')} className="tw-bg-blue-50 tw-text-blue-700 tw-border tw-border-blue-300 tw-rounded-md tw-px-3.5 tw-py-2 tw-cursor-pointer tw-font-bold tw-text-[0.84rem] hover:tw-bg-blue-100">✉️ Invia GDPR</button></>}
                {consensoPrestazioneFirmato && <><button type="button" onClick={() => esportaConsensoPdf('prestazione')} className="tw-bg-orange-50 tw-text-orange-800 tw-border tw-border-orange-300 tw-rounded-md tw-px-3.5 tw-py-2 tw-cursor-pointer tw-font-bold tw-text-[0.84rem] hover:tw-bg-orange-100">📄 PDF prestazione</button><button type="button" onClick={() => inviaEmailConsenso('prestazione')} className="tw-bg-orange-50 tw-text-orange-800 tw-border tw-border-orange-300 tw-rounded-md tw-px-3.5 tw-py-2 tw-cursor-pointer tw-font-bold tw-text-[0.84rem] hover:tw-bg-orange-100">✉️ Invia prestazione</button></>}
              </div>
            </div>

            {showChatPaziente && pazienteSelezionato && (
              <div className="tw-mb-4">
                <ChatWidget scope="patient" patientId={pazienteSelezionato._id} title={`💬 Chat con coordinatore — ${pazienteSelezionato.firstName} ${pazienteSelezionato.lastName}`} height={420} />
              </div>
            )}

            {/* ── COMPENSO MATURATO ── */}
            {pianoSelezionato.tipoCompenso && pianoSelezionato.tipoCompenso !== 'nessuno' && (
              <div className="tw-rounded-lg tw-p-4 tw-mb-4" style={{ background: riepilogo?.compensoPagato ? 'rgba(5,150,105,0.06)' : 'rgba(124,58,237,0.06)', border: `1px solid ${riepilogo?.compensoPagato ? 'rgba(5,150,105,0.3)' : 'rgba(124,58,237,0.3)'}` }}>
                <h4 className="tw-m-0 tw-mb-3 tw-flex tw-items-center tw-gap-2" style={{ color: riepilogo?.compensoPagato ? '#065f46' : '#7c3aed' }}>
                  💰 Compenso maturato
                </h4>
                <div className="tw-grid tw-grid-cols-2 md:tw-grid-cols-4 tw-gap-2.5">
                  <div className="tw-bg-violet-50 tw-rounded-lg tw-px-3.5 tw-py-2.5 tw-text-center">
                    <div className="tw-text-[0.72rem] tw-text-violet-600 tw-font-semibold tw-mb-0.5 tw-uppercase">
                      {pianoSelezionato.tipoCompenso === 'orario' ? 'Tariffa/ora' : 'Compenso fisso'}
                    </div>
                    <div className="tw-text-[1.2rem] tw-font-extrabold tw-text-violet-600">
                      € {(pianoSelezionato.tariffa || 0).toFixed(2)}
                      {pianoSelezionato.tipoCompenso === 'orario' && <span className="tw-text-[0.7rem] tw-font-normal">/h</span>}
                    </div>
                  </div>
                  {pianoSelezionato.tipoCompenso === 'orario' && riepilogo && (
                    <div className="tw-bg-sky-50 tw-rounded-lg tw-px-3.5 tw-py-2.5 tw-text-center">
                      <div className="tw-text-[0.72rem] tw-text-sky-600 tw-font-semibold tw-mb-0.5 tw-uppercase">Ore lavorate</div>
                      <div className="tw-text-[1.2rem] tw-font-extrabold tw-text-sky-600">{riepilogo.oreTotali}h</div>
                    </div>
                  )}
                  {riepilogo && (
                    <div className="tw-bg-amber-50 tw-rounded-lg tw-px-3.5 tw-py-2.5 tw-text-center">
                      <div className="tw-text-[0.72rem] tw-text-amber-600 tw-font-semibold tw-mb-0.5 tw-uppercase">Accessi</div>
                      <div className="tw-text-[1.2rem] tw-font-extrabold tw-text-amber-600">{riepilogo.accessiCompletati}</div>
                    </div>
                  )}
                  {riepilogo && (
                    <div className="tw-rounded-lg tw-px-3.5 tw-py-2.5 tw-text-center" style={{ background: riepilogo.compensoPagato ? '#f0fdf4' : '#fdf4ff', border: `1px solid ${riepilogo.compensoPagato ? '#bbf7d0' : '#e9d5ff'}` }}>
                      <div className="tw-text-[0.72rem] tw-font-semibold tw-mb-0.5 tw-uppercase" style={{ color: riepilogo.compensoPagato ? '#059669' : '#7c3aed' }}>
                        {riepilogo.compensoPagato ? '✅ Pagato' : '💰 Maturato'}
                      </div>
                      <div className="tw-text-[1.3rem] tw-font-extrabold" style={{ color: riepilogo.compensoPagato ? '#059669' : '#7c3aed' }}>
                        € {(riepilogo.compensoSalvato > 0 ? riepilogo.compensoSalvato : riepilogo.compensoCalcolato).toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
                {riepilogo && !riepilogo.compensoPagato && (
                  <p className="tw-m-0 tw-mt-2.5 tw-text-[0.8rem] tw-text-slate-400 tw-italic">
                    ⏳ In attesa di pagamento da parte del coordinatore.
                  </p>
                )}
                {riepilogo?.compensoPagato && (
                  <p className="tw-m-0 tw-mt-2.5 tw-text-[0.8rem] tw-text-emerald-600 tw-font-semibold">
                    ✅ Compenso già pagato.
                  </p>
                )}
              </div>
            )}

            {/* ── REGISTRAZIONE ACCESSO (apre pagina dedicata ottimizzata tablet) ── */}
            <div className="tw-rounded-lg tw-p-4 tw-mb-4" style={{ background: accessoAperto ? 'rgba(5,150,105,0.06)' : 'rgba(30,77,140,0.04)', border: `1px solid ${accessoAperto ? 'rgba(5,150,105,0.3)' : 'rgba(30,77,140,0.2)'}` }}>
              <h4 className="tw-m-0 tw-mb-2.5" style={{ color: accessoAperto ? '#065f46' : '#1e4d8c' }}>
                {accessoAperto ? '🟢 Accesso in corso' : '🔵 Registra accesso'}
              </h4>
              {accessoAperto && (
                <p className="tw-m-0 tw-mb-3 tw-text-[0.9rem] tw-text-slate-700">
                  Entrata: <strong>{formatOra(accessoAperto.oraEntrata)}</strong> del <strong>{formatData(accessoAperto.oraEntrata)}</strong>
                </p>
              )}
              <button
                type="button"
                onClick={() => pianoSelezionato && navigate(`/registrazione-accesso/${pianoSelezionato._id}`)}
                className="tw-w-full tw-p-4 tw-rounded-xl tw-border-0 tw-cursor-pointer tw-text-white tw-font-bold tw-text-[1.05rem] tw-flex tw-items-center tw-justify-center tw-gap-2.5"
                style={{ backgroundColor: accessoAperto ? '#16a34a' : '#1e4d8c' }}
              >
                {accessoAperto ? '⏹️ Registra Uscita con Firma' : '▶️ Registra Entrata'}
                <span className="tw-text-[0.75rem] tw-opacity-90">(ottimizzato tablet)</span>
              </button>
            </div>

            {/* ── SEZIONE DIARIO CLINICO ── */}
            <div className="tw-border tw-border-slate-200 tw-rounded-lg tw-mb-4 tw-overflow-hidden">
              <div className="tw-flex tw-gap-2 tw-items-stretch tw-bg-slate-50">
                <button type="button" onClick={() => setShowDiario(!showDiario)}
                className="tw-w-full tw-bg-slate-50 tw-border-0 tw-px-4 tw-py-3.5 tw-text-left tw-cursor-pointer tw-font-semibold tw-text-[0.95rem] tw-text-slate-700 tw-flex tw-justify-between hover:tw-bg-slate-100">
                <span>📓 Diario clinico ({diario.length} voci)</span>
                <span>{showDiario ? '▲' : '▼'}</span>
                </button>
                <button type="button" onClick={() => setShowFormazioneSanitaria(true)} className="tw-my-2 tw-mr-2.5 tw-px-3 tw-py-2 tw-border tw-border-teal-200 tw-rounded-md tw-cursor-pointer tw-bg-teal-50 tw-text-teal-700 tw-font-bold tw-whitespace-nowrap hover:tw-bg-teal-100">🎓 Formazione sanitaria</button>
              </div>
              {showDiario && (
                <div className="tw-p-4">
                  <div className="tw-bg-slate-50 tw-border tw-border-slate-200 tw-rounded-lg tw-p-4 tw-mb-4">
                    <h5 className="tw-m-0 tw-mb-3 tw-text-brand">✏️ Nuova voce diario</h5>
                    {pianoSelezionato && (
                      <div className="tw-mb-3">
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
                    <label className="tw-block tw-mb-3">
                      Diaria *
                      <textarea
                        value={testoDiario}
                        onChange={e => setTestoDiario(e.target.value)}
                        placeholder="Descrivi le attività svolte, le condizioni del paziente, le osservazioni cliniche..."
                        rows={4}
                        className="tw-w-full tw-mt-1 tw-px-3 tw-py-2 tw-border tw-border-slate-300 tw-rounded-md tw-text-[0.9rem] tw-resize-y tw-box-border"
                      />
                    </label>
                    <h6 className="tw-m-0 tw-mb-2.5 tw-text-slate-700 tw-font-semibold">📊 Parametri vitali (opzionali)</h6>
                    <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-3 xl:tw-grid-cols-4 tw-gap-2.5 tw-mb-3">
                      {PARAMETRI_VITALI.map(({ key, label, unit, step }) => (
                        <label key={key} className="tw-text-[0.82rem]">
                          {label}
                          <div className="tw-flex tw-items-center tw-gap-1 tw-mt-0.5">
                            <input
                              type="number"
                              value={parametri[key] || ''}
                              onChange={e => setParametri(prev => ({ ...prev, [key]: e.target.value }))}
                              step={step}
                              min={key === 'dolore' ? '0' : undefined}
                              max={key === 'dolore' ? '10' : undefined}
                              placeholder="—"
                              className="tw-flex-1 tw-px-2 tw-py-1 tw-border tw-border-slate-300 tw-rounded tw-text-[0.85rem]"
                            />
                            <span className="tw-text-[0.75rem] tw-text-slate-400 tw-whitespace-nowrap">{unit}</span>
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
                    <p className="tw-text-slate-500 tw-italic">Nessuna voce nel diario.</p>
                  ) : (
                    <div className="document-list">
                      <ul>
                        {diario.map(entry => (
                          <li key={entry._id}>
                            <div className="tw-flex tw-justify-between tw-items-start tw-flex-wrap tw-gap-2">
                              <div className="tw-flex-1">
                                <div className="tw-flex tw-gap-2 tw-items-center tw-mb-1.5 tw-flex-wrap">
                                  <span className="tw-font-semibold tw-text-[0.88rem]">📅 {formatData(entry.dataRegistrazione)} {formatOra(entry.dataRegistrazione)}</span>
                                  <span className="tw-text-[0.8rem] tw-text-slate-400">✍️ {entry.staffName}</span>
                                  {entry.firmato && (
                                    <span className="tw-bg-emerald-50 tw-text-emerald-800 tw-border tw-border-emerald-600 tw-rounded-full tw-px-2 tw-py-px tw-text-[0.75rem] tw-font-bold">
                                      ✅ Firmato {entry.dataFirma ? formatData(entry.dataFirma) : ''}
                                    </span>
                                  )}
                                </div>
                                <p className="tw-m-0 tw-mb-2 tw-text-slate-700 tw-text-[0.9rem] tw-whitespace-pre-wrap">{entry.testo}</p>
                                {entry.parametriVitali && Object.values(entry.parametriVitali).some(v => v !== undefined && v !== null) && (
                                  <div className="tw-bg-slate-100 tw-rounded-md tw-px-3 tw-py-2 tw-text-[0.82rem] tw-text-slate-600 tw-flex tw-flex-wrap tw-gap-2.5">
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
                                <div className="tw-flex tw-gap-1.5">
                                  <button type="button" onClick={() => setDiarioDaFirmare(entry._id)} className="tw-bg-emerald-600 tw-text-white tw-text-[0.82rem] tw-px-3 tw-py-1.5 tw-whitespace-nowrap tw-rounded-md tw-cursor-pointer hover:tw-bg-emerald-700">✍️ Firma con dito/penna</button>
                                  <button type="button" onClick={() => eliminaDiario(entry._id)} title="Elimina voce non firmata" className="tw-bg-red-100 tw-text-red-700 tw-border tw-border-red-300 tw-rounded-md tw-px-2 tw-py-1 tw-cursor-pointer tw-font-bold hover:tw-bg-red-200">✕</button>
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
            <div className="tw-border tw-border-slate-200 tw-rounded-lg tw-mb-4 tw-overflow-hidden">
              <button type="button" onClick={() => setShowAllegati(!showAllegati)}
                className="tw-w-full tw-bg-slate-50 tw-border-0 tw-px-4 tw-py-3.5 tw-text-left tw-cursor-pointer tw-font-semibold tw-text-[0.95rem] tw-text-slate-700 tw-flex tw-justify-between hover:tw-bg-slate-100">
                <span>📎 Allegati ({allegati.length})</span>
                <span>{showAllegati ? '▲' : '▼'}</span>
              </button>
              {showAllegati && (
                <div className="tw-p-4">
                  <div className="tw-bg-slate-50 tw-border tw-border-slate-200 tw-rounded-lg tw-p-4 tw-mb-4">
                    <h5 className="tw-m-0 tw-mb-3 tw-text-brand">📤 Carica documento</h5>
                    <div className="tw-flex tw-gap-2.5 tw-flex-wrap tw-items-end">
                      <label className="tw-flex-[2] tw-min-w-[200px] tw-block">
                        File *
                        <input ref={fileInputRef} type="file" onChange={e => setFileAllegato(e.target.files?.[0] || null)}
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.txt"
                          className="tw-mt-1 tw-block tw-w-full" />
                      </label>
                      <label className="tw-flex-[2] tw-min-w-[200px] tw-block">
                        Descrizione (opzionale)
                        <input value={descrizioneAllegato} onChange={e => setDescrizioneAllegato(e.target.value)}
                          placeholder="Es. Referto ECG, Prescrizione..." className="tw-mt-1 tw-w-full tw-px-2 tw-py-1.5 tw-border tw-border-slate-300 tw-rounded-md" />
                      </label>
                      <button type="button" onClick={caricaAllegato} disabled={caricandoAllegato || !fileAllegato}
                        className="tw-bg-brand tw-text-white tw-px-4.5 tw-py-2.5 tw-rounded-md tw-cursor-pointer tw-font-semibold tw-whitespace-nowrap hover:tw-bg-brand-dark disabled:tw-opacity-50 disabled:tw-cursor-not-allowed">
                        {caricandoAllegato ? '⏳' : '📤 Carica'}
                      </button>
                    </div>
                    <p className="tw-m-0 tw-mt-2 tw-text-[0.8rem] tw-text-slate-400">Formati accettati: PDF, immagini, Word, Excel, testo. Max 20 MB.</p>
                  </div>
                  {allegati.length === 0 ? (
                    <p className="tw-text-slate-500 tw-italic">Nessun allegato.</p>
                  ) : (
                    <div className="document-list">
                      <ul>
                        {allegati.map(all => (
                          <li key={all._id}>
                            <div className="tw-flex tw-justify-between tw-items-center tw-flex-wrap tw-gap-2">
                              <div>
                                <div className="tw-font-semibold tw-mb-0.5">
                                  {all.mimeType.startsWith('image/') ? '🖼️' : all.mimeType === 'application/pdf' ? '📄' : '📎'} {all.nomeFile}
                                </div>
                                <div className="tw-text-[0.82rem] tw-text-slate-400 tw-flex tw-gap-2.5 tw-flex-wrap">
                                  {all.descrizione && <span>{all.descrizione}</span>}
                                  <span>{formatBytes(all.dimensione)}</span>
                                  <span>📅 {formatData(all.dataCaricamento)}</span>
                                  <span>👤 {all.caricatoDa}</span>
                                </div>
                              </div>
                              <button type="button" onClick={() => apriAllegato(all)}
                                className="tw-bg-brand tw-text-white tw-text-[0.85rem] tw-px-3.5 tw-py-1.5 tw-rounded-md tw-cursor-pointer hover:tw-bg-brand-dark">
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
            <div className="tw-border tw-border-slate-200 tw-rounded-lg tw-mb-4 tw-overflow-hidden">
              <button type="button" onClick={() => setShowObiettivi(!showObiettivi)}
                className="tw-w-full tw-bg-slate-50 tw-border-0 tw-px-4 tw-py-3.5 tw-text-left tw-cursor-pointer tw-font-semibold tw-text-[0.95rem] tw-text-slate-700 tw-flex tw-justify-between hover:tw-bg-slate-100">
                <span>🎯 Obiettivi del piano ({obiettivi.length})</span>
                <span>{showObiettivi ? '▲' : '▼'}</span>
              </button>
              {showObiettivi && (
                <div className="tw-p-4">
                  {obiettivi.length === 0 ? (
                    <p className="tw-text-slate-500 tw-italic">Nessun obiettivo definito. Gli obiettivi vengono formulati dal coordinatore.</p>
                  ) : (
                    <div className="tw-flex tw-flex-col tw-gap-3">
                      {obiettivi.map(ob => {
                        const badge = statoObiettivoBadge[ob.stato] || statoObiettivoBadge.attivo;
                        const isRivalutando = rivalutandoId === ob._id;
                        return (
                          <div key={ob._id} className="tw-rounded-lg tw-px-4 tw-py-3.5" style={{ background: badge.bg, border: `1px solid ${badge.color}30` }}>
                            <div className="tw-flex tw-justify-between tw-items-start tw-flex-wrap tw-gap-2 tw-mb-2">
                              <div className="tw-flex-1">
                                <p className="tw-m-0 tw-mb-1 tw-font-semibold tw-text-slate-700">{ob.descrizione}</p>
                                <div className="tw-text-[0.82rem] tw-text-slate-400 tw-flex tw-gap-2.5 tw-flex-wrap">
                                  <span>📅 Inizio: {formatData(ob.dataInizio)}</span>
                                  {ob.dataRivalutazione && <span>🔄 Rivalutazione: {formatData(ob.dataRivalutazione)}</span>}
                                </div>
                              </div>
                              <div className="tw-flex tw-gap-2 tw-items-center tw-flex-wrap">
                                <span className="tw-text-[0.85rem] tw-font-bold tw-rounded-xl tw-px-2.5 tw-py-0.5" style={{ color: badge.color, background: badge.bg, border: `1px solid ${badge.color}` }}>{badge.label}</span>
                                <button type="button"
                                  onClick={() => { setRivalutandoId(isRivalutando ? null : ob._id); setStatoRivalutazione(ob.stato); setNoteRivalutazione(''); }}
                                  className={`tw-text-[0.82rem] tw-px-3 tw-py-1.5 tw-rounded-md tw-cursor-pointer tw-text-white ${isRivalutando ? 'tw-bg-slate-500 hover:tw-bg-slate-600' : 'tw-bg-amber-500 hover:tw-bg-amber-600'}`}>
                                  {isRivalutando ? '✕ Annulla' : '🔄 Rivaluta'}
                                </button>
                              </div>
                            </div>
                            {isRivalutando && (
                              <div className="tw-bg-white tw-border tw-border-slate-200 tw-rounded-md tw-p-3 tw-mt-2">
                                <h6 className="tw-m-0 tw-mb-2.5 tw-text-slate-700">🔄 Rivaluta obiettivo</h6>
                                <div className="tw-flex tw-gap-2.5 tw-flex-wrap tw-items-end">
                                  <label className="tw-flex-1 tw-min-w-[160px] tw-block">
                                    Nuovo stato *
                                    <select value={statoRivalutazione} onChange={e => setStatoRivalutazione(e.target.value)}
                                      className="tw-w-full tw-mt-1 tw-px-2.5 tw-py-1.5 tw-border tw-border-slate-300 tw-rounded-md">
                                      <option value="">— Seleziona —</option>
                                      {STATI_OBIETTIVO.map(s => (
                                        <option key={s} value={s}>{statoObiettivoBadge[s]?.label || s}</option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="tw-flex-[2] tw-min-w-[200px] tw-block">
                                    Note rivalutazione
                                    <input value={noteRivalutazione} onChange={e => setNoteRivalutazione(e.target.value)}
                                      placeholder="Osservazioni sulla rivalutazione..." className="tw-w-full tw-mt-1 tw-px-2 tw-py-1.5 tw-border tw-border-slate-300 tw-rounded-md" />
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
                              <details className="tw-mt-2">
                                <summary className="tw-cursor-pointer tw-text-[0.82rem] tw-text-slate-400">📋 Storico valutazioni ({ob.valutazioni.length})</summary>
                                <div className="tw-mt-2 tw-flex tw-flex-col tw-gap-1">
                                  {ob.valutazioni.map((v, i) => (
                                    <div key={i} className="tw-text-[0.82rem] tw-text-slate-600 tw-bg-slate-50 tw-px-2.5 tw-py-1.5 tw-rounded-md">
                                      <strong>{formatData(v.data)}</strong> — {statoObiettivoBadge[v.stato]?.label || v.stato}
                                      {v.note && ` — ${v.note}`}
                                      <span className="tw-text-slate-400 tw-ml-2">({v.valutatoDa})</span>
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
            <div className="tw-border tw-border-slate-200 tw-rounded-lg tw-overflow-hidden">
              <div className="tw-bg-slate-50 tw-px-4 tw-py-3.5 tw-flex tw-justify-between tw-items-center tw-flex-wrap tw-gap-2">
                <span className="tw-font-semibold tw-text-[0.95rem] tw-text-slate-700">📅 Storico accessi ({accessi.length})</span>
                <button type="button" onClick={() => setShowExport(!showExport)}
                  className="tw-bg-slate-100 tw-text-slate-700 tw-border tw-border-slate-200 tw-px-3.5 tw-py-1.5 tw-text-[0.85rem] tw-cursor-pointer tw-rounded-md hover:tw-bg-slate-200">
                  📄 Esporta / Visualizza PDF
                </button>
              </div>

              {showExport && (
                <div className="tw-p-4 tw-border-t tw-border-slate-200 tw-bg-slate-50/50">
                  <h5 className="tw-m-0 tw-mb-3 tw-text-slate-700">📄 Esporta registro accessi (rendicontazione)</h5>
                  <div className="tw-flex tw-gap-3 tw-flex-wrap tw-items-end tw-mb-2">
                    <label className="tw-flex-1 tw-min-w-[140px] tw-block">
                      Da data
                      <input type="date" value={exportDaData} onChange={e => setExportDaData(e.target.value)} className="tw-w-full tw-mt-1 tw-px-2 tw-py-1.5 tw-border tw-border-slate-300 tw-rounded-md" />
                    </label>
                    <label className="tw-flex-1 tw-min-w-[140px] tw-block">
                      A data
                      <input type="date" value={exportAData} onChange={e => setExportAData(e.target.value)} className="tw-w-full tw-mt-1 tw-px-2 tw-py-1.5 tw-border tw-border-slate-300 tw-rounded-md" />
                    </label>
                    <button type="button" onClick={caricaExport} disabled={loadingExport}
                      className="tw-bg-brand tw-text-white tw-px-4.5 tw-py-2.5 tw-rounded-md tw-cursor-pointer tw-font-semibold tw-whitespace-nowrap hover:tw-bg-brand-dark disabled:tw-opacity-50 disabled:tw-cursor-not-allowed">
                      {loadingExport ? '⏳' : '🔍 Carica'}
                    </button>
                    {exportData && (
                      <>
                        <button type="button" onClick={visualizzaPDF}
                          className="tw-bg-blue-500 tw-text-white tw-px-4.5 tw-py-2.5 tw-rounded-md tw-cursor-pointer tw-font-semibold tw-whitespace-nowrap hover:tw-bg-blue-600">
                          👁️ Visualizza PDF
                        </button>
                        <button type="button" onClick={stampaPDF}
                          className="tw-bg-emerald-600 tw-text-white tw-px-4.5 tw-py-2.5 tw-rounded-md tw-cursor-pointer tw-font-semibold tw-whitespace-nowrap hover:tw-bg-emerald-700">
                          🖨️ Stampa PDF
                        </button>
                      </>
                    )}
                  </div>
                  <p className="tw-m-0 tw-text-[0.82rem] tw-text-slate-400">Lascia vuoto per il mese corrente. Il PDF non include le tariffe.</p>

                  {exportData && (
                    <div ref={printRef} className="tw-mt-4 tw-bg-white tw-p-4 tw-border tw-border-slate-200 tw-rounded-md">
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
                              <td className="tw-align-top">
                                {acc.firmaOperatore
                                  ? <img src={acc.firmaOperatore} alt="Firma op" className="tw-max-w-[160px] tw-max-h-[55px] tw-border tw-border-slate-300 tw-rounded tw-block" />
                                  : <span className="tw-text-[0.75rem] tw-text-slate-400">Non raccolta</span>}
                              </td>
                              <td className="tw-align-top">
                                {acc.firmaPaziente
                                  ? <div>
                                      <img src={acc.firmaPaziente} alt="Firma paz" className="tw-max-w-[160px] tw-max-h-[55px] tw-border tw-border-slate-300 tw-rounded tw-block" />
                                      {acc.nomeFirmatarioPaziente && <span className="tw-text-[0.7rem] tw-text-slate-500">{acc.ruoloFirmatario === 'caregiver' ? 'Caregiver' : 'Paziente'}: {acc.nomeFirmatarioPaziente}</span>}
                                    </div>
                                  : <span className="tw-text-[0.75rem] tw-text-slate-400">Non raccolta</span>}
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

              <div className={accessi.length > 0 ? 'tw-p-0' : 'tw-p-4'}>
                {accessi.length === 0 ? (
                  <p className="tw-text-slate-500 tw-italic tw-m-0">Nessun accesso registrato.</p>
                ) : (
                  <div className="document-list tw-m-0">
                    <ul>
                      {accessi.map(acc => (
                        <li key={acc._id}>
                          <div className="tw-flex tw-justify-between tw-flex-wrap tw-gap-2">
                            <div className="tw-flex-1">
                              <div className="tw-font-semibold tw-mb-1">
                                📅 {formatData(acc.oraEntrata)} — {formatOra(acc.oraEntrata)}
                                {acc.oraUscita ? ` → ${formatOra(acc.oraUscita)}` : ' 🟢 In corso'}
                              </div>
                              <div className="tw-text-[0.85rem] tw-text-slate-600 tw-flex tw-gap-3 tw-flex-wrap tw-mb-1.5">
                                {acc.durataMinuti > 0 && <span>⏱️ {formatDurata(acc.durataMinuti)}</span>}
                                {acc.note && <span>📝 {acc.note}</span>}
                              </div>
                              <div className="tw-flex tw-gap-4 tw-flex-wrap tw-mt-1.5">
                                <div className="tw-text-[0.78rem]">
                                  <span className="tw-text-slate-500 tw-font-semibold">Firma operatore: </span>
                                  {acc.firmaOperatore
                                    ? <img src={acc.firmaOperatore} alt="Firma op" className="tw-max-w-[120px] tw-max-h-[40px] tw-align-middle tw-border tw-border-slate-300 tw-rounded tw-ml-1" />
                                    : <span className="tw-text-amber-500">⚠️ non raccolta</span>}
                                </div>
                                <div className="tw-text-[0.78rem]">
                                  <span className="tw-text-slate-500 tw-font-semibold">Firma paziente: </span>
                                  {acc.firmaPaziente
                                    ? <span>
                                        <img src={acc.firmaPaziente} alt="Firma paz" className="tw-max-w-[120px] tw-max-h-[40px] tw-align-middle tw-border tw-border-slate-300 tw-rounded tw-ml-1" />
                                        {acc.nomeFirmatarioPaziente && <span className="tw-text-slate-500 tw-ml-1">({acc.nomeFirmatarioPaziente})</span>}
                                      </span>
                                    : <span className="tw-text-slate-400">non raccolta</span>}
                                </div>
                              </div>
                            </div>
                            <div className="tw-text-[0.8rem] tw-text-slate-400 tw-text-right">
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
          <div className="tw-font-bold tw-text-[0.8rem] tw-text-brand tw-uppercase tw-tracking-wider tw-border-b-2 tw-border-brand tw-pb-1 tw-mb-2.5 tw-mt-1">{txt}</div>
        );
        const checkRow = (campo: 'fattoriPaziente'|'fattoriStaff'|'fattoriComunicazione'|'fattoriAmbiente', val: string) => (
          <label key={val} className="tw-flex tw-items-start tw-gap-2.5 tw-cursor-pointer tw-text-[0.86rem] tw-leading-snug tw-py-1">
            <input type="checkbox" checked={(eventoForm[campo] as string[]).includes(val)} onChange={() => toggleFattore(campo, val)}
              className="tw-w-4 tw-h-4 tw-flex-shrink-0 tw-mt-0.5 tw-cursor-pointer" style={{ accentColor: '#1e4d8c' }} />
            <span>{val}</span>
          </label>
        );
        const canSend = eventoForm.patientId && eventoForm.ruoloOperatore && eventoForm.dataEvento && eventoForm.luogoEvento && eventoForm.descrizioneEvento && firmaEventoOp;
        return (
          <div className="tw-fixed tw-inset-0 tw-bg-black/65 tw-z-50 tw-flex tw-items-start tw-justify-center tw-overflow-y-auto tw-p-3">
            <div className="tw-bg-white tw-rounded-2xl tw-w-full tw-max-w-[660px] tw-mt-4 tw-mb-6 tw-shadow-2xl" style={{ fontFamily: 'Arial, sans-serif' }}>

              {/* ── Intestazione scheda ── */}
              <div className="tw-bg-gradient-to-br tw-from-brand tw-to-brand-dark tw-text-white tw-rounded-t-2xl tw-px-5 tw-py-4 tw-flex tw-justify-between tw-items-center">
                <div>
                  <div className="tw-text-[0.72rem] tw-opacity-80 tw-tracking-widest tw-uppercase tw-mb-0.5">Abbraccio Cure Domiciliari</div>
                  <div className="tw-font-bold tw-text-[1.1rem] tw-flex tw-items-center tw-gap-2">
                    <AlertTriangle size={20} /> SCHEDA SEGNALAZIONE EVENTO AVVERSO
                  </div>
                </div>
                <button onClick={() => setShowEventoAvverso(false)} className="tw-bg-white/15 tw-border-0 tw-text-white tw-rounded-lg tw-p-1.5 tw-cursor-pointer tw-flex hover:tw-bg-white/25">
                  <X size={20} />
                </button>
              </div>

              {eventoSalvato ? (
                <div className="tw-px-6 tw-py-12 tw-text-center">
                  <div className="tw-text-[3.5rem] tw-mb-3.5">✅</div>
                  <div className="tw-font-bold tw-text-[1.15rem] tw-text-green-600 tw-mb-2">Segnalazione registrata con successo</div>
                  <div className="tw-text-slate-500 tw-text-[0.9rem] tw-mb-7">La scheda è stata inviata e sarà esaminata dalla Direzione di Area.</div>
                  <button onClick={() => setShowEventoAvverso(false)} className="tw-bg-brand tw-text-white tw-border-0 tw-rounded-lg tw-px-8 tw-py-3 tw-font-bold tw-cursor-pointer tw-text-base hover:tw-bg-brand-dark">Chiudi</button>
                </div>
              ) : (
                <div className="tw-p-5 tw-flex tw-flex-col tw-gap-5">

                  {/* ── SEZIONE 1: Chi segnala ── */}
                  {sezLabel('Operatore che segnala l\'evento')}
                  <div className="tw-flex tw-flex-col tw-gap-3">
                    <div>
                      <label className="tw-font-semibold tw-text-[0.83rem] tw-text-slate-700 tw-block tw-mb-1">Direzione di area</label>
                      <input type="text" value={eventoForm.direzioneDiArea} onChange={e => setEventoForm(p => ({ ...p, direzioneDiArea: e.target.value }))}
                        placeholder="es. Distretto Sud, Area Metropolitana..."
                        className="tw-w-full tw-px-2.5 tw-py-2 tw-rounded-lg tw-border tw-border-slate-300 tw-text-[0.88rem] tw-box-border" />
                    </div>
                    <div>
                      <label className="tw-font-bold tw-text-[0.83rem] tw-text-slate-700 tw-block tw-mb-2">Ruolo operatore *</label>
                      <div className="tw-flex tw-gap-2.5 tw-flex-wrap">
                        {[
                          { val: 'infermiere_oss', label: '👩‍⚕️ Infermiere / OSS' },
                          { val: 'medico', label: '🩺 Medico' },
                          { val: 'altro', label: '✏️ Altro' },
                        ].map(r => (
                          <label key={r.val} className={`tw-flex tw-items-center tw-gap-2 tw-cursor-pointer tw-text-[0.88rem] tw-px-3.5 tw-py-2 tw-rounded-lg tw-border-2 ${eventoForm.ruoloOperatore === r.val ? 'tw-border-brand tw-bg-blue-50 tw-font-bold' : 'tw-border-slate-200 tw-bg-white'}`}>
                            <input type="radio" name="ruoloOp" value={r.val} checked={eventoForm.ruoloOperatore === r.val} onChange={() => setEventoForm(p => ({ ...p, ruoloOperatore: r.val }))} style={{ accentColor: '#1e4d8c' }} />
                            {r.label}
                          </label>
                        ))}
                      </div>
                      {eventoForm.ruoloOperatore === 'altro' && (
                        <input type="text" value={eventoForm.ruoloOperatoreAltro} onChange={e => setEventoForm(p => ({ ...p, ruoloOperatoreAltro: e.target.value }))}
                          placeholder="Specificare ruolo..."
                          className="tw-w-full tw-mt-2 tw-px-2.5 tw-py-2 tw-rounded-lg tw-border tw-border-slate-300 tw-text-[0.88rem] tw-box-border" />
                      )}
                    </div>
                  </div>

                  {/* ── SEZIONE 2: Dati paziente (facoltativi) ── */}
                  {sezLabel('Dati relativi al paziente (facoltativi)')}
                  <div className="tw-flex tw-flex-col tw-gap-2.5">
                    <div>
                      <label className="tw-font-bold tw-text-[0.83rem] tw-text-slate-700 tw-block tw-mb-1">Paziente in carico *</label>
                      <select value={eventoForm.patientId} onChange={e => {
                        const paz = pazienti.find(p => p._id === e.target.value);
                        setEventoForm(p => ({ ...p, patientId: e.target.value, pazienteNomeCognome: paz ? `${paz.firstName} ${paz.lastName}` : '' }));
                      }} className={`tw-w-full tw-px-2.5 tw-py-2 tw-rounded-lg tw-text-[0.88rem] tw-bg-white ${eventoForm.patientId ? 'tw-border-slate-300' : 'tw-border-red-300'}`} style={{ borderWidth: '2px' }}>
                        <option value="">— Seleziona paziente —</option>
                        {pazienti.map(p => <option key={p._id} value={p._id}>{p.firstName} {p.lastName}</option>)}
                      </select>
                    </div>
                    <div className="tw-grid tw-grid-cols-2 md:tw-grid-cols-4 tw-gap-2.5">
                      <div className="tw-col-span-2">
                        <label className="tw-font-semibold tw-text-[0.8rem] tw-text-slate-500 tw-block tw-mb-0.5">CSTV di appartenenza</label>
                        <input type="text" value={eventoForm.pazienteCSTV} onChange={e => setEventoForm(p => ({ ...p, pazienteCSTV: e.target.value }))}
                          placeholder="es. ASL Roma 1" className="tw-w-full tw-px-2 tw-py-1.5 tw-rounded-lg tw-border tw-border-slate-300 tw-text-[0.85rem] tw-box-border" />
                      </div>
                      <div>
                        <label className="tw-font-semibold tw-text-[0.8rem] tw-text-slate-500 tw-block tw-mb-0.5">Età</label>
                        <input type="number" value={eventoForm.pazienteEta} onChange={e => setEventoForm(p => ({ ...p, pazienteEta: e.target.value }))}
                          min={0} max={130} placeholder="anni" className="tw-w-full tw-px-2 tw-py-1.5 tw-rounded-lg tw-border tw-border-slate-300 tw-text-[0.85rem] tw-box-border" />
                      </div>
                      <div>
                        <label className="tw-font-semibold tw-text-[0.8rem] tw-text-slate-500 tw-block tw-mb-0.5">Sesso</label>
                        <select value={eventoForm.pazienteSesso} onChange={e => setEventoForm(p => ({ ...p, pazienteSesso: e.target.value as any }))}
                          className="tw-w-full tw-px-2 tw-py-1.5 tw-rounded-lg tw-border tw-border-slate-300 tw-text-[0.85rem] tw-bg-white">
                          <option value="">—</option>
                          <option value="M">M</option>
                          <option value="F">F</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* ── SEZIONE 3: Descrizione evento ── */}
                  {sezLabel('Descrizione dell\'evento')}
                  <div className="tw-flex tw-flex-col tw-gap-2.5">
                    <div>
                      <label className="tw-font-semibold tw-text-[0.83rem] tw-text-slate-700 tw-block tw-mb-1">
                        Cos'è successo? Dove? Quando? Come e perché è successo? Chi si è accorto? *
                      </label>
                      <textarea value={eventoForm.descrizioneEvento} onChange={e => setEventoForm(p => ({ ...p, descrizioneEvento: e.target.value }))}
                        placeholder="Descrivi l'evento in modo sintetico ma esaustivo..."
                        rows={4} className={`tw-w-full tw-px-2.5 tw-py-2 tw-rounded-lg tw-text-[0.88rem] tw-resize-y tw-box-border ${eventoForm.descrizioneEvento ? 'tw-border-slate-300' : 'tw-border-red-300'}`} style={{ borderWidth: '1px' }} />
                      <button type="button" onClick={avviaDettaturaEvento} disabled={dettaturaEventoAttiva} className={`tw-mt-2 tw-px-3 tw-py-2 tw-rounded-lg tw-text-white tw-border-0 tw-font-bold tw-text-[0.82rem] tw-cursor-pointer ${dettaturaEventoAttiva ? 'tw-bg-slate-400 tw-cursor-not-allowed' : 'tw-bg-violet-600 hover:tw-bg-violet-700'}`}>
                        {dettaturaEventoAttiva ? '🎙️ Ascolto in corso...' : '🤖 AI - detta e trascrivi evento'}
                      </button>
                      <div className="tw-text-[0.75rem] tw-text-slate-500 tw-mt-1">Premi il pulsante, descrivi l'evento a voce e la trascrizione verrà inserita nella scheda.</div>
                    </div>
                    <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-4 tw-gap-2.5">
                      <div>
                        <label className="tw-font-semibold tw-text-[0.8rem] tw-text-slate-700 tw-block tw-mb-0.5">📅 Data *</label>
                        <input type="date" value={eventoForm.dataEvento} onChange={e => setEventoForm(p => ({ ...p, dataEvento: e.target.value }))}
                          className="tw-w-full tw-px-2 tw-py-1.5 tw-rounded-lg tw-border tw-border-slate-300 tw-text-[0.85rem] tw-box-border" />
                      </div>
                      <div>
                        <label className="tw-font-semibold tw-text-[0.8rem] tw-text-slate-700 tw-block tw-mb-0.5">⏰ Ora</label>
                        <input type="time" value={eventoForm.oraEvento} onChange={e => setEventoForm(p => ({ ...p, oraEvento: e.target.value }))}
                          className="tw-w-full tw-px-2 tw-py-1.5 tw-rounded-lg tw-border tw-border-slate-300 tw-text-[0.85rem] tw-box-border" />
                      </div>
                      <div className="tw-col-span-2">
                        <label className="tw-font-semibold tw-text-[0.8rem] tw-text-slate-700 tw-block tw-mb-0.5">📍 Luogo *</label>
                        <input type="text" value={eventoForm.luogoEvento} onChange={e => setEventoForm(p => ({ ...p, luogoEvento: e.target.value }))}
                          placeholder="es. Domicilio paziente" className={`tw-w-full tw-px-2 tw-py-1.5 tw-rounded-lg tw-text-[0.85rem] tw-box-border ${eventoForm.luogoEvento ? 'tw-border-slate-300' : 'tw-border-red-300'}`} style={{ borderWidth: '1px' }} />
                      </div>
                    </div>
                    <div>
                      <label className="tw-font-semibold tw-text-[0.83rem] tw-text-slate-700 tw-block tw-mb-1">Come si sono svolti i fatti</label>
                      <textarea value={eventoForm.svolgimentoFatti} onChange={e => setEventoForm(p => ({ ...p, svolgimentoFatti: e.target.value }))}
                        placeholder="Descrivi la sequenza degli eventi, il contesto, le azioni intraprese..."
                        rows={3} className="tw-w-full tw-px-2.5 tw-py-2 tw-rounded-lg tw-border tw-border-slate-300 tw-text-[0.88rem] tw-resize-y tw-box-border" />
                    </div>
                  </div>

                  {/* ── SEZIONE 4: Esito / Grado danno ── */}
                  {sezLabel('Esito dell\'evento')}
                  <div className="tw-flex tw-gap-2 tw-flex-wrap">
                    {GRADI_DANNO.map(g => (
                      <button key={g.value} type="button" onClick={() => setEventoForm(p => ({ ...p, dannoRiscontrato: g.value as any }))}
                        className="tw-px-3.5 tw-py-1.5 tw-rounded-lg tw-cursor-pointer tw-text-[0.82rem] tw-border-2" style={{ borderColor: eventoForm.dannoRiscontrato === g.value ? g.color : '#e5e7eb', background: eventoForm.dannoRiscontrato === g.value ? g.color + '18' : 'white', color: eventoForm.dannoRiscontrato === g.value ? g.color : '#374151', fontWeight: eventoForm.dannoRiscontrato === g.value ? 700 : 400 }}>
                        {g.label}
                      </button>
                    ))}
                  </div>

                  {/* ── SEZIONE 5: Fattori contribuenti ── */}
                  {sezLabel('Fattori che possono aver contribuito all\'evento (più risposte possibili)')}
                  <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
                    <div className="tw-bg-sky-50 tw-rounded-xl tw-p-3.5 tw-border tw-border-sky-200">
                      <div className="tw-font-bold tw-text-[0.78rem] tw-text-sky-700 tw-mb-2.5 tw-uppercase">👤 Fattori paziente</div>
                      {FATTORI_PAZIENTE.map(v => checkRow('fattoriPaziente', v))}
                    </div>
                    <div className="tw-bg-violet-50 tw-rounded-xl tw-p-3.5 tw-border tw-border-violet-200">
                      <div className="tw-font-bold tw-text-[0.78rem] tw-text-violet-700 tw-mb-2.5 tw-uppercase">👥 Fattori staff / organizzazione</div>
                      {FATTORI_STAFF.map(v => checkRow('fattoriStaff', v))}
                    </div>
                    <div className="tw-bg-orange-50 tw-rounded-xl tw-p-3.5 tw-border tw-border-orange-200">
                      <div className="tw-font-bold tw-text-[0.78rem] tw-text-orange-700 tw-mb-2.5 tw-uppercase">💬 Comunicazione / task</div>
                      {FATTORI_COMUNICAZIONE.map(v => checkRow('fattoriComunicazione', v))}
                    </div>
                    <div className="tw-bg-emerald-50 tw-rounded-xl tw-p-3.5 tw-border tw-border-emerald-200">
                      <div className="tw-font-bold tw-text-[0.78rem] tw-text-emerald-700 tw-mb-2.5 tw-uppercase">🏠 Ambiente / attrezzatura</div>
                      {FATTORI_AMBIENTE.map(v => checkRow('fattoriAmbiente', v))}
                    </div>
                  </div>

                  {/* ── SEZIONE 6: Suggerimenti ── */}
                  {sezLabel('Suggerimenti per prevenire / evitare il ripetersi dell\'evento')}
                  <textarea value={eventoForm.suggerimenti} onChange={e => setEventoForm(p => ({ ...p, suggerimenti: e.target.value }))}
                    placeholder="Inserisci eventuali proposte migliorative, raccomandazioni o azioni correttive suggerite..."
                    rows={3} className="tw-w-full tw-px-2.5 tw-py-2 tw-rounded-lg tw-border tw-border-slate-300 tw-text-[0.88rem] tw-resize-y tw-box-border" />

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
                    className={`tw-w-full tw-py-3.5 tw-rounded-xl tw-border-0 tw-font-bold tw-text-base tw-flex tw-items-center tw-justify-center tw-gap-2 ${canSend && !salvandoEvento ? 'tw-bg-red-600 tw-text-white tw-cursor-pointer hover:tw-bg-red-700' : 'tw-bg-slate-300 tw-text-slate-400 tw-cursor-not-allowed'}`}
                  >
                    <AlertTriangle size={18} />
                    {salvandoEvento ? 'Invio in corso...' : 'Invia segnalazione evento avverso'}
                  </button>
                  <p className="tw-text-center tw-text-[0.75rem] tw-text-slate-400 tw-m-0">
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
      {showRiformulazionePAI && pazienteSelezionato && <RiformulazionePAIModal patient={pazienteSelezionato} workPlan={pianoSelezionato} onClose={() => setShowRiformulazionePAI(false)} />}
      {showDatiCliniciADI && pazienteSelezionato && <DatiCliniciADIModal patient={pazienteSelezionato} onClose={() => setShowDatiCliniciADI(false)} onSaved={(pazienteAggiornato) => setPazienteSelezionato(prev => prev ? { ...prev, ...pazienteAggiornato } : prev)} />}
      {showFormazioneSanitaria && pazienteSelezionato && <FormazioneSanitariaModal patient={pazienteSelezionato} workPlan={pianoSelezionato} onClose={() => setShowFormazioneSanitaria(false)} />}

      {diarioDaFirmare && (
        <div className="tw-fixed tw-inset-0 tw-z-50 tw-bg-black/55 tw-flex tw-items-center tw-justify-center tw-p-3" onClick={() => { setDiarioDaFirmare(null); setFirmaDiarioGrafometrica(''); }}>
          <div className="tw-bg-white tw-rounded-2xl tw-p-5 tw-w-full tw-max-w-[600px]" onClick={e => e.stopPropagation()}>
            <h3 className="tw-m-0 tw-mb-2 tw-text-green-800">Firma voce del diario</h3>
            <p className="tw-text-[0.86rem] tw-text-slate-600">Firma con il dito o con la penna. Dopo la conferma la voce sarà bloccata e non potrà essere eliminata.</p>
            <FirmaCanvas label="Firma grafometrica dell’operatore" sublabel="Disegna la firma nel riquadro" onFirmaCompleta={setFirmaDiarioGrafometrica} onCancella={() => setFirmaDiarioGrafometrica('')} altezza={160} />
            <div className="tw-flex tw-gap-2.5 tw-mt-3">
              <button type="button" onClick={() => { setDiarioDaFirmare(null); setFirmaDiarioGrafometrica(''); }} className="tw-flex-1 tw-py-2.5 tw-rounded-lg tw-border tw-border-slate-300 tw-bg-slate-100 tw-cursor-pointer hover:tw-bg-slate-200">Annulla</button>
              <button type="button" disabled={!firmaDiarioGrafometrica} onClick={firmaDiario} className={`tw-flex-[2] tw-py-2.5 tw-rounded-lg tw-border-0 tw-text-white tw-font-bold tw-cursor-pointer ${firmaDiarioGrafometrica ? 'tw-bg-emerald-600 hover:tw-bg-emerald-700' : 'tw-bg-emerald-200 tw-cursor-not-allowed'}`}>Firma e blocca voce</button>
            </div>
          </div>
        </div>
      )}

      {showConsensoGDPR && (
        <div className="tw-fixed tw-inset-0 tw-z-50 tw-bg-black/55 tw-flex tw-items-center tw-justify-center tw-p-3" onClick={() => setShowConsensoGDPR(false)}>
          <div className="tw-bg-white tw-rounded-2xl tw-p-5 tw-w-full tw-max-w-[540px] tw-max-h-[92vh] tw-overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="tw-m-0 tw-mb-2 tw-text-red-800">Consenso GDPR</h3>
            <p className="tw-text-[0.85rem] tw-text-slate-600 tw-mb-3.5">Il paziente o il firmatario autorizza il trattamento dei dati per le prestazioni sanitarie e assistenziali.</p>
            <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-2.5 tw-mb-3.5">
              <input value={nomeFirmatarioGDPR} onChange={e => setNomeFirmatarioGDPR(e.target.value)} placeholder="Nome firmatario" className="tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-300" />
              <input value={cognomeFirmatarioGDPR} onChange={e => setCognomeFirmatarioGDPR(e.target.value)} placeholder="Cognome firmatario" className="tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-300" />
            </div>
            <input type="email" value={emailConsensoGDPR} onChange={e => setEmailConsensoGDPR(e.target.value)} placeholder="Email del paziente / firmatario (facoltativa)" className="tw-w-full tw-box-border tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-300 tw-mb-3.5" />
            <FirmaCanvas label="Firma del paziente / firmatario" sublabel="Firma per accettare l'informativa privacy" onFirmaCompleta={setFirmaGDPR} onCancella={() => setFirmaGDPR('')} altezza={160} />
            <div className="tw-flex tw-gap-2.5 tw-mt-4">
              <button type="button" onClick={() => setShowConsensoGDPR(false)} className="tw-flex-1 tw-py-2.5 tw-rounded-lg tw-border tw-border-slate-300 tw-bg-slate-100 tw-cursor-pointer hover:tw-bg-slate-200">Annulla</button>
              <button type="button" disabled={salvandoConsenso || !nomeFirmatarioGDPR.trim() || !cognomeFirmatarioGDPR.trim() || !firmaGDPR} onClick={salvaConsensoGDPR} className={`tw-flex-[2] tw-py-2.5 tw-rounded-lg tw-border-0 tw-text-white tw-font-bold tw-cursor-pointer hover:tw-bg-red-700 ${salvandoConsenso ? 'tw-opacity-70' : ''}`} style={{ background: '#dc2626' }}>{salvandoConsenso ? 'Salvataggio...' : 'Firma e archivia consenso'}</button>
            </div>
          </div>
        </div>
      )}

      {showConsensoPrestazione && (
        <div className="tw-fixed tw-inset-0 tw-z-50 tw-bg-black/55 tw-flex tw-items-center tw-justify-center tw-p-3" onClick={() => setShowConsensoPrestazione(false)}>
          <div className="tw-bg-white tw-rounded-2xl tw-p-5 tw-w-full tw-max-w-[620px] tw-max-h-[92vh] tw-overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="tw-m-0 tw-mb-2 tw-text-orange-800">Consenso alla prestazione sanitaria e rischi</h3>
            <p className="tw-text-[0.85rem] tw-text-slate-600 tw-leading-relaxed">Il firmatario dichiara di aver ricevuto informazioni sulle prestazioni assistenziali e sanitarie, sui rischi prevedibili e sulle limitazioni connesse alle condizioni cliniche.</p>
            <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-2.5 tw-my-3.5">
              <input value={nomeFirmatarioPrestazione} onChange={e => setNomeFirmatarioPrestazione(e.target.value)} placeholder="Nome firmatario" className="tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-300" />
              <input value={cognomeFirmatarioPrestazione} onChange={e => setCognomeFirmatarioPrestazione(e.target.value)} placeholder="Cognome firmatario" className="tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-300" />
            </div>
            <select value={ruoloFirmatarioPrestazione} onChange={e => setRuoloFirmatarioPrestazione(e.target.value as typeof ruoloFirmatarioPrestazione)} className="tw-w-full tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-300 tw-mb-3"><option value="paziente">Paziente</option><option value="caregiver">Caregiver</option><option value="tutore">Tutore</option><option value="rappresentanteLegale">Rappresentante legale</option></select>
            <label className="tw-flex tw-gap-2 tw-text-[0.85rem] tw-mb-2.5"><input type="checkbox" checked={accettaPrestazione} onChange={e => setAccettaPrestazione(e.target.checked)} /> Confermo di aver ricevuto informazioni sulla prestazione e di acconsentire alla sua esecuzione.</label>
            <label className="tw-flex tw-gap-2 tw-text-[0.85rem] tw-mb-3.5"><input type="checkbox" checked={accettaRischiPrestazione} onChange={e => setAccettaRischiPrestazione(e.target.checked)} /> Dichiaro di aver letto e compreso rischi e limitazioni del trattamento.</label>
            <input type="email" value={emailConsensoPrestazione} onChange={e => setEmailConsensoPrestazione(e.target.value)} placeholder="Email del paziente / firmatario (facoltativa)" className="tw-w-full tw-box-border tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-300 tw-mb-3.5" />
            <FirmaCanvas label="Firma del paziente / firmatario" sublabel="Firmare con il dito sullo schermo" onFirmaCompleta={setFirmaPrestazione} onCancella={() => setFirmaPrestazione('')} altezza={160} />
            <div className="tw-flex tw-gap-2.5 tw-mt-4">
              <button type="button" onClick={() => setShowConsensoPrestazione(false)} className="tw-flex-1 tw-py-2.5 tw-rounded-lg tw-border tw-border-slate-300 tw-bg-slate-100 tw-cursor-pointer hover:tw-bg-slate-200">Annulla</button>
              <button type="button" disabled={salvandoConsenso || !nomeFirmatarioPrestazione.trim() || !cognomeFirmatarioPrestazione.trim() || !firmaPrestazione || !accettaPrestazione || !accettaRischiPrestazione} onClick={salvaConsensoPrestazione} className={`tw-flex-[2] tw-py-2.5 tw-rounded-lg tw-border-0 tw-text-white tw-font-bold tw-cursor-pointer hover:tw-bg-orange-800 ${salvandoConsenso ? 'tw-opacity-70' : ''}`} style={{ background: '#c2410c' }}>{salvandoConsenso ? 'Salvataggio...' : 'Firma e archivia consenso'}</button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
