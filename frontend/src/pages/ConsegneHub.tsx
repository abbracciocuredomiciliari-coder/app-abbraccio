import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api/api';
import { HubConsegne } from '../hub/HubConsegne';
import type { HubSnapshot, HubView, HubAction } from '../hub/hub-ui.mjs';
import NuovaAttivitaForm from '../components/NuovaAttivitaForm';
import { Modal } from '../components/ui/Modal';

// ═══════════════════════════════════════════════════════════════════════════
// HUB CONSEGNE — pagina canonica /consegne. Unisce Attivita + Consegna
// Amministrativa in una sola vista per settore/stato/professionista.
// Lo stato di navigazione vive nei parametri URL: refresh e back del browser
// funzionano; il renderer hub-ui gestisce le sottoschermate.
// "Apri gestione completa" rimanda alla fonte originale (stesso ID/storico).
// ═══════════════════════════════════════════════════════════════════════════

const VIEW_KEYS = ['screen', 'sectorId', 'status', 'professionalId', 'patientId', 'patientName', 'itemKey', 'tool', 'query', 'area'] as const;

function viewFromParams(p: URLSearchParams): HubView {
  const v: Record<string, string> = {};
  for (const k of VIEW_KEYS) { const val = p.get(k); if (val) v[k] = val; }
  if (!v.screen) v.screen = 'home';
  return v as HubView;
}

