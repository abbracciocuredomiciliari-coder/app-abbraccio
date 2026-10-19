import { useEffect, useState, FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { Users, Plus, FileText, Mail, Trash2, Receipt, Check, X, User, Briefcase, Euro, Download } from 'lucide-react';
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
  fatturaId?: Fattura | string;
  fattureGestione?: Fattura[] | string[];
  createdAt: string;
}

export default function BadantiIntermediazione() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const patientIdDaUrl = searchParams.get('patientId') || '';
  const apriNuovoDaUrl = searchParams.get('nuovo') === '1';
  const [richieste, setRichieste] = useState<Badante[]>([]);
  const [pazienti, setPazienti] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(apriNuovoDaUrl);

  const [patient, setPatient] = useState(patientIdDaUrl);
  const [contrattoTipo, setContrattoTipo] = useState<'orario_non_convivente' | 'convivente'>('orario_non_convivente');
  const [livello, setLivello] = useState('A');
  const [oreSettimanali, setOreSettimanali] = useState('24');
  const [mesiContratto, setMesiContratto] = useState('12');
  const [note, setNote] = useState('');
  const [gestioneAmministrativa, setGestioneAmministrativa] = useState('');
  const [includiGestione, setIncludiGestione] = useState(true);
  const [quoteNote, setQuoteNote] = useState('');
  const [meseGestione, setMeseGestione] = useState('');

  // ── Simulazione costo badante (calcolatore CCNL/INPS 2026, stile doemploy) ──
  const [showSim, setShowSim] = useState(false);
  const [simContratto, setSimContratto] = useState('convivente');
  const [simLivello, setSimLivello] = useState('BS');
  const [simOre, setSimOre] = useState('30');
  const [simDeterminato, setSimDeterminato] = useState(false);
  const [simPiuAutosuff, setSimPiuAutosuff] = useState(false);
  const [simCertUni, setSimCertUni] = useState(false);
  const [simPagaCustom, setSimPagaCustom] = useState('');
  const [simRisultato, setSimRisultato] = useState<SimulazioneCosto | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simErr, setSimErr] = useState('');

  const simTipoCorrente = TIPI_CONTRATTO_SIM.find(t => t.value === simContratto) || TIPI_CONTRATTO_SIM[1];
  const simIsOrario = simTipoCorrente.orario;

  const [selectedQuote, setSelectedQuote] = useState<string | null>(null);

  const isGestione = user?.role === 'admin' || user?.role === 'coordinator' || user?.role === 'direttore';

  useEffect(() => { caricaDati(); caricaPazienti(); }, []);

  useEffect(() => {
    const r = richieste.find(x => x._id === selectedQuote);
    if (r) {
      setGestioneAmministrativa(r.gestioneAmministrativa ? String(r.gestioneAmministrativa) : '');
      setIncludiGestione(!!r.gestioneAmministrativa && Number(r.gestioneAmministrativa) > 0);
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

  async function caricaPazienti() {
    try {
      const res = await api.get('/patients?tipo=consulenza');
      const pazienti = res.data?.patients || res.data || [];
      setPazienti(pazienti as Patient[]);
    } catch (err: any) {
      console.error('Errore caricamento pazienti', err);
    }
  }

  async function salvaRichiesta(e: FormEvent) {
    e.preventDefault();
    if (!patient) return alert('Seleziona un paziente');
    try {
      setSaving(true);
      await api.post('/badanti-intermediazione', {
        patient,
        contrattoTipo,
        livello,
        oreSettimanali: contrattoTipo === 'orario_non_convivente' && oreSettimanali ? Number(oreSettimanali) : undefined,
        mesiContratto: mesiContratto ? Number(mesiContratto) : undefined,
        note,
      });
      setPatient('');
      setContrattoTipo('orario_non_convivente');
      setLivello('A');
      setOreSettimanali('24');
      setMesiContratto('12');
      setNote('');
      setShowForm(false);
      await caricaDati();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore salvataggio');
    } finally {
      setSaving(false);
    }
  }

  async function generaPreventivo(id: string) {
    try {
      setSaving(true);
      await api.post(`/badanti-intermediazione/${id}/preventivo`, {
        gestioneAmministrativa: includiGestione ? Number(gestioneAmministrativa) : 0,
        note: quoteNote,
      });
      setSelectedQuote(null);
      setGestioneAmministrativa('');
      setIncludiGestione(true);
      setQuoteNote('');
      await caricaDati();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore generazione preventivo');
    } finally {
      setSaving(false);
    }
  }

  async function inviaFirma(preventivo: Preventivo) {
    const email = window.prompt('Email del destinatario');
    if (!email) return;
    try {
      await api.post(`/fatturazione-documenti/${preventivo._id}/invia-email`, { email });
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
              <Button onClick={() => setShowForm(s => !s)} className="tw-flex tw-items-center tw-gap-2">
                {showForm ? <X size={18} /> : <Plus size={18} />} Nuova richiesta
              </Button>
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
            </div>
            <div className="tw-flex tw-justify-end tw-mb-4">
              <Button onClick={calcolaSimulazione} disabled={simLoading || (simIsOrario && !(Number(simOre) > 0))} className="tw-flex tw-items-center tw-gap-2">
                <Euro size={18} /> {simLoading ? 'Calcolo...' : 'Calcola il costo mensile'}
              </Button>
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

        {showForm && (
          <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-slate-100 tw-shadow-sm tw-p-5 md:tw-p-6">
            <h2 className="tw-text-lg tw-font-semibold tw-mb-4 tw-text-slate-700">Nuova richiesta</h2>
            <form onSubmit={salvaRichiesta} className="tw-space-y-4">
              <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
                <label className="tw-flex tw-flex-col tw-gap-1">
                  <span className="tw-text-sm tw-font-medium">Paziente</span>
                  <select value={patient} onChange={e => setPatient(e.target.value)} className="tw-border tw-rounded tw-p-2" required>
                    <option value="">Seleziona...</option>
                    {pazienti.filter(Boolean).map(p => (
                      <option key={p._id} value={p._id}>{p.firstName} {p.lastName} {p.codiceFiscale ? `(${p.codiceFiscale})` : ''}</option>
                    ))}
                  </select>
                </label>
                <label className="tw-flex tw-flex-col tw-gap-1">
                  <span className="tw-text-sm tw-font-medium">Tipo contratto</span>
                  <select value={contrattoTipo} onChange={e => setContrattoTipo(e.target.value as any)} className="tw-border tw-rounded tw-p-2">
                    <option value="orario_non_convivente">Ad orario non convivente</option>
                    <option value="convivente">Convivente</option>
                  </select>
                </label>
                <label className="tw-flex tw-flex-col tw-gap-1">
                  <span className="tw-text-sm tw-font-medium">Livello</span>
                  <select value={livello} onChange={e => setLivello(e.target.value)} className="tw-border tw-rounded tw-p-2">
                    {['A', 'AS', 'B', 'BS', 'C', 'CS', 'D', 'DS'].map(l => (
                      <option key={l} value={l}>{l} — {LIVELLI_DESCRIZIONI[l]}</option>
                    ))}
                  </select>
                  <span className="tw-text-xs tw-text-slate-500 tw-mt-1">{LIVELLI_DESCRIZIONI[livello]}</span>
                </label>
                <label className="tw-flex tw-flex-col tw-gap-1">
                  <span className="tw-text-sm tw-font-medium">Mesi contratto</span>
                  <input type="number" value={mesiContratto} onChange={e => setMesiContratto(e.target.value)} className="tw-border tw-rounded tw-p-2" />
                </label>
                {contrattoTipo === 'orario_non_convivente' && (
                  <label className="tw-flex tw-flex-col tw-gap-1">
                    <span className="tw-text-sm tw-font-medium">Ore settimanali</span>
                    <input type="number" value={oreSettimanali} onChange={e => setOreSettimanali(e.target.value)} className="tw-border tw-rounded tw-p-2" />
                  </label>
                )}
                <label className="tw-flex tw-flex-col tw-gap-1 md:tw-col-span-2">
                  <span className="tw-text-sm tw-font-medium">Note</span>
                  <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} className="tw-border tw-rounded tw-p-2" />
                </label>
              </div>
              <div className="tw-flex tw-justify-end">
                <Button type="submit" disabled={saving} className="tw-flex tw-items-center tw-gap-2">
                  <Check size={18} /> {saving ? 'Salvataggio...' : 'Salva richiesta'}
                </Button>
              </div>
            </form>
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
                const preventivo = r.preventivoId && typeof r.preventivoId === 'object' ? r.preventivoId : undefined;
                const fattura = r.fatturaId && typeof r.fatturaId === 'object' ? r.fatturaId : undefined;
                const isOpen = selectedQuote === r._id;
                // Paziente eliminato: populate restituisce null, mostriamo un fallback invece di crashare
                const nomePaziente = r.patient ? `${r.patient.firstName} ${r.patient.lastName}` : 'Paziente rimosso';
                return (
                  <div key={r._id} className="tw-bg-white tw-rounded-xl tw-overflow-hidden tw-border tw-border-rose-100 tw-shadow-sm hover:tw-shadow-md tw-transition-shadow tw-border-l-4 tw-border-l-rose-600">
                    <div className="tw-p-4">
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
                          {preventivo && (
                            <div className="tw-text-sm tw-text-slate-600">
                              <strong>Preventivo:</strong> {preventivo.numero} — <Euro size={14} className="tw-inline" /> {preventivo.totale.toFixed(2)} una tantum ({preventivo.stato})
                              {Number(preventivo.totaleMensileStimato) > 0 && (
                                <span className="tw-ml-2 tw-inline-flex tw-items-center tw-px-2 tw-py-0.5 tw-rounded-full tw-bg-blue-100 tw-text-blue-700 tw-font-bold tw-text-xs">
                                  💶 €{Number(preventivo.totaleMensileStimato).toFixed(2)}/mese
                                </span>
                              )}
                            </div>
                          )}
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
                        <div className="tw-flex tw-gap-2 tw-flex-shrink-0 tw-flex-wrap tw-items-center">
                          {isGestione && !preventivo && (
                            <Button size="sm" onClick={() => setSelectedQuote(isOpen ? null : r._id)}>
                              {isOpen ? 'Chiudi' : 'Genera preventivo'}
                            </Button>
                          )}
                          {isGestione && preventivo && preventivo.stato === 'emesso' && (
                            <>
                              <Button size="sm" variant="secondary" onClick={() => scaricaPDF(preventivo)}>
                                <Download size={14} className="tw-inline" /> PDF
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => inviaFirma(preventivo)}>
                                <Mail size={14} className="tw-inline" /> Firma
                              </Button>
                            </>
                          )}
                          {isGestione && preventivo?.stato === 'firmato' && (
                            <Button size="sm" variant="secondary" onClick={() => scaricaPDF(preventivo)}>
                              <Download size={14} className="tw-inline" /> PDF firmato
                            </Button>
                          )}
                          {isGestione && preventivo?.stato === 'firmato' && !fattura && (
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
                      </div>
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
          <div className="tw-bg-white tw-rounded-2xl tw-p-6 tw-w-full tw-max-w-2xl tw-max-h-[90vh] tw-overflow-y-auto tw-shadow-xl">
            <h2 className="tw-text-lg tw-font-bold tw-mb-4 tw-flex tw-items-center tw-gap-2 tw-text-slate-800"><FileText size={20} /> Genera preventivo</h2>
            <div className="tw-space-y-3 tw-mb-4">
              {(() => {
                const costoBadanteMensile = Number(richiestaAperta.costoMensile || 0);
                const gaNetta = includiGestione ? Number(gestioneAmministrativa || 0) : 0;
                const ivaGestioneMensile = Math.round(gaNetta * 0.22 * 100) / 100;
                const gaLordaMensile = Math.round((gaNetta + ivaGestioneMensile) * 100) / 100;
                const totaleMensile = Math.round((costoBadanteMensile + gaLordaMensile) * 100) / 100;
                return (
                  <div className="tw-p-4 tw-bg-blue-50 tw-border-2 tw-border-blue-200 tw-rounded-xl tw-flex tw-justify-between tw-items-center tw-flex-wrap tw-gap-2">
                    <div>
                      <div className="tw-text-xs tw-uppercase tw-font-bold tw-text-blue-700 tw-tracking-wide">💶 Totale mensile a carico della famiglia</div>
                      <div className="tw-text-xs tw-text-blue-600 tw-mt-0.5">Badante €{costoBadanteMensile.toFixed(2)}/mese{includiGestione && gaNetta > 0 ? ` + Gestione amministrativa €${gaLordaMensile.toFixed(2)}/mese (IVA incl.)` : ''}</div>
                    </div>
                    <div className="tw-text-2xl tw-font-extrabold tw-text-blue-800">€{totaleMensile.toFixed(2)}<span className="tw-text-sm tw-font-semibold">/mese</span></div>
                  </div>
                );
              })()}
              <div className="tw-p-3 tw-bg-slate-50 tw-rounded-xl">
                <div className="tw-text-xs tw-font-bold tw-text-slate-500 tw-uppercase tw-mb-1.5">Dettaglio contratto e costi una tantum</div>
                <div className="tw-text-sm"><span className="tw-font-semibold">Contratto:</span> {richiestaAperta.contrattoTipo === 'orario_non_convivente' ? 'Orario non convivente' : 'Convivente'}</div>
                <div className="tw-text-sm"><span className="tw-font-semibold">Livello:</span> {richiestaAperta.livello} — {LIVELLI_DESCRIZIONI[richiestaAperta.livello]}</div>
                {richiestaAperta.oreSettimanali ? <div className="tw-text-sm"><span className="tw-font-semibold">Ore settimanali:</span> {richiestaAperta.oreSettimanali}</div> : null}
                <div className="tw-text-sm"><span className="tw-font-semibold">Mesi contratto:</span> {richiestaAperta.mesiContratto}</div>
                {(() => {
                  const mesi = Number(richiestaAperta.mesiContratto) || 12;
                  const costoBadanteMensile = Number(richiestaAperta.costoMensile || 0);
                  const costoContrattoAnnuale = Math.round(costoBadanteMensile * mesi * 100) / 100;
                  const gaNetta = includiGestione ? Number(gestioneAmministrativa || 0) : 0;
                  const ivaGestioneMensile = Math.round(gaNetta * 0.22 * 100) / 100;
                  const gaLordaMensile = Math.round((gaNetta + ivaGestioneMensile) * 100) / 100;
                  const gaLordaAnnuale = Math.round(gaLordaMensile * mesi * 100) / 100;
                  const attivazione = 120;
                  const consulenza = 610;
                  const totaleUnaTantum = attivazione + consulenza;
                  return (
                    <>
                      <div className="tw-text-sm"><span className="tw-font-semibold">Costo contratto consigliato:</span> <Euro size={14} className="tw-inline" /> {costoContrattoAnnuale.toFixed(2)} ({mesi} mesi)</div>
                      {includiGestione && (
                        <div className="tw-text-sm"><span className="tw-font-semibold">Gestione amministrativa:</span> <Euro size={14} className="tw-inline" /> {gaLordaAnnuale.toFixed(2)} ({mesi} mesi - imponibile €{gaNetta.toFixed(2)}/mese + IVA €{ivaGestioneMensile.toFixed(2)}/mese)</div>
                      )}
                      <div className="tw-text-sm"><span className="tw-font-semibold">Attivazione contratto:</span> <Euro size={14} className="tw-inline" /> {attivazione.toFixed(2)} (una tantum)</div>
                      <div className="tw-text-sm"><span className="tw-font-semibold">Consulenza specialistica:</span> <Euro size={14} className="tw-inline" /> {consulenza.toFixed(2)} (imponibile €500,00 + IVA 22% €110,00)</div>
                      <div className="tw-text-sm tw-font-semibold tw-text-slate-700 tw-mt-1">Totale una tantum (pagato subito): <Euro size={14} className="tw-inline" /> {totaleUnaTantum.toFixed(2)}</div>
                    </>
                  );
                })()}
              </div>
              <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-cursor-pointer">
                <input
                  type="checkbox"
                  checked={includiGestione}
                  onChange={e => setIncludiGestione(e.target.checked)}
                  className="tw-w-4 tw-h-4 tw-accent-[#1e4d8c]"
                />
                <span className="tw-font-medium">Includi gestione amministrativa</span>
              </label>
              {includiGestione && (
                <label className="tw-flex tw-flex-col tw-gap-1">
                  <span className="tw-text-sm tw-font-medium">Gestione amministrativa mensile (imponibile, IVA 22% aggiunta in automatico)</span>
                  <input type="number" step="0.01" value={gestioneAmministrativa} onChange={e => setGestioneAmministrativa(e.target.value)} className="tw-border tw-rounded tw-p-2" />
                </label>
              )}
              <label className="tw-block">
                <span className="tw-text-sm tw-font-medium">Note preventivo</span>
                <textarea value={quoteNote} onChange={e => setQuoteNote(e.target.value)} rows={2} className="tw-w-full tw-border tw-rounded tw-p-2" />
              </label>
            </div>
            <div className="tw-flex tw-justify-end tw-gap-2">
              <Button size="sm" variant="secondary" onClick={() => setSelectedQuote(null)}>Annulla</Button>
              <Button size="sm" onClick={() => generaPreventivo(selectedQuote)} disabled={saving}>
                {saving ? 'Generazione...' : 'Genera preventivo'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
