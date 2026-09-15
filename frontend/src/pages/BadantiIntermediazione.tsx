import { useEffect, useState, FormEvent } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { Users, Plus, FileText, Mail, Trash2, Receipt, Check, X, User, Briefcase, Euro } from 'lucide-react';
import { Button } from '../components/ui/Button';

interface Patient {
  _id: string;
  firstName: string;
  lastName: string;
  codiceFiscale?: string;
  email?: string;
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
  tipoPiano: 'orario' | 'contratto_nazionale';
  oreSettimanali?: number;
  mesiContratto?: number;
  costoMensile?: number;
  tariffaOraria?: number;
  note?: string;
  stato: string;
  preventivoId?: Preventivo | string;
  fatturaId?: Fattura | string;
  createdAt: string;
}

interface VocePreventivo {
  descrizione: string;
  quantita: number;
  prezzoUnitario: number;
}

export default function BadantiIntermediazione() {
  const { user } = useAuth();
  const [richieste, setRichieste] = useState<Badante[]>([]);
  const [pazienti, setPazienti] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [patient, setPatient] = useState('');
  const [tipoPiano, setTipoPiano] = useState<'orario' | 'contratto_nazionale'>('orario');
  const [oreSettimanali, setOreSettimanali] = useState('');
  const [mesiContratto, setMesiContratto] = useState('');
  const [costoMensile, setCostoMensile] = useState('');
  const [tariffaOraria, setTariffaOraria] = useState('');
  const [note, setNote] = useState('');

  const [selectedQuote, setSelectedQuote] = useState<string | null>(null);
  const [voci, setVoci] = useState<VocePreventivo[]>([{ descrizione: '', quantita: 1, prezzoUnitario: 0 }]);
  const [quoteNote, setQuoteNote] = useState('');

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
      setPazienti(res.data?.patients || res.data || []);
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
        tipoPiano,
        oreSettimanali: oreSettimanali ? Number(oreSettimanali) : undefined,
        mesiContratto: mesiContratto ? Number(mesiContratto) : undefined,
        costoMensile: costoMensile ? Number(costoMensile) : undefined,
        tariffaOraria: tariffaOraria ? Number(tariffaOraria) : undefined,
        note,
      });
      setPatient('');
      setTipoPiano('orario');
      setOreSettimanali('');
      setMesiContratto('');
      setCostoMensile('');
      setTariffaOraria('');
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
    const vociValide = voci.filter(v => v.descrizione.trim());
    if (vociValide.length === 0) return alert('Inserisci almeno una voce');
    try {
      setSaving(true);
      await api.post(`/badanti-intermediazione/${id}/preventivo`, {
        prestazioni: vociValide,
        note: quoteNote,
      });
      setSelectedQuote(null);
      setVoci([{ descrizione: '', quantita: 1, prezzoUnitario: 0 }]);
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

  function aggiornaVoce(index: number, campo: keyof VocePreventivo, valore: string | number) {
    setVoci(prev => prev.map((v, i) => i === index ? { ...v, [campo]: valore } : v));
  }

  function aggiungiVoce() {
    setVoci(prev => [...prev, { descrizione: '', quantita: 1, prezzoUnitario: 0 }]);
  }

  function rimuoviVoce(index: number) {
    setVoci(prev => prev.filter((_, i) => i !== index));
  }

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
              <span className="tw-text-sm tw-font-medium">Tipo piano</span>
              <select value={tipoPiano} onChange={e => setTipoPiano(e.target.value as any)} className="tw-border tw-rounded tw-p-2">
                <option value="orario">Ad orario</option>
                <option value="contratto_nazionale">Contratto nazionale badanti</option>
              </select>
            </label>
            <label className="tw-flex tw-flex-col tw-gap-1">
              <span className="tw-text-sm tw-font-medium">Ore settimanali</span>
              <input type="number" value={oreSettimanali} onChange={e => setOreSettimanali(e.target.value)} className="tw-border tw-rounded tw-p-2" />
            </label>
            <label className="tw-flex tw-flex-col tw-gap-1">
              <span className="tw-text-sm tw-font-medium">Mesi contratto</span>
              <input type="number" value={mesiContratto} onChange={e => setMesiContratto(e.target.value)} className="tw-border tw-rounded tw-p-2" />
            </label>
            <label className="tw-flex tw-flex-col tw-gap-1">
              <span className="tw-text-sm tw-font-medium">Costo mensile</span>
              <input type="number" step="0.01" value={costoMensile} onChange={e => setCostoMensile(e.target.value)} className="tw-border tw-rounded tw-p-2" />
            </label>
            <label className="tw-flex tw-flex-col tw-gap-1">
              <span className="tw-text-sm tw-font-medium">Tariffa oraria</span>
              <input type="number" step="0.01" value={tariffaOraria} onChange={e => setTariffaOraria(e.target.value)} className="tw-border tw-rounded tw-p-2" />
            </label>
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
              <th className="tw-p-3">Piano</th>
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
                      {r.tipoPiano === 'orario' ? 'Ad orario' : 'Contratto nazionale'}
                    </div>
                    {r.oreSettimanali ? <div className="tw-text-xs tw-text-slate-500">{r.oreSettimanali} h/sett</div> : null}
                    {r.mesiContratto ? <div className="tw-text-xs tw-text-slate-500">{r.mesiContratto} mesi</div> : null}
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
                      <Button size="sm" variant="secondary" onClick={() => inviaFirma(preventivo)}>
                        <Mail size={14} className="tw-inline" /> Invia firma
                      </Button>
                    )}
                    {isGestione && preventivo?.stato === 'firmato' && !fattura && (
                      <Button size="sm" onClick={() => convertiInFattura(r._id)}>
                        <Receipt size={14} className="tw-inline" /> Fattura
                      </Button>
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
                <td colSpan={6} className="tw-p-6 tw-text-center tw-text-slate-500">Nessuna richiesta di intermediazione badante.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedQuote && (
        <div className="tw-fixed tw-inset-0 tw-bg-black/40 tw-flex tw-items-center tw-justify-center tw-z-50 tw-p-4">
          <div className="tw-bg-white tw-rounded-lg tw-p-6 tw-w-full tw-max-w-2xl tw-max-h-[90vh] tw-overflow-y-auto">
            <h2 className="tw-text-lg tw-font-bold tw-mb-4 tw-flex tw-items-center tw-gap-2"><FileText size={20} /> Voci del preventivo</h2>
            <div className="tw-space-y-3 tw-mb-4">
              {voci.map((v, i) => (
                <div key={i} className="tw-grid tw-grid-cols-12 tw-gap-2 tw-items-end">
                  <div className="tw-col-span-5">
                    <label className="tw-text-xs tw-font-medium">Descrizione</label>
                    <input value={v.descrizione} onChange={e => aggiornaVoce(i, 'descrizione', e.target.value)} className="tw-w-full tw-border tw-rounded tw-p-2" />
                  </div>
                  <div className="tw-col-span-2">
                    <label className="tw-text-xs tw-font-medium">Q.tà</label>
                    <input type="number" value={v.quantita} onChange={e => aggiornaVoce(i, 'quantita', Number(e.target.value))} className="tw-w-full tw-border tw-rounded tw-p-2" />
                  </div>
                  <div className="tw-col-span-3">
                    <label className="tw-text-xs tw-font-medium">Prezzo unitario</label>
                    <input type="number" step="0.01" value={v.prezzoUnitario} onChange={e => aggiornaVoce(i, 'prezzoUnitario', Number(e.target.value))} className="tw-w-full tw-border tw-rounded tw-p-2" />
                  </div>
                  <div className="tw-col-span-2 tw-text-right">
                    <button onClick={() => rimuoviVoce(i)} className="tw-text-red-600 hover:tw-text-red-800"><X size={18} /></button>
                  </div>
                </div>
              ))}
              <Button size="sm" variant="secondary" onClick={aggiungiVoce}>Aggiungi voce</Button>
            </div>
            <label className="tw-block tw-mb-4">
              <span className="tw-text-sm tw-font-medium">Note preventivo</span>
              <textarea value={quoteNote} onChange={e => setQuoteNote(e.target.value)} rows={2} className="tw-w-full tw-border tw-rounded tw-p-2" />
            </label>
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
