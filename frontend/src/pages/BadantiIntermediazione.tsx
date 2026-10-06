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

interface Badante {
  _id: string;
  patient: Patient;
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

  async function scaricaPDF(doc: { _id: string; numero: string }) {
    try {
      const res = await api.get(`/fatturazione-documenti/${doc._id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.numero}.pdf`;
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
              <h1 className="tw-text-2xl tw-font-bold tw-text-slate-800">Consulenza famiglie</h1>
              <p className="tw-text-slate-500 tw-text-sm tw-m-0">Gestione richieste, preventivi e fatture — solo pazienti privati</p>
            </div>
          </div>
          {isGestione && (
            <Button onClick={() => setShowForm(s => !s)} className="tw-flex tw-items-center tw-gap-2">
              {showForm ? <X size={18} /> : <Plus size={18} />} Nuova richiesta
            </Button>
          )}
        </div>

        {showForm && (
          <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-slate-100 tw-shadow-sm tw-p-5 md:tw-p-6">
            <h2 className="tw-text-lg tw-font-semibold tw-mb-4 tw-text-slate-700">Nuova richiesta</h2>
            <form onSubmit={salvaRichiesta} className="tw-space-y-4">
              <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
                <label className="tw-flex tw-flex-col tw-gap-1">
                  <span className="tw-text-sm tw-font-medium">Paziente</span>
                  <select value={patient} onChange={e => setPatient(e.target.value)} className="tw-border tw-rounded tw-p-2" required>
                    <option value="">Seleziona...</option>
                    {pazienti.map(p => (
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
              Nessuna richiesta di Consulenza famiglie.
            </div>
          ) : (
            <div className="tw-flex tw-flex-col tw-gap-3">
              {richieste.map(r => {
                const preventivo = r.preventivoId && typeof r.preventivoId === 'object' ? r.preventivoId : undefined;
                const fattura = r.fatturaId && typeof r.fatturaId === 'object' ? r.fatturaId : undefined;
                const isOpen = selectedQuote === r._id;
                return (
                  <div key={r._id} className="tw-bg-white tw-rounded-xl tw-overflow-hidden tw-border tw-border-rose-100 tw-shadow-sm hover:tw-shadow-md tw-transition-shadow tw-border-l-4 tw-border-l-rose-600">
                    <div className="tw-p-4">
                      <div className="tw-flex tw-flex-wrap tw-justify-between tw-items-start tw-gap-4">
                        <div className="tw-flex-1 tw-min-w-[240px]">
                          <div className="tw-flex tw-items-center tw-flex-wrap tw-gap-2 tw-mb-1">
                            <User size={18} className="tw-text-rose-600" />
                            <strong className="tw-text-[1.05rem] tw-text-slate-800">{r.patient.firstName} {r.patient.lastName}</strong>
                            <span className="tw-text-xs tw-px-2 tw-py-0.5 tw-rounded-full tw-bg-slate-100 tw-text-slate-600 tw-font-medium">{r.patient.codiceFiscale || ''}</span>
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
