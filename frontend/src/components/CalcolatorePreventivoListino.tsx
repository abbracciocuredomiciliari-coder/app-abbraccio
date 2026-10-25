import { useEffect, useState } from 'react';
import axios from 'axios';
import { Calculator, CheckCircle, FileText, Info, Plus, Minus, Trash2, Stethoscope, Tag } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.abbracciocuredomiciliari.it/api';

interface VoceListino { id: string; nome: string; prezzo: number; prezzoListino: number; promo: boolean; unitaMisura: string | null; note: string | null }
interface CategoriaListino { key: string; label: string; descrizione: string; ordine: number; voci: VoceListino[] }
interface Riga { voceId: string; categoria: string; descrizione: string; unitaMisura?: string; note?: string; quantita: number; prezzoUnitario: number; prezzoListino: number; promo: boolean; importo: number }
interface Preventivo { righe: Riga[]; subtotale: number; scontoPerc: number; sconto: number; totale: number; scontoApplicato: boolean }
const SCONTO_PERC = 5; // sconto "più servizi": allineato al server

// Riga pronta per POST /fatturazione-documenti (prestazioni)
export interface RigaDocumento {
  descrizione: string;
  quantita: number;
  prezzoUnitario: number;
  tipo?: string;
  aliquotaIva?: number;
}
export interface RisultatoCalcolatore {
  prestazioni: RigaDocumento[];
  subtotale: number;
  sconto: number;
  scontoApplicato: boolean;
  totale: number;
}

function InfoNote({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }} title={text} aria-label="Cosa significa questa voce"
        style={{ border: 'none', background: 'none', padding: '0 0 0 6px', cursor: 'pointer', color: '#0284c7', display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}>
        <Info size={15} />
      </button>
      {open && (
        <div style={{ fontWeight: 400, fontSize: '0.76rem', color: '#0c4a6e', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '8px 10px', marginTop: '5px', lineHeight: 1.45 }}>
          {text}
        </div>
      )}
    </>
  );
}

const euro = (n: number) => `€ ${Number(n || 0).toFixed(2).replace('.', ',')}`;

