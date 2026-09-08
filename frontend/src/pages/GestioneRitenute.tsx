import { useEffect, useMemo, useState } from 'react';
import api from '../api/api';
import { Euro, Plus, Save, Mail, Download, Trash2, X, FileText } from 'lucide-react';

interface StaffMember {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
  codiceFiscale?: string;
  partitaIva?: string;
  indirizzoResidenza?: string;
  cittaResidenza?: string;
  professionista?: boolean;
}

interface Ritenuta {
  _id: string;
  numero: string;
  data: string;
  professionistaId?: string;
  datiProfessionista: {
    firstName: string;
    lastName: string;
    email?: string;
    codiceFiscale?: string;
    partitaIva?: string;
    indirizzo?: string;
    citta?: string;
  };
  descrizione?: string;
  importoLordo: number;
  percentualeRitenuta: number;
  importoRitenuta: number;
  importoBollo: number;
  nettoAPagare: number;
  numeroDocumentoProfessionista?: string;
  stato: 'emesso' | 'firmato' | 'annullato';
  firma?: { email?: string };
}

const INITIAL_DATI = {
  firstName: '',
  lastName: '',
  codiceFiscale: '',
  partitaIva: '',
  indirizzo: '',
  citta: '',
  email: '',
};

export default function GestioneRitenute() {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [ritenute, setRitenute] = useState<Ritenuta[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [professionistaId, setProfessionistaId] = useState('');
  const [dati, setDati] = useState(INITIAL_DATI);
  const [descrizione, setDescrizione] = useState('');
  const [importoLordo, setImportoLordo] = useState<string>('');
  const [percentuale, setPercentuale] = useState<string>('20');
  const [bollo, setBollo] = useState<string>('0');
  const [numeroDocumento, setNumeroDocumento] = useState('');

  useEffect(() => {
    caricaStaff();
    caricaRitenute();
  }, []);

  const caricaStaff = async () => {
    try {
      const res = await api.get('/staff');
      setStaffList(res.data || []);
    } catch (err) {
      console.error('Errore caricamento staff', err);
    }
  };

  const caricaRitenute = async () => {
    setLoading(true);
    try {
      const res = await api.get('/ritenute-acconto');
      setRitenute(res.data || []);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore caricamento ritenute');
    } finally {
      setLoading(false);
    }
  };

  const calcoli = useMemo(() => {
    const lordo = Number(importoLordo) || 0;
    const perc = Number(percentuale) || 0;
    const b = Number(bollo) || 0;
    const ritenuta = Math.round(lordo * (perc / 100) * 100) / 100;
    const netto = Math.round((lordo - ritenuta + b) * 100) / 100;
    return { ritenuta, netto };
  }, [importoLordo, percentuale, bollo]);

  const onSelezionaProfessionista = (id: string) => {
    setProfessionistaId(id);
    if (!id) {
      setDati(INITIAL_DATI);
      return;
    }
    const s = staffList.find((x) => x._id === id);
    if (!s) return;
    setDati({
      firstName: s.firstName || '',
      lastName: s.lastName || '',
      codiceFiscale: s.codiceFiscale || '',
      partitaIva: s.partitaIva || '',
      indirizzo: s.indirizzoResidenza || '',
      citta: s.cittaResidenza || '',
      email: s.email || '',
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setProfessionistaId('');
    setDati(INITIAL_DATI);
    setDescrizione('');
    setImportoLordo('');
    setPercentuale('20');
    setBollo('0');
    setNumeroDocumento('');
  };

  const salva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dati.firstName || !dati.lastName || Number(importoLordo) <= 0) {
      alert('Nome, cognome e importo lordo sono obbligatori');
      return;
    }
    const payload = {
      professionistaId: professionistaId || undefined,
      datiProfessionista: dati,
      descrizione,
      importoLordo: Number(importoLordo),
      percentualeRitenuta: Number(percentuale),
      importoBollo: Number(bollo),
      numeroDocumentoProfessionista: numeroDocumento,
    };
    try {
      if (editingId) {
        await api.put(`/ritenute-acconto/${editingId}`, payload);
      } else {
        await api.post('/ritenute-acconto', payload);
      }
      resetForm();
      await caricaRitenute();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore salvataggio');
    }
  };

  const inviaFirma = async (r: Ritenuta) => {
    const email = r.datiProfessionista?.email || window.prompt('Email del professionista');
    if (!email) return;
    try {
      await api.post(`/ritenute-acconto/${r._id}/invia-email`, { email });
      alert('Email inviata');
      await caricaRitenute();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Errore invio email");
    }
  };

  const scaricaPdf = async (r: Ritenuta, firmato = false) => {
    try {
      const res = await api.get(`/ritenute-acconto/${r._id}/${firmato ? 'firmato' : 'pdf'}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RITENUTA-${r.numero}${firmato ? '-firmata' : ''}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore download PDF');
    }
  };

  const annulla = async (r: Ritenuta) => {
    if (!window.confirm('Annullare questa ritenuta?')) return;
    try {
      await api.patch(`/ritenute-acconto/${r._id}/annulla`);
      await caricaRitenute();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore annullamento');
    }
  };

  const elimina = async (r: Ritenuta) => {
    if (!window.confirm('Eliminare definitivamente questa ritenuta?')) return;
    try {
      await api.delete(`/ritenute-acconto/${r._id}`);
      await caricaRitenute();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore eliminazione');
    }
  };

  const modifica = (r: Ritenuta) => {
    if (r.stato !== 'emesso') {
      alert('Solo le ritenute emesse possono essere modificate');
      return;
    }
    setEditingId(r._id);
    setProfessionistaId(r.professionistaId || '');
    setDati(r.datiProfessionista as any);
    setDescrizione(r.descrizione || '');
    setImportoLordo(String(r.importoLordo));
    setPercentuale(String(r.percentualeRitenuta ?? 20));
    setBollo(String(r.importoBollo));
    setNumeroDocumento(r.numeroDocumentoProfessionista || '');
  };

  const formatEuro = (n: number) => `€${(Number(n) || 0).toFixed(2)}`;

  return (
    <div className="tw-p-6 tw-max-w-6xl tw-mx-auto">
      <h1 className="tw-text-2xl tw-font-bold tw-text-slate-800 tw-mb-6 tw-flex tw-items-center tw-gap-2">
        <Euro /> Ritenute d'acconto professionisti
      </h1>

      <form onSubmit={salva} className="tw-bg-white tw-rounded-xl tw-p-6 tw-shadow-sm tw-mb-8">
        <h2 className="tw-text-lg tw-font-semibold tw-mb-4 tw-flex tw-items-center tw-gap-2">
          <FileText size={18} /> {editingId ? 'Modifica ritenuta' : 'Nuova ritenuta'}
        </h2>

        <div className="tw-mb-4">
          <label className="tw-block tw-text-sm tw-font-medium tw-text-slate-700 tw-mb-1">Professionista registrato</label>
          <select
            value={professionistaId}
            onChange={(e) => onSelezionaProfessionista(e.target.value)}
            className="tw-w-full tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200"
          >
            <option value="">Seleziona o compila manualmente</option>
            {staffList.map((s) => (
              <option key={s._id} value={s._id}>
                {s.firstName} {s.lastName} {s.professionista ? '(professionista)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4 tw-mb-4">
          <input required value={dati.firstName} onChange={(e) => setDati({ ...dati, firstName: e.target.value })} placeholder="Nome" className="tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200" />
          <input required value={dati.lastName} onChange={(e) => setDati({ ...dati, lastName: e.target.value })} placeholder="Cognome" className="tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200" />
          <input value={dati.codiceFiscale} onChange={(e) => setDati({ ...dati, codiceFiscale: e.target.value })} placeholder="Codice Fiscale" className="tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200" />
          <input value={dati.partitaIva} onChange={(e) => setDati({ ...dati, partitaIva: e.target.value })} placeholder="Partita IVA" className="tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200" />
          <input value={dati.indirizzo} onChange={(e) => setDati({ ...dati, indirizzo: e.target.value })} placeholder="Indirizzo" className="tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200" />
          <input value={dati.citta} onChange={(e) => setDati({ ...dati, citta: e.target.value })} placeholder="Città" className="tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200" />
          <input value={dati.email} onChange={(e) => setDati({ ...dati, email: e.target.value })} placeholder="Email" type="email" className="tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200" />
        </div>

        <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4 tw-mb-4">
          <div>
            <label className="tw-block tw-text-sm tw-font-medium tw-text-slate-700 tw-mb-1">Compenso / importo lordo</label>
            <input required type="number" min="0" step="0.01" value={importoLordo} onChange={(e) => setImportoLordo(e.target.value)} className="tw-w-full tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200" />
          </div>
          <div>
            <label className="tw-block tw-text-sm tw-font-medium tw-text-slate-700 tw-mb-1">% Ritenuta d'acconto</label>
            <input type="number" min="0" step="0.01" value={percentuale} onChange={(e) => setPercentuale(e.target.value)} className="tw-w-full tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200" />
          </div>
          <div>
            <label className="tw-block tw-text-sm tw-font-medium tw-text-slate-700 tw-mb-1">Importo bollo</label>
            <input type="number" min="0" step="0.01" value={bollo} onChange={(e) => setBollo(e.target.value)} className="tw-w-full tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200" />
          </div>
          <div>
            <label className="tw-block tw-text-sm tw-font-medium tw-text-slate-700 tw-mb-1">Numero documento professionista</label>
            <input value={numeroDocumento} onChange={(e) => setNumeroDocumento(e.target.value)} placeholder="es. Fatt. 5/2026" className="tw-w-full tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200" />
          </div>
        </div>

        <div className="tw-flex tw-items-center tw-gap-6 tw-mb-4 tw-p-4 tw-bg-slate-50 tw-rounded-lg">
          <div><span className="tw-text-sm tw-text-slate-500">Ritenuta</span> <div className="tw-font-bold tw-text-slate-800">{formatEuro(calcoli.ritenuta)}</div></div>
          <div><span className="tw-text-sm tw-text-slate-500">Netto a pagare</span> <div className="tw-font-bold tw-text-teal-700">{formatEuro(calcoli.netto)}</div></div>
        </div>

        <div className="tw-mb-4">
          <label className="tw-block tw-text-sm tw-font-medium tw-text-slate-700 tw-mb-1">Causale / descrizione</label>
          <textarea value={descrizione} onChange={(e) => setDescrizione(e.target.value)} rows={2} className="tw-w-full tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200" />
        </div>

        <div className="tw-flex tw-gap-3">
          <button type="submit" className="tw-flex tw-items-center tw-gap-2 tw-px-4 tw-py-2 tw-bg-teal-600 hover:tw-bg-teal-700 tw-text-white tw-rounded-lg tw-font-semibold">
            <Save size={18} /> {editingId ? 'Aggiorna' : 'Salva'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="tw-flex tw-items-center tw-gap-2 tw-px-4 tw-py-2 tw-bg-slate-200 hover:tw-bg-slate-300 tw-text-slate-700 tw-rounded-lg">
              <X size={18} /> Annulla modifica
            </button>
          )}
        </div>
      </form>

      <div className="tw-bg-white tw-rounded-xl tw-shadow-sm tw-overflow-hidden">
        <h2 className="tw-text-lg tw-font-semibold tw-p-4 tw-border-b tw-flex tw-items-center tw-gap-2">
          <Plus size={18} /> Ritenute create
        </h2>
        {loading ? (
          <div className="tw-p-6 tw-text-center tw-text-slate-500">Caricamento...</div>
        ) : (
          <table className="tw-w-full tw-text-sm">
            <thead className="tw-bg-slate-100">
              <tr>
                <th className="tw-text-left tw-p-3">Numero</th>
                <th className="tw-text-left tw-p-3">Professionista</th>
                <th className="tw-text-left tw-p-3">Lordo</th>
                <th className="tw-text-left tw-p-3">Ritenuta</th>
                <th className="tw-text-left tw-p-3">Netto</th>
                <th className="tw-text-left tw-p-3">Stato</th>
                <th className="tw-text-left tw-p-3">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {ritenute.map((r) => (
                <tr key={r._id} className="tw-border-b hover:tw-bg-slate-50">
                  <td className="tw-p-3 tw-font-mono">{r.numero}</td>
                  <td className="tw-p-3">{r.datiProfessionista.firstName} {r.datiProfessionista.lastName}</td>
                  <td className="tw-p-3">{formatEuro(r.importoLordo)}</td>
                  <td className="tw-p-3">{formatEuro(r.importoRitenuta)}</td>
                  <td className="tw-p-3 tw-font-semibold">{formatEuro(r.nettoAPagare)}</td>
                  <td className="tw-p-3"><span className={`tw-px-2 tw-py-1 tw-rounded tw-text-xs tw-font-semibold ${r.stato === 'firmato' ? 'tw-bg-green-100 tw-text-green-700' : r.stato === 'annullato' ? 'tw-bg-red-100 tw-text-red-700' : 'tw-bg-blue-100 tw-text-blue-700'}`}>{r.stato}</span></td>
                  <td className="tw-p-3 tw-flex tw-gap-2 tw-flex-wrap">
                    {r.stato === 'emesso' && (
                      <>
                        <button onClick={() => modifica(r)} title="Modifica" className="tw-p-1.5 tw-text-slate-600 hover:tw-bg-slate-200 tw-rounded">Modifica</button>
                        <button onClick={() => inviaFirma(r)} title="Invia per firma" className="tw-p-1.5 tw-text-slate-600 hover:tw-bg-slate-200 tw-rounded tw-flex tw-items-center tw-gap-1"><Mail size={16} />Invia</button>
                        <button onClick={() => annulla(r)} title="Annulla" className="tw-p-1.5 tw-text-red-600 hover:tw-bg-red-50 tw-rounded">Annulla</button>
                      </>
                    )}
                    <button onClick={() => scaricaPdf(r)} title="PDF" className="tw-p-1.5 tw-text-slate-600 hover:tw-bg-slate-200 tw-rounded tw-flex tw-items-center tw-gap-1"><Download size={16} />PDF</button>
                    {r.stato === 'firmato' && (
                      <button onClick={() => scaricaPdf(r, true)} title="PDF firmato" className="tw-p-1.5 tw-text-green-600 hover:tw-bg-green-50 tw-rounded tw-flex tw-items-center tw-gap-1"><Download size={16} />Firmata</button>
                    )}
                    <button onClick={() => elimina(r)} title="Elimina" className="tw-p-1.5 tw-text-red-600 hover:tw-bg-red-50 tw-rounded"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
