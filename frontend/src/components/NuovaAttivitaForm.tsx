import { useEffect, useState } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { DictationMicButton } from './DictationMicButton';
import { Plus } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// FORM NUOVO ELEMENTO — usato in Oggi e dalla scheda paziente.
// Il "tipo" guida i campi: ricontatto (chi + quando), scadenza (data),
// attesa di risposta (interlocutore + controllo), consegna (bacheca condivisa).
// Azione richiesta: textarea ampia + dettatura vocale (DictationMicButton).
// ═══════════════════════════════════════════════════════════════════════════

export type TipoElemento = 'attivita' | 'ricontatto' | 'scadenza' | 'consegna' | 'attesa';
type PraticaTipo = 'richiesta' | 'paziente' | 'intermediazione' | 'consegna' | 'documento';
interface PraticaOpt { id: string; tipo: string; label: string }
interface Utente { _id?: string; id?: string; name: string }

export const TIPO_LABEL: Record<string, string> = {
  attivita: '📋 Attività', ricontatto: '📞 Ricontatto', scadenza: '⏰ Scadenza', attesa: '⏳ Attesa risposta',
};

const TIPI: { v: TipoElemento; label: string; hint: string }[] = [
  { v: 'attivita', label: '📋 Attività da svolgere', hint: 'Un lavoro da fare, con o senza data.' },
  { v: 'ricontatto', label: '📞 Ricontatto', hint: 'Richiamare qualcuno a una data precisa.' },
  { v: 'scadenza', label: '⏰ Scadenza', hint: 'Qualcosa che deve essere chiuso entro una data.' },
  { v: 'attesa', label: '⏳ In attesa di risposta', hint: 'Aspettiamo qualcuno: registra chi e quando ricontrollare.' },
  { v: 'consegna', label: '📮 Consegna al team', hint: 'Una consegna in bacheca per tutto il gruppo.' },
];

const inputSt: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' };
const lblSt: React.CSSProperties = { display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: 3 };