// ═════════════════════════════════════════════════════════════════════════════
// Calcolatore preventivo dal listino — stessa UI della landing pubblica
// /preventivo, ma riusabile dentro l'area riservata (Pazienti, Accettazione,
// Centro Prenotazioni). I prezzi e i totali sono calcolati dal server.
// ═════════════════════════════════════════════════════════════════════════════
export default function CalcolatorePreventivoListino({ onConferma, onChiudi, labelConferma }: {
  onConferma: (r: RisultatoCalcolatore) => void;
  onChiudi?: () => void;
  labelConferma?: string;
}) {
  const [categorie, setCategorie] = useState<CategoriaListino[]>([]);
  const [listinoErr, setListinoErr] = useState('');
  const [categoriaAttiva, setCategoriaAttiva] = useState('');
  const [selezione, setSelezione] = useState<Record<string, number>>({});
  const [showLegenda, setShowLegenda] = useState(false);
  const [applicaSconto, setApplicaSconto] = useState(true);

  const [prev, setPrev] = useState<Preventivo | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    axios.get(`${API_BASE}/landing-preventivo/listino`)
      .then(res => {
        const cats: CategoriaListino[] = res.data?.categorie || [];
        setCategorie(cats);
        if (cats.length > 0) setCategoriaAttiva(cats[0].key);
      })
      .catch(() => setListinoErr('Listino non disponibile al momento.'));
  }, []);

  const tutteVoci = categorie.flatMap(c => c.voci);
  const vociBody = () => Object.entries(selezione).filter(([, q]) => q > 0).map(([id, quantita]) => ({ id, quantita }));
  const numSelezionate = vociBody().length;

  const invalida = () => setPrev(null);
  const setQta = (id: string, q: number) => {
    setSelezione(s => {
      const n = { ...s };
      if (q <= 0) delete n[id]; else n[id] = Math.min(q, 999);
      return n;
    });
    invalida();
  };

  const Prezzo = ({ v, suffisso }: { v: VoceListino; suffisso?: string }) => v.promo ? (
    <>
      <span style={{ textDecoration: 'line-through', color: '#94a3b8' }}>{euro(v.prezzoListino)}</span>{' '}
      <span style={{ color: '#b91c1c', fontWeight: 800 }}>{euro(v.prezzo)}</span>{suffisso}
      <span style={{ marginLeft: '6px', background: '#fee2e2', color: '#b91c1c', fontSize: '0.66rem', fontWeight: 800, padding: '1px 6px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', gap: '3px', verticalAlign: 'middle' }}><Tag size={10} /> PROMO</span>
    </>
  ) : <>{euro(v.prezzo)}{suffisso}</>;

  async function genera() {
    if (numSelezionate === 0) { setPreviewError('Seleziona almeno una prestazione dal listino.'); return; }
    try {
      setPreviewLoading(true);
      setPreviewError('');
      const res = await axios.post(`${API_BASE}/landing-preventivo/preview`, { voci: vociBody() });
      setPrev(res.data);
    } catch (err: any) {
      setPrev(null);
      setPreviewError(err?.response?.data?.message || 'Controlla le prestazioni selezionate');
    } finally {
      setPreviewLoading(false);
    }
  }

  const scontoAttivo = applicaSconto && !!prev?.scontoApplicato;
  const totaleFinale = prev ? (scontoAttivo ? prev.totale : prev.subtotale) : 0;

  function conferma() {
    if (!prev) return;
    const prestazioni: RigaDocumento[] = prev.righe.map(r => ({
      descrizione: `${r.descrizione}${r.unitaMisura ? ` (${r.unitaMisura})` : ''}${r.promo ? ` — PROMO (listino €${r.prezzoListino.toFixed(2)})` : ''}`,
      quantita: r.quantita,
      prezzoUnitario: r.prezzoUnitario,
      tipo: r.categoria,
      aliquotaIva: 0,
    }));
    if (scontoAttivo) {
      prestazioni.push({
        descrizione: `Sconto più servizi ${prev.scontoPerc}% (${prev.righe.length} prestazioni)`,
        quantita: 1,
        prezzoUnitario: -prev.sconto,
        tipo: 'sconto',
        aliquotaIva: 0,
      });
    }
    onConferma({ prestazioni, subtotale: prev.subtotale, sconto: scontoAttivo ? prev.sconto : 0, scontoApplicato: scontoAttivo, totale: totaleFinale });
  }

  const input: React.CSSProperties = { width: '100%', padding: '11px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box', fontFamily: 'inherit' };
  const label: React.CSSProperties = { display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '5px' };

  const catCorrente = categorie.find(c => c.key === categoriaAttiva);

  return (
    <div style={{ fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '16px', alignItems: 'start' }}>
        {/* Calcolatore */}
        <div style={{ background: 'linear-gradient(165deg,#eff6ff 0%,#ffffff 55%)', borderRadius: '16px', border: '1px solid #93c5fd', boxShadow: '0 8px 24px rgba(30,77,140,.10)', overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(90deg,#1e3a8a,#1e4d8c)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calculator size={20} color="#fff" />
            <div>
              <h2 style={{ fontSize: '1rem', color: '#fff', margin: 0, fontWeight: 800 }}>Calcolatore prestazioni</h2>
              <div style={{ fontSize: '0.72rem', color: '#dbeafe' }}>listino ufficiale Abbraccio Cure Domiciliari</div>
            </div>
          </div>
          <div style={{ display: 'grid', gap: '12px', padding: '16px 18px 18px' }}>
            {listinoErr && <p style={{ color: '#dc2626', fontSize: '0.88rem', margin: 0 }}>{listinoErr}</p>}
            {!listinoErr && categorie.length === 0 && <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: 0 }}>⏳ Caricamento listino...</p>}

            {categorie.length > 0 && (
              <>
                <div>
                  <span style={label}>Tipo di prestazione <InfoNote text="Scegli la categoria: ogni categoria raggruppa le prestazioni del listino. Puoi aggiungere prestazioni da più categorie allo stesso preventivo." /></span>
                  <select value={categoriaAttiva} onChange={e => setCategoriaAttiva(e.target.value)} style={input}>
                    {categorie.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                  {catCorrente && <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{catCorrente.descrizione}</span>}
                  <button type="button" onClick={() => setShowLegenda(o => !o)}
                    style={{ marginTop: '6px', border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: '#1e4d8c', fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Info size={14} /> {showLegenda ? 'Nascondi la legenda delle categorie' : 'Quale categoria scegliere? Legenda'}
                  </button>
                  {showLegenda && (
                    <div style={{ marginTop: '8px', background: '#fff', border: '1px solid #bfdbfe', borderRadius: '10px', overflow: 'hidden' }}>
                      {categorie.map(c => (
                        <button key={c.key} type="button" onClick={() => { setCategoriaAttiva(c.key); setShowLegenda(false); }}
                          style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid #eff6ff', padding: '9px 12px', cursor: 'pointer', background: c.key === categoriaAttiva ? '#dbeafe' : '#fff', fontFamily: 'inherit' }}>
                          <Stethoscope size={16} color="#1e4d8c" style={{ flexShrink: 0, marginTop: '2px' }} />
                          <span>
                            <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>{c.label} <span style={{ color: '#94a3b8', fontWeight: 500 }}>· {c.voci.length} voci</span></span>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>{c.descrizione}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Voci della categoria */}
                {catCorrente && (
                  <div style={{ background: '#fff', border: '1px solid #dbeafe', borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{ padding: '8px 12px', background: '#f8fafc', fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Prestazione</span><span>Prezzo · Quantità</span>
                    </div>
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {catCorrente.voci.map(v => {
                        const q = selezione[v.id] || 0;
                        return (
                          <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderBottom: '1px solid #f1f5f9', background: q > 0 ? '#eff6ff' : v.promo ? '#fff7f7' : '#fff' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{v.nome}</div>
                              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                <Prezzo v={v} suffisso={v.unitaMisura ? ` / ${v.unitaMisura}` : ''} />{v.note ? ` · ${v.note}` : ''}
                              </div>
                            </div>
                            {q === 0 ? (
                              <button type="button" onClick={() => setQta(v.id, 1)} style={{ border: '1px solid #1e4d8c', background: '#fff', color: '#1e4d8c', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                <Plus size={14} /> Aggiungi
                              </button>
                            ) : (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                <button type="button" onClick={() => setQta(v.id, q - 1)} style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: '6px', width: '28px', height: '28px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={13} /></button>
                                <input type="number" min={1} max={999} value={q} onChange={e => setQta(v.id, Number(e.target.value) || 1)} style={{ width: '46px', textAlign: 'center', padding: '5px 2px', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 700 }} />
                                <button type="button" onClick={() => setQta(v.id, q + 1)} style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: '6px', width: '28px', height: '28px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={13} /></button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Riepilogo selezione */}
                {numSelezionate > 0 && (
                  <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0c4a6e', marginBottom: '6px' }}>
                      Prestazioni selezionate ({numSelezionate})
                    </div>
                    <div style={{ fontSize: '0.76rem', fontWeight: 700, padding: '6px 9px', borderRadius: '8px', marginBottom: '8px', background: numSelezionate >= 2 ? '#dcfce7' : '#fef9c3', color: numSelezionate >= 2 ? '#166534' : '#854d0e' }}>
                      {numSelezionate >= 2
                        ? `🎉 Sconto ${SCONTO_PERC}% "più servizi" disponibile`
                        : `💡 Aggiungi un altro servizio per lo sconto ${SCONTO_PERC}%`}
                    </div>
                    {tutteVoci.filter(v => selezione[v.id] > 0).map(v => (
                      <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#334155', padding: '3px 0' }}>
                        <span style={{ flex: 1 }}>{v.nome} <strong>× {selezione[v.id]}</strong>{v.promo && <span style={{ color: '#b91c1c', fontWeight: 800, fontSize: '0.7rem' }}> PROMO</span>}</span>
                        <span style={{ fontWeight: 600 }}>{euro(v.prezzo * selezione[v.id])}</span>
                        <button type="button" onClick={() => setQta(v.id, 0)} title="Rimuovi" style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', padding: '2px' }}><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}

                <button type="button" onClick={genera} disabled={previewLoading || numSelezionate === 0}
                  style={{ marginTop: '2px', width: '100%', padding: '13px', border: 'none', borderRadius: '10px', background: previewLoading || numSelezionate === 0 ? '#93c5fd' : 'linear-gradient(135deg,#1e3a8a,#1e4d8c)', color: '#fff', fontWeight: 800, fontSize: '0.95rem', cursor: previewLoading ? 'wait' : numSelezionate === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Calculator size={17} /> {previewLoading ? 'Calcolo in corso...' : prev ? 'Rigenera preventivo' : 'Genera preventivo'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Preventivo */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #dbeafe', boxShadow: '0 4px 20px rgba(0,0,0,.05)', padding: '18px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', color: '#1e293b', margin: '0 0 12px' }}>
            <FileText size={19} color="#1e4d8c" /> Anteprima preventivo
          </h2>
          {previewLoading && <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>⏳ Calcolo in corso...</p>}
          {previewError && <p style={{ color: '#dc2626', fontSize: '0.88rem' }}>{previewError}</p>}
          {prev && !previewError && (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <tbody>
                  {prev.righe.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '7px 6px 7px 0', color: '#475569' }}>
                        {r.descrizione}{r.unitaMisura ? <span style={{ color: '#94a3b8' }}> ({r.unitaMisura})</span> : ''}
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                          {r.quantita} × {r.promo ? <><span style={{ textDecoration: 'line-through' }}>{euro(r.prezzoListino)}</span> <span style={{ color: '#b91c1c', fontWeight: 800 }}>{euro(r.prezzoUnitario)} PROMO</span></> : euro(r.prezzoUnitario)}
                        </div>
                      </td>
                      <td style={{ padding: '7px 0', textAlign: 'right', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{euro(r.importo)}</td>
                    </tr>
                  ))}
                  {prev.scontoApplicato && (
                    <tr style={{ borderTop: '2px solid #e2e8f0' }}>
                      <td style={{ padding: '8px 6px 4px 0', color: '#64748b' }}>Subtotale</td>
                      <td style={{ padding: '8px 0 4px', textAlign: 'right', color: '#64748b', whiteSpace: 'nowrap' }}>{euro(prev.subtotale)}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {prev.scontoApplicato && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', background: applicaSconto ? '#f0fdf4' : '#f8fafc', border: `1px solid ${applicaSconto ? '#86efac' : '#e2e8f0'}`, borderRadius: '8px', padding: '8px 10px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={applicaSconto} onChange={e => setApplicaSconto(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#16a34a' }} />
                  <span style={{ fontSize: '0.8rem', color: applicaSconto ? '#166534' : '#64748b', fontWeight: 700 }}>
                    🎉 Applica sconto più servizi {prev.scontoPerc}% (−{euro(prev.sconto)})
                  </span>
                </label>
              )}

              <div style={{ background: 'linear-gradient(135deg,#1e3a8a,#1e4d8c)', borderRadius: '12px', padding: '14px 16px', marginTop: '12px', color: '#fff' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, opacity: 0.9 }}>TOTALE PREVENTIVO</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1.2 }}>{euro(totaleFinale)}</div>
                  {scontoAttivo && <div style={{ fontSize: '0.9rem', textDecoration: 'line-through', opacity: 0.7 }}>{euro(prev.subtotale)}</div>}
                  {scontoAttivo && <span style={{ background: '#16a34a', color: '#fff', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '999px' }}>-{prev.scontoPerc}%</span>}
                </div>
                <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>{prev.righe.length} {prev.righe.length === 1 ? 'prestazione' : 'prestazioni'} · esenti IVA</div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                {onChiudi && (
                  <button type="button" onClick={onChiudi}
                    style={{ padding: '11px 14px', border: '1px solid #cbd5e1', borderRadius: '10px', background: '#fff', color: '#475569', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Annulla
                  </button>
                )}
                <button type="button" onClick={conferma}
                  style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '10px', background: 'linear-gradient(135deg,#15803d,#16a34a)', color: '#fff', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontFamily: 'inherit' }}>
                  <CheckCircle size={17} /> {labelConferma || 'Usa questo preventivo'}
                </button>
              </div>
            </>
          )}
          {!prev && !previewLoading && !previewError && (
            <div style={{ textAlign: 'center', padding: '26px 10px', color: '#94a3b8' }}>
              <Calculator size={34} color="#93c5fd" style={{ margin: '0 auto 10px' }} />
              <p style={{ fontSize: '0.88rem', margin: 0, lineHeight: 1.55 }}>
                Nessun preventivo ancora.<br />
                Aggiungi le prestazioni e premi <strong style={{ color: '#1e4d8c' }}>«Genera preventivo»</strong>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
