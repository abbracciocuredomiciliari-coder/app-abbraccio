import { useEffect, useRef, useState } from 'react';
import api from '../api/api';
import { Globe, Image as ImageIcon, Video, ShoppingBag, Plus, Trash2, Save, RotateCcw, Upload, ExternalLink, X, Pencil, Star, MessageSquareQuote } from 'lucide-react';
import { Button } from '../components/ui/Button';

// ═════════════════════════════════════════════════════════════════════════════
// SITI WEB E SHOP — area riservata per modificare i contenuti dei tre siti
// pubblici (foto e video dell'hero, titolo, sottotitolo) e il catalogo shop.
// I siti leggono tutto da GET /api/public: le modifiche sono visibili entro
// circa un minuto (cache breve), senza nuovo deploy.
// ═════════════════════════════════════════════════════════════════════════════

type SiteId = 'main' | 'family' | 'shop';
interface SiteDoc { site: SiteId; title: string; subtitle: string; photo: string; video: string; contenuti?: { chiave: string; tipo: 'testo' | 'foto' | 'video'; valore: string; label?: string }[]; updatedByName?: string; updatedAt?: string; storico?: { at: string; by?: string; campo: string; valore: string }[] }
interface Recensione { _id: string; site: SiteId; nome: string; ruolo?: string; rating: number; testo: string; approvato: boolean; ordine: number }
interface Prodotto {
  _id: string; nome: string; descrizione: string; categoria: 'vendita' | 'noleggio'; sezione?: string;
  prezzo?: number; prezzoScontato?: number; inOfferta?: boolean;
  prezzoNoleggio?: { giorno?: number; settimana?: number; mese?: number };
  cauzione?: number; disponibile: boolean; attivo: boolean; ordine: number; immagini: string[]; badge?: string;
}

const SITI: { id: SiteId; nome: string; url: string }[] = [
  { id: 'main', nome: 'Sito principale', url: 'https://www.abbracciocuredomiciliari.it' },
  { id: 'family', nome: 'Abbraccio Famiglia', url: 'https://famiglia.abbracciocuredomiciliari.it' },
  { id: 'shop', nome: 'Shop e noleggio', url: 'https://shop.abbracciocuredomiciliari.it' },
];
const SEZIONI = ['Mobilità', 'Riposo e comfort', 'Elettromedicali', 'Cura quotidiana'];
const ORIGIN = String(api.defaults.baseURL || '').replace(/\/api\/?$/, '');
const media = (u: string) => (u && u.startsWith('/') ? ORIGIN + u : u);
const eur = (n?: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n || 0);
const errMsg = (e: any) => e?.response?.data?.message || e?.message || 'Operazione non riuscita';
const input = 'tw-w-full tw-border tw-border-slate-300 tw-rounded-md tw-px-3 tw-py-2 tw-text-sm tw-bg-white';
const label = 'tw-block tw-text-xs tw-font-bold tw-text-slate-600 tw-mb-1';
const vuoto: Omit<Prodotto, '_id'> = { nome: '', descrizione: '', categoria: 'vendita', sezione: SEZIONI[0], prezzo: 0, prezzoScontato: 0, inOfferta: false, prezzoNoleggio: { giorno: 0, settimana: 0, mese: 0 }, cauzione: 0, disponibile: true, attivo: true, ordine: 0, immagini: [], badge: '' };

export default function SitiWeb() {
  const [tab, setTab] = useState<'siti' | 'recensioni' | 'shop'>('siti');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const flash = (ok: boolean, t: string) => { setMsg({ ok, t }); setTimeout(() => setMsg(null), 5000); };

  return (
    <div className="page-container tw-p-5">
      <div className="tw-mb-5">
        <h1 className="tw-flex tw-items-center tw-gap-2 tw-text-slate-800 tw-m-0 tw-text-2xl tw-font-extrabold"><Globe size={26} /> Siti web e Shop</h1>
        <p className="tw-text-slate-500 tw-text-sm tw-mt-1.5 tw-mb-0">
          Modifica foto, video e testi principali dei tre siti e gestisci il catalogo dello shop. Le modifiche compaiono sui siti entro circa un minuto.
        </p>
      </div>
      <div className="tw-flex tw-gap-2 tw-mb-4">
        <Button variant={tab === 'siti' ? 'primary' : 'secondary'} icon={<ImageIcon size={16} />} onClick={() => setTab('siti')}>Contenuti dei siti</Button>
        <Button variant={tab === 'recensioni' ? 'primary' : 'secondary'} icon={<Star size={16} />} onClick={() => setTab('recensioni')}>Recensioni</Button>
        <Button variant={tab === 'shop' ? 'primary' : 'secondary'} icon={<ShoppingBag size={16} />} onClick={() => setTab('shop')}>Prodotti shop</Button>
      </div>
      {msg && <div className={`tw-mb-4 tw-rounded-md tw-px-4 tw-py-2 tw-text-sm tw-font-semibold ${msg.ok ? 'tw-bg-emerald-50 tw-text-emerald-800 tw-border tw-border-emerald-200' : 'tw-bg-red-50 tw-text-red-700 tw-border tw-border-red-200'}`}>{msg.t}</div>}
      {tab === 'siti' ? <Contenuti flash={flash} /> : tab === 'recensioni' ? <Recensioni flash={flash} /> : <Prodotti flash={flash} />}
    </div>
  );
}

