import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Phone, Send, Calculator, CheckCircle } from 'lucide-react';

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'https://api.abbracciocuredomiciliari.it/api';
const TEL = '06 01905242';
const TEL_HREF = '0601905242';
const WA = '393514175117';

const TIPI_CONTRATTO = [
  { value: 'non_convivente', label: 'Non convivente (a ore)', livelli: ['A', 'AS', 'B', 'BS', 'C', 'CS', 'D', 'DS'], orario: true },
  { value: 'convivente', label: 'Convivente full-time', livelli: ['A', 'AS', 'B', 'BS', 'C', 'CS', 'D', 'DS'], orario: false },
  { value: 'convivente_part_time', label: 'Convivente part-time (30 ore)', livelli: ['B', 'BS', 'C'], orario: false },
  { value: 'assistenza_notturna', label: 'Convivente — assistenza notturna', livelli: ['BS', 'CS', 'DS'], orario: false },
  { value: 'presenza_notturna', label: 'Convivente — presenza notturna', livelli: [], orario: false },
  { value: 'sostituzione', label: 'Sostituzione (giorni di riposo)', livelli: ['CS', 'DS'], orario: true },
];

const LIVELLI_DESC: Record<string, string> = {
  A: 'Operatore base', AS: 'Operatore base super', B: 'Badante/colf convivente', BS: 'Badante convivente per NON autosufficienti',
  C: 'Assistente qualificato', CS: 'Assistente a persona NON autosufficiente', D: 'Assistente non autosufficienti qualificato', DS: 'Massima qualifica',
};

const euro = (n: number) => `€${Number(n || 0).toFixed(2).replace('.', ',')}`;

function utm() {
  const q = new URLSearchParams(window.location.search);
  const o: Record<string, string> = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(k => { const v = q.get(k); if (v) o[k] = v; });
  return o;
}