export default function NuovaAttivitaForm({
  area,
  defaultPratica,
  onSaved,
  onCancel,
}: {
  area?: string;
  defaultPratica?: PraticaOpt;    // paziente già scelto (scheda paziente)
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const { user } = useAuth();
  const [tipo, setTipo] = useState<TipoElemento>('attivita');
  const [titolo, setTitolo] = useState('');
  const [azione, setAzione] = useState('');
  const [interlocutore, setInterlocutore] = useState('');
  const [dataControllo, setDataControllo] = useState('');
  const [scadenza, setScadenza] = useState('');
  const [priorita, setPriorita] = useState('normale');
  const [responsabile, setResponsabile] = useState(''); // '' = da prendere in carico | 'me' | userId
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState('');

  // Collegamento pratica (se non predefinita)
  const [praticaTipo, setPraticaTipo] = useState<PraticaTipo | ''>('');
  const [praticaQ, setPraticaQ] = useState('');
  const [praticaSel, setPraticaSel] = useState<PraticaOpt | null>(defaultPratica || null);
  const [pratiche, setPratiche] = useState<PraticaOpt[]>([]);

  useEffect(() => {
    api.get('/auth/all-users').then(r => {
      const list = (r.data || []).map((x: any) => ({ _id: x._id || x.id, name: x.name }));
      setUtenti(list.filter((x: Utente) => x._id));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!praticaTipo || praticaSel) { setPratiche([]); return; }
    const t = setTimeout(() => {
      api.get('/attivita/pratiche', { params: { tipo: praticaTipo, q: praticaQ } })
        .then(r => setPratiche(r.data || [])).catch(() => setPratiche([]));
    }, 300);
    return () => clearTimeout(t);
  }, [praticaTipo, praticaQ, praticaSel]);

  const bisognaData = tipo === 'ricontatto' || tipo === 'attesa';
  const pratica = praticaSel || (defaultPratica ?? null);

  const valido = titolo.trim().length > 0
    && (tipo !== 'consegna' || azione.trim().length > 0)
    && (!bisognaData || (!!interlocutore.trim() || tipo === 'ricontatto') && !!dataControllo)
    && (tipo !== 'ricontatto' || !!dataControllo);

  const crea = async () => {
    if (!valido || busy) return;
    setBusy(true); setErrore('');
    try {
      const responsabileId = responsabile === 'me' ? (user as any)?.id || (user as any)?._id : (responsabile || undefined);
      if (tipo === 'consegna') {
        await api.post('/consegne-amministrative', {
          titolo: titolo.trim(),
          testo: azione.trim() || titolo.trim(),
          tipo: 'generale',
          priorita: priorita === 'urgente' ? 'urgente' : 'normale',
          riferimento: pratica?.label,
          scadenza: scadenza || undefined,
        });
      } else {
        await api.post('/attivita', {
          titolo: titolo.trim(),
          tipo,
          azioneRichiesta: azione.trim() || undefined,
          praticaTipo: pratica ? pratica.tipo : 'generale',
          praticaId: pratica?.id,
          praticaLabel: pratica?.label,
          area,
          priorita,
          scadenza: tipo === 'scadenza' ? (dataControllo || scadenza) : (scadenza || undefined),
          interlocutoreAttesa: bisognaData ? interlocutore.trim() || undefined : undefined,
          dataControlloAttesa: bisognaData ? dataControllo : undefined,
          responsabileId,
        });
      }
      setTitolo(''); setAzione(''); setInterlocutore(''); setDataControllo(''); setScadenza('');
      setPraticaTipo(''); setPraticaQ(''); if (!defaultPratica) setPraticaSel(null);
      onSaved?.();
    } catch (e: any) {
      setErrore(e?.response?.data?.message || 'Errore, riprova.');
    } finally { setBusy(false); }
  };

  const tipoInfo = TIPI.find(t => t.v === tipo)!;

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {/* Tipo elemento */}
      <div>
        <span style={lblSt}>Che cos'è? *</span>
        <select style={inputSt} value={tipo} onChange={e => setTipo(e.target.value as TipoElemento)}>
          {TIPI.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
        </select>
        <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: 3 }}>{tipoInfo.hint}</div>
      </div>

      <div>
        <span style={lblSt}>Titolo *</span>
        <input style={inputSt} placeholder={tipo === 'consegna' ? 'Es. Turno di domani: copertura Rossi' : 'Es. Ricontattare famiglia Rossi'} value={titolo} onChange={e => setTitolo(e.target.value)} maxLength={200} />
      </div>

      {/* Azione richiesta: dettatura + testo libero ampio */}
      <div>
        <span style={lblSt}>{tipo === 'consegna' ? 'Testo della consegna *' : 'Azione richiesta / dettagli'}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <textarea
            style={{ ...inputSt, flex: 1, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }}
            placeholder={tipo === 'consegna' ? 'Scrivi o detta la consegna completa: cosa è successo, cosa fare, avvisi…' : 'Scrivi o detta tutti i dettagli utili: cosa fare, con chi parlare, numeri, note…'}
            value={azione}
            onChange={e => setAzione(e.target.value)}
            rows={4}
            maxLength={tipo === 'consegna' ? 4000 : 2000}
          />
          <DictationMicButton compact onTranscribed={t => setAzione(v => (v ? v.trimEnd() + ' ' : '') + t)} />
        </div>
      </div>

      {/* Campi guidati dal tipo */}
      {bisognaData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <div>
            <span style={lblSt}>{tipo === 'attesa' ? 'In attesa di *' : 'Chi ricontattare'}</span>
            <input style={inputSt} placeholder="Es. famiglia Rossi, ASL, fornitore" value={interlocutore} onChange={e => setInterlocutore(e.target.value)} />
          </div>
          <div>
            <span style={lblSt}>{tipo === 'attesa' ? 'Data prossimo controllo *' : 'Data del ricontatto *'}</span>
            <input style={inputSt} type="date" value={dataControllo} onChange={e => setDataControllo(e.target.value)} />
          </div>
        </div>
      )}
      {tipo === 'scadenza' && (
        <div>
          <span style={lblSt}>Data di scadenza *</span>
          <input style={inputSt} type="date" value={dataControllo} onChange={e => setDataControllo(e.target.value)} />
        </div>
      )}
      {(tipo === 'attivita' || tipo === 'consegna') && (
        <div>
          <span style={lblSt}>Scadenza (facoltativa)</span>
          <input style={inputSt} type="date" value={scadenza} onChange={e => setScadenza(e.target.value)} />
        </div>
      )}

      {/* Collegamento a pratica/paziente reale */}
      {!defaultPratica && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 200px) 1fr', gap: 10 }}>
          <div>
            <span style={lblSt}>Collega a</span>
            <select style={inputSt} value={praticaTipo} onChange={e => { setPraticaTipo(e.target.value as PraticaTipo | ''); setPraticaSel(null); setPraticaQ(''); }}>
              <option value="">Niente</option>
              <option value="richiesta">Richiesta / prenotazione</option>
              <option value="paziente">Paziente</option>
              <option value="intermediazione">Pratica intermediazione</option>
              <option value="consegna">Consegna aperta</option>
              <option value="documento">Documento fatturazione</option>
            </select>
          </div>
          <div style={{ position: 'relative' }}>
            <span style={lblSt}>Pratica</span>
            {praticaSel ? (
              <div style={{ ...inputSt, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--brand-50)', borderColor: 'var(--brand-300)' }}>
                <span style={{ color: '#1d4ed8', fontWeight: 600, fontSize: '0.82rem' }}>📂 {praticaSel.label}</span>
                <button type="button" onClick={() => setPraticaSel(null)} style={{ border: 'none', background: 'none', color: '#b91c1c', cursor: 'pointer', fontWeight: 700 }}>✕</button>
              </div>
            ) : (
              <>
                <input style={inputSt} disabled={!praticaTipo} placeholder={praticaTipo ? 'Cerca la pratica reale…' : 'Scegli prima il tipo'} value={praticaQ} onChange={e => setPraticaQ(e.target.value)} />
                {praticaTipo && pratiche.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, marginTop: 4, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 20px rgba(0,0,0,0.12)' }}>
                    {pratiche.map(p => (
                      <button key={p.id} type="button" onClick={() => setPraticaSel(p)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.82rem', borderBottom: '1px solid #f1f5f9' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
                {praticaTipo && pratiche.length === 0 && praticaQ && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, marginTop: 4, padding: '8px 12px', fontSize: '0.78rem', color: '#64748b' }}>
                    Nessuna pratica trovata
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {defaultPratica && (
        <div style={{ fontSize: '0.8rem', color: '#1d4ed8', fontWeight: 600, background: 'var(--brand-50)', border: '1px solid var(--brand-300)', borderRadius: 8, padding: '7px 10px' }}>
          📂 Collegata a: {defaultPratica.label}
        </div>
      )}

      {/* Responsabilità + priorità */}
      {tipo !== 'consegna' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
          <div>
            <span style={lblSt}>Responsabilità</span>
            <select style={inputSt} value={responsabile} onChange={e => setResponsabile(e.target.value)}>
              <option value="">Da prendere in carico (senza responsabile)</option>
              <option value="me">Assegnata a me</option>
              {utenti.map(x => <option key={x._id} value={x._id}>{x.name}</option>)}
            </select>
          </div>
          <div>
            <span style={lblSt}>Priorità</span>
            <select style={inputSt} value={priorita} onChange={e => setPriorita(e.target.value)}>
              <option value="bassa">Bassa</option>
              <option value="normale">Normale</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
        </div>
      )}
      {tipo === 'consegna' && (
        <div>
          <span style={lblSt}>Priorità</span>
          <select style={inputSt} value={priorita} onChange={e => setPriorita(e.target.value)}>
            <option value="normale">Normale</option>
            <option value="urgente">Urgente</option>
          </select>
        </div>
      )}

      {errore && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '8px 12px', borderRadius: 8, fontWeight: 600, fontSize: '0.82rem' }}>{errore}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#15803d', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: valido && !busy ? 'pointer' : 'not-allowed', opacity: valido && !busy ? 1 : 0.55, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onClick={crea}
          disabled={!valido || busy}
        >
          <Plus size={15} /> {busy ? 'Creazione…' : tipo === 'consegna' ? 'Pubblica consegna' : 'Crea attività'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Annulla</button>
        )}
      </div>
    </div>
  );
}
