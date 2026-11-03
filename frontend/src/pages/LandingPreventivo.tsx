import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  Phone, Calculator, Plus, Trash2, Send, Minus,
  CheckCircle, MessageCircle, ShieldCheck, HelpCircle, FileText, Tag,
} from 'lucide-react';

const API = 'https://api.abbracciocuredomiciliari.it/api';
const TEL_HREF = '0601905242';
const TEL = '06 01905242';
const WA = '393514175117';
const SCONTO = 5;

interface Voce { id: string; nome: string; prezzo: number; prezzoListino: number; promo: boolean; unitaMisura: string | null; note: string | null; }
interface Categoria { key: string; label: string; descrizione: string; ordine: number; voci: Voce[]; }

// Mappa ?servizio=<slug sito> → categoria listino + eventuale voce pre-selezionata
const MAPPA_SERVIZIO: Record<string, { cat: string; voce?: RegExp; label: string }> = {
  'holter-pressorio': { cat: 'prestazioni_infermieristiche', voce: /holter\s*pressorio/i, label: 'Holter pressorio' },
  'holter-ecg': { cat: 'prestazioni_infermieristiche', voce: /holter\s*(cardiaco|ecg)/i, label: 'Holter ECG' },
  'apnee-sonno': { cat: 'prestazioni_infermieristiche', voce: /polisonn/i, label: 'Polisonnografia (apnee del sonno)' },
  'screening-cardiaci': { cat: 'prestazioni_infermieristiche', voce: /^ecg$/i, label: 'ECG' },
  'saturimetria-spirometria': { cat: 'prestazioni_infermieristiche', voce: /spirometria/i, label: 'Spirometria' },
  'emogasanalisi': { cat: 'prestazioni_infermieristiche', voce: /emogas/i, label: 'Emogasanalisi' },
  'prelievi-ematici': { cat: 'prelievi', voce: /prelievo\s*ematico/i, label: 'Prelievo ematico' },
  'rx-domiciliare': { cat: 'radiologia', label: 'Radiologia a domicilio' },
  'ecografia-domiciliare': { cat: 'ecografia', label: 'Ecografia a domicilio' },
  'esami-strumentali': { cat: 'prestazioni_infermieristiche', label: 'Esami strumentali' },
  'infermiere-a-domicilio': { cat: 'prestazioni_infermieristiche', label: 'Assistenza infermieristica' },
  'cure-pazienti-cronici': { cat: 'prestazioni_infermieristiche', label: 'Cure pazienti cronici' },
  'cure-palliative': { cat: 'prestazioni_infermieristiche', label: 'Cure palliative' },
  'fisioterapia-a-domicilio': { cat: 'riabilitazione', voce: /fisioterap/i, label: 'Fisioterapia' },
  'assistenza-anziani': { cat: 'assistenza_domiciliare', voce: /assistenza\s*oss/i, label: 'Assistenza OSS' },
  'assistenza-notturna': { cat: 'assistenza_domiciliare', voce: /^assistenza\s*notturna/i, label: 'Assistenza notturna' },
  'servizio-ambulanza': { cat: 'trasporto', label: 'Trasporto in ambulanza' },
  'visite-specialistiche': { cat: 'visite_mediche', label: 'Visite specialistiche' },
  'psicologia-a-domicilio': { cat: 'visite_mediche', voce: /psicolog/i, label: 'Colloquio psicologico' },
};

function fbq(ev: string, params?: any) {
  try { (window as any).fbq && (window as any).fbq('track', ev, params); } catch {}
}

const euro = (n: number) => `€ ${Number(n || 0).toFixed(2).replace('.', ',')}`;

// Icona "?" con tooltip esplicativo
function Hint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
        title={text} aria-label="Cosa significa questa voce"
        style={{ border: 'none', background: 'none', padding: '0 0 0 6px', cursor: 'pointer', color: '#0284c7', display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}>
        <HelpCircle size={15} />
      </button>
      {open && <div style={{ fontWeight: 400, fontSize: '0.76rem', color: '#0c4a6e', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '8px 10px', marginTop: 5, lineHeight: 1.45 }}>{text}</div>}
    </>
  );
}

