import { useEffect, useState, FormEvent } from 'react';
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
  categoriaPrivata?: 'diagnostica' | 'assistenza_domiciliare' | 'intermediazione_badanti';
}

interface Preventivo {
  _id: string;
  numero: string;
  totale: number;
  stato: 'emesso' | 'firmato' | 'annullato';
}

interface Fattura {
  _id: string;
  numero: string;
  totale: number;
  stato: 'emesso' | 'firmato' | 'annullato';
}

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
  createdAt: string;
}

export default function BadantiIntermediazione() {
  const { user } = useAuth();
  const [richieste, setRichieste] = useState<Badante[]>([]);
  const [pazienti, setPazienti] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [patient, setPatient] = useState('');
  const [contrattoTipo, setContrattoTipo] = useState<'orario_non_convivente' | 'convivente'>('orario_non_convivente');
  const [livello, setLivello] = useState('A');
  const [oreSettimanali, setOreSettimanali] = useState('24');
  const [mesiContratto, setMesiContratto] = useState('12');
  const [note, setNote] = useState('');
  const [gestioneAmministrativa, setGestioneAmministrativa] = useState('');
  const [quoteNote, setQuoteNote] = useState('');

  const [selectedQuote, setSelectedQuote] = useState<string | null>(null);

  const isGestione = user?.role === 'admin' || user?.role === 'coordinator' || user?.role === 'direttore';

  useEffect(() => { caricaDati(); caricaPazienti(); }, []);

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
      const res = await api.get('/patients');
      const tutti = res.data?.patients || res.data || [];
      const badanti = (tutti as Patient[]).filter((p: Patient) => p.categoriaPrivata === 'intermediazione_badanti');
      setPazienti(badanti);
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
        gestioneAmministrativa: gestioneAmministrativa ? Number(gestioneAmministrativa) : 0,
        note: quoteNote,
      });
      setSelectedQuote(null);
      setGestioneAmministrativa('');
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

  if (loading) return <div className="tw-p-8 tw-text-slate-500">Caricamento...</div>;

  return (
    <section className="tw-p-6">
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-6">
        <h1 className="tw-text-2xl tw-font-bold tw-flex tw-items-center tw-gap-2">
          <Users size={26} /> Intermediazione Badanti
        </h1>
        {isGestione && (
          <Button onClick={() => setShowForm(s => !s)} className="tw-flex tw-items-center tw-gap-2">
            {showForm ? <X size={18} /> : <Plus size={18} />} Nuova richiesta
          </Button>
        )}
      </div>

      {showForm && (
        <form onSubmit={salvaRichiesta} className="tw-bg-white tw-rounded-lg tw-p-6 tw-shadow-sm tw-mb-6 tw-space-y-4">
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
                {['A', 'AS', 'B', 'BS', 'C', 'CS', 'D', 'DS'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
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
      )}

      <div className="tw-overflow-x-auto tw-bg-white tw-rounded-lg tw-shadow-sm">
        <table className="tw-w-full tw-text-sm">
          <thead className="tw-bg-slate-50 tw-text-left">
            <tr>
              <th className="tw-p-3">Paziente</th>
              <th className="tw-p-3">Contratto</th>
              <th className="tw-p-3">Costo mensile</th>
              <th className="tw-p-3">Stato</th>
              <th className="tw-p-3">Preventivo</th>
              <th className="tw-p-3">Fattura</th>
              <th className="tw-p-3 tw-text-right">Azioni</th>
            </tr>
          </thead>
          <tbody className="tw-divide-y">
            {richieste.map(r => {
              const preventivo = r.preventivoId && typeof r.preventivoId === 'object' ? r.preventivoId : undefined;
              const fattura = r.fatturaId && typeof r.fatturaId === 'object' ? r.fatturaId : undefined;
              const isOpen = selectedQuote === r._id;
              return (
                <tr key={r._id} className="tw-align-top">
                  <td className="tw-p-3">
                    <div className="tw-flex tw-items-center tw-gap-2">
                      <User size={16} className="tw-text-slate-400" />
                      {r.patient.firstName} {r.patient.lastName}
                    </div>
                    <div className="tw-text-xs tw-text-slate-500">{r.patient.codiceFiscale}</div>
                  </td>
                  <td className="tw-p-3">
                    <div className="tw-flex tw-items-center tw-gap-2">
                      <Briefcase size={16} className="tw-text-slate-400" />
                      {r.contrattoTipo === 'orario_non_convivente' ? 'Orario non convivente' : 'Convivente'}
                    </div>
                    <div className="tw-text-xs tw-text-slate-500">Livello {r.livello}</div>
                    {r.oreSettimanali ? <div className="tw-text-xs tw-text-slate-500">{r.oreSettimanali} h/sett</div> : null}
                    {r.mesiContratto ? <div className="tw-text-xs tw-text-slate-500">{r.mesiContratto} mesi</div> : null}
                  </td>
                  <td className="tw-p-3 tw-text-right tw-font-medium">
                    {r.costoMensile ? <><Euro size={12} className="tw-inline" /> {r.costoMensile.toFixed(2)}</> : '-'}
                  </td>
                  <td className="tw-p-3"><span className={statoBadge(r.stato)}>{r.stato.replace('_', ' ')}</span></td>
                  <td className="tw-p-3">
                    {preventivo ? (
                      <div>
                        <div className="tw-font-medium">{preventivo.numero}</div>
                        <div className="tw-text-xs tw-text-slate-500"><Euro size={12} className="tw-inline" /> {preventivo.totale.toFixed(2)} — {preventivo.stato}</div>
                      </div>
                    ) : '-'}
                  </td>
                  <td className="tw-p-3">
                    {fattura ? (
                      <div>
                        <div className="tw-font-medium">{fattura.numero}</div>
                        <div className="tw-text-xs tw-text-slate-500"><Euro size={12} className="tw-inline" /> {fattura.totale.toFixed(2)}</div>
                      </div>
                    ) : '-'}
                  </td>
                  <td className="tw-p-3 tw-text-right tw-space-x-2">
                    {isGestione && !preventivo && (
                      <Button size="sm" onClick={() => setSelectedQuote(isOpen ? null : r._id)}>
                        {isOpen ? 'Chiudi' : 'Genera preventivo'}
                      </Button>
                    )}
                    {isGestione && preventivo && preventivo.stato === 'emesso' && (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => scaricaPDF(preventivo)}>
                          <Download size={14} className="tw-inline" /> Stampa PDF
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => inviaFirma(preventivo)}>
                          <Mail size={14} className="tw-inline" /> Invia firma
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
                          <Download size={14} className="tw-inline" /> Stampa PDF
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => inviaFattura(fattura)}>
                          <Mail size={14} className="tw-inline" /> Invia fattura
                        </Button>
                      </>
                    )}
                    {isGestione && (
                      <button onClick={() => eliminaRichiesta(r._id)} className="tw-text-red-600 hover:tw-text-red-800" title="Elimina">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {richieste.length === 0 && (
              <tr>
                <td colSpan={7} className="tw-p-6 tw-text-center tw-text-slate-500">Nessuna richiesta di intermediazione badante.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedQuote && richiestaAperta && (
        <div className="tw-fixed tw-inset-0 tw-bg-black/40 tw-flex tw-items-center tw-justify-center tw-z-50 tw-p-4">
          <div className="tw-bg-white tw-rounded-lg tw-p-6 tw-w-full tw-max-w-2xl tw-max-h-[90vh] tw-overflow-y-auto">
            <h2 className="tw-text-lg tw-font-bold tw-mb-4 tw-flex tw-items-center tw-gap-2"><FileText size={20} /> Genera preventivo</h2>
            <div className="tw-space-y-3 tw-mb-4">
              <div className="tw-p-3 tw-bg-slate-50 tw-rounded">
                <div className="tw-text-sm"><span className="tw-font-semibold">Contratto:</span> {richiestaAperta.contrattoTipo === 'orario_non_convivente' ? 'Orario non convivente' : 'Convivente'}</div>
                <div className="tw-text-sm"><span className="tw-font-semibold">Livello:</span> {richiestaAperta.livello}</div>
                {richiestaAperta.oreSettimanali ? <div className="tw-text-sm"><span className="tw-font-semibold">Ore settimanali:</span> {richiestaAperta.oreSettimanali}</div> : null}
                <div className="tw-text-sm"><span className="tw-font-semibold">Mesi contratto:</span> {richiestaAperta.mesiContratto}</div>
                <div className="tw-text-sm"><span className="tw-font-semibold">Costo badante mensile:</span> <Euro size={14} className="tw-inline" /> {richiestaAperta.costoMensile?.toFixed(2) || '0.00'}</div>
                <div className="tw-text-sm"><span className="tw-font-semibold">Totale mensile (compreso gestione amministrativa):</span> <Euro size={14} className="tw-inline" /> {(Number(richiestaAperta.costoMensile || 0) + Number(gestioneAmministrativa || 0)).toFixed(2)}</div>
                <div className="tw-text-sm"><span className="tw-font-semibold">Totale annuale stimato:</span> <Euro size={14} className="tw-inline" /> {((Number(richiestaAperta.costoMensile || 0) + Number(gestioneAmministrativa || 0)) * 12).toFixed(2)}</div>
                <div className="tw-text-xs tw-text-slate-500 tw-mt-2">Voci una tantum incluse: registrazione contratto 120 € e spese reclutamento 500 € + IVA 22% (110 €).</div>
              </div>
              <label className="tw-flex tw-flex-col tw-gap-1">
                <span className="tw-text-sm tw-font-medium">Gestione amministrativa mensile</span>
                <input type="number" step="0.01" value={gestioneAmministrativa} onChange={e => setGestioneAmministrativa(e.target.value)} className="tw-border tw-rounded tw-p-2" />
              </label>
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
