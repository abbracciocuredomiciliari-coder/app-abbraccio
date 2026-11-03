import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Phone, Send, Calculator, CheckCircle, Plus, Minus, Trash2 } from 'lucide-react';

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'https://api.abbracciocuredomiciliari.it/api';
const TEL = '06 01905242';
const TEL_HREF = '0601905242';
const WA = '393514175117';

interface Voce { id: string; nome: string; prezzo: number; prezzoListino: number; promo: boolean; unitaMisura: string | null; note: string | null; }
interface Categoria { key: string; label: string; descrizione: string; ordine: number; voci: Voce[]; }
interface Selezione { quantita: number; giorni: number; }

const euro = (n: number) => `€${Number(n || 0).toFixed(2).replace('.', ',')}`;

function utm() {
  const q = new URLSearchParams(window.location.search);
  const o: Record<string, string> = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(k => { const v = q.get(k); if (v) o[k] = v; });
  return o;
}

export default function LandingPreventivo() {
  const [categorie, setCategorie] = useState<Categoria[]>([]);
  const [sel, setSel] = useState<Record<string, Selezione>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [initErr, setInitErr] = useState('');

  const [nome, setNome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [messaggio, setMessaggio] = useState('');
  const [sending, setSending] = useState(false);
  const [inviata, setInviata] = useState<any>(null);

  useEffect(() => {
    axios.get(`${API_BASE}/landing-preventivo/listino`)
      .then(r => {
        setCategorie(r.data.categorie || []);
        const srv = new URLSearchParams(window.location.search).get('servizio');
        if (srv) {
          const cat = (r.data.categorie || []).find((c: Categoria) => c.key === srv || c.label.toLowerCase().includes(srv.toLowerCase()));
          if (cat) setOpen(o => ({ ...o, [cat.key]: true }));
        }
      })
      .catch(() => setInitErr('Non riesco a caricare il listino. Riprova tra poco o chiamaci al ' + TEL + '.'));
  }, []);

  const vociSel = useMemo(() => {
    const all: Record<string, Voce> = {};
    categorie.forEach(c => c.voci.forEach(v => { all[v.id] = v; }));
    return Object.entries(sel).filter(([, s]) => s.quantita > 0).map(([id, s]) => ({ id, voce: all[id], ...s })).filter(x => x.voce);
  }, [sel, categorie]);

  const bodyVoci = () => vociSel.map(v => ({ id: v.id, quantita: v.quantita, giorni: v.voce.unitaMisura === 'ora' ? v.giorni : 1 }));

  useEffect(() => {
    if (vociSel.length === 0) { setPreview(null); return; }
    const t = setTimeout(() => {
      axios.post(`${API_BASE}/landing-preventivo/preview`, { voci: bodyVoci() })
        .then(r => setPreview(r.data))
        .catch(() => setPreview(null));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vociSel]);

  function setQty(id: string, q: number) {
    setSel(s => {
      const cur = s[id] || { quantita: 0, giorni: 1 };
      const nq = Math.min(999, Math.max(0, q));
      return { ...s, [id]: { ...cur, quantita: nq } };
    });
  }
  function setGiorni(id: string, g: number) {
    setSel(s => ({ ...s, [id]: { ...(s[id] || { quantita: 1 }), giorni: Math.min(365, Math.max(1, g)) } }));
  }

  async function invia() {
    if (vociSel.length === 0) return setErr('Seleziona almeno una prestazione');
    if (!nome.trim()) return setErr('Inserisci il tuo nome');
    if (!telefono.trim()) return setErr('Inserisci il numero di telefono');
    setSending(true); setErr('');
    try {
      const res = await axios.post(`${API_BASE}/landing-preventivo/richiesta`, { voci: bodyVoci(), nome, telefono, email, messaggio, utm: utm() });
      setInviata(res.data);
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Errore nell\'invio. Riprova o chiamaci.');
    } finally { setSending(false); }
  }

  const waTesto = encodeURIComponent(
    preview && preview.righe?.length
      ? `Preventivo servizi: ${preview.righe.map((r: any) => `${r.descrizione} x${r.quantita}`).join(', ')} — totale ${euro(preview.totale)}`
      : 'Vorrei un preventivo per i servizi a domicilio'
  );

  const inp: React.CSSProperties = { width: '100%', padding: '11px 13px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.92rem', boxSizing: 'border-box' };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#eff6ff 0%,#dbeafe 45%,#fff 100%)', fontFamily: "'Segoe UI',system-ui,sans-serif", padding: '28px 16px 48px' }}>
      <style>{`@media (max-width: 640px) { .landing-hide-mobile { display: none !important; } }`}</style>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <img src="/logo.png" alt="Abbraccio Cure Domiciliari" style={{ height: 54, marginBottom: 8 }} onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />
          <h1 style={{ margin: 0, color: '#1e4d8c', fontSize: '1.7rem', fontWeight: 800 }}>Calcola il tuo preventivo</h1>
          <p style={{ margin: '6px 0 0', color: '#1e40af', fontSize: '0.95rem' }}>Seleziona le prestazioni a domicilio e ottieni subito il totale — senza impegno</p>
        </div>

        <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 8px 30px rgba(0,0,0,.08)', padding: '22px 22px 24px', border: '1px solid #dbeafe' }}>

          {initErr && <p style={{ color: '#dc2626' }}>{initErr}</p>}

          {!inviata && categorie.map(c => (
            <div key={c.key} style={{ marginBottom: 8, border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
              <button onClick={() => setOpen(o => ({ ...o, [c.key]: !o[c.key] }))}
                style={{ width: '100%', textAlign: 'left', padding: '12px 14px', background: open[c.key] ? '#eff6ff' : '#fff', border: 0, cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <strong style={{ color: '#1e4d8c', fontSize: '0.95rem' }}>{c.label}</strong>
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{c.voci.length} {c.voci.length === 1 ? 'prestazione' : 'prestazioni'} {open[c.key] ? '▲' : '▼'}</span>
                </div>
                <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: 2 }}>{c.descrizione}</div>
              </button>
              {open[c.key] && (
                <div style={{ borderTop: '1px solid #e2e8f0' }}>
                  {c.voci.map(v => {
                    const s = sel[v.id] || { quantita: 0, giorni: 1 };
                    const att = s.quantita > 0;
                    const oraria = v.unitaMisura === 'ora';
                    return (
                      <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: '1px solid #f1f5f9', background: att ? '#f8fbff' : '#fff', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 160 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a' }}>{v.nome}{v.unitaMisura ? <span style={{ color: '#64748b', fontWeight: 400 }}> ({v.unitaMisura})</span> : null}</div>
                          {v.note && <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>{v.note}</div>}
                          <div style={{ fontSize: '0.82rem', marginTop: 2 }}>
                            <strong style={{ color: v.promo ? '#b91c1c' : '#1e4d8c' }}>{euro(v.prezzo)}</strong>
                            {v.promo && <> <span style={{ color: '#b91c1c', fontSize: '0.7rem', fontWeight: 800 }}>PROMO</span> <s style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{euro(v.prezzoListino)}</s></>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button onClick={() => setQty(v.id, (s.quantita || 0) - 1)} disabled={!att} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={14} /></button>
                          <span style={{ width: 26, textAlign: 'center', fontWeight: 700, color: att ? '#1e4d8c' : '#94a3b8' }}>{s.quantita || 0}</span>
                          <button onClick={() => setQty(v.id, (s.quantita || 0) + 1)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={14} /></button>
                        </div>
                        {oraria && att && (
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#475569' }}>
                            giorni
                            <input type="number" min={1} max={365} value={s.giorni} onChange={e => setGiorni(v.id, Number(e.target.value))}
                              style={{ width: 60, padding: '5px 8px', borderRadius: 8, border: '1px solid #cbd5e1' }} />
                          </label>
                        )}
                        {att && (
                          <div style={{ fontWeight: 700, color: '#1e4d8c', fontSize: '0.88rem', minWidth: 70, textAlign: 'right' }}>
                            {euro(s.quantita * (oraria ? s.giorni : 1) * v.prezzo)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {preview && preview.righe?.length > 0 && !inviata && (
            <div style={{ marginTop: 14, background: '#1e4d8c', borderRadius: 14, padding: '16px 18px', color: '#fff' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: 1, opacity: .85 }}>TOTALE PREVENTIVO</div>
              <div style={{ fontSize: '2rem', fontWeight: 800 }}>{euro(preview.totale)}</div>
              {preview.scontoApplicato && (
                <div style={{ fontSize: '0.82rem', opacity: .95 }}>
                  Subtotale {euro(preview.subtotale)} — sconto più servizi {preview.scontoPerc}% (-{euro(preview.sconto)})
                </div>
              )}
              <div style={{ fontSize: '0.78rem', opacity: .9, marginTop: 4 }}>
                {preview.righe.length} {preview.righe.length === 1 ? 'prestazione' : 'prestazioni'} selezionate
              </div>
            </div>
          )}
          {preview && preview.minServiziPerSconto && !preview.scontoApplicato && preview.righe?.length === 1 && (
            <p style={{ fontSize: '0.78rem', color: '#166534', margin: '10px 4px 0' }}>💡 Aggiungi un'altra prestazione: con {preview.minServiziPerSconto}+ servizi hai il {preview.scontoPerc || 5}% di sconto!</p>
          )}

          {err && <div style={{ marginTop: 12, color: '#dc2626', fontSize: '0.88rem' }}>{err}</div>}

          {inviata ? (
            <div style={{ textAlign: 'center', padding: '20px 8px' }}>
              <CheckCircle size={56} color="#16a34a" style={{ margin: '0 auto 12px' }} />
              <h2 style={{ color: '#15803d', margin: '0 0 8px' }}>Preventivo registrato!</h2>
              <p style={{ color: '#475569', lineHeight: 1.6 }}>
                {inviata.preventivo && <>Preventivo <strong>{inviata.preventivo.numero}</strong> da <strong>{euro(inviata.preventivo.totale)}</strong> registrato. </>}
                Ti ricontatteremo al più presto al numero <strong>{telefono}</strong>.
              </p>
              <a href={`https://wa.me/${WA}`} style={{ display: 'inline-block', marginTop: 8, background: '#16a34a', color: '#fff', padding: '12px 22px', borderRadius: 10, textDecoration: 'none', fontWeight: 700 }}>Scrivici su WhatsApp</a>
            </div>
          ) : (
            <div style={{ marginTop: 20, borderTop: '1px solid #f1f5f9', paddingTop: 18 }}>
              <h3 style={{ margin: '0 0 4px', color: '#1e4d8c', fontSize: '1.05rem' }}>Invia il tuo preventivo</h3>
              <p style={{ margin: '0 0 14px', color: '#64748b', fontSize: '0.85rem' }}>Lascia i tuoi recapiti: registriamo il preventivo e ti ricontattiamo per confermare.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
                <input style={inp} placeholder="Nome e cognome *" value={nome} onChange={e => setNome(e.target.value)} />
                <input style={inp} type="tel" placeholder="Telefono * (es. 333 1234567)" value={telefono} onChange={e => setTelefono(e.target.value)} />
                <input style={inp} type="email" placeholder="Email (facoltativa)" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <textarea style={{ ...inp, marginTop: 10, resize: 'vertical' }} rows={3} placeholder="Messaggio (facoltativo): zona, urgenza, esigenze particolari..." value={messaggio} onChange={e => setMessaggio(e.target.value)} />
              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                <button onClick={invia} disabled={sending || vociSel.length === 0}
                  style={{ flex: 1, minWidth: 200, padding: '13px', borderRadius: 12, border: 0, background: vociSel.length ? '#1e4d8c' : '#94a3b8', color: '#fff', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Send size={17} /> {sending ? 'Invio in corso...' : 'Invia il preventivo'}
                </button>
                <a href={`https://wa.me/${WA}?text=${waTesto}`} target="_blank" rel="noopener"
                  style={{ flex: '0 0 auto', padding: '13px 18px', borderRadius: 12, background: '#16a34a', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  WhatsApp
                </a>
                <a href={`tel:${TEL_HREF}`} className="landing-hide-mobile"
                  style={{ flex: '0 0 auto', padding: '13px 18px', borderRadius: 12, background: '#0f766e', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Phone size={16} /> Telefona
                </a>
              </div>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', marginTop: 18 }}>
          Abbraccio Cure Domiciliari · <a href={`tel:${TEL_HREF}`} style={{ color: '#1e4d8c' }}>{TEL}</a> · Assistenza sanitaria e domiciliare — Roma e provincia
        </p>
      </div>
    </div>
  );
}