export default function LandingPreventivo() {
  const [categorie, setCategorie] = useState<Categoria[]>([]);
  const [initErr, setInitErr] = useState('');
  const [catAttiva, setCatAttiva] = useState('');
  const [sel, setSel] = useState<Record<string, number>>({});
  const [presel, setPresel] = useState<{ label: string; voceNome?: string } | null>(null);
  const [mostraCategorie, setMostraCategorie] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [messaggio, setMessaggio] = useState('');
  const [sending, setSending] = useState(false);
  const [inviata, setInviata] = useState<{ numero: string; totale: number } | null>(null);
  const [formErr, setFormErr] = useState('');
  const utmRef = useRef<Record<string, string>>({});
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    axios.get(`${API}/landing-preventivo/listino`).then(r => {
      const cats: Categoria[] = r.data?.categorie || [];
      setCategorie(cats);
      if (cats.length === 0) return;
      const srv = new URLSearchParams(window.location.search).get('servizio') || '';
      const map = MAPPA_SERVIZIO[srv];
      const cat = map ? cats.find(c => c.key === map.cat) : undefined;
      if (map && cat) {
        setCatAttiva(cat.key);
        const voce = map.voce ? cat.voci.find(v => map.voce!.test(v.nome)) : undefined;
        if (voce) setSel({ [voce.id]: 1 });
        setPresel({ label: map.label, voceNome: voce?.nome });
      } else setCatAttiva(cats[0].key);
    }).catch(() => setInitErr('Listino non disponibile al momento. Riprova tra poco o chiamaci.'));

    const q = new URLSearchParams(window.location.search);
    const o: Record<string, string> = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'gad_source', 'msclkid']
      .forEach(k => { const v = q.get(k); if (v) o[k] = v; });
    utmRef.current = o;
    fbq('PageView');
  }, []);

  const tutteVoci = categorie.flatMap(c => c.voci);
  const vociBody = () => Object.entries(sel).filter(([, q]) => q > 0).map(([id, quantita]) => ({ id, quantita }));
  const nSel = vociBody().length;
  const setQty = (id: string, q: number) => {
    setSel(s => {
      const n = { ...s };
      if (q <= 0) delete n[id]; else n[id] = Math.min(q, 999);
      return n;
    });
    setPreview(null);
  };

  const Prezzo = ({ v, suffisso }: { v: Voce; suffisso?: string }) => v.promo ? (
    <>
      <span style={{ textDecoration: 'line-through', color: '#94a3b8' }}>{euro(v.prezzoListino)}</span>{' '}
      <span style={{ color: '#b91c1c', fontWeight: 800 }}>{euro(v.prezzo)}</span>{suffisso}
      <span style={{ marginLeft: 6, background: '#fee2e2', color: '#b91c1c', fontSize: '0.66rem', fontWeight: 800, padding: '1px 6px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle' }}><Tag size={10} /> PROMO</span>
    </>
  ) : (<>{euro(v.prezzo)}{suffisso}</>);

  async function genera() {
    if (nSel === 0) { setErr('Seleziona almeno una prestazione dal listino.'); return; }
    try {
      setLoading(true); setErr('');
      const res = await axios.post(`${API}/landing-preventivo/preview`, { voci: vociBody() });
      setPreview(res.data);
      fbq('ViewContent', { content_name: 'Preventivo prestazioni generato' });
    } catch (e: any) {
      setPreview(null);
      setErr(e?.response?.data?.message || 'Controlla le prestazioni selezionate');
    } finally { setLoading(false); }
  }

  async function invia(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !telefono.trim()) { setFormErr('Inserisci nome e numero di telefono.'); return; }
    if (!preview) {
      setFormErr('Genera prima il preventivo con il pulsante "Genera preventivo".');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    try {
      setSending(true); setFormErr('');
      const res = await axios.post(`${API}/landing-preventivo/richiesta`, {
        nome: nome.trim(), telefono: telefono.trim(), email: email.trim() || undefined,
        messaggio: messaggio.trim() || undefined, voci: vociBody(), utm: utmRef.current,
      });
      setInviata({ numero: res.data?.preventivo?.numero || '', totale: res.data?.preventivo?.totale ?? preview.totale });
      fbq('Lead', { content_name: 'Preventivo prestazioni' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setFormErr(e?.response?.data?.message || "Errore nell'invio. Riprova.");
    } finally { setSending(false); }
  }

  const waUrl = () => {
    const righe = preview
      ? preview.righe.map((r: any) => `• ${r.descrizione}${r.unitaMisura ? ` (${r.unitaMisura})` : ''} x${r.quantita} a ${euro(r.prezzoUnitario)}${r.promo ? ' (PROMO)' : ''} = ${euro(r.importo)}`).join('\n')
      : '';
    const sc = preview?.scontoApplicato ? `\nSubtotale: ${euro(preview.subtotale)}\nSconto più servizi ${preview.scontoPerc}%: -${euro(preview.sconto)}` : '';
    const intro = nome.trim() ? `Buongiorno, sono ${nome.trim()}.` : 'Buongiorno,';
    const testo = preview
      ? `${intro} ho calcolato questo preventivo sul vostro sito:\n${righe}${sc}\nTOTALE: ${euro(preview.totale)}\n\nVorrei maggiori informazioni e confermare disponibilità e tariffa nella mia zona.${messaggio.trim() ? `\n\nMessaggio: ${messaggio.trim()}` : ''}`
      : `${intro} vorrei informazioni sulle vostre prestazioni a domicilio e un preventivo.${messaggio.trim() ? `\n\nMessaggio: ${messaggio.trim()}` : ''}`;
    return `https://wa.me/${WA}?text=${encodeURIComponent(testo)}`;
  };

  const inp: React.CSSProperties = { width: '100%', padding: '11px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.95rem', boxSizing: 'border-box', fontFamily: 'inherit' };
  const lbl: React.CSSProperties = { display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: 5 };
  const btnWa: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 16px', borderRadius: 10, background: '#25d366', color: '#fff', fontWeight: 800, textDecoration: 'none', fontSize: '0.95rem', border: 'none', cursor: 'pointer' };
  const btnBlu: React.CSSProperties = { ...btnWa, background: '#1e4d8c' };
  const cat = categorie.find(c => c.key === catAttiva);

  // ── Schermata di conferma invio ─────────────────────────────────────────────
  if (inviata) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#eff6ff,#ffffff 55%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 8px 30px rgba(0,0,0,.08)', padding: '44px 36px', maxWidth: 540, textAlign: 'center', border: '1px solid #dbeafe' }}>
        <CheckCircle size={56} color="#16a34a" style={{ margin: '0 auto 16px' }} />
        <h1 style={{ color: '#1e293b', fontSize: '1.5rem', margin: '0 0 10px' }}>Richiesta inviata!</h1>
        <p style={{ color: '#64748b', lineHeight: 1.6, margin: '0 0 14px' }}>Grazie <strong>{nome.split(' ')[0]}</strong>, ti ricontatteremo al più presto al numero <strong>{telefono}</strong>.</p>
        <p style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 12, color: '#1e3a8a', fontSize: '0.9rem' }}>Preventivo <strong>{inviata.numero}</strong> registrato — totale <strong>{euro(inviata.totale)}</strong>.</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 18 }}>
          <a href={waUrl()} target="_blank" rel="noopener" style={btnWa}><MessageCircle size={18} /> Scrivici su WhatsApp</a>
          <a href={`tel:${TEL_HREF}`} style={btnBlu}><Phone size={18} /> Chiama {TEL}</a>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#eff6ff,#ffffff 55%)', fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
      <style>{`@media (max-width: 640px) { .landing-hide-mobile { display: none; } }`}</style>

      <header style={{ background: '#fff', borderBottom: '1px solid #dbeafe', padding: '12px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo.png" alt="Abbraccio Cure Domiciliari" style={{ height: 46, width: 'auto', display: 'block' }} onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />
          <div>
            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.05rem', lineHeight: 1.1 }}>Abbraccio Cure Domiciliari</div>
            <div style={{ fontSize: '0.75rem', color: '#1e4d8c', fontWeight: 600 }}>Infermieri · OSS · Visite mediche · Esami a domicilio</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <a href={`tel:${TEL_HREF}`} style={{ ...btnBlu, padding: '8px 12px', fontSize: '0.82rem' }}><Phone size={15} /> <span className="landing-hide-mobile">{TEL}</span></a>
            <a href={waUrl()} target="_blank" rel="noopener" style={{ ...btnWa, padding: '8px 12px', fontSize: '0.82rem' }}><MessageCircle size={15} /> <span className="landing-hide-mobile">WhatsApp</span></a>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 16px 48px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <span style={{ background: '#dbeafe', color: '#1e3a8a', padding: '6px 14px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 700 }}>Preventivo online gratuito</span>
          <h1 style={{ color: '#1e293b', fontSize: 'clamp(1.5rem,4vw,2.2rem)', margin: '14px 0 8px', fontWeight: 800 }}>Calcola il costo delle prestazioni sanitarie a domicilio</h1>
          <p style={{ color: '#64748b', maxWidth: 640, margin: '0 auto', lineHeight: 1.6 }}>Accessi infermieristici, assistenza OSS, visite specialistiche, prelievi, fisioterapia ed esami direttamente a casa tua, a Roma e provincia. Scegli le prestazioni dal nostro listino e genera il preventivo in 1 minuto.</p>
          <span style={{ display: 'inline-block', marginTop: 12, background: '#dcfce7', color: '#166534', padding: '6px 14px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 700 }}>🎉 Combina 2 o più servizi nello stesso preventivo: sconto {SCONTO}% automatico</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 20, alignItems: 'start' }}>

          {/* ── Colonna calcolatore ── */}
          <div style={{ background: 'linear-gradient(165deg,#eff6ff 0%,#ffffff 55%)', borderRadius: 16, border: '1px solid #93c5fd', boxShadow: '0 8px 24px rgba(30,77,140,.10)', overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(90deg,#1e3a8a,#1e4d8c)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Calculator size={20} color="#fff" />
              <div>
                <h2 style={{ fontSize: '1.05rem', color: '#fff', margin: 0, fontWeight: 800 }}>Calcolatore prestazioni</h2>
                <div style={{ fontSize: '0.72rem', color: '#dbeafe' }}>listino ufficiale Abbraccio Cure Domiciliari</div>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 14, padding: '22px 24px 24px' }}>

              {presel && (
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, padding: '10px 12px', fontSize: '0.82rem', color: '#065f46', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>Stai calcolando il preventivo per <strong>{presel.label}</strong>.{presel.voceNome
                    ? <> La prestazione <strong>«{presel.voceNome}»</strong> è già nel preventivo: regola la quantità o aggiungi altri servizi (sconto {SCONTO}% dal secondo).</>
                    : ' Scegli qui sotto la prestazione specifica dal listino.'}</span>
                </div>
              )}
              {initErr && <p style={{ color: '#dc2626', fontSize: '0.88rem', margin: 0 }}>{initErr}</p>}
              {!initErr && categorie.length === 0 && <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: 0 }}>⏳ Caricamento listino...</p>}

              {categorie.length > 0 && (<>
                <div>
                  <span style={lbl}>Tipo di prestazione <Hint text="Scegli la categoria: ogni categoria raggruppa le prestazioni del nostro listino. Puoi aggiungere prestazioni da più categorie allo stesso preventivo." /></span>
                  <select value={catAttiva} onChange={e => setCatAttiva(e.target.value)} style={inp}>
                    {categorie.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                  {cat && <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{cat.descrizione}</span>}
                  <button type="button" onClick={() => setMostraCategorie(m => !m)}
                    style={{ marginTop: 6, border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: '#1e4d8c', fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <HelpCircle size={14} /> {mostraCategorie ? 'Nascondi elenco categorie' : 'Mostra tutte le categorie del listino'}
                  </button>
                  {mostraCategorie && (
                    <div style={{ marginTop: 6, border: '1px solid #dbeafe', borderRadius: 10, overflow: 'hidden' }}>
                      {categorie.map(c => (
                        <button key={c.key} type="button" onClick={() => { setCatAttiva(c.key); setMostraCategorie(false); }}
                          style={{ display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid #eff6ff', padding: '9px 12px', cursor: 'pointer', background: c.key === catAttiva ? '#dbeafe' : '#fff', fontFamily: 'inherit' }}>
                          <ShieldCheck size={16} color="#1e4d8c" style={{ flexShrink: 0, marginTop: 2 }} />
                          <span>
                            <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>{c.label} <span style={{ color: '#94a3b8', fontWeight: 500 }}>· {c.voci.length} voci</span></span>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>{c.descrizione}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {cat && (
                  <div style={{ background: '#fff', border: '1px solid #dbeafe', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '8px 12px', background: '#f8fafc', fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Prestazione</span>
                      <span>Prezzo · Quantità <Hint text="I prezzi sono quelli del listino ufficiale Abbraccio. Le prestazioni contrassegnate PROMO hanno un prezzo promozionale: il listino è mostrato barrato. La quantità indica accessi, ore o esami." /></span>
                    </div>
                    <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                      {cat.voci.map(v => {
                        const q = sel[v.id] || 0;
                        return (
                          <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderBottom: '1px solid #f1f5f9', background: q > 0 ? '#eff6ff' : v.promo ? '#fff7f7' : '#fff' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{v.nome}</div>
                              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                <Prezzo v={v} suffisso={v.unitaMisura ? ` / ${v.unitaMisura}` : ''} />
                                {v.note ? ` · ${v.note}` : ''}
                              </div>
                            </div>
                            {q === 0 ? (
                              <button type="button" onClick={() => setQty(v.id, 1)}
                                style={{ border: '1px solid #1e4d8c', background: '#fff', color: '#1e4d8c', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                <Plus size={14} /> Aggiungi
                              </button>
                            ) : (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                <button type="button" onClick={() => setQty(v.id, q - 1)} style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={13} /></button>
                                <input type="number" min={1} max={999} value={q} onChange={e => setQty(v.id, Number(e.target.value) || 1)}
                                  style={{ width: 46, textAlign: 'center', padding: '5px 2px', border: '1px solid #cbd5e1', borderRadius: 6, fontWeight: 700 }} />
                                <button type="button" onClick={() => setQty(v.id, q + 1)} style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={13} /></button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {nSel > 0 && (
                  <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0c4a6e', marginBottom: 6 }}>
                      Prestazioni selezionate ({nSel})<Hint text="La quantità indica quanti accessi, ore o esami vuoi preventivare. Es. 'Assistenza OSS x 20' = 20 ore; 'Medicazioni x 5' = 5 accessi. Puoi combinare prestazioni di categorie diverse in un unico preventivo." />
                    </div>
                    <div style={{ fontSize: '0.76rem', fontWeight: 700, padding: '6px 9px', borderRadius: 8, marginBottom: 8, background: nSel >= 2 ? '#dcfce7' : '#fef9c3', color: nSel >= 2 ? '#166534' : '#854d0e' }}>
                      {nSel >= 2 ? `✓ Hai diritto allo sconto più servizi del ${SCONTO}%` : `💡 Aggiungi un altro servizio e ottieni il ${SCONTO}% di sconto sul totale`}
                    </div>
                    {tutteVoci.filter(v => sel[v.id] > 0).map(v => (
                      <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#334155', padding: '3px 0' }}>
                        <span style={{ flex: 1 }}>{v.nome} <strong>× {sel[v.id]}</strong>{v.promo && <span style={{ color: '#b91c1c', fontWeight: 800, fontSize: '0.7rem' }}> PROMO</span>}</span>
                        <span style={{ fontWeight: 600 }}>{euro(v.prezzo * sel[v.id])}</span>
                        <button type="button" onClick={() => setQty(v.id, 0)} title="Rimuovi" style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', padding: 2 }}><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}

                <button type="button" onClick={genera} disabled={loading || nSel === 0}
                  style={{ marginTop: 4, width: '100%', padding: 14, border: 'none', borderRadius: 10, background: loading || nSel === 0 ? '#93c5fd' : 'linear-gradient(135deg,#1e3a8a,#1e4d8c)', color: '#fff', fontWeight: 800, fontSize: '1rem', cursor: loading ? 'wait' : nSel === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 14px rgba(30,77,140,.30)' }}>
                  <Calculator size={18} /> {loading ? 'Calcolo in corso...' : preview ? 'Rigenera preventivo' : 'Genera preventivo'}
                </button>
              </>)}
            </div>
          </div>

          {/* ── Colonna preventivo ── */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #dbeafe', boxShadow: '0 4px 20px rgba(0,0,0,.05)', padding: 24, position: 'sticky', top: 80 }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.05rem', color: '#1e293b', margin: '0 0 14px' }}><FileText size={20} color="#1e4d8c" /> Il tuo preventivo</h2>
            {loading && <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>⏳ Calcolo in corso...</p>}
            {err && <p style={{ color: '#dc2626', fontSize: '0.88rem' }}>{err}</p>}
            {preview && !err && (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <tbody>
                    {preview.righe.map((r: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 6px 8px 0', color: '#475569' }}>
                          {r.descrizione}{r.unitaMisura ? <span style={{ color: '#94a3b8' }}> ({r.unitaMisura})</span> : ''}
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            {r.quantita} × {r.promo
                              ? <><span style={{ textDecoration: 'line-through' }}>{euro(r.prezzoListino)}</span> <span style={{ color: '#b91c1c', fontWeight: 800 }}>{euro(r.prezzoUnitario)} PROMO</span></>
                              : euro(r.prezzoUnitario)}{r.note ? ` · ${r.note}` : ''}
                          </div>
                        </td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{euro(r.importo)}</td>
                      </tr>
                    ))}
                    {preview.scontoApplicato && (<>
                      <tr style={{ borderTop: '2px solid #e2e8f0' }}>
                        <td style={{ padding: '8px 6px 4px 0', color: '#64748b' }}>Subtotale</td>
                        <td style={{ padding: '8px 0 4px', textAlign: 'right', color: '#64748b', whiteSpace: 'nowrap' }}>{euro(preview.subtotale)}</td>
                      </tr>
                      <tr style={{ background: '#f0fdf4' }}>
                        <td style={{ padding: '6px 6px 6px 4px', color: '#166534', fontWeight: 700 }}>
                          🎉 Sconto più servizi {preview.scontoPerc}%
                          <div style={{ fontSize: '0.7rem', fontWeight: 500, color: '#15803d' }}>{preview.righe.length} prestazioni in un unico preventivo</div>
                        </td>
                        <td style={{ padding: '6px 4px 6px 0', textAlign: 'right', color: '#166534', fontWeight: 800, whiteSpace: 'nowrap' }}>-{euro(preview.sconto)}</td>
                      </tr>
                    </>)}
                  </tbody>
                </table>
                <div style={{ background: 'linear-gradient(135deg,#1e3a8a,#1e4d8c)', borderRadius: 12, padding: '16px 18px', marginTop: 14, color: '#fff' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, opacity: 0.9 }}>TOTALE PREVENTIVO</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.2 }}>{euro(preview.totale)}</div>
                    {preview.scontoApplicato && <div style={{ fontSize: '0.95rem', textDecoration: 'line-through', opacity: 0.7 }}>{euro(preview.subtotale)}</div>}
                    {preview.scontoApplicato && <span style={{ background: '#16a34a', color: '#fff', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: 999 }}>-{preview.scontoPerc}%</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>
                    {preview.righe.length} {preview.righe.length === 1 ? 'prestazione' : 'prestazioni'} · prestazioni sanitarie esenti IVA
                    {!preview.scontoApplicato && <> · <strong>aggiungi un altro servizio per il {SCONTO}% di sconto</strong></>}
                  </div>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '9px 11px', marginTop: 12, lineHeight: 1.5 }}>
                  ⚠️ <strong>Tariffe indicative.</strong> L'importo può subire variazioni in base alle condizioni domiciliari e assistenziali specifiche (distanza, orari, materiali, urgenza): la tariffa definitiva viene confermata dopo il contatto, senza impegno.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                  <a href={waUrl()} target="_blank" rel="noopener" style={btnWa}><MessageCircle size={17} /> Invia su WhatsApp</a>
                  <a href={`tel:${TEL_HREF}`} style={btnBlu}><Phone size={17} /> Telefona</a>
                </div>
                <button type="button" onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  style={{ marginTop: 8, width: '100%', padding: 10, border: '1px solid #1e4d8c', borderRadius: 10, background: '#fff', color: '#1e4d8c', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' }}>
                  <Send size={15} /> Oppure compila il modulo
                </button>
              </>
            )}
            {!preview && !loading && !err && (
              <div style={{ textAlign: 'center', padding: '26px 10px', color: '#94a3b8' }}>
                <Calculator size={34} color="#93c5fd" style={{ margin: '0 auto 10px' }} />
                <p style={{ fontSize: '0.88rem', margin: 0, lineHeight: 1.55 }}>Nessun preventivo ancora.<br />Aggiungi le prestazioni e premi <strong style={{ color: '#1e4d8c' }}>«Genera preventivo»</strong>:<br />se modifichi qualcosa dovrai rigenerarlo.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Modulo contatto ── */}
        <div ref={formRef} style={{ background: '#fff', borderRadius: 16, border: '1px solid #dbeafe', boxShadow: '0 4px 20px rgba(0,0,0,.05)', padding: 26, marginTop: 24 }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.1rem', color: '#1e293b', margin: '0 0 6px' }}><Send size={20} color="#1e4d8c" /> Richiedi appuntamento o maggiori informazioni</h2>
          <p style={{ color: '#475569', fontSize: '0.9rem', margin: '0 0 6px', lineHeight: 1.55 }}><strong>Siamo a tua disposizione.</strong> Compila il modulo: verifichiamo la disponibilità del personale nella tua zona e ti confermiamo la tariffa calcolata — <strong>senza impegno</strong>.</p>
          <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0 0 18px' }}>Inviando il modulo registreremo il tuo preventivo e ti ricontatteremo noi. Preferisci parlare subito? <a href={`tel:${TEL_HREF}`} style={{ color: '#1e4d8c', fontWeight: 700 }}>{TEL}</a> o <a href={waUrl()} target="_blank" rel="noopener" style={{ color: '#16a34a', fontWeight: 700 }}>WhatsApp</a>.</p>
          <form onSubmit={invia}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
              <div><span style={lbl}>Nome e cognome *</span><input style={inp} value={nome} onChange={e => setNome(e.target.value)} placeholder="Mario Rossi" /></div>
              <div><span style={lbl}>Telefono *</span><input style={inp} type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="333 1234567" /></div>
              <div><span style={lbl}>Email</span><input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="mario@email.it" /></div>
            </div>
            <div style={{ marginTop: 12 }}><span style={lbl}>Messaggio</span>
              <textarea style={{ ...inp, resize: 'vertical' }} rows={3} value={messaggio} onChange={e => setMessaggio(e.target.value)} placeholder="Raccontaci le tue esigenze, zona, quando vuoi essere ricontattato..." />
            </div>
            {formErr && <p style={{ color: '#dc2626', fontSize: '0.88rem' }}>{formErr}</p>}
            <button type="submit" disabled={sending}
              style={{ marginTop: 14, width: '100%', padding: 14, border: 'none', borderRadius: 10, background: sending ? '#93c5fd' : 'linear-gradient(135deg,#1e3a8a,#1e4d8c)', color: '#fff', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}>
              <Send size={18} /> {sending ? 'Invio in corso...' : 'Invia richiesta con il tuo preventivo'}
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
              <a href={waUrl()} target="_blank" rel="noopener" style={btnWa}><MessageCircle size={17} /> Invia su WhatsApp</a>
              <a href={`tel:${TEL_HREF}`} style={btnBlu}><Phone size={17} /> Telefona {TEL}</a>
            </div>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem', marginTop: 24 }}>
          Abbraccio Cure Domiciliari S.R.L.S. · Via di S. Maria Ausiliatrice 4/B, Roma · {TEL} · Prestazioni sanitarie a domicilio a Roma e provincia
        </p>
      </main>
    </div>
  );
}