export default function ConsegneHub() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const view = viewFromParams(params);
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);

  const [snapshot, setSnapshot] = useState<HubSnapshot>({ items: [], professionals: [], loading: true, complete: false });
  const [showCrea, setShowCrea] = useState(false);
  const [creaSettore, setCreaSettore] = useState<string | undefined>(undefined);
  const [creaPaziente, setCreaPaziente] = useState<{ id: string; tipo: string; label: string } | undefined>(undefined);
  const [creaProf, setCreaProf] = useState<{ id: string; label: string; role?: string; sectorId?: string } | undefined>(undefined);
  const [riclassifica, setRiclassifica] = useState<{ source: string; id: string } | null>(null);
  const [collegaPaz, setCollegaPaz] = useState<{ source: string; id: string } | null>(null);
  const [pazQ, setPazQ] = useState('');
  const [pazOpts, setPazOpts] = useState<{ id: string; label: string }[]>([]);
  const [pazBusy, setPazBusy] = useState(false);
  const [notaItem, setNotaItem] = useState<{ source: string; id: string; titolo: string } | null>(null);
  const [notaTesto, setNotaTesto] = useState('');
  const [notaBusy, setNotaBusy] = useState(false);
  const [edItem, setEdItem] = useState<any | null>(null);
  const [edTitolo, setEdTitolo] = useState('');
  const [edPriorita, setEdPriorita] = useState('normale');
  const [edScadenza, setEdScadenza] = useState('');
  const [edOrario, setEdOrario] = useState('');
  const [edStato, setEdStato] = useState('');
  const [edEsito, setEdEsito] = useState('');
  const [edInterlocutore, setEdInterlocutore] = useState('');
  const [edDataCtrl, setEdDataCtrl] = useState('');
  const [edMotivo, setEdMotivo] = useState('');
  const [edErr, setEdErr] = useState('');
  const [edBusy, setEdBusy] = useState(false);
  const reqId = useRef(0);

  const trovaItem = (itemKey?: string | null) => (snapshot.complete
    ? (snapshot.items || []).find((i: any) => `${i.source}:${i.id}` === itemKey)
    : snapshot.detail) as any;

  const carica = useCallback(async (v: HubView, pg: number) => {
    const id = ++reqId.current;
    setSnapshot(s => ({ ...s, loading: true, error: undefined }));
    try {
      const { data } = await api.get('/hub-consegne/snapshot', {
        params: {
          screen: v.screen, sectorId: v.sectorId || undefined, status: v.status,
          professionalId: v.professionalId || undefined, tool: v.tool || undefined,
          patientId: v.patientId || undefined, patientName: v.patientName || undefined,
          area: v.area !== 'all' ? v.area : undefined, q: v.query || undefined,
          page: pg, itemKey: v.itemKey || undefined,
        },
      });
      if (id === reqId.current) setSnapshot({ ...data, loading: false });
    } catch (e: any) {
      if (id === reqId.current) setSnapshot(s => ({ ...s, loading: false, error: e?.response?.data?.message || 'Errore di caricamento. Riprova.' }));
    }
  }, []);

  const viewKey = JSON.stringify(view) + '|' + page;
  useEffect(() => { carica(view, page); }, [viewKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ricerca paziente per il collegamento (debounced, riusa /attivita/pratiche)
  useEffect(() => {
    if (!collegaPaz) return;
    const t = setTimeout(async () => {
      setPazBusy(true);
      try {
        const { data } = await api.get('/attivita/pratiche', { params: { tipo: 'paziente', q: pazQ } });
        setPazOpts(Array.isArray(data) ? data.map((r: any) => ({ id: r.id, label: String(r.label).replace(/^Paziente — /, '') })) : []);
      } catch { setPazOpts([]); }
      finally { setPazBusy(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [collegaPaz, pazQ]);

  const onViewChange = useCallback((v: HubView) => {
    const p = new URLSearchParams();
    for (const k of VIEW_KEYS) { const val = (v as any)[k]; if (val != null && val !== '') p.set(k, String(val)); }
    setParams(p); // page torna a 1 ad ogni cambio vista
  }, [setParams]);

  const vaiPagina = (delta: number) => {
    const p = new URLSearchParams(params);
    p.set('page', String(Math.max(1, page + delta)));
    setParams(p);
  };

  const onAction = useCallback(async (a: HubAction) => {
    switch (a.action) {
      case 'create':
        setCreaSettore(a.view.sectorId || undefined);
        // Preselezione dal contesto: paziente (schermata paziente) o
        // professionista (schermata professionista) già collegati al form.
        setCreaPaziente(a.view.patientId
          ? { id: a.view.patientId, tipo: 'paziente', label: a.view.patientName || snapshot.patients?.find(p => p.id === a.view.patientId)?.label || 'Paziente' }
          : undefined);
        setCreaProf(a.view.professionalId
          ? (() => { const p = snapshot.professionals?.find(x => x.id === a.view.professionalId); return p ? { id: p.id, label: p.label, role: p.role, sectorId: p.sectorIds[0] } : undefined; })()
          : undefined);
        setShowCrea(true);
        break;
      case 'source': {
        // Apri la gestione completa della fonte originale (stesso ID/storico)
        const d = snapshot.detail as any;
        navigate(d?.sourceRoute || '/gestione');
        break;
      }
      case 'assignment': {
        const d = snapshot.detail as any;
        if (d?.assignmentRef) navigate(d.assignmentRef);
        break;
      }
      case 'legacy':
        navigate('/gestione');
        break;
      case 'previous': vaiPagina(-1); break;
      case 'next': vaiPagina(1); break;
      case 'retry': carica(view, page); break;
      case 'set-sector': {
        // classificazione manuale (azioni amministrative dal dettaglio)
        const d = snapshot.detail as any;
        if (d) setRiclassifica({ source: d.source, id: d.id });
        break;
      }
      case 'link-patient': {
        // collega un paziente reale a una consegna (anche vecchie riportate)
        const d = trovaItem(a.itemKey);
        if (d) { setPazQ(''); setPazOpts([]); setCollegaPaz({ source: d.source, id: d.id }); }
        break;
      }
      case 'edit': {
        // modifica completa: priorità, scadenza, orario, stato (anche riapri)
        const d = trovaItem(a.itemKey);
        if (d) {
          setEdItem(d);
          setEdTitolo(d.title || '');
          setEdPriorita(d.priority === 'urgent' ? 'urgente' : 'normale');
          setEdScadenza(d.dueAt ? String(d.dueAt).slice(0, 10) : '');
          setEdOrario(d.orario || '');
          setEdStato(''); setEdEsito(''); setEdInterlocutore(''); setEdDataCtrl(''); setEdMotivo(''); setEdErr('');
        }
        break;
      }
      case 'nota': {
        const d = trovaItem(a.itemKey);
        if (d) { setNotaTesto(''); setNotaItem({ source: d.source, id: d.id, titolo: d.title }); }
        break;
      }
    }
  }, [snapshot.detail, navigate, carica, view, page]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="tw-min-h-full">
      <HubConsegne snapshot={snapshot} view={view} onViewChange={onViewChange} onAction={onAction} />

      {/* Nuova consegna/attività — form esistente adattato: settore + professionista, nessun responsabile */}
      {showCrea && (
        <Modal isOpen onClose={() => setShowCrea(false)} title="Nuova consegna / attività" size="lg">
          <NuovaAttivitaForm
            defaultSettore={creaSettore}
            defaultPratica={creaPaziente}
            defaultProfessionista={creaProf}
            onSaved={() => { setShowCrea(false); carica(view, page); }}
            onCreated={() => carica(view, page)}
            onCancel={() => setShowCrea(false)}
          />
        </Modal>
      )}

      {/* Classificazione manuale da "Da classificare" → settore reale (tracciata) */}
      {riclassifica && (
        <Modal isOpen onClose={() => setRiclassifica(null)} title="Assegna settore" size="sm">
          <div style={{ display: 'grid', gap: 8 }}>
            <p style={{ margin: '0 0 6px', fontSize: '0.88rem', color: '#475569' }}>
              Scegli il settore corretto. La correzione resta nello storico della lavorazione.
            </p>
            {[
              ['infermieristiche-strumentali', 'Infermieristiche e Strumentali'],
              ['oss', 'Assistenza OSS'],
              ['badanti', 'Assistenza Badanti'],
              ['medici', 'Medici e Specialisti'],
              ['riabilitazione', 'Riabilitazione'],
              ['altri', 'Altri professionisti'],
              ['backoffice', 'Amministrative / back office'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={async () => {
                  try {
                    await api.patch('/hub-consegne/settore', { ...riclassifica, settore: id });
                    setRiclassifica(null); carica(view, page);
                  } catch { /* errore gestito sotto */ }
                }}
                style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', textAlign: 'left', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', minHeight: 46 }}
              >
                {label}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Modifica e stato — priorità, scadenza, orario, riapertura; tutto tracciato con data/ora */}
      {edItem && (
        <Modal isOpen onClose={() => setEdItem(null)} title={`✏️ ${edItem.title}`} size="md">
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: 3 }}>Titolo</span>
              <input value={edTitolo} onChange={e => setEdTitolo(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: 3 }}>Priorità</span>
                <select value={edPriorita} onChange={e => setEdPriorita(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1' }}>
                  <option value="normale">Normale</option>
                  <option value="urgente">🔴 Urgente</option>
                  {edItem.source === 'attivita' && <option value="alta">Alta</option>}
                  {edItem.source === 'attivita' && <option value="bassa">Bassa</option>}
                </select>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: 3 }}>Scadenza</span>
                <input type="date" value={edScadenza} onChange={e => setEdScadenza(e.target.value)} style={{ width: '100%', padding: '9px', borderRadius: 8, border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: 3 }}>🔔 Orario promemoria</span>
                <input type="time" value={edOrario} onChange={e => setEdOrario(e.target.value)} style={{ width: '100%', padding: '9px', borderRadius: 8, border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: 3 }}>Cambia stato</span>
              <select value={edStato} onChange={e => setEdStato(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1' }}>
                <option value="">Lascia lo stato attuale</option>
                {edItem.source === 'consegna' ? (
                  <>
                    <option value="da_gestire">🔓 Riapri (da gestire)</option>
                    <option value="presa_in_carico">👤 Presa in carico</option>
                    <option value="in_attesa_riscontro">⏳ In attesa di riscontro</option>
                    <option value="gestita">✅ Gestita</option>
                  </>
                ) : (
                  <>
                    <option value="riaperta">🔓 Riapri</option>
                    <option value="in_lavorazione">👤 In lavorazione</option>
                    <option value="in_attesa">⏳ In attesa</option>
                    <option value="completata">✅ Completata</option>
                    <option value="annullata">🚫 Annullata</option>
                  </>
                )}
              </select>
            </div>
            {['gestita', 'completata'].includes(edStato) && (
              <div>
                <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: 3 }}>Esito * (cosa è stato fatto)</span>
                <textarea value={edEsito} onChange={e => setEdEsito(e.target.value)} rows={2} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              </div>
            )}
            {['in_attesa_riscontro', 'in_attesa'].includes(edStato) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: 3 }}>In attesa di *</span>
                  <input value={edInterlocutore} onChange={e => setEdInterlocutore(e.target.value)} placeholder="Es. famiglia, ASL" style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: 3 }}>Data controllo *</span>
                  <input type="date" value={edDataCtrl} onChange={e => setEdDataCtrl(e.target.value)} style={{ width: '100%', padding: '9px', borderRadius: 8, border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
                </div>
              </div>
            )}
            {edStato === 'annullata' && (
              <div>
                <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: 3 }}>Motivo annullamento *</span>
                <input value={edMotivo} onChange={e => setEdMotivo(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>
            )}
            {edErr && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '8px 12px', borderRadius: 8, fontWeight: 600, fontSize: '0.82rem' }}>{edErr}</div>}
            <button
              disabled={edBusy}
              onClick={async () => {
                setEdBusy(true); setEdErr('');
                try {
                  if (edStato) {
                    if (edItem.source === 'consegna') {
                      await api.patch(`/consegne-amministrative/${edItem.id}/stato`, { stato: edStato, esito: edEsito || undefined, interlocutore: edInterlocutore || undefined, dataControllo: edDataCtrl || undefined });
                    } else {
                      await api.patch(`/attivita/${edItem.id}/stato`, { stato: edStato, esito: edEsito || undefined, motivo: edMotivo || undefined, interlocutore: edInterlocutore || undefined, dataControllo: edDataCtrl || undefined });
                    }
                  }
                  await api.patch('/hub-consegne/elemento', {
                    source: edItem.source, id: edItem.id, titolo: edTitolo, priorita: edPriorita,
                    scadenza: edScadenza || null, orarioPromemoria: edOrario || null,
                  });
                  setEdItem(null); carica(view, page);
                } catch (e: any) { setEdErr(e?.response?.data?.message || 'Errore salvataggio'); }
                finally { setEdBusy(false); }
              }}
              style={{ padding: '12px', borderRadius: 10, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
            >
              {edBusy ? 'Salvataggio…' : '💾 Salva modifiche'}
            </button>
          </div>
        </Modal>
      )}

      {/* Aggiungi nota — resta nello storico con data/ora e autore */}
      {notaItem && (
        <Modal isOpen onClose={() => setNotaItem(null)} title={`📝 Nota su: ${notaItem.titolo}`} size="sm">
          <div style={{ display: 'grid', gap: 10 }}>
            <textarea
              autoFocus
              value={notaTesto}
              onChange={e => setNotaTesto(e.target.value)}
              rows={4}
              placeholder="Scrivi l'aggiornamento: sarà registrato con data, ora e il tuo nome…"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
            <button
              disabled={notaBusy || !notaTesto.trim()}
              onClick={async () => {
                setNotaBusy(true);
                try {
                  const url = notaItem.source === 'consegna' ? `/consegne-amministrative/${notaItem.id}/nota` : `/attivita/${notaItem.id}/aggiornamento`;
                  await api.post(url, notaItem.source === 'consegna' ? { nota: notaTesto.trim() } : { testo: notaTesto.trim() });
                  setNotaItem(null); carica(view, page);
                } catch { /* riprova */ }
                finally { setNotaBusy(false); }
              }}
              style={{ padding: '12px', borderRadius: 10, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: notaTesto.trim() ? 1 : 0.5 }}
            >
              {notaBusy ? 'Salvataggio…' : 'Salva nota'}
            </button>
          </div>
        </Modal>
      )}

      {/* Cerca paziente — collega un paziente reale alla consegna, anche vecchia */}
      {collegaPaz && (
        <Modal isOpen onClose={() => setCollegaPaz(null)} title="🔍 Cerca paziente" size="sm">
          <div style={{ display: 'grid', gap: 10 }}>
            <input
              autoFocus
              value={pazQ}
              onChange={e => setPazQ(e.target.value)}
              placeholder="Scrivi nome o cognome del paziente…"
              style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.95rem' }}
            />
            {pazBusy && <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Ricerca in corso…</p>}
            {!pazBusy && pazOpts.length === 0 && (
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                {pazQ ? 'Nessun paziente trovato.' : 'Digita per cercare nell\'anagrafica pazienti.'}
              </p>
            )}
            {pazOpts.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={async () => {
                  try {
                    await api.patch('/hub-consegne/paziente', { ...collegaPaz, pazienteId: p.id });
                    setCollegaPaz(null); carica(view, page);
                  } catch { /* errore gestito dal modal aperto */ }
                }}
                style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', textAlign: 'left', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', minHeight: 46 }}
              >
                👤 {p.label}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
