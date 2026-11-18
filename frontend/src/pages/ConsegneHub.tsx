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
  const reqId = useRef(0);

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
        const d = (snapshot.complete
          ? (snapshot.items || []).find((i: any) => `${i.source}:${i.id}` === a.itemKey)
          : snapshot.detail) as any;
        if (d) { setPazQ(''); setPazOpts([]); setCollegaPaz({ source: d.source, id: d.id }); }
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
