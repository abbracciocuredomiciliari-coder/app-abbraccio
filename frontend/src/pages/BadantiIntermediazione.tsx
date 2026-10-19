import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { Users, FileText, Mail, Trash2, Receipt, Check, X, User, Briefcase, Euro, Download, Settings } from 'lucide-react';
import { Button } from '../components/ui/Button';

interface Patient {
  _id: string;
  firstName: string;
  lastName: string;
  codiceFiscale?: string;
  email?: string;
  categoriaPrivata?: 'diagnostica' | 'prelievi' | 'assistenza_domiciliare' | 'trasporto' | 'visite_mediche' | 'riabilitazione' | 'intermediazione_badanti';
}

interface Preventivo {
  _id: string;
  numero: string;
  totale: number;
  totaleMensileStimato?: number;
  stato: 'emesso' | 'firmato' | 'annullato';
}

interface Fattura {
  _id: string;
  numero: string;
  totale: number;
  stato: 'emesso' | 'firmato' | 'annullato';
}

const LIVELLI_DESCRIZIONI: Record<string, string> = {
  A: 'Operatore base: assistenza minima e piccoli compiti domestici',
  AS: 'Operatore base super: base con qualifica/anzianità superiore',
  B: 'Badante/colf convivente: assistenza giornaliera in convivenza',
  BS: 'Badante convivente super: maggiore autonomia e qualifica',
  C: 'Badante non convivente: assistenza a non autosufficienti',
  CS: 'Badante non convivente super: profilo specializzato',
  D: 'Operatore specializzato: assistenza notturna, turni o profili complessi',
  DS: 'Operatore super specializzato: coordinamento o massima qualifica',
};

interface SimulazioneCosto {
  contrattoLabel: string;
  livelloLabel: string;
  oreSettimanali: number;
  oreMensili: number;
  pagaBaseCcnl: number;
  pagaUnitaria: 'mese' | 'ora';
  retribuzioneLordaMensile: number;
  indennitaMensili: number;
  contribInpsLavoratoreOrario: number;
  contribInpsLavoratoreMensili: number;
  cassaColfLavoratoreOrario: number;
  cassaColfLavoratoreMensili: number;
  retribuzioneNetta: number;
  contribInpsDatoreOrario: number;
  contribInpsDatoreMensili: number;
  cassaColfDatoreOrario: number;
  cassaColfDatoreMensili: number;
  tfr: number;
  tredicesima: number;
  nettoComplessivo: number;
  totaleCostoMensile: number;
  retribuzioneOrariaTotale: number;
  retribuzioneOrariaEffettiva: number;
  ferieMensiliOre: number;
  vittoAlloggioGiorno: number;
}

const TIPI_CONTRATTO_SIM = [
  { value: 'non_convivente', label: 'Non convivente', livelli: ['A', 'AS', 'B', 'BS', 'C', 'CS', 'D', 'DS'], orario: true },
  { value: 'convivente', label: 'Convivente full-time', livelli: ['A', 'AS', 'B', 'BS', 'C', 'CS', 'D', 'DS'], orario: false },
  { value: 'convivente_part_time', label: 'Convivente part-time (30 ore)', livelli: ['B', 'BS', 'C'], orario: false },
  { value: 'assistenza_notturna', label: 'Convivente – assistenza notturna', livelli: ['BS', 'CS', 'DS'], orario: false },
  { value: 'presenza_notturna', label: 'Convivente – presenza notturna', livelli: [], orario: false },
  { value: 'sostituzione', label: 'Sostituzione', livelli: ['CS', 'DS'], orario: true },
];