export default function LandingBadante() {
  const [searchParams] = useSearchParams();
  const modulo = searchParams.get('modulo') === '1';

  const [contratto, setContratto] = useState('convivente');
  const [livello, setLivello] = useState('BS');
  const [ore, setOre] = useState('30');
  const [determinato, setDeterminato] = useState(false);
  const [piuAutosuff, setPiuAutosuff] = useState(false);
  const [certUni, setCertUni] = useState(false);
  const [babysitter, setBabysitter] = useState(false);
  const [escludiTfr, setEscludiTfr] = useState(false);
  const [sim, setSim] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [nome, setNome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [messaggio, setMessaggio] = useState('');
  const [sending, setSending] = useState(false);
  const [inviata, setInviata] = useState<any>(null);

  const tipo = TIPI_CONTRATTO.find(t => t.value === contratto) || TIPI_CONTRATTO[1];

  const inputBody = () => ({
    contrattoTipo: contratto,
    livello,
    oreSettimanali: tipo.orario ? Number(ore) : undefined,
    tempoDeterminato: determinato,
    indennitaPiuAutosuff: piuAutosuff,
    certificazioneUni: certUni,
    indennitaBabysitter: babysitter,
    escludiTfrTredicesima: escludiTfr,
  });

  const costoFamiglia = useMemo(() => {
    if (!sim) return 0;
    return sim.totaleCostoMensile + (sim.cafMensile || 0) - (escludiTfr ? sim.tfr + sim.tredicesima : 0);
  }, [sim, escludiTfr]);

  async function calcola() {
    setLoading(true); setErr('');
    try {
      const res = await axios.post(`${API_BASE}/landing-badante/preview`, inputBody());
      setSim(res.data);
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Errore nel calcolo');
      setSim(null);
    } finally { setLoading(false); }
  }

  async function invia() {
    if (!nome.trim()) return setErr('Inserisci il tuo nome');
    if (!telefono.trim()) return setErr('Inserisci il numero di telefono');
    setSending(true); setErr('');
    try {
      const res = await axios.post(`${API_BASE}/landing-badante/richiesta`, { ...inputBody(), nome, telefono, email, messaggio, utm: utm() });
      setInviata(res.data);
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Errore nell\'invio. Riprova o chiamaci.');
    } finally { setSending(false); }
  }

  const waTesto = encodeURIComponent(
    sim
      ? `Preventivo badante: ${sim.contrattoLabel} ${sim.livelloLabel} — costo mensile famiglia ${euro(costoFamiglia)}/mese (${escludiTfr ? 'TFR e 13ª esclusi' : 'TFR e 13ª inclusi'}, CAF sanitario ${euro(sim.cafMensile)}/mese)`
      : 'Vorrei un preventivo per una badante'
  );

  const inp: React.CSSProperties = { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box', marginTop: 4 };
  const lbl: React.CSSProperties = { display: 'block', fontWeight: 600, color: '#334155', fontSize: '0.85rem' };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#fff7ed 0%,#ffedd5 45%,#fff 100%)', fontFamily: "'Segoe UI',system-ui,sans-serif", padding: '28px 16px 48px' }}>
      <style>{`@media (max-width: 640px) { .landing-hide-mobile { display: none !important; } }`}</style>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <img src="/logo.png" alt="Abbraccio Cure Domiciliari" style={{ height: 54, marginBottom: 8 }} onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />
          <h1 style={{ margin: 0, color: '#c2410c', fontSize: '1.7rem', fontWeight: 800 }}>Calcola il costo della badante</h1>
          <p style={{ margin: '6px 0 0', color: '#9a3412', fontSize: '0.95rem' }}>Preventivo immediato secondo CCNL lavoro domestico 2026 — badanti, colf e assistenti familiari</p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginTop: 12, background: '#f6f9ff', border: '1px solid #dfe9fb', borderRadius: 14, padding: '8px 14px' }}>
            <img src="/images/logo-salus.png" alt="Salus Group — Divisione Datoriale Casimpresa" style={{ height: 40 }} onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}><strong style={{ color: '#1e4d8c' }}>In collaborazione con Salus Group</strong><br />— Divisione Datoriale Casimpresa</span>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 8px 30px rgba(0,0,0,.08)', padding: '22px 24px 24px', border: '1px solid #ffedd5' }}>

          {!inviata && (<>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
              <label style={lbl}>Tipo di contratto
                <select style={inp} value={contratto} onChange={e => {
                  const t = TIPI_CONTRATTO.find(x => x.value === e.target.value) || TIPI_CONTRATTO[0];
                  setContratto(t.value);
                  if (t.livelli.length > 0 && !t.livelli.includes(livello)) setLivello(t.livelli[0]);
                  setSim(null);
                }}>
                  {TIPI_CONTRATTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              {tipo.livelli.length > 0 && (
                <label style={lbl}>Livello CCNL
                  <select style={inp} value={livello} onChange={e => { setLivello(e.target.value); setSim(null); }}>
                    {tipo.livelli.map(l => <option key={l} value={l}>{l} — {LIVELLI_DESC[l]}</option>)}
                  </select>
                </label>
              )}
              {tipo.orario && (
                <label style={lbl}>Ore a settimana
                  <input style={inp} type="number" min={1} max={40} value={ore} onChange={e => { setOre(e.target.value); setSim(null); }} />
                </label>
              )}
              <label style={lbl}>Durata
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  {[['Indeterminato', false], ['Determinato', true]].map(([l, v]) => (
                    <button key={l as string} type="button" onClick={() => { setDeterminato(v as boolean); setSim(null); }}
                      style={{ flex: 1, padding: '11px 8px', borderRadius: 10, border: `1.5px solid ${determinato === v ? '#f97316' : '#e2e8f0'}`, background: determinato === v ? '#fff7ed' : '#fff', color: determinato === v ? '#c2410c' : '#64748b', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>{l as string}</button>
                  ))}
                </div>
              </label>
            </div>

            {(livello === 'CS' || livello === 'DS' || livello === 'B' || livello === 'BS') && contratto !== 'sostituzione' && contratto !== 'presenza_notturna' && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Indennità applicabili</span>
                {(livello === 'CS' || livello === 'DS') && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', cursor: 'pointer', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '9px 12px' }}>
                    <input type="checkbox" checked={piuAutosuff} onChange={e => { setPiuAutosuff(e.target.checked); setSim(null); }} /> Addetto a più persone non autosufficienti
                  </label>
                )}
                {livello === 'BS' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', cursor: 'pointer', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '9px 12px' }}>
                    <input type="checkbox" checked={babysitter} onChange={e => { setBabysitter(e.target.checked); setSim(null); }} /> Babysitter bambini &lt; 6 anni
                  </label>
                )}
                {(livello === 'B' || livello === 'BS' || livello === 'CS') && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', cursor: 'pointer', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '9px 12px' }}>
                    <input type="checkbox" checked={certUni} onChange={e => { setCertUni(e.target.checked); setSim(null); }} /> Lavoratore certificato UNI 11766
                  </label>
                )}
              </div>
            )}

            <button onClick={calcola} disabled={loading || (tipo.orario && !(Number(ore) > 0))}
              style={{ width: '100%', marginTop: 18, padding: '14px', borderRadius: 12, border: 0, background: '#c2410c', color: '#fff', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 14px rgba(234,88,12,.30)' }}>
              <Calculator size={19} /> {loading ? 'Calcolo in corso...' : 'Calcola il tuo preventivo'}
            </button>

            {sim && (
              <div style={{ marginTop: 18 }}>
                <div style={{ background: '#c2410c', borderRadius: 14, padding: '16px 18px', color: '#fff' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: 1, opacity: .85 }}>COSTO MENSILE FAMIGLIA</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800 }}>{euro(costoFamiglia)}<span style={{ fontSize: '0.9rem', fontWeight: 600 }}>/mese</span></div>
                  <div style={{ fontSize: '0.78rem', opacity: .9 }}>{sim.contrattoLabel} · {sim.livelloLabel} · {sim.oreSettimanali} ore/settimana</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: '0.82rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={escludiTfr} onChange={e => setEscludiTfr(e.target.checked)} />
                    Mostra costo senza TFR e 13ª (accantonamenti esclusi)
                  </label>
                </div>
                <div style={{ marginTop: 12, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: '12px 14px', fontSize: '0.85rem', color: '#7c2d12' }}>
                  {[
                    ['Retribuzione lorda', euro(sim.retribuzioneLordaMensile)],
                    ['Contributi INPS datore', euro(sim.contribInpsDatoreMensili)],
                    ['Cassa.Colf', euro(sim.cassaColfDatoreMensili)],
                    ['Accantonamento TFR', euro(sim.tfr)],
                    ['Accantonamento 13esima', euro(sim.tredicesima)],
                    ['Gestione CAF sanitario inclusa', euro(sim.cafMensile) + '/mese'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span>{k}</span><strong>{v}</strong></div>
                  ))}
                  <div style={{ borderTop: '1px dashed #fdba74', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Netto mensile della badante</span><strong>{euro(sim.retribuzioneNetta)}</strong>
                  </div>
                </div>
                <p style={{ fontSize: '0.72rem', color: '#a8a29e', margin: '8px 0 0' }}>Stima informativa basata sul CCNL lavoro domestico e contributi INPS 2026. Non sostituisce la consulenza paghe.</p>
              </div>
            )}

            {err && <div style={{ marginTop: 12, color: '#dc2626', fontSize: '0.88rem' }}>{err}</div>}
          </>)}

          {inviata ? (
            <div style={{ textAlign: 'center', padding: '20px 8px' }}>
              <CheckCircle size={56} color="#16a34a" style={{ margin: '0 auto 12px' }} />
              <h2 style={{ color: '#15803d', margin: '0 0 8px' }}>Richiesta registrata!</h2>
              <p style={{ color: '#475569', lineHeight: 1.6 }}>
                Il tuo preventivo {inviata.preventivo ? `(${inviata.preventivo.contrattoLabel} — ${euro(inviata.preventivo.totaleCostoMensile)}/mese)` : ''} è stato registrato.
                Ti ricontatteremo al più presto al numero <strong>{telefono}</strong>.
              </p>
              <a href={`https://wa.me/${WA}`} style={{ display: 'inline-block', marginTop: 8, background: '#16a34a', color: '#fff', padding: '12px 22px', borderRadius: 10, textDecoration: 'none', fontWeight: 700 }}>Scrivici su WhatsApp</a>
            </div>
          ) : (
            <div style={{ marginTop: 22, borderTop: '1px solid #f1f5f9', paddingTop: 18 }}>
              <h3 style={{ margin: '0 0 4px', color: '#c2410c', fontSize: '1.05rem' }}>Il tuo preventivo</h3>
              <p style={{ margin: '0 0 14px', color: '#64748b', fontSize: '0.85rem' }}>Richiedi appuntamento o maggiori informazioni: ti ricontattiamo noi.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
                <input style={inp} placeholder="Nome e cognome *" value={nome} onChange={e => setNome(e.target.value)} />
                <input style={inp} type="tel" placeholder="Telefono * (es. 333 1234567)" value={telefono} onChange={e => setTelefono(e.target.value)} />
                <input style={inp} type="email" placeholder="Email (facoltativa)" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <textarea style={{ ...inp, marginTop: 10, resize: 'vertical' }} rows={3} placeholder="Messaggio (facoltativo): zona, orari, esigenze particolari..." value={messaggio} onChange={e => setMessaggio(e.target.value)} />
              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                <button onClick={invia} disabled={sending}
                  style={{ flex: 1, minWidth: 200, padding: '13px', borderRadius: 12, border: 0, background: '#c2410c', color: '#fff', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Send size={17} /> {sending ? 'Invio in corso...' : 'Invia la richiesta'}
                </button>
                <a href={`https://wa.me/${WA}?text=${waTesto}`} target="_blank" rel="noopener"
                  style={{ flex: '0 0 auto', padding: '13px 18px', borderRadius: 12, background: '#16a34a', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  Invia su WhatsApp
                </a>
                <a href={`tel:${TEL_HREF}`} className="landing-hide-mobile"
                  style={{ flex: '0 0 auto', padding: '13px 18px', borderRadius: 12, background: '#1e4d8c', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Phone size={16} /> Telefona
                </a>
              </div>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#a8a29e', fontSize: '0.75rem', marginTop: 18 }}>
          Abbraccio Cure Domiciliari · <a href={`tel:${TEL_HREF}`} style={{ color: '#c2410c' }}>{TEL}</a> · Intermediazione badanti, colf e assistenti familiari — Roma e provincia
        </p>
      </div>
    </div>
  );
}