// ─── CONTENUTI DEI SITI ──────────────────────────────────────────────────────
function Contenuti({ flash }: { flash: (ok: boolean, t: string) => void }) {
  const [docs, setDocs] = useState<SiteDoc[]>([]);
  const [busy, setBusy] = useState<string>('');
  const load = () => api.get('/siti-admin/contenuti').then(r => setDocs(r.data)).catch(e => flash(false, errMsg(e)));
  useEffect(() => { load(); }, []);
  const upd = (d: SiteDoc) => setDocs(ds => ds.map(x => (x.site === d.site ? { ...x, ...d } : x)));

  async function salvaTesti(d: SiteDoc) {
    setBusy(d.site + 't');
    try { await api.put(`/siti-admin/contenuti/${d.site}`, { title: d.title, subtitle: d.subtitle }); flash(true, 'Testi salvati.'); load(); }
    catch (e) { flash(false, errMsg(e)); } finally { setBusy(''); }
  }
  async function carica(site: SiteId, file: File, tipo: 'photo' | 'video') {
    if (tipo === 'video' && !file.type.startsWith('video/')) return flash(false, 'Scegli un file video (MP4).');
    if (tipo === 'photo' && !file.type.startsWith('image/')) return flash(false, 'Scegli una foto (JPG, PNG o WEBP).');
    if (file.size > 24 * 1024 * 1024) return flash(false, 'File troppo grande: massimo 24 MB.');
    setBusy(site + tipo);
    try {
      const fd = new FormData(); fd.append('file', file);
      await api.post(`/siti-admin/contenuti/${site}/media`, fd, { timeout: 300000 });
      flash(true, tipo === 'video' ? 'Video caricato.' : 'Foto caricata.'); load();
    } catch (e) { flash(false, errMsg(e)); } finally { setBusy(''); }
  }
  async function ripristina(site: SiteId, campo: 'photo' | 'video') {
    if (!confirm('Ripristinare ' + (campo === 'video' ? 'il video' : 'la foto') + ' originale del sito?')) return;
    try { await api.delete(`/siti-admin/contenuti/${site}/media/${campo}`); flash(true, 'Originale ripristinato.'); load(); }
    catch (e) { flash(false, errMsg(e)); }
  }

  return (
    <div className="tw-grid tw-gap-4">
      {SITI.map(s => {
        const d = docs.find(x => x.site === s.id) || { site: s.id, title: '', subtitle: '', photo: '', video: '' };
        return (
          <section key={s.id} className="tw-bg-white tw-border tw-border-slate-200 tw-rounded-xl tw-p-4">
            <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-2 tw-mb-3">
              <h2 className="tw-m-0 tw-text-lg tw-font-extrabold tw-text-slate-800">{s.nome}</h2>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="tw-text-sm tw-font-semibold tw-text-sky-700 tw-flex tw-items-center tw-gap-1">Apri il sito <ExternalLink size={14} /></a>
            </div>
            <div className="tw-grid md:tw-grid-cols-3 tw-gap-4">
              <div>
                <span className={label}>Foto principale (hero)</span>
                <div className="tw-aspect-video tw-bg-slate-100 tw-rounded-md tw-overflow-hidden tw-flex tw-items-center tw-justify-center tw-text-xs tw-text-slate-500 tw-mb-2">
                  {d.photo ? <img src={media(d.photo)} alt="" className="tw-w-full tw-h-full tw-object-cover" /> : 'Foto originale del sito'}
                </div>
                <FileBtn accept="image/jpeg,image/png,image/webp" busy={busy === s.id + 'photo'} onFile={f => carica(s.id, f, 'photo')} icon={<ImageIcon size={15} />}>Cambia foto</FileBtn>
                {d.photo && <button className="tw-ml-2 tw-text-xs tw-text-slate-500 tw-underline" onClick={() => ripristina(s.id, 'photo')}>Ripristina originale</button>}
              </div>
              {s.id !== 'shop' ? (
                <div>
                  <span className={label}>Video principale (hero)</span>
                  <div className="tw-aspect-video tw-bg-slate-900 tw-rounded-md tw-overflow-hidden tw-flex tw-items-center tw-justify-center tw-text-xs tw-text-slate-300 tw-mb-2">
                    {d.video ? <video src={media(d.video)} muted controls playsInline className="tw-w-full tw-h-full tw-object-contain" /> : 'Video originale del sito'}
                  </div>
                  <FileBtn accept="video/mp4,video/webm,video/quicktime" busy={busy === s.id + 'video'} onFile={f => carica(s.id, f, 'video')} icon={<Video size={15} />}>Cambia video</FileBtn>
                  {d.video && <button className="tw-ml-2 tw-text-xs tw-text-slate-500 tw-underline" onClick={() => ripristina(s.id, 'video')}>Ripristina originale</button>}
                  <p className="tw-text-xs tw-text-slate-500 tw-mt-1 tw-mb-0">MP4 verticale consigliato, massimo 24 MB.</p>
                </div>
              ) : <div className="tw-text-xs tw-text-slate-500 tw-self-center">Lo shop non ha video nell'hero.</div>}
              <div>
                <label className={label}>Titolo (vuoto = originale)</label>
                <input className={input} maxLength={120} value={d.title} onChange={e => upd({ ...d, title: e.target.value })} placeholder="Es. La cura, dove sei tu." />
                <label className={label + ' tw-mt-3'}>Sottotitolo (vuoto = originale)</label>
                <textarea className={input} rows={3} maxLength={300} value={d.subtitle} onChange={e => upd({ ...d, subtitle: e.target.value })} />
                <div className="tw-mt-2"><Button size="sm" icon={<Save size={15} />} loading={busy === s.id + 't'} onClick={() => salvaTesti(d)}>Salva testi</Button></div>
              </div>
            </div>
            {d.updatedByName && <p className="tw-text-xs tw-text-slate-400 tw-mt-3 tw-mb-0">Ultima modifica: {d.updatedByName}{d.updatedAt ? ' · ' + new Date(d.updatedAt).toLocaleString('it-IT') : ''}</p>}
            <BlocchiEditor site={s.id} items={d.contenuti || []} flash={flash} onSaved={load} />
          </section>
        );
      })}
    </div>
  );
}

// Editor dei blocchi liberi: ogni blocco (chiave + tipo + valore) corrisponde a un
// punto marcato nella pagina del sito (data-cms / data-cms-img / data-cms-video).
function BlocchiEditor({ site, items, flash, onSaved }: { site: SiteId; items: NonNullable<SiteDoc['contenuti']>; flash: (ok: boolean, t: string) => void; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [add, setAdd] = useState({ chiave: '', tipo: 'testo' as 'testo' | 'foto' | 'video', label: '', valore: '' });
  const [busy, setBusy] = useState('');
  useEffect(() => { const m: Record<string, string> = {}; items.forEach(i => { if (i.tipo === 'testo') m[i.chiave] = i.valore; }); setTexts(m); }, [items]);

  async function saveTesto(chiave: string, lbl?: string) {
    setBusy(chiave);
    try { await api.put(`/siti-admin/contenuti/${site}/elemento`, { chiave, tipo: 'testo', valore: texts[chiave] ?? '', label: lbl }); flash(true, 'Blocco salvato.'); onSaved(); }
    catch (e) { flash(false, errMsg(e)); } finally { setBusy(''); }
  }
  async function del(chiave: string) {
    if (!confirm(`Rimuovere il blocco "${chiave}"?`)) return;
    try { await api.delete(`/siti-admin/contenuti/${site}/elemento/${encodeURIComponent(chiave)}`); flash(true, 'Blocco rimosso.'); onSaved(); }
    catch (e) { flash(false, errMsg(e)); }
  }
  async function uploadMedia(f: File, chiave: string, lbl?: string) {
    if (f.size > 24 * 1024 * 1024) return flash(false, 'File troppo grande: massimo 24 MB.');
    setBusy(chiave);
    try {
      const fd = new FormData(); fd.append('file', f); fd.append('chiave', chiave); if (lbl) fd.append('label', lbl);
      await api.post(`/siti-admin/contenuti/${site}/elemento-media`, fd, { timeout: 300000 });
      flash(true, 'File caricato.'); onSaved();
    } catch (e) { flash(false, errMsg(e)); } finally { setBusy(''); }
  }
  async function addBlock() {
    const chiave = add.chiave.trim();
    if (!chiave) return flash(false, 'Scrivi la chiave del blocco (es. contatti.titolo).');
    if (!/^[a-z0-9._-]+$/i.test(chiave)) return flash(false, 'Chiave non valida: solo lettere, numeri, punto, trattino.');
    try {
      await api.put(`/siti-admin/contenuti/${site}/elemento`, { chiave, tipo: add.tipo, valore: add.tipo === 'testo' ? add.valore : '', label: add.label });
      flash(true, add.tipo === 'testo' ? 'Blocco aggiunto.' : 'Blocco creato: ora carica il file.');
      setAdd({ chiave: '', tipo: 'testo', label: '', valore: '' }); onSaved();
    } catch (e) { flash(false, errMsg(e)); }
  }

  return (
    <div className="tw-mt-4 tw-border-t tw-border-slate-100 tw-pt-3">
      <button onClick={() => setOpen(!open)} className="tw-text-xs tw-font-bold tw-uppercase tw-tracking-wide tw-text-indigo-600 hover:tw-text-indigo-800">
        {open ? '▾ Chiudi blocchi di pagina' : `▸ Blocchi di pagina (tutti i testi, foto, video) · ${items.length}`}
      </button>
      {open && <>
        <p className="tw-text-xs tw-text-slate-500 tw-mt-2 tw-mb-3 tw-mb-0">
          Ogni blocco modifica un punto della pagina marcato con la sua chiave (es. <code className="tw-bg-slate-100 tw-px-1 tw-rounded">contatti.titolo</code>).
          Tipo <b>testo</b> → scritte della pagina · <b>foto</b> → immagini · <b>video</b> → filmati. Valore vuoto = contenuto originale del sito.
        </p>
        <div className="tw-flex tw-flex-col tw-gap-2 tw-mt-3">
          {items.map(it => (
            <div key={it.chiave} className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-rounded-lg tw-border tw-border-slate-200 tw-bg-slate-50 tw-px-3 tw-py-2">
              <span className={`tw-rounded tw-px-1.5 tw-py-0.5 tw-text-[10px] tw-font-bold tw-uppercase ${it.tipo === 'testo' ? 'tw-bg-sky-100 tw-text-sky-700' : it.tipo === 'foto' ? 'tw-bg-emerald-100 tw-text-emerald-700' : 'tw-bg-amber-100 tw-text-amber-700'}`}>{it.tipo}</span>
              <span className="tw-min-w-32"><code className="tw-text-[11px] tw-text-slate-700">{it.chiave}</code>{it.label && <span className="tw-block tw-text-[10px] tw-text-slate-400">{it.label}</span>}</span>
              {it.tipo === 'testo' ? (
                <>
                  <input value={texts[it.chiave] ?? ''} onChange={e => setTexts(t => ({ ...t, [it.chiave]: e.target.value }))} placeholder="Vuoto = testo originale" className={input + ' !tw-w-auto tw-flex-1 tw-min-w-40 !tw-py-1.5 tw-text-xs'} />
                  <Button size="sm" variant="secondary" icon={<Save size={13} />} loading={busy === it.chiave} onClick={() => saveTesto(it.chiave, it.label)}>Salva</Button>
                </>
              ) : (
                <>
                  {it.valore
                    ? (it.tipo === 'foto'
                      ? <img src={media(it.valore)} alt="" className="tw-h-9 tw-w-14 tw-rounded tw-object-cover" />
                      : <video src={media(it.valore)} muted playsInline className="tw-h-9 tw-w-14 tw-rounded tw-object-cover" />)
                    : <span className="tw-text-[10px] tw-text-slate-400">nessun file</span>}
                  <FileBtn accept={it.tipo === 'foto' ? 'image/jpeg,image/png,image/webp' : 'video/mp4,video/webm,video/quicktime'} busy={busy === it.chiave} onFile={f => uploadMedia(f, it.chiave, it.label)} icon={<Upload size={13} />}>Carica</FileBtn>
                </>
              )}
              <button onClick={() => del(it.chiave)} className="tw-ml-auto tw-p-1 tw-text-slate-300 hover:tw-text-red-500" title="Rimuovi blocco"><Trash2 size={14} /></button>
            </div>
          ))}
          {!items.length && <p className="tw-text-xs tw-text-slate-400 tw-m-0">Nessun blocco definito. Aggiungine uno qui sotto: scrivi la chiave del punto pagina che vuoi modificare.</p>}
        </div>
        <div className="tw-mt-3 tw-flex tw-flex-wrap tw-items-end tw-gap-2 tw-rounded-lg tw-border tw-border-dashed tw-border-slate-300 tw-p-3">
          <div><label className={label}>Chiave punto pagina</label><input value={add.chiave} onChange={e => setAdd(a => ({ ...a, chiave: e.target.value }))} placeholder="es. servizi.titolo" className={input + ' !tw-w-36 !tw-py-1.5 tw-text-xs'} /></div>
          <div><label className={label}>Tipo</label><select value={add.tipo} onChange={e => setAdd(a => ({ ...a, tipo: e.target.value as 'testo' | 'foto' | 'video' }))} className={input + ' !tw-w-auto !tw-py-1.5 tw-text-xs'}><option value="testo">Testo</option><option value="foto">Foto</option><option value="video">Video</option></select></div>
          <div><label className={label}>Etichetta (dove si trova)</label><input value={add.label} onChange={e => setAdd(a => ({ ...a, label: e.target.value }))} placeholder="es. Titolo sezione contatti" className={input + ' !tw-w-44 !tw-py-1.5 tw-text-xs'} /></div>
          {add.tipo === 'testo' && <div className="tw-flex-1 tw-min-w-40"><label className={label}>Testo</label><input value={add.valore} onChange={e => setAdd(a => ({ ...a, valore: e.target.value }))} className={input + ' !tw-py-1.5 tw-text-xs'} /></div>}
          <Button size="sm" variant="secondary" icon={<Plus size={13} />} onClick={addBlock}>Aggiungi blocco</Button>
        </div>
      </>}
    </div>
  );
}

// ─── RECENSIONI DEI SITI ─────────────────────────────────────────────────────
function Recensioni({ flash }: { flash: (ok: boolean, t: string) => void }) {
  const [items, setItems] = useState<Recensione[]>([]);
  const [site, setSite] = useState<SiteId>('main');
  const [form, setForm] = useState({ nome: '', ruolo: '', rating: 5, testo: '' });
  const [edit, setEdit] = useState<Recensione | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.get('/siti-admin/recensioni').then(r => setItems((r.data as Recensione[]).filter(x => x.site === site))).catch(e => flash(false, errMsg(e)));
  useEffect(() => { load(); }, [site]);

  async function salva() {
    if (!form.nome.trim()) return flash(false, 'Inserisci il nome di chi scrive.');
    if (!form.testo.trim()) return flash(false, 'Inserisci il testo della recensione.');
    setBusy(true);
    try {
      if (edit) await api.put(`/siti-admin/recensioni/${edit._id}`, { ...form });
      else await api.post('/siti-admin/recensioni', { ...form, site, ordine: items.length + 1 });
      flash(true, edit ? 'Recensione aggiornata.' : 'Recensione pubblicata sul sito.');
      setForm({ nome: '', ruolo: '', rating: 5, testo: '' }); setEdit(null); load();
    } catch (e) { flash(false, errMsg(e)); } finally { setBusy(false); }
  }
  async function toggle(r: Recensione) {
    try { await api.put(`/siti-admin/recensioni/${r._id}`, { approvato: !r.approvato }); flash(true, r.approvato ? 'Recensione nascosta dal sito.' : 'Recensione pubblicata.'); load(); }
    catch (e) { flash(false, errMsg(e)); }
  }
  async function elimina(r: Recensione) {
    if (!confirm(`Eliminare la recensione di "${r.nome}"?`)) return;
    try { await api.delete(`/siti-admin/recensioni/${r._id}`); flash(true, 'Recensione eliminata.'); load(); }
    catch (e) { flash(false, errMsg(e)); }
  }
  const stars = (n: number) => '★'.repeat(Math.max(1, Math.min(5, n))) + '☆'.repeat(5 - Math.max(1, Math.min(5, n)));

  return (
    <div className="tw-grid tw-gap-4 lg:tw-grid-cols-2 tw-items-start">
      <section className="tw-bg-white tw-border tw-border-slate-200 tw-rounded-xl tw-p-4">
        <div className="tw-flex tw-flex-wrap tw-gap-2 tw-mb-4">
          {SITI.map(s => <button key={s.id} onClick={() => { setSite(s.id); setEdit(null); setForm({ nome: '', ruolo: '', rating: 5, testo: '' }); }} className={`tw-rounded-full tw-px-4 tw-py-1.5 tw-text-xs tw-font-bold tw-transition ${site === s.id ? 'tw-bg-indigo-600 tw-text-white' : 'tw-bg-slate-100 tw-text-slate-500 hover:tw-bg-slate-200'}`}>{s.nome}</button>)}
        </div>
        <h2 className="tw-m-0 tw-mb-3 tw-text-lg tw-font-extrabold tw-text-slate-800">{edit ? 'Modifica recensione' : 'Nuova recensione'} — {SITI.find(s => s.id === site)?.nome}</h2>
        <div className="tw-grid tw-gap-3">
          <div className="tw-grid sm:tw-grid-cols-2 tw-gap-2">
            <div><label className={label}>Nome *</label><input className={input} maxLength={80} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Es. Maria R." /></div>
            <div><label className={label}>Dettaglio (zona, ruolo)</label><input className={input} maxLength={80} value={form.ruolo} onChange={e => setForm(f => ({ ...f, ruolo: e.target.value }))} placeholder="Es. Famiglia, Roma" /></div>
          </div>
          <div className="tw-flex tw-items-center tw-gap-3">
            <span className={label + ' !tw-mb-0'}>Stelle</span>
            <div className="tw-flex tw-gap-1">{[1, 2, 3, 4, 5].map(n => <button key={n} type="button" onClick={() => setForm(f => ({ ...f, rating: n }))} className={`tw-text-2xl ${n <= form.rating ? 'tw-text-amber-400' : 'tw-text-slate-200'}`}>★</button>)}</div>
          </div>
          <div><label className={label}>Testo della recensione *</label><textarea className={input} rows={4} maxLength={800} value={form.testo} onChange={e => setForm(f => ({ ...f, testo: e.target.value }))} placeholder="Scrivi o incolla la recensione…" /></div>
          <div className="tw-flex tw-gap-2">
            <Button icon={<Save size={15} />} loading={busy} onClick={salva}>{edit ? 'Salva modifiche' : 'Pubblica recensione'}</Button>
            {edit && <Button variant="ghost" icon={<RotateCcw size={15} />} onClick={() => { setEdit(null); setForm({ nome: '', ruolo: '', rating: 5, testo: '' }); }}>Annulla</Button>}
          </div>
          <p className="tw-text-xs tw-text-slate-500 tw-m-0">Appare subito nella sezione «Cosa dicono di noi» di {SITI.find(s => s.id === site)?.url}. Puoi nasconderla in qualsiasi momento senza cancellarla.</p>
        </div>
      </section>
      <section className="tw-bg-white tw-border tw-border-slate-200 tw-rounded-xl tw-p-4">
        <h2 className="tw-m-0 tw-mb-3 tw-text-lg tw-font-extrabold tw-text-slate-800">Recensioni su {SITI.find(s => s.id === site)?.nome} ({items.length})</h2>
        <div className="tw-flex tw-flex-col tw-gap-2 tw-max-h-[540px] tw-overflow-y-auto">
          {items.map(r => (
            <div key={r._id} className={`tw-rounded-lg tw-border tw-p-3 ${r.approvato ? 'tw-border-slate-200 tw-bg-white' : 'tw-border-amber-300 tw-bg-amber-50'}`}>
              <div className="tw-flex tw-items-start tw-justify-between tw-gap-2">
                <div className="tw-min-w-0">
                  <p className="tw-m-0 tw-text-sm tw-font-bold tw-text-slate-800">{r.nome}{r.ruolo && <span className="tw-font-normal tw-text-slate-400"> · {r.ruolo}</span>}</p>
                  <p className="tw-m-0 tw-text-amber-400 tw-text-sm">{stars(r.rating)}</p>
                </div>
                <div className="tw-flex tw-flex-none tw-items-center tw-gap-1">
                  <button onClick={() => toggle(r)} className={`tw-rounded-full tw-px-2.5 tw-py-1 tw-text-[10px] tw-font-bold tw-uppercase ${r.approvato ? 'tw-bg-emerald-100 tw-text-emerald-700' : 'tw-bg-slate-200 tw-text-slate-500'}`}>{r.approvato ? 'Visibile' : 'Nascosta'}</button>
                  <button aria-label="Modifica" onClick={() => { setEdit(r); setForm({ nome: r.nome, ruolo: r.ruolo || '', rating: r.rating, testo: r.testo }); }} className="tw-p-1.5 tw-text-slate-300 hover:tw-text-indigo-600"><Pencil size={15} /></button>
                  <button aria-label="Elimina" onClick={() => elimina(r)} className="tw-p-1.5 tw-text-slate-300 hover:tw-text-red-500"><Trash2 size={15} /></button>
                </div>
              </div>
              <p className="tw-mt-1.5 tw-mb-0 tw-text-xs tw-text-slate-500 tw-line-clamp-3">{r.testo}</p>
            </div>
          ))}
          {!items.length && <p className="tw-rounded-lg tw-bg-slate-50 tw-py-8 tw-text-center tw-text-xs tw-text-slate-400 tw-m-0"><MessageSquareQuote size={18} className="tw-mx-auto tw-mb-1 tw-opacity-50" />Nessuna recensione per questo sito.<br />Aggiungila dal modulo a sinistra: apparirà nella sezione «Cosa dicono di noi».</p>}
        </div>
      </section>
    </div>
  );
}

function FileBtn({ accept, busy, onFile, icon, children }: { accept: string; busy: boolean; onFile: (f: File) => void; icon: React.ReactNode; children: React.ReactNode }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={ref} type="file" accept={accept} hidden onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      <Button size="sm" variant="secondary" icon={icon} loading={busy} onClick={() => ref.current?.click()}>{busy ? 'Caricamento…' : children}</Button>
    </>
  );
}

// ─── PRODOTTI SHOP ───────────────────────────────────────────────────────────
function Prodotti({ flash }: { flash: (ok: boolean, t: string) => void }) {
  const [list, setList] = useState<Prodotto[]>([]);
  const [edit, setEdit] = useState<(Omit<Prodotto, '_id'> & { _id?: string }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [filtro, setFiltro] = useState<'tutti' | 'vendita' | 'noleggio'>('tutti');
  const load = () => api.get('/siti-admin/prodotti').then(r => setList(r.data)).catch(e => flash(false, errMsg(e)));
  useEffect(() => { load(); }, []);

  async function salva() {
    if (!edit) return;
    if (!edit.nome.trim()) return flash(false, 'Inserisci il nome del prodotto.');
    if (edit.categoria === 'vendita' && !(Number(edit.prezzo) > 0)) return flash(false, 'Inserisci il prezzo di vendita.');
    if (edit.categoria === 'noleggio' && !(Number(edit.prezzoNoleggio?.giorno) > 0 || Number(edit.prezzoNoleggio?.settimana) > 0 || Number(edit.prezzoNoleggio?.mese) > 0)) return flash(false, 'Inserisci almeno una tariffa di noleggio.');
    setSaving(true);
    try {
      const r = edit._id ? await api.put(`/siti-admin/prodotti/${edit._id}`, edit) : await api.post('/siti-admin/prodotti', edit);
      setEdit(r.data); flash(true, edit._id ? 'Prodotto aggiornato.' : 'Prodotto creato: ora puoi aggiungere le foto.'); load();
    } catch (e) { flash(false, errMsg(e)); } finally { setSaving(false); }
  }
  async function elimina(p: Prodotto) {
    if (!confirm(`Eliminare definitivamente "${p.nome}"?`)) return;
    try { await api.delete(`/siti-admin/prodotti/${p._id}`); flash(true, 'Prodotto eliminato.'); if (edit?._id === p._id) setEdit(null); load(); }
    catch (e) { flash(false, errMsg(e)); }
  }
  async function addImg(f: File) {
    if (!edit?._id) return;
    if (f.size > 8 * 1024 * 1024) return flash(false, 'Immagine troppo grande: massimo 8 MB.');
    try { const fd = new FormData(); fd.append('file', f); const r = await api.post(`/siti-admin/prodotti/${edit._id}/immagini`, fd); setEdit(r.data); load(); }
    catch (e) { flash(false, errMsg(e)); }
  }
  async function delImg(src: string) {
    if (!edit?._id) return;
    try { const r = await api.delete(`/siti-admin/prodotti/${edit._id}/immagini`, { data: { src } }); setEdit(r.data); load(); }
    catch (e) { flash(false, errMsg(e)); }
  }
  const set = (patch: Partial<Prodotto>) => setEdit(e => (e ? { ...e, ...patch } : e));
  const setNol = (k: 'giorno' | 'settimana' | 'mese', v: string) => setEdit(e => (e ? { ...e, prezzoNoleggio: { ...(e.prezzoNoleggio || {}), [k]: Number(v) || 0 } } : e));
  const visibili = list.filter(p => filtro === 'tutti' || p.categoria === filtro);

  return (
    <div className="tw-grid lg:tw-grid-cols-[1fr_440px] tw-gap-4 tw-items-start">
      <section className="tw-bg-white tw-border tw-border-slate-200 tw-rounded-xl">
        <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-p-3 tw-border-b tw-border-slate-200">
          <Button size="sm" icon={<Plus size={15} />} onClick={() => setEdit({ ...vuoto })}>Nuovo prodotto</Button>
          <select className={input + ' !tw-w-auto'} value={filtro} onChange={e => setFiltro(e.target.value as any)}>
            <option value="tutti">Tutti ({list.length})</option>
            <option value="vendita">Acquisto ({list.filter(p => p.categoria === 'vendita').length})</option>
            <option value="noleggio">Noleggio ({list.filter(p => p.categoria === 'noleggio').length})</option>
          </select>
          <a href="https://shop.abbracciocuredomiciliari.it" target="_blank" rel="noopener noreferrer" className="tw-ml-auto tw-text-sm tw-font-semibold tw-text-sky-700 tw-flex tw-items-center tw-gap-1">Apri lo shop <ExternalLink size={14} /></a>
        </div>
        {!visibili.length && <p className="tw-p-6 tw-text-sm tw-text-slate-500 tw-m-0">Nessun prodotto. Premi «Nuovo prodotto» per iniziare il catalogo.</p>}
        <div className="tw-divide-y tw-divide-slate-100">
          {visibili.map(p => (
            <div key={p._id} className={`tw-flex tw-items-center tw-gap-3 tw-p-3 ${edit?._id === p._id ? 'tw-bg-sky-50' : ''}`}>
              <div className="tw-w-14 tw-h-14 tw-rounded-md tw-bg-slate-100 tw-overflow-hidden tw-flex-none">{p.immagini?.[0] && <img src={media(p.immagini[0])} alt="" className="tw-w-full tw-h-full tw-object-cover" />}</div>
              <div className="tw-flex-1 tw-min-w-0">
                <div className="tw-font-bold tw-text-sm tw-text-slate-800 tw-truncate">{p.nome}</div>
                <div className="tw-text-xs tw-text-slate-500">
                  {p.categoria === 'noleggio' ? 'Noleggio' : 'Acquisto'} · {p.sezione || '—'} · {p.categoria === 'noleggio'
                    ? [p.prezzoNoleggio?.giorno && `${eur(p.prezzoNoleggio.giorno)}/giorno`, p.prezzoNoleggio?.settimana && `${eur(p.prezzoNoleggio.settimana)}/sett.`, p.prezzoNoleggio?.mese && `${eur(p.prezzoNoleggio.mese)}/mese`].filter(Boolean).join(' · ')
                    : eur(p.inOfferta && p.prezzoScontato ? p.prezzoScontato : p.prezzo)}
                </div>
                <div className="tw-flex tw-gap-1 tw-mt-1">
                  {!p.attivo && <span className="tw-text-[10px] tw-font-bold tw-bg-slate-200 tw-text-slate-600 tw-rounded tw-px-1.5">NASCOSTO</span>}
                  {!p.disponibile && <span className="tw-text-[10px] tw-font-bold tw-bg-amber-100 tw-text-amber-700 tw-rounded tw-px-1.5">NON DISPONIBILE</span>}
                  {p.inOfferta && <span className="tw-text-[10px] tw-font-bold tw-bg-rose-100 tw-text-rose-700 tw-rounded tw-px-1.5">OFFERTA</span>}
                </div>
              </div>
              <button aria-label="Modifica" className="tw-p-2 tw-text-sky-700" onClick={() => setEdit({ ...vuoto, ...p })}><Pencil size={17} /></button>
              <button aria-label="Elimina" className="tw-p-2 tw-text-red-600" onClick={() => elimina(p)}><Trash2 size={17} /></button>
            </div>
          ))}
        </div>
      </section>

      {edit && (
        <section className="tw-bg-white tw-border tw-border-slate-200 tw-rounded-xl tw-p-4 lg:tw-sticky lg:tw-top-4">
          <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
            <h2 className="tw-m-0 tw-text-lg tw-font-extrabold tw-text-slate-800">{edit._id ? 'Modifica prodotto' : 'Nuovo prodotto'}</h2>
            <button aria-label="Chiudi" onClick={() => setEdit(null)} className="tw-p-1 tw-text-slate-500"><X size={18} /></button>
          </div>
          <div className="tw-grid tw-gap-3">
            <div className="tw-grid tw-grid-cols-2 tw-gap-2">
              {(['vendita', 'noleggio'] as const).map(c => (
                <button key={c} type="button" onClick={() => set({ categoria: c })}
                  className={`tw-rounded-md tw-py-2 tw-text-sm tw-font-bold tw-border ${edit.categoria === c ? 'tw-bg-sky-800 tw-text-white tw-border-sky-800' : 'tw-bg-white tw-text-slate-700 tw-border-slate-300'}`}>
                  {c === 'vendita' ? 'Acquisto' : 'Noleggio'}
                </button>
              ))}
            </div>
            <div><label className={label}>Nome *</label><input className={input} maxLength={160} value={edit.nome} onChange={e => set({ nome: e.target.value })} /></div>
            <div>
              <label className={label}>Categoria del catalogo</label>
              <input className={input} list="sezioni-shop" maxLength={60} value={edit.sezione || ''} onChange={e => set({ sezione: e.target.value })} />
              <datalist id="sezioni-shop">{SEZIONI.map(s => <option key={s} value={s} />)}</datalist>
            </div>
            <div><label className={label}>Descrizione</label><textarea className={input} rows={4} maxLength={3000} value={edit.descrizione} onChange={e => set({ descrizione: e.target.value })} /></div>
            {edit.categoria === 'vendita' ? (
              <div className="tw-grid tw-grid-cols-2 tw-gap-2">
                <div><label className={label}>Prezzo € *</label><input className={input} type="number" min={0} step="0.01" value={edit.prezzo || ''} onChange={e => set({ prezzo: Number(e.target.value) })} /></div>
                <div><label className={label}>Prezzo scontato €</label><input className={input} type="number" min={0} step="0.01" value={edit.prezzoScontato || ''} onChange={e => set({ prezzoScontato: Number(e.target.value), inOfferta: Number(e.target.value) > 0 })} /></div>
              </div>
            ) : (
              <>
                <div className="tw-grid tw-grid-cols-3 tw-gap-2">
                  <div><label className={label}>€ / giorno</label><input className={input} type="number" min={0} step="0.01" value={edit.prezzoNoleggio?.giorno || ''} onChange={e => setNol('giorno', e.target.value)} /></div>
                  <div><label className={label}>€ / settimana</label><input className={input} type="number" min={0} step="0.01" value={edit.prezzoNoleggio?.settimana || ''} onChange={e => setNol('settimana', e.target.value)} /></div>
                  <div><label className={label}>€ / mese</label><input className={input} type="number" min={0} step="0.01" value={edit.prezzoNoleggio?.mese || ''} onChange={e => setNol('mese', e.target.value)} /></div>
                </div>
                <p className="tw-text-xs tw-text-slate-500 tw-m-0">Lo shop calcola il totale sui giorni scelti dal cliente usando la tariffa giornaliera (se manca, quella settimanale o mensile divisa per i giorni).</p>
                <div><label className={label}>Cauzione €</label><input className={input} type="number" min={0} step="0.01" value={edit.cauzione || ''} onChange={e => set({ cauzione: Number(e.target.value) })} /></div>
              </>
            )}
            <div className="tw-grid tw-grid-cols-2 tw-gap-2">
              <div><label className={label}>Etichetta (es. Novità)</label><input className={input} maxLength={40} value={edit.badge || ''} onChange={e => set({ badge: e.target.value })} /></div>
              <div><label className={label}>Ordine (1 = primo)</label><input className={input} type="number" value={edit.ordine || 0} onChange={e => set({ ordine: Number(e.target.value) })} /></div>
            </div>
            <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm"><input type="checkbox" checked={edit.attivo} onChange={e => set({ attivo: e.target.checked })} /> Visibile nello shop</label>
            <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm"><input type="checkbox" checked={edit.disponibile} onChange={e => set({ disponibile: e.target.checked })} /> Disponibile (ordinabile)</label>

            <div>
              <span className={label}>Foto del prodotto</span>
              {edit._id ? (
                <>
                  <div className="tw-flex tw-flex-wrap tw-gap-2 tw-mb-2">
                    {edit.immagini.map(src => (
                      <div key={src} className="tw-relative tw-w-20 tw-h-20 tw-rounded-md tw-overflow-hidden tw-bg-slate-100">
                        <img src={media(src)} alt="" className="tw-w-full tw-h-full tw-object-cover" />
                        <button aria-label="Rimuovi foto" onClick={() => delImg(src)} className="tw-absolute tw-top-0.5 tw-right-0.5 tw-bg-white/90 tw-rounded-full tw-p-0.5 tw-text-red-600"><X size={13} /></button>
                      </div>
                    ))}
                  </div>
                  <FileBtn accept="image/jpeg,image/png,image/webp" busy={false} onFile={addImg} icon={<Upload size={15} />}>Aggiungi foto</FileBtn>
                </>
              ) : <p className="tw-text-xs tw-text-slate-500 tw-m-0">Salva il prodotto, poi potrai caricare le foto.</p>}
            </div>
            <div className="tw-flex tw-gap-2 tw-pt-1">
              <Button icon={<Save size={16} />} loading={saving} onClick={salva}>{edit._id ? 'Salva modifiche' : 'Crea prodotto'}</Button>
              <Button variant="ghost" icon={<RotateCcw size={16} />} onClick={() => setEdit(null)}>Annulla</Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