// ── Editor parametri CCNL/INPS: spec dei campi editabili ──
const LIVELLI_ALL = ['A', 'AS', 'B', 'BS', 'C', 'CS', 'D', 'DS'];
const getPath = (obj: any, path: string) => path.split('.').reduce((o: any, k: string) => o?.[k], obj);
function setPath(obj: any, path: string, v: any) {
  const keys = path.split('.');
  const clone: any = Array.isArray(obj) ? [...obj] : { ...obj };
  let cur = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    cur[keys[i]] = typeof cur[keys[i]] === 'object' && cur[keys[i]] !== null ? { ...cur[keys[i]] } : {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = v;
  return clone;
}
const livelli = (base: string, lista: string[] = LIVELLI_ALL) => lista.map(l => ({ path: `${base}.${l}`, label: l }));
const fasciaInps = (base: string, f: string, conLimite: boolean) => [
  { path: `${base}.${f}.totale`, label: `${f} totale` },
  { path: `${base}.${f}.quotaLavoratore`, label: `${f} lavorat.` },
  ...(conLimite ? [{ path: `${base}.${f}.limite`, label: `${f} limite €/h` }] : []),
];
const SEZIONI_TARIFFE: { titolo: string; campi: { path: string; label: string }[] }[] = [
  { titolo: 'Paga convivente full-time (€/mese) — Tab. A', campi: livelli('pagaConvivente') },
  { titolo: 'Convivente part-time 30h (€/mese) — Tab. B', campi: livelli('pagaPartTime', ['B', 'BS', 'C']) },
  { titolo: 'Non convivente (€/ora) — Tab. C', campi: livelli('pagaOraria') },
  { titolo: 'Assistenza notturna (€/mese) — Tab. D', campi: livelli('pagaNotturna', ['BS', 'CS', 'DS']) },
  { titolo: 'Presenza notturna (€/mese) — Tab. E', campi: [{ path: 'pagaPresenzaNotturna', label: 'Livello unico' }] },
  { titolo: 'Sostituzione riposo (€/ora) — Tab. G', campi: livelli('pagaSostituzione', ['CS', 'DS']) },
  {
    titolo: 'Indennità',
    campi: [
      { path: 'indennitaPiuAutosuffMensile', label: 'Più non autosuff. €/mese' },
      { path: 'indennitaPiuAutosuffOraria', label: 'Più non autosuff. €/h' },
      { path: 'indennitaUni11766Mensile', label: 'UNI 11766 €/mese' },
      { path: 'indennitaBabysitterMensile', label: 'Babysitter conv. €/mese' },
      { path: 'indennitaBabysitterPartTime', label: 'Babysitter PT €/mese' },
      { path: 'indennitaBabysitterOraria', label: 'Babysitter €/h' },
    ],
  },
  {
    titolo: 'Parametri generali',
    campi: [
      { path: 'vittoAlloggioGiorno', label: 'Vitto+alloggio €/g' },
      { path: 'giorniVittoMese', label: 'Gg vitto/mese' },
      { path: 'settimaneMesi', label: 'Settimane→mese' },
      { path: 'oreConviventeFull', label: 'Ore conv. full' },
      { path: 'orePartTime', label: 'Ore part-time' },
      { path: 'ferieGiorniAnno', label: 'Ferie gg/anno' },
      { path: 'cafMensileDefault', label: 'CAF sanitario €/mese' },
    ],
  },
  {
    titolo: 'Cassa.Colf (€/ora)',
    campi: [
      { path: 'cassaColfDatoreOrario', label: 'Datore €/h' },
      { path: 'cassaColfLavoratoreOrario', label: 'Lavoratore €/h' },
    ],
  },
  {
    titolo: 'INPS indeterminato (contributi €/ora per fascia)',
    campi: [...fasciaInps('inpsIndeterminato', 'fascia1', true), ...fasciaInps('inpsIndeterminato', 'fascia2', true), ...fasciaInps('inpsIndeterminato', 'fascia3', false), ...fasciaInps('inpsIndeterminato', 'sopra24h', false)],
  },
  {
    titolo: 'INPS determinato (+1,40%)',
    campi: [...fasciaInps('inpsDeterminato', 'fascia1', true), ...fasciaInps('inpsDeterminato', 'fascia2', true), ...fasciaInps('inpsDeterminato', 'fascia3', false), ...fasciaInps('inpsDeterminato', 'sopra24h', false)],
  },
];

interface ContrattoCollegato {
  _id: string;
  stato: 'emesso' | 'firmato';
  email?: string;
  nome?: string;
  dataFirma?: string;
  allegatoFileName?: string;
  token?: string;
}

interface ConsensoGdprRow {
  _id: string;
  nomeFirmatario?: string;
  cognomeFirmatario?: string;
  codiceFiscaleFirmatario?: string;
  dataFirma?: string;
  luogoFirma?: string;
  versioneInformativa?: string;
  revocato?: boolean;
  dataRevoca?: string;
  ipAddress?: string;
  patient?: { firstName: string; lastName: string } | null;
}

interface Badante {
  _id: string;
  patient: Patient | null; // null se il paziente è stato eliminato (populate orfano)
  contrattoTipo: 'orario_non_convivente' | 'convivente';
  livello: string;
  oreSettimanali?: number;
  mesiContratto?: number;
  costoMensile?: number;
  gestioneAmministrativa?: number;
  note?: string;
  stato: string;
  preventivoId?: Preventivo | string;
  contrattoId?: ContrattoCollegato | string;
  simulazione?: { totaleCostoMensile?: number } | null;
  preventivoPdfFileName?: string;
  fatturaId?: Fattura | string;
  fattureGestione?: Fattura[] | string[];
  createdAt: string;
}

export default function BadantiIntermediazione() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientIdDaUrl = searchParams.get('patientId') || '';
  const [richieste, setRichieste] = useState<Badante[]>([]);
  const [pazienti, setPazienti] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [meseGestione, setMeseGestione] = useState('');

  // Modale riga "Simula costo" → contratto da inviare per firma (richieste pre-esistenti)
  const [prevEmail, setPrevEmail] = useState('');
  const [prevImporto, setPrevImporto] = useState('610');
  const [prevCaf, setPrevCaf] = useState('150');
  const [prevInvia, setPrevInvia] = useState(true);
  const [prevLoading, setPrevLoading] = useState(false);

  // ── Simulazione costo badante (calcolatore CCNL/INPS 2026, stile doemploy) ──
  const [showSim, setShowSim] = useState(!!patientIdDaUrl);

  // Contratto d'incarico dal simulatore associato a un paziente
  const [simPatient, setSimPatient] = useState(patientIdDaUrl);
  const [simContractEmail, setSimContractEmail] = useState('');
  const [simContractImporto, setSimContractImporto] = useState('610');
  const [simContractInvia, setSimContractInvia] = useState(true);
  const [simContractLoading, setSimContractLoading] = useState(false);
  const [simContractMsg, setSimContractMsg] = useState('');
  const [simContratto, setSimContratto] = useState('convivente');
  const [simLivello, setSimLivello] = useState('BS');
  const [simOre, setSimOre] = useState('30');
  const [simDeterminato, setSimDeterminato] = useState(false);
  const [simPiuAutosuff, setSimPiuAutosuff] = useState(false);
  const [simCertUni, setSimCertUni] = useState(false);
  const [simBabysitter, setSimBabysitter] = useState(false);
  const [simPagaCustom, setSimPagaCustom] = useState('');
  const [simIntestatario, setSimIntestatario] = useState('');
  const [simCaf, setSimCaf] = useState('150');
  const [simPdfLoading, setSimPdfLoading] = useState(false);
  const [simRisultato, setSimRisultato] = useState<SimulazioneCosto | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simErr, setSimErr] = useState('');

  // Parametri CCNL/INPS (editor annuale tariffe)
  const [showTariffe, setShowTariffe] = useState(false);
  const [tariffe, setTariffe] = useState<any>(null);
  const [tariffeMeta, setTariffeMeta] = useState<{ personalizzato: boolean; aggiornatoIl?: string | null; aggiornatoDa?: string | null }>({ personalizzato: false });
  const [tariffeSaving, setTariffeSaving] = useState(false);

  const simTipoCorrente = TIPI_CONTRATTO_SIM.find(t => t.value === simContratto) || TIPI_CONTRATTO_SIM[1];
  const simIsOrario = simTipoCorrente.orario;

  const [selectedQuote, setSelectedQuote] = useState<string | null>(null);

  const isGestione = user?.role === 'admin' || user?.role === 'coordinator' || user?.role === 'direttore';
  const isAdmin = user?.role === 'admin';
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => { caricaDati(); caricaPazienti(); caricaTariffe(); }, []);

  async function caricaPazienti() {
    try {
      const res = await api.get('/patients?tipo=consulenza');
      const elenco = res.data?.patients || res.data || [];
      setPazienti(elenco as Patient[]);
    } catch (err: any) {
      console.error('Errore caricamento pazienti', err);
    }
  }

  async function caricaTariffe() {
    try {
      const res = await api.get('/badanti-intermediazione/tariffe-ccnl');
      setTariffe(res.data?.parametri || null);
      setTariffeMeta({ personalizzato: !!res.data?.personalizzato, aggiornatoIl: res.data?.aggiornatoIl, aggiornatoDa: res.data?.aggiornatoDa });
      if (res.data?.parametri?.cafMensileDefault != null) {
        setSimCaf(String(res.data.parametri.cafMensileDefault));
        setPrevCaf(String(res.data.parametri.cafMensileDefault));
      }
    } catch { /* tariffe opzionali: restano i default */ }
  }

  async function salvaTariffe() {
    if (!tariffe) return;
    try {
      setTariffeSaving(true);
      if (!confirm('Confermi l\'aggiornamento delle tariffe CCNL/INPS? I nuovi valori si applicheranno subito a simulatore, PDF e preventivi da firmare.')) return;
      const res = await api.put('/badanti-intermediazione/tariffe-ccnl', { parametri: tariffe });
      setTariffe(res.data?.parametri || tariffe);
      setTariffeMeta(m => ({ ...m, personalizzato: true, aggiornatoIl: new Date().toISOString() }));
      alert('Tariffe CCNL salvate: il simulatore e i preventivi PDF useranno i nuovi valori.');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore salvataggio tariffe');
    } finally {
      setTariffeSaving(false);
    }
  }

  async function resetTariffe() {
    if (!confirm('Ripristinare tutti i minimi ufficiali CCNL/INPS presenti nel sistema?')) return;
    try {
      setTariffeSaving(true);
      const res = await api.post('/badanti-intermediazione/tariffe-ccnl/reset');
      setTariffe(res.data?.parametri || null);
      setTariffeMeta({ personalizzato: false });
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore reset tariffe');
    } finally {
      setTariffeSaving(false);
    }
  }

  // All'apertura del modale preventivo: inizializza il simulatore dai dati della richiesta
  useEffect(() => {
    const r = richieste.find(x => x._id === selectedQuote);
    if (r) {
      setSimContratto(r.contrattoTipo === 'orario_non_convivente' ? 'non_convivente' : 'convivente');
      setSimLivello(r.livello || 'BS');
      setSimOre(r.oreSettimanali ? String(r.oreSettimanali) : '30');
      setSimRisultato(null);
      setSimErr('');
      setPrevEmail(r.patient?.email || '');
      setPrevImporto('610');
      setPrevCaf('150');
      setPrevInvia(!!r.patient?.email);
    }
  }, [selectedQuote]);

  async function caricaDati() {
    try {
      setLoading(true);
      const res = await api.get('/badanti-intermediazione');
      setRichieste(res.data || []);
    } catch (err: any) {
      console.error('Errore caricamento badanti', err);
      alert(err?.response?.data?.message || 'Errore caricamento');
    } finally {
      setLoading(false);
    }
  }

  async function calcolaSimulazione() {
    try {
      setSimLoading(true);
      setSimErr('');
      const res = await api.post('/badanti-intermediazione/simula-costo', {
        contrattoTipo: simContratto,
        livello: simLivello,
        oreSettimanali: simIsOrario ? Number(simOre) : undefined,
        tempoDeterminato: simDeterminato,
        indennitaPiuAutosuff: simPiuAutosuff,
        certificazioneUni: simCertUni,
        indennitaBabysitter: simBabysitter,
        pagaPersonalizzata: simPagaCustom ? Number(simPagaCustom) : undefined,
      });
      setSimRisultato(res.data);
    } catch (err: any) {
      setSimErr(err?.response?.data?.message || 'Errore nel calcolo');
      setSimRisultato(null);
    } finally {
      setSimLoading(false);
    }
  }

  async function scaricaPdfPreventivo() {
    try {
      setSimPdfLoading(true);
      const res = await api.post('/badanti-intermediazione/simula-costo/pdf', {
        contrattoTipo: simContratto,
        livello: simLivello,
        oreSettimanali: simIsOrario ? Number(simOre) : undefined,
        tempoDeterminato: simDeterminato,
        indennitaPiuAutosuff: simPiuAutosuff,
        certificazioneUni: simCertUni,
        indennitaBabysitter: simBabysitter,
        pagaPersonalizzata: simPagaCustom ? Number(simPagaCustom) : undefined,
        intestatario: simIntestatario || undefined,
        cafMensile: Number(simCaf) >= 0 ? Number(simCaf) : undefined,
      }, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `preventivo-assistente-familiare${simIntestatario ? '-' + simIntestatario.replace(/\s+/g, '-').toLowerCase() : ''}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nella generazione del PDF');
    } finally {
      setSimPdfLoading(false);
    }
  }

  // Dal simulatore: associa il costo a un paziente e genera contratto + GDPR per la firma
  async function generaContrattoDaSim() {
    if (!simPatient) return alert('Seleziona un paziente');
    try {
      setSimContractLoading(true);
      setSimContractMsg('');
      const res = await api.post('/badanti-intermediazione/simula-costo/contratto', {
        patient: simPatient,
        contrattoTipo: simContratto,
        livello: simLivello,
        oreSettimanali: simIsOrario ? Number(simOre) : undefined,
        tempoDeterminato: simDeterminato,
        indennitaPiuAutosuff: simPiuAutosuff,
        certificazioneUni: simCertUni,
        indennitaBabysitter: simBabysitter,
        pagaPersonalizzata: simPagaCustom ? Number(simPagaCustom) : undefined,
        cafMensile: Number(simCaf) >= 0 ? Number(simCaf) : undefined,
        importo: Number(simContractImporto) > 0 ? Number(simContractImporto) : 610,
        email: simContractEmail || undefined,
        inviaEmail: simContractInvia,
      });
      setSimContractMsg(res.data?.emailInviata
        ? 'Contratto creato e inviato al paziente per la firma (contratto + GDPR + PDF costo).'
        : 'Contratto creato: trovi la riga qui sotto per inviarlo per la firma.');
      await caricaDati();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore generazione contratto');
    } finally {
      setSimContractLoading(false);
    }
  }

  // Genera il contratto dal simulatore → PDF costo → contratto (con GDPR) per la firma
  async function generaPreventivoContratto(id: string) {
    try {
      setPrevLoading(true);
      const res = await api.post(`/badanti-intermediazione/${id}/preventivo`, {
        contrattoTipo: simContratto,
        livello: simLivello,
        oreSettimanali: simIsOrario ? Number(simOre) : undefined,
        tempoDeterminato: simDeterminato,
        indennitaPiuAutosuff: simPiuAutosuff,
        certificazioneUni: simCertUni,
        indennitaBabysitter: simBabysitter,
        pagaPersonalizzata: simPagaCustom ? Number(simPagaCustom) : undefined,
        cafMensile: Number(prevCaf) >= 0 ? Number(prevCaf) : 150,
        importo: Number(prevImporto) > 0 ? Number(prevImporto) : 610,
        email: prevEmail || undefined,
        inviaEmail: prevInvia,
      });
      setSelectedQuote(null);
      await caricaDati();
      alert(res.data?.emailInviata
        ? 'Contratto generato e inviato al paziente per la firma (contratto + GDPR + PDF costo).'
        : 'Contratto generato. Puoi inviarlo per la firma dalla riga della richiesta.');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore generazione preventivo');
    } finally {
      setPrevLoading(false);
    }
  }

  // Scarica il PDF preventivo allegato al contratto
  async function scaricaPreventivoContratto(contratto: ContrattoCollegato) {
    try {
      const res = await api.get(`/contratti-pazienti/${contratto._id}/allegato`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = contratto.allegatoFileName || 'preventivo.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore download preventivo');
    }
  }

  // Invia (o reinvia) contratto + GDPR + preventivo al paziente per la firma
  async function inviaFirmaContratto(contratto: ContrattoCollegato) {
    const email = window.prompt('Email del destinatario', contratto.email || '');
    if (!email) return;
    try {
      await api.post(`/contratti-pazienti/${contratto._id}/invia-email`, { email });
      alert('Email inviata');
      await caricaDati();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore invio');
    }
  }

  async function scaricaPDF(doc: { _id: string; numero: string; stato?: string }) {
    try {
      const firmato = doc.stato === 'firmato';
      const endpoint = firmato ? `/fatturazione-documenti/${doc._id}/firmato` : `/fatturazione-documenti/${doc._id}/pdf`;
      const res = await api.get(endpoint, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.numero}${firmato ? '-firmato' : ''}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore download PDF');
    }
  }

  async function convertiInFattura(id: string) {
    if (!confirm('Confermi la generazione della fattura?')) return;
    try {
      setSaving(true);
      await api.post(`/badanti-intermediazione/${id}/fattura`);
      await caricaDati();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore fattura');
    } finally {
      setSaving(false);
    }
  }

  async function generaFatturaGestione(id: string) {
    if (!meseGestione) return alert('Seleziona il mese di riferimento');
    if (!confirm(`Confermi la generazione della fattura gestione per ${meseGestione}?`)) return;
    try {
      setSaving(true);
      await api.post(`/badanti-intermediazione/${id}/fattura-gestione`, { meseRiferimento: meseGestione });
      setMeseGestione('');
      await caricaDati();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore fattura gestione');
    } finally {
      setSaving(false);
    }
  }

  async function eliminaRichiesta(id: string) {
    if (!confirm('Eliminare la richiesta?')) return;
    try {
      await api.delete(`/badanti-intermediazione/${id}`);
      await caricaDati();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore eliminazione');
    }
  }

  async function inviaFattura(fattura: Fattura) {
    const email = window.prompt('Email del destinatario');
    if (!email) return;
    try {
      await api.post(`/fatturazione-documenti/${fattura._id}/invia-email`, { email });
      alert('Email inviata');
      await caricaDati();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore invio');
    }
  }

  const richiestaAperta = richieste.find(r => r._id === selectedQuote);
  // Contratti intermediazione firmati: badge di segnalazione sul menu ⚙
  const firmatiCount = richieste.filter((r: any) => r.contrattoId && typeof r.contrattoId === 'object' && r.contrattoId.stato === 'firmato').length;

  const statoBadge = (stato: string) => {
    const map: Record<string, string> = {
      aperta: 'tw-bg-slate-100 tw-text-slate-700',
      preventivo_emesso: 'tw-bg-blue-100 tw-text-blue-700',
      accettata: 'tw-bg-green-100 tw-text-green-700',
      fatturata: 'tw-bg-emerald-100 tw-text-emerald-700',
      annullata: 'tw-bg-red-100 tw-text-red-700',
    };
    return `tw-inline-flex tw-px-2 tw-py-1 tw-rounded tw-text-xs tw-font-semibold ${map[stato] || 'tw-bg-slate-100 tw-text-slate-700'}`;
  };

  if (loading) return (
    <section className="tw-min-h-screen tw-flex tw-items-center tw-justify-center tw-bg-slate-50">
      <div className="tw-bg-white tw-rounded-2xl tw-shadow-sm tw-border tw-border-slate-100 tw-p-10 tw-text-slate-500 tw-font-medium">⏳ Caricamento...</div>
    </section>
  );

  return (
    <section className="fade-in tw-bg-slate-50 tw-min-h-screen tw-p-4 md:tw-p-6">
      <div className="tw-max-w-7xl tw-mx-auto tw-space-y-6">

        <div className="tw-flex tw-justify-between tw-items-center tw-flex-wrap tw-gap-4 tw-bg-white tw-rounded-2xl tw-shadow-sm tw-border tw-border-slate-100 tw-p-5 md:tw-p-6">
          <div className="tw-flex tw-items-center tw-gap-4">
            <div className="tw-p-3 tw-rounded-xl tw-text-white tw-shadow-sm tw-bg-rose-600">
              <Users size={24} />
            </div>
            <div>
              <h1 className="tw-text-2xl tw-font-bold tw-text-slate-800">Intermediazioni</h1>
              <p className="tw-text-slate-500 tw-text-sm tw-m-0">Gestione richieste, preventivi e fatture — solo pazienti privati</p>
            </div>
          </div>
          <div className="tw-flex tw-items-center tw-gap-2 tw-flex-wrap">
            <Button variant="secondary" onClick={() => setShowSim(s => !s)} className="tw-flex tw-items-center tw-gap-2">
              <Euro size={18} /> {showSim ? 'Chiudi calcolo' : 'Simula costo'}
            </Button>
            {isGestione && (
              <div className="tw-relative">
                <button
                  onClick={() => setShowMenu(s => !s)}
                  title="Impostazioni"
                  className="tw-relative tw-p-2 tw-rounded-lg tw-border tw-border-slate-200 tw-text-slate-500 hover:tw-text-slate-800 hover:tw-bg-slate-50"
                >
                  <Settings size={18} />
                  {firmatiCount > 0 && (
                    <span className="tw-absolute -tw-top-1.5 -tw-right-1.5 tw-min-w-[18px] tw-h-[18px] tw-px-1 tw-rounded-full tw-bg-red-600 tw-text-white tw-text-[10px] tw-font-bold tw-flex tw-items-center tw-justify-center">
                      {firmatiCount}
                    </span>
                  )}
                </button>
                {showMenu && (
                  <>
                    <div className="tw-fixed tw-inset-0 tw-z-10" onClick={() => setShowMenu(false)} />
                    <div className="tw-absolute tw-right-0 tw-mt-2 tw-w-64 tw-bg-white tw-rounded-xl tw-border tw-border-slate-200 tw-shadow-lg tw-z-20 tw-p-1">
                      <button
                        onClick={() => { setShowMenu(false); navigate('/archivi-intermediazione'); }}
                        className="tw-w-full tw-text-left tw-px-3 tw-py-2 tw-rounded-lg hover:tw-bg-slate-50 tw-text-sm tw-flex tw-items-center tw-gap-2"
                      >
                        <FileText size={16} className="tw-text-rose-600" /> Archivi intermediazione
                        {firmatiCount > 0 && (
                          <span className="tw-ml-auto tw-text-[10px] tw-font-bold tw-text-white tw-bg-green-600 tw-rounded-full tw-px-1.5 tw-py-0.5">
                            {firmatiCount} firmati
                          </span>
                        )}
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => { setShowMenu(false); setShowTariffe(true); }}
                          className="tw-w-full tw-text-left tw-px-3 tw-py-2 tw-rounded-lg hover:tw-bg-slate-50 tw-text-sm tw-flex tw-items-center tw-gap-2"
                        >
                          <Euro size={16} className="tw-text-amber-600" /> Tariffe CCNL / INPS
                          <span className="tw-ml-auto tw-text-[10px] tw-font-bold tw-text-slate-400">
                            {tariffeMeta.personalizzato ? 'personalizzate' : 'ufficiali'}
                          </span>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {showSim && (
          <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-slate-100 tw-shadow-sm tw-p-5 md:tw-p-6">
            <h2 className="tw-text-lg tw-font-semibold tw-mb-1 tw-text-slate-700 tw-flex tw-items-center tw-gap-2">
              <Euro size={20} /> Simula costo badante — CCNL 2026
            </h2>
            <p className="tw-text-xs tw-text-slate-500 tw-mb-4">Stima completa: retribuzione lorda, contributi INPS, Cassa.Colf, TFR e tredicesima.</p>
            <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-gap-4 tw-mb-4">
              <label className="tw-flex tw-flex-col tw-gap-1">
                <span className="tw-text-sm tw-font-medium">Tipo di contratto</span>
                <select
                  value={simContratto}
                  onChange={e => {
                    const t = TIPI_CONTRATTO_SIM.find(x => x.value === e.target.value) || TIPI_CONTRATTO_SIM[0];
                    setSimContratto(t.value);
                    if (t.livelli.length > 0 && !t.livelli.includes(simLivello)) setSimLivello(t.livelli[0]);
                    setSimRisultato(null);
                  }}
                  className="tw-border tw-rounded tw-p-2"
                >
                  {TIPI_CONTRATTO_SIM.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label className="tw-flex tw-flex-col tw-gap-1">
                <span className="tw-text-sm tw-font-medium">Durata del contratto</span>
                <div className="tw-flex tw-gap-2">
                  <button type="button" onClick={() => { setSimDeterminato(false); setSimRisultato(null); }} className={`tw-flex-1 tw-border tw-rounded tw-p-2 tw-text-sm tw-font-semibold ${!simDeterminato ? 'tw-bg-emerald-50 tw-border-emerald-400 tw-text-emerald-800' : 'tw-bg-white tw-text-slate-500'}`}>Indeterminato</button>
                  <button type="button" onClick={() => { setSimDeterminato(true); setSimRisultato(null); }} className={`tw-flex-1 tw-border tw-rounded tw-p-2 tw-text-sm tw-font-semibold ${simDeterminato ? 'tw-bg-emerald-50 tw-border-emerald-400 tw-text-emerald-800' : 'tw-bg-white tw-text-slate-500'}`}>Determinato</button>
                </div>
              </label>
              {simTipoCorrente.livelli.length > 0 ? (
                <label className="tw-flex tw-flex-col tw-gap-1">
                  <span className="tw-text-sm tw-font-medium">Livello CCNL</span>
                  <select value={simLivello} onChange={e => { setSimLivello(e.target.value); setSimRisultato(null); }} className="tw-border tw-rounded tw-p-2">
                    {simTipoCorrente.livelli.map(l => (
                      <option key={l} value={l}>{l} — {LIVELLI_DESCRIZIONI[l]}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="tw-flex tw-items-end tw-text-sm tw-text-slate-500 tw-pb-2">Livello unico (presenza notturna)</div>
              )}
              {(simLivello === 'CS' || simLivello === 'DS' || simLivello === 'B' || simLivello === 'BS') && simContratto !== 'sostituzione' && simContratto !== 'presenza_notturna' && (
                <div className="tw-flex tw-flex-col tw-gap-2 md:tw-col-span-2">
                  <span className="tw-text-xs tw-font-bold tw-text-slate-500 tw-uppercase">Indennità applicabili</span>
                  {(simLivello === 'CS' || simLivello === 'DS') && (
                    <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-cursor-pointer tw-bg-slate-50 tw-border tw-rounded tw-p-2.5">
                      <input type="checkbox" checked={simPiuAutosuff} onChange={e => { setSimPiuAutosuff(e.target.checked); setSimRisultato(null); }} className="tw-w-4 tw-h-4 tw-accent-[#1e4d8c]" />
                      <span>Addetto a più persone non autosufficienti</span>
                    </label>
                  )}
                  {simLivello === 'BS' && (
                    <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-cursor-pointer tw-bg-slate-50 tw-border tw-rounded tw-p-2.5">
                      <input type="checkbox" checked={simBabysitter} onChange={e => { setSimBabysitter(e.target.checked); setSimRisultato(null); }} className="tw-w-4 tw-h-4 tw-accent-[#1e4d8c]" />
                      <span>Babysitter fino al 6° anno di età del bambino</span>
                    </label>
                  )}
                  {(simLivello === 'B' || simLivello === 'BS' || simLivello === 'CS') && (
                    <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-cursor-pointer tw-bg-slate-50 tw-border tw-rounded tw-p-2.5">
                      <input type="checkbox" checked={simCertUni} onChange={e => { setSimCertUni(e.target.checked); setSimRisultato(null); }} className="tw-w-4 tw-h-4 tw-accent-[#1e4d8c]" />
                      <span>Lavoratore certificato UNI 11766</span>
                    </label>
                  )}
                </div>
              )}
              {simIsOrario && (
                <label className="tw-flex tw-flex-col tw-gap-1">
                  <span className="tw-text-sm tw-font-medium">Ore a settimana</span>
                  <input type="number" min="1" max="40" value={simOre} onChange={e => { setSimOre(e.target.value); setSimRisultato(null); }} className="tw-border tw-rounded tw-p-2" />
                  <span className="tw-text-xs tw-text-slate-400">Massimo 40 ore</span>
                </label>
              )}
              <label className="tw-flex tw-flex-col tw-gap-1">
                <span className="tw-text-sm tw-font-medium">
                  {simIsOrario ? 'Paga oraria (€/h)' : 'Paga mensile (€/mese)'}
                </span>
                <input type="number" step="0.01" min="0" value={simPagaCustom} onChange={e => { setSimPagaCustom(e.target.value); setSimRisultato(null); }} className="tw-border tw-rounded tw-p-2" placeholder="Minimo CCNL" />
                <span className="tw-text-xs tw-text-slate-400">Vuoto = minimo contrattuale CCNL 2026</span>
              </label>
              <label className="tw-flex tw-flex-col tw-gap-1">
                <span className="tw-text-sm tw-font-medium">Quota CAF sanitario (€/mese)</span>
                <input type="number" step="0.01" min="0" value={simCaf} onChange={e => setSimCaf(e.target.value)} className="tw-border tw-rounded tw-p-2" />
                <span className="tw-text-xs tw-text-slate-400">Voce stampata sul PDF preventivo</span>
              </label>
              <label className="tw-flex tw-flex-col tw-gap-1">
                <span className="tw-text-sm tw-font-medium">Intestatario preventivo (opzionale)</span>
                <input type="text" value={simIntestatario} onChange={e => setSimIntestatario(e.target.value)} className="tw-border tw-rounded tw-p-2" placeholder="Es. Famiglia Rossi" />
              </label>
            </div>
            {isGestione && (
              <div className="tw-mb-4 tw-p-3 tw-rounded-xl tw-bg-slate-50 tw-border tw-border-slate-100">
                <h3 className="tw-text-xs tw-font-bold tw-text-slate-500 tw-uppercase tw-mb-2">Contratto d'incarico per firma paziente</h3>
                <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-4 tw-gap-3">
                  <label className="tw-flex tw-flex-col tw-gap-1">
                    <span className="tw-text-sm tw-font-medium">Paziente</span>
                    <select
                      value={simPatient}
                      onChange={e => {
                        setSimPatient(e.target.value);
                        setSimContractMsg('');
                        const p = pazienti.find(x => x._id === e.target.value);
                        if (p?.email) setSimContractEmail(p.email);
                      }}
                      className="tw-border tw-rounded tw-p-2"
                    >
                      <option value="">Seleziona paziente...</option>
                      {pazienti.filter(Boolean).map(p => (
                        <option key={p._id} value={p._id}>{p.firstName} {p.lastName}{p.codiceFiscale ? ` (${p.codiceFiscale})` : ''}</option>
                      ))}
                    </select>
                  </label>
                  <label className="tw-flex tw-flex-col tw-gap-1">
                    <span className="tw-text-sm tw-font-medium">Email per firma</span>
                    <input type="email" value={simContractEmail} onChange={e => setSimContractEmail(e.target.value)} className="tw-border tw-rounded tw-p-2" placeholder="paziente@email.it" />
                  </label>
                  <label className="tw-flex tw-flex-col tw-gap-1">
                    <span className="tw-text-sm tw-font-medium">Corrispettivo contratto (€)</span>
                    <input type="number" step="0.01" min="0" value={simContractImporto} onChange={e => setSimContractImporto(e.target.value)} className="tw-border tw-rounded tw-p-2" />
                    <span className="tw-text-xs tw-text-slate-400">Imponibile — la fattura aggiunge IVA 22%</span>
                  </label>
                  <label className="tw-flex tw-items-end tw-gap-2 tw-text-sm tw-cursor-pointer tw-pb-2">
                    <input type="checkbox" checked={simContractInvia} onChange={e => setSimContractInvia(e.target.checked)} className="tw-w-4 tw-h-4 tw-accent-[#1e4d8c]" />
                    <span className="tw-font-medium">Invia subito per firma</span>
                  </label>
                </div>
                <div className="tw-flex tw-items-center tw-gap-3 tw-mt-3 tw-flex-wrap">
                  <Button size="sm" onClick={generaContrattoDaSim} disabled={simContractLoading || !simPatient || (simContractInvia && !simContractEmail)}>
                    {simContractLoading ? 'Generazione...' : 'Genera contratto + invia firma'}
                  </Button>
                  {simContractMsg && <span className="tw-text-sm tw-text-green-700 tw-font-medium">{simContractMsg}</span>}
                </div>
              </div>
            )}
            <div className="tw-flex tw-justify-end tw-gap-2 tw-mb-4 tw-flex-wrap">
              <Button onClick={calcolaSimulazione} disabled={simLoading || (simIsOrario && !(Number(simOre) > 0))} className="tw-flex tw-items-center tw-gap-2">
                <Euro size={18} /> {simLoading ? 'Calcolo...' : 'Calcola il costo mensile'}
              </Button>
              {simRisultato && (
                <Button variant="secondary" onClick={scaricaPdfPreventivo} disabled={simPdfLoading} className="tw-flex tw-items-center tw-gap-2">
                  <FileText size={18} /> {simPdfLoading ? 'Generazione...' : 'Scarica PDF simulazione'}
                </Button>
              )}
            </div>
            {simErr && <div className="tw-text-red-600 tw-text-sm tw-mb-3">{simErr}</div>}
            {simRisultato && (
              <div className="tw-space-y-4">
                <div className="tw-p-4 tw-bg-rose-600 tw-rounded-xl tw-text-white">
                  <div className="tw-text-xs tw-uppercase tw-font-bold tw-text-rose-100 tw-tracking-wide">Costo mensile stimato</div>
                  <div className="tw-text-3xl tw-font-extrabold">€{simRisultato.totaleCostoMensile.toFixed(2).replace('.', ',')}</div>
                  <div className="tw-text-xs tw-text-rose-100">Totale a carico del datore di lavoro, inclusi gli accantonamenti.</div>
                  <div className="tw-text-xs tw-text-rose-200 tw-mt-2 tw-font-semibold">
                    {simRisultato.contrattoLabel} · {simRisultato.livelloLabel} · {simRisultato.oreSettimanali.toFixed(2).replace('.', ',')} ore a settimana
                  </div>
                </div>
                <div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-3 tw-gap-4">
                  <div className="tw-p-4 tw-bg-slate-50 tw-rounded-xl">
                    <div className="tw-text-xs tw-font-bold tw-text-slate-500 tw-uppercase tw-mb-2">Retribuzione</div>
                    <div className="tw-flex tw-justify-between tw-text-sm tw-py-1"><span className="tw-text-slate-600">Retribuzione ordinaria {Math.round(simRisultato.oreMensili)} ore</span><span className="tw-font-semibold">€{simRisultato.retribuzioneLordaMensile.toFixed(2).replace('.', ',')}</span></div>
                    <div className="tw-flex tw-justify-between tw-text-sm tw-py-1 tw-font-bold tw-text-slate-800 tw-border-b tw-border-slate-200 tw-pb-2"><span>Retribuzione lorda</span><span>€{simRisultato.retribuzioneLordaMensile.toFixed(2).replace('.', ',')}</span></div>
                    <div className="tw-text-xs tw-font-bold tw-text-slate-500 tw-uppercase tw-mt-3 tw-mb-1">Trattenute del lavoratore</div>
                    <div className="tw-flex tw-justify-between tw-text-sm tw-py-1"><span className="tw-text-slate-600">Contributi INPS ({simRisultato.contribInpsLavoratoreOrario.toFixed(2).replace('.', ',')} €/h)</span><span className="tw-font-semibold">€{simRisultato.contribInpsLavoratoreMensili.toFixed(2).replace('.', ',')}</span></div>
                    <div className="tw-flex tw-justify-between tw-text-sm tw-py-1"><span className="tw-text-slate-600">Cas.sa.Colf ({simRisultato.cassaColfLavoratoreOrario.toFixed(2).replace('.', ',')} €/h)</span><span className="tw-font-semibold">€{simRisultato.cassaColfLavoratoreMensili.toFixed(2).replace('.', ',')}</span></div>
                    <div className="tw-flex tw-justify-between tw-text-sm tw-py-1 tw-font-bold tw-text-emerald-700 tw-border-t-2 tw-border-emerald-200 tw-mt-1"><span>Retribuzione netta</span><span>€{simRisultato.retribuzioneNetta.toFixed(2).replace('.', ',')}</span></div>
                  </div>
                  <div className="tw-p-4 tw-bg-slate-50 tw-rounded-xl">
                    <div className="tw-text-xs tw-font-bold tw-text-slate-500 tw-uppercase tw-mb-2">A carico del datore di lavoro</div>
                    <div className="tw-flex tw-justify-between tw-text-sm tw-py-1"><span className="tw-text-slate-600">Contributi INPS ({simRisultato.contribInpsDatoreOrario.toFixed(2).replace('.', ',')} €/h)</span><span className="tw-font-semibold">€{simRisultato.contribInpsDatoreMensili.toFixed(2).replace('.', ',')}</span></div>
                    <div className="tw-flex tw-justify-between tw-text-sm tw-py-1"><span className="tw-text-slate-600">Cas.sa.Colf ({simRisultato.cassaColfDatoreOrario.toFixed(2).replace('.', ',')} €/h)</span><span className="tw-font-semibold">€{simRisultato.cassaColfDatoreMensili.toFixed(2).replace('.', ',')}</span></div>
                    <div className="tw-flex tw-justify-between tw-text-sm tw-py-1"><span className="tw-text-slate-600">TFR</span><span className="tw-font-semibold">€{simRisultato.tfr.toFixed(2).replace('.', ',')}</span></div>
                    <div className="tw-flex tw-justify-between tw-text-sm tw-py-1"><span className="tw-text-slate-600">Tredicesima</span><span className="tw-font-semibold">€{simRisultato.tredicesima.toFixed(2).replace('.', ',')}</span></div>
                    <div className="tw-flex tw-justify-between tw-text-sm tw-py-1 tw-font-bold tw-text-slate-800 tw-border-t-2 tw-border-slate-200 tw-mt-1"><span>Netto complessivo con TFR e 13ª</span><span>€{simRisultato.nettoComplessivo.toFixed(2).replace('.', ',')}</span></div>
                  </div>
                  <div className="tw-p-4 tw-bg-slate-50 tw-rounded-xl">
                    <div className="tw-text-xs tw-font-bold tw-text-slate-500 tw-uppercase tw-mb-2">Dettagli utili</div>
                    <div className="tw-flex tw-justify-between tw-text-sm tw-py-1"><span className="tw-text-slate-600">Retribuzione oraria totale</span><span className="tw-font-semibold">€{simRisultato.retribuzioneOrariaTotale.toFixed(2).replace('.', ',')}</span></div>
                    <div className="tw-flex tw-justify-between tw-text-sm tw-py-1"><span className="tw-text-slate-600">Retribuzione oraria effettiva</span><span className="tw-font-semibold">€{simRisultato.retribuzioneOrariaEffettiva.toFixed(2).replace('.', ',')}</span></div>
                    <div className="tw-flex tw-justify-between tw-text-sm tw-py-1"><span className="tw-text-slate-600">Ferie maturate al mese</span><span className="tw-font-semibold">{simRisultato.ferieMensiliOre.toFixed(2).replace('.', ',')} ore</span></div>
                    {simRisultato.vittoAlloggioGiorno > 0 && (
                      <div className="tw-flex tw-justify-between tw-text-sm tw-py-1"><span className="tw-text-slate-600">Vitto e alloggio in natura</span><span className="tw-font-semibold">{simRisultato.vittoAlloggioGiorno.toFixed(2).replace('.', ',')} €/g</span></div>
                    )}
                  </div>
                </div>
                <p className="tw-text-xs tw-text-slate-400 tw-m-0">Stima informativa basata sul CCNL lavoro domestico e contributi INPS 2026. Non sostituisce la consulenza paghe.</p>
              </div>
            )}
          </div>
        )}

        <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-slate-100 tw-shadow-sm tw-p-5 md:tw-p-6">
          <h2 className="tw-text-lg tw-font-semibold tw-mb-4 tw-flex tw-items-center tw-gap-2 tw-text-slate-700">
            <FileText size={20} /> Richieste ({richieste.length})
          </h2>

          {richieste.length === 0 ? (
            <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-slate-100 tw-shadow-sm tw-p-8 tw-text-center tw-text-slate-400">
              Nessuna richiesta di intermediazione.
            </div>
          ) : (
            <div className="tw-flex tw-flex-col tw-gap-3">
              {richieste.map(r => {
                const contratto = r.contrattoId && typeof r.contrattoId === 'object' ? r.contrattoId : undefined;
                const fattura = r.fatturaId && typeof r.fatturaId === 'object' ? r.fatturaId : undefined;
                const isOpen = selectedQuote === r._id;
                // Paziente eliminato: populate restituisce null, mostriamo un fallback invece di crashare
                const nomePaziente = r.patient ? `${r.patient.firstName} ${r.patient.lastName}` : 'Paziente rimosso';
                return (
                  <div key={r._id} className="tw-bg-white tw-rounded-xl tw-overflow-hidden tw-border tw-border-rose-100 tw-shadow-sm hover:tw-shadow-md tw-transition-shadow tw-border-l-4 tw-border-l-rose-600">
                    <div className="tw-p-4">
                      {/* ── Dati paziente/richiesta (riga superiore, senza azioni) ── */}
                      <div className="tw-flex tw-flex-wrap tw-justify-between tw-items-start tw-gap-4">
                        <div className="tw-flex-1 tw-min-w-[240px]">
                          <div className="tw-flex tw-items-center tw-flex-wrap tw-gap-2 tw-mb-1">
                            <User size={18} className="tw-text-rose-600" />
                            <strong className="tw-text-[1.05rem] tw-text-slate-800">{nomePaziente}</strong>
                            <span className="tw-text-xs tw-px-2 tw-py-0.5 tw-rounded-full tw-bg-slate-100 tw-text-slate-600 tw-font-medium">{r.patient?.codiceFiscale || ''}</span>
                            <span className={statoBadge(r.stato)}>{r.stato.replace('_', ' ')}</span>
                          </div>
                          <div className="tw-flex tw-flex-wrap tw-gap-3 tw-text-sm tw-text-slate-500 tw-mb-2">
                            <span><Briefcase size={14} className="tw-inline" /> {r.contrattoTipo === 'orario_non_convivente' ? 'Orario non convivente' : 'Convivente'} — Livello {r.livello}</span>
                            {r.oreSettimanali ? <span>{r.oreSettimanali} h/sett</span> : null}
                            <span>{r.mesiContratto} mesi</span>
                            {r.costoMensile ? <span className="tw-font-medium tw-text-slate-700"><Euro size={14} className="tw-inline" /> {r.costoMensile.toFixed(2)}/mese</span> : null}
                          </div>
                          {fattura && (
                            <div className="tw-text-sm tw-text-slate-600 tw-mt-1">
                              <strong>Fattura:</strong> {fattura.numero} — <Euro size={14} className="tw-inline" /> {fattura.totale.toFixed(2)}
                            </div>
                          )}
                          {Array.isArray(r.fattureGestione) && r.fattureGestione.length > 0 && (
                            <div className="tw-text-xs tw-text-slate-500 tw-mt-1">
                              <strong>Fatture gestione:</strong>{' '}
                              {r.fattureGestione.map((fg: any, i: number) => (
                                <span key={typeof fg === 'object' ? fg._id : fg}>
                                  {i > 0 && ', '}
                                  {typeof fg === 'object' ? `${fg.numero} — €${fg.totale?.toFixed(2)}` : fg}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ── Fascia azioni separata dai dati paziente ── */}
                      {(isGestione || contratto) && (
                        <div className="tw-flex tw-gap-2 tw-flex-wrap tw-items-center tw-justify-end tw-border-t tw-border-slate-100 tw-mt-3 tw-pt-3">
                          {isGestione && !contratto && (
                            <Button size="sm" onClick={() => setSelectedQuote(isOpen ? null : r._id)}>
                              {isOpen ? 'Chiudi' : 'Simula costo'}
                            </Button>
                          )}
                          {contratto && (
                            <>
                              <Button size="sm" variant="secondary" onClick={() => scaricaPreventivoContratto(contratto)}>
                                <Download size={14} className="tw-inline" /> Preventivo
                              </Button>
                              {isGestione && contratto.stato === 'emesso' && (
                                <Button size="sm" variant="secondary" onClick={() => inviaFirmaContratto(contratto)}>
                                  <Mail size={14} className="tw-inline" /> Invia per firma
                                </Button>
                              )}
                              {contratto.stato === 'firmato' && (
                                <span className="tw-inline-flex tw-items-center tw-gap-1 tw-px-2 tw-py-1 tw-rounded tw-bg-green-100 tw-text-green-700 tw-text-xs tw-font-bold">
                                  <Check size={14} /> Firmato{contratto.dataFirma ? ` il ${new Date(contratto.dataFirma).toLocaleDateString('it-IT')}` : ''}
                                </span>
                              )}
                            </>
                          )}
                          {isGestione && contratto?.stato === 'firmato' && !fattura && (
                            <Button size="sm" onClick={() => convertiInFattura(r._id)}>
                              <Receipt size={14} className="tw-inline" /> Fattura
                            </Button>
                          )}
                          {isGestione && fattura && (
                            <>
                              <Button size="sm" variant="secondary" onClick={() => scaricaPDF(fattura)}>
                                <Download size={14} className="tw-inline" /> PDF
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => inviaFattura(fattura)}>
                                <Mail size={14} className="tw-inline" /> Fattura
                              </Button>
                              {Number(r.gestioneAmministrativa) > 0 && (
                                <div className="tw-flex tw-items-center tw-gap-2 tw-w-full md:tw-w-auto">
                                  <input
                                    type="month"
                                    value={meseGestione}
                                    onChange={e => setMeseGestione(e.target.value)}
                                    className="tw-border tw-rounded tw-p-1 tw-text-sm"
                                  />
                                  <Button size="sm" variant="secondary" onClick={() => generaFatturaGestione(r._id)} disabled={!meseGestione || saving}>
                                    <Receipt size={14} className="tw-inline" /> Fattura mensile
                                  </Button>
                                </div>
                              )}
                            </>
                          )}
                          {isGestione && (
                            <button onClick={() => eliminaRichiesta(r._id)} className="tw-text-red-600 hover:tw-text-red-800 tw-p-2" title="Elimina">
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedQuote && richiestaAperta && (
        <div className="tw-fixed tw-inset-0 tw-bg-black/40 tw-flex tw-items-center tw-justify-center tw-z-50 tw-p-4">
          <div className="tw-bg-white tw-rounded-2xl tw-p-6 tw-w-full tw-max-w-3xl tw-max-h-[90vh] tw-overflow-y-auto tw-shadow-xl">
            <h2 className="tw-text-lg tw-font-bold tw-mb-1 tw-flex tw-items-center tw-gap-2 tw-text-slate-800"><Euro size={20} /> Simula costo e contratto d'incarico</h2>
            <p className="tw-text-xs tw-text-slate-500 tw-mb-4">Il PDF con la simulazione del costo sarà allegato al contratto d'incarico inviato al paziente insieme all'informativa GDPR per la firma.</p>
            <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-gap-3 tw-mb-4">
              <label className="tw-flex tw-flex-col tw-gap-1">
                <span className="tw-text-sm tw-font-medium">Tipo di contratto</span>
                <select
                  value={simContratto}
                  onChange={e => {
                    const t = TIPI_CONTRATTO_SIM.find(x => x.value === e.target.value) || TIPI_CONTRATTO_SIM[0];
                    setSimContratto(t.value);
                    if (t.livelli.length > 0 && !t.livelli.includes(simLivello)) setSimLivello(t.livelli[0]);
                    setSimRisultato(null);
                  }}
                  className="tw-border tw-rounded tw-p-2"
                >
                  {TIPI_CONTRATTO_SIM.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              {simTipoCorrente.livelli.length > 0 ? (
                <label className="tw-flex tw-flex-col tw-gap-1">
                  <span className="tw-text-sm tw-font-medium">Livello CCNL</span>
                  <select value={simLivello} onChange={e => { setSimLivello(e.target.value); setSimRisultato(null); }} className="tw-border tw-rounded tw-p-2">
                    {simTipoCorrente.livelli.map(l => (
                      <option key={l} value={l}>{l} — {LIVELLI_DESCRIZIONI[l]}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="tw-flex tw-items-end tw-text-sm tw-text-slate-500 tw-pb-2">Livello unico (presenza notturna)</div>
              )}
              <label className="tw-flex tw-flex-col tw-gap-1">
                <span className="tw-text-sm tw-font-medium">Durata</span>
                <div className="tw-flex tw-gap-2">
                  <button type="button" onClick={() => { setSimDeterminato(false); setSimRisultato(null); }} className={`tw-flex-1 tw-border tw-rounded tw-p-2 tw-text-sm tw-font-semibold ${!simDeterminato ? 'tw-bg-emerald-50 tw-border-emerald-400 tw-text-emerald-800' : 'tw-bg-white tw-text-slate-500'}`}>Indeterminato</button>
                  <button type="button" onClick={() => { setSimDeterminato(true); setSimRisultato(null); }} className={`tw-flex-1 tw-border tw-rounded tw-p-2 tw-text-sm tw-font-semibold ${simDeterminato ? 'tw-bg-emerald-50 tw-border-emerald-400 tw-text-emerald-800' : 'tw-bg-white tw-text-slate-500'}`}>Determinato</button>
                </div>
              </label>
              {simIsOrario && (
                <label className="tw-flex tw-flex-col tw-gap-1">
                  <span className="tw-text-sm tw-font-medium">Ore a settimana</span>
                  <input type="number" min="1" max="40" value={simOre} onChange={e => { setSimOre(e.target.value); setSimRisultato(null); }} className="tw-border tw-rounded tw-p-2" />
                </label>
              )}
              <label className="tw-flex tw-flex-col tw-gap-1">
                <span className="tw-text-sm tw-font-medium">{simIsOrario ? 'Paga oraria (€/h)' : 'Paga mensile (€/mese)'}</span>
                <input type="number" step="0.01" min="0" value={simPagaCustom} onChange={e => { setSimPagaCustom(e.target.value); setSimRisultato(null); }} className="tw-border tw-rounded tw-p-2" placeholder="Minimo CCNL" />
              </label>
              {(simLivello === 'CS' || simLivello === 'DS' || simLivello === 'B' || simLivello === 'BS') && simContratto !== 'sostituzione' && simContratto !== 'presenza_notturna' && (
                <div className="tw-flex tw-flex-col tw-gap-2 md:tw-col-span-2">
                  <span className="tw-text-xs tw-font-bold tw-text-slate-500 tw-uppercase">Indennità</span>
                  {(simLivello === 'CS' || simLivello === 'DS') && (
                    <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-cursor-pointer tw-bg-slate-50 tw-border tw-rounded tw-p-2">
                      <input type="checkbox" checked={simPiuAutosuff} onChange={e => { setSimPiuAutosuff(e.target.checked); setSimRisultato(null); }} className="tw-w-4 tw-h-4 tw-accent-[#1e4d8c]" />
                      <span>Più persone non autosufficienti</span>
                    </label>
                  )}
                  {simLivello === 'BS' && (
                    <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-cursor-pointer tw-bg-slate-50 tw-border tw-rounded tw-p-2">
                      <input type="checkbox" checked={simBabysitter} onChange={e => { setSimBabysitter(e.target.checked); setSimRisultato(null); }} className="tw-w-4 tw-h-4 tw-accent-[#1e4d8c]" />
                      <span>Babysitter fino al 6° anno</span>
                    </label>
                  )}
                  {(simLivello === 'B' || simLivello === 'BS' || simLivello === 'CS') && (
                    <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-cursor-pointer tw-bg-slate-50 tw-border tw-rounded tw-p-2">
                      <input type="checkbox" checked={simCertUni} onChange={e => { setSimCertUni(e.target.checked); setSimRisultato(null); }} className="tw-w-4 tw-h-4 tw-accent-[#1e4d8c]" />
                      <span>Certificato UNI 11766</span>
                    </label>
                  )}
                </div>
              )}
            </div>

            <div className="tw-flex tw-items-center tw-gap-3 tw-flex-wrap tw-mb-4">
              <Button size="sm" variant="secondary" onClick={calcolaSimulazione} disabled={simLoading || (simIsOrario && !(Number(simOre) > 0))}>
                {simLoading ? 'Calcolo...' : 'Anteprima costo mensile'}
              </Button>
              {simRisultato && (
                <div className="tw-text-sm tw-font-bold tw-text-slate-700">
                  Costo mensile: <span className="tw-text-rose-700">€{simRisultato.totaleCostoMensile.toFixed(2).replace('.', ',')}</span>
                  <span className="tw-text-xs tw-font-normal tw-text-slate-500 tw-ml-2">{simRisultato.contrattoLabel} · {simRisultato.livelloLabel}</span>
                </div>
              )}
              {simErr && <span className="tw-text-red-600 tw-text-sm">{simErr}</span>}
            </div>

            <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-gap-3 tw-mb-4 tw-p-3 tw-bg-slate-50 tw-rounded-xl">
              <label className="tw-flex tw-flex-col tw-gap-1">
                <span className="tw-text-sm tw-font-medium">Quota CAF mensile (€)</span>
                <input type="number" step="0.01" min="0" value={prevCaf} onChange={e => setPrevCaf(e.target.value)} className="tw-border tw-rounded tw-p-2" />
              </label>
              <label className="tw-flex tw-flex-col tw-gap-1">
                <span className="tw-text-sm tw-font-medium">Corrispettivo contratto (€)</span>
                <input type="number" step="0.01" min="0" value={prevImporto} onChange={e => setPrevImporto(e.target.value)} className="tw-border tw-rounded tw-p-2" />
                <span className="tw-text-xs tw-text-slate-400">Importo riportato nel contratto d'incarico</span>
              </label>
              <label className="tw-flex tw-flex-col tw-gap-1">
                <span className="tw-text-sm tw-font-medium">Email destinatario firma</span>
                <input type="email" value={prevEmail} onChange={e => setPrevEmail(e.target.value)} className="tw-border tw-rounded tw-p-2" placeholder="paziente@email.it" />
              </label>
            </div>
            <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-cursor-pointer tw-mb-4">
              <input type="checkbox" checked={prevInvia} onChange={e => setPrevInvia(e.target.checked)} className="tw-w-4 tw-h-4 tw-accent-[#1e4d8c]" />
              <span className="tw-font-medium">Invia subito al paziente contratto + GDPR + preventivo per la firma</span>
            </label>

            <div className="tw-flex tw-justify-end tw-gap-2">
              <Button size="sm" variant="secondary" onClick={() => setSelectedQuote(null)}>Annulla</Button>
              <Button size="sm" onClick={() => generaPreventivoContratto(selectedQuote)} disabled={prevLoading || (prevInvia && !prevEmail)}>
                {prevLoading ? 'Generazione...' : prevInvia ? 'Genera e invia per firma' : 'Genera contratto'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modale Tariffe CCNL / INPS — accesso riservato dal menu ⚙ (solo admin) ── */}
      {showTariffe && tariffe && (
        <div className="tw-fixed tw-inset-0 tw-bg-black/40 tw-flex tw-items-center tw-justify-center tw-z-50 tw-p-4">
          <div className="tw-bg-white tw-rounded-2xl tw-p-6 tw-w-full tw-max-w-5xl tw-max-h-[90vh] tw-overflow-y-auto tw-shadow-xl">
            <div className="tw-flex tw-justify-between tw-items-start">
              <h2 className="tw-text-lg tw-font-bold tw-flex tw-items-center tw-gap-2 tw-text-slate-800">
                <Euro size={20} /> Parametri CCNL / INPS
              </h2>
              <button onClick={() => setShowTariffe(false)} className="tw-p-1 tw-text-slate-400 hover:tw-text-slate-700"><X size={20} /></button>
            </div>
            <p className="tw-text-xs tw-text-slate-500 tw-mb-1">
              Aggiorna qui i minimi retributivi, le indennità e i contributi quando escono le nuove tabelle CCNL/INPS.
              I valori si applicano subito al simulatore, al PDF preventivo e al preventivo reale da firmare.
            </p>
            <p className="tw-text-xs tw-mb-4 tw-font-semibold">
              <span className={tariffeMeta.personalizzato ? 'tw-text-amber-600' : 'tw-text-slate-400'}>
                {tariffeMeta.personalizzato ? 'Tariffe personalizzate salvate' : 'Minimi ufficiali (nessuna personalizzazione)'}
              </span>
              {tariffeMeta.aggiornatoIl ? (
                <span className="tw-text-slate-400 tw-font-normal"> · agg. {new Date(tariffeMeta.aggiornatoIl).toLocaleDateString('it-IT')}{tariffeMeta.aggiornatoDa ? ` da ${tariffeMeta.aggiornatoDa}` : ''}</span>
              ) : null}
            </p>

            <div className="tw-space-y-5">
              {SEZIONI_TARIFFE.map(s => (
                <div key={s.titolo}>
                  <h3 className="tw-text-xs tw-font-bold tw-text-slate-500 tw-uppercase tw-mb-2">{s.titolo}</h3>
                  <div className="tw-grid tw-grid-cols-2 md:tw-grid-cols-4 lg:tw-grid-cols-6 tw-gap-2">
                    {s.campi.map(c => (
                      <label key={c.path} className="tw-flex tw-flex-col tw-gap-0.5">
                        <span className="tw-text-[11px] tw-text-slate-500">{c.label}</span>
                        <input
                          type="number"
                          step="0.01"
                          value={getPath(tariffe, c.path) ?? ''}
                          onChange={e => setTariffe((t: any) => setPath(t, c.path, e.target.value === '' ? undefined : Number(e.target.value)))}
                          className="tw-border tw-rounded tw-p-1.5 tw-text-sm"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="tw-flex tw-justify-end tw-gap-2 tw-mt-6 tw-flex-wrap">
              <Button size="sm" variant="secondary" onClick={() => setShowTariffe(false)}>Annulla</Button>
              <Button size="sm" variant="secondary" onClick={resetTariffe} disabled={tariffeSaving}>
                Ripristina minimi ufficiali
              </Button>
              <Button size="sm" onClick={salvaTariffe} disabled={tariffeSaving}>
                {tariffeSaving ? 'Salvataggio...' : 'Salva tariffe'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
