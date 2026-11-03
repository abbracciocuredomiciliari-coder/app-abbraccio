import { useState } from 'react';
import api from '../api/api';
import { Plus, Trash2, FileText, Mail } from 'lucide-react';

interface Riga { descrizione: string; quantita: number; prezzoUnitario: number; }

export default function PreventivoVeloce() {
  const [righe, setRighe] = useState<Riga[]>([{ descrizione: '', quantita: 1, prezzoUnitario: 0 }]);
  const [note, setNote] = useState('');
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (i: number, k: keyof Riga, v: any) => setRighe(rs => rs.map((r, j) => j === i ? { ...r, [k]: v } : r));
  const totale = righe.reduce((a, r) => a + (r.quantita || 0) * (r.prezzoUnitario || 0), 0);
  const body = () => ({
    prestazioni: righe.filter(r => r.descrizione.trim() && r.prezzoUnitario > 0)
      .map(r => ({ descrizione: r.descrizione.trim(), quantita: r.quantita, prezzoUnitario: r.prezzoUnitario, importo: r.quantita * r.prezzoUnitario })),
    note: note.trim() || undefined,
  });

  async function scaricaPdf() {
    setErr(''); setBusy(true);
    try {
      const res = await api.post('/preventivo-veloce/pdf', body(), { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'preventivo.pdf';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMsg('PDF scaricato.');
    } catch (e: any) { setErr(e?.response?.data?.message || 'Errore nella generazione del PDF'); }
    finally { setBusy(false); }
  }

  async function inviaEmail() {
    if (!email.trim()) { setErr('Inserisci l\'email del destinatario'); return; }
    setErr(''); setBusy(true);
    try {
      await api.post('/preventivo-veloce/email', { ...body(), emailDestinatario: email.trim() });
      setMsg(`Preventivo inviato a ${email}.`);
    } catch (e: any) { setErr(e?.response?.data?.message || 'Errore nell\'invio'); }
    finally { setBusy(false); }
  }

  const inp = 'tw-w-full tw-px-3 tw-py-2 tw-border tw-border-slate-300 tw-rounded-lg tw-text-sm';

  return (
    <div className="tw-p-4 tw-max-w-3xl tw-mx-auto">
      <h1 className="tw-text-xl tw-font-bold tw-text-slate-800">Preventivo veloce</h1>
      <p className="tw-text-sm tw-text-slate-500 tw-mb-5">Genera al volo un preventivo PDF da scaricare o inviare via email</p>

      <div className="tw-bg-white tw-rounded-xl tw-border tw-border-slate-200 tw-shadow-sm tw-p-4">
        <div className="tw-hidden sm:tw-grid tw-grid-cols-[1fr_90px_110px_36px] tw-gap-2 tw-text-[0.7rem] tw-font-bold tw-text-slate-500 tw-px-1 tw-mb-1">
          <span>Prestazione</span><span>Quantità</span><span>Prezzo €</span><span></span>
        </div>
        {righe.map((r, i) => (
          <div key={i} className="tw-flex tw-flex-wrap sm:tw-grid sm:tw-grid-cols-[1fr_90px_110px_36px] tw-gap-2 tw-items-center tw-mb-2">
            <input className={inp} placeholder="Descrizione prestazione" value={r.descrizione} onChange={e => set(i, 'descrizione', e.target.value)} />
            <input className={inp} type="number" min={1} value={r.quantita} onChange={e => set(i, 'quantita', Number(e.target.value) || 1)} />
            <input className={inp} type="number" min={0} step="0.01" value={r.prezzoUnitario || ''} onChange={e => set(i, 'prezzoUnitario', Number(e.target.value) || 0)} placeholder="0.00" />
            <button onClick={() => setRighe(rs => rs.filter((_, j) => j !== i))} disabled={righe.length === 1}
              className="tw-p-2 tw-rounded-lg tw-text-red-500 hover:tw-bg-red-50 disabled:tw-opacity-30"><Trash2 size={16} /></button>
          </div>
        ))}
        <button onClick={() => setRighe(rs => [...rs, { descrizione: '', quantita: 1, prezzoUnitario: 0 }])}
          className="tw-flex tw-items-center tw-gap-1 tw-text-sm tw-font-bold tw-text-blue-800 tw-mt-1"><Plus size={15} /> Aggiungi voce</button>

        <div className="tw-flex tw-justify-end tw-mt-4 tw-text-lg tw-font-extrabold tw-text-slate-800">
          Totale: € {totale.toFixed(2)}
        </div>

        <textarea className={`${inp} tw-mt-3`} rows={2} placeholder="Note (facoltative): validità, condizioni..." value={note} onChange={e => setNote(e.target.value)} />

        <div className="tw-flex tw-flex-wrap tw-gap-2 tw-mt-4">
          <button onClick={scaricaPdf} disabled={busy}
            className="tw-flex-1 tw-min-w-[160px] tw-px-4 tw-py-2.5 tw-rounded-lg tw-bg-blue-800 tw-text-white tw-font-bold tw-flex tw-items-center tw-justify-center tw-gap-2">
            <FileText size={16} /> Scarica PDF
          </button>
          <div className="tw-flex tw-flex-1 tw-min-w-[220px] tw-gap-2">
            <input className={inp} type="email" placeholder="email destinatario" value={email} onChange={e => setEmail(e.target.value)} />
            <button onClick={inviaEmail} disabled={busy}
              className="tw-px-4 tw-py-2.5 tw-rounded-lg tw-bg-emerald-700 tw-text-white tw-font-bold tw-flex tw-items-center tw-gap-2"><Mail size={16} /> Invia</button>
          </div>
        </div>
        {msg && <p className="tw-text-emerald-700 tw-text-sm tw-mt-3 tw-font-semibold">✓ {msg}</p>}
        {err && <p className="tw-text-red-600 tw-text-sm tw-mt-3">{err}</p>}
      </div>
    </div>
  );
}
