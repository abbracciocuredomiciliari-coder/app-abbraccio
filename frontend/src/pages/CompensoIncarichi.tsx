import { useEffect, useState } from 'react';
import api from '../api/api';
import { Euro, TrendingUp, CheckCircle, Clock, AlertCircle, Receipt, ChevronDown, ChevronUp } from 'lucide-react';

interface WorkPlanItem {
  _id: string;
  type: string;
  category: string;
  task: string;
  date: string;
  dataFine?: string;
  status: string;
  tipoCompenso?: 'orario' | 'fisso' | 'nessuno';
  tariffa?: number;
  compensoTotale?: number;
  compensoPagato?: boolean;
  costoPrestazione?: number;
  patient: { _id: string; firstName: string; lastName: string };
  staff: { _id: string; firstName: string; lastName: string; role: string };
}

interface RiepilogoItem {
  workPlan: WorkPlanItem;
  oreTotali: number;
  accessiCompletati: number;
  compensoCalcolato: number;
  compensoSalvato: number;
  compensoPagato: boolean;
  costoPrestazione: number;
  utile: number;
}

function formatData(d: string) {
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CompensoIncarichi() {
  const [workplans, setWorkplans] = useState<WorkPlanItem[]>([]);
  const [riepilogos, setRiepilogos] = useState<RiepilogoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDettagli, setLoadingDettagli] = useState(false);
  const [filtroStaff, setFiltroStaff] = useState('');
  const [filtroPagato, setFiltroPagato] = useState<'tutti' | 'pagato' | 'da_pagare'>('tutti');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [showFatturazione, setShowFatturazione] = useState(false);

  useEffect(() => {
    caricaDati();
  }, []);

  const caricaDati = async () => {
    setLoading(true);
    try {
      const res = await api.get('/workplan');
      const piani: WorkPlanItem[] = res.data;
      // Filtra solo quelli con compenso impostato
      const conCompenso = piani.filter(p => p.tipoCompenso && p.tipoCompenso !== 'nessuno');
      setWorkplans(conCompenso);
      await caricaRiepilogos(conCompenso);
    } catch {
      setError('Errore nel caricamento dei dati.');
    } finally {
      setLoading(false);
    }
  };

  const caricaRiepilogos = async (piani: WorkPlanItem[]) => {
    setLoadingDettagli(true);
    const risultati: RiepilogoItem[] = [];
    await Promise.allSettled(
      piani.map(async (p) => {
        try {
          const res = await api.get(`/workplan/${p._id}/accessi`);
          const r = res.data.riepilogo;
          const compensoOp = r?.compensoSalvato > 0 ? r.compensoSalvato : (r?.compensoCalcolato || 0);
          const costo = r?.costoPrestazione || p.costoPrestazione || 0;
          risultati.push({
            workPlan: p,
            oreTotali: r?.oreTotali || 0,
            accessiCompletati: r?.accessiCompletati || 0,
            compensoCalcolato: r?.compensoCalcolato || 0,
            compensoSalvato: r?.compensoSalvato || 0,
            compensoPagato: r?.compensoPagato || false,
            costoPrestazione: costo,
            utile: Math.round((costo - compensoOp) * 100) / 100,
          });
        } catch {
          const costo = p.costoPrestazione || 0;
          const compensoOp = p.compensoTotale || 0;
          risultati.push({
            workPlan: p,
            oreTotali: 0,
            accessiCompletati: 0,
            compensoCalcolato: 0,
            compensoSalvato: compensoOp,
            compensoPagato: p.compensoPagato || false,
            costoPrestazione: costo,
            utile: Math.round((costo - compensoOp) * 100) / 100,
          });
        }
      })
    );
    setRiepilogos(risultati);
    setLoadingDettagli(false);
  };

  const segnaComePagato = async (workPlanId: string, pagato: boolean) => {
    try {
      await api.patch(`/workplan/${workPlanId}/compenso`, { compensoPagato: pagato });
      setRiepilogos(prev => prev.map(r =>
        r.workPlan._id === workPlanId ? { ...r, compensoPagato: pagato } : r
      ));
      setWorkplans(prev => prev.map(w =>
        w._id === workPlanId ? { ...w, compensoPagato: pagato } : w
      ));
      setSuccess(pagato ? '✅ Compenso segnato come pagato!' : '↩️ Compenso segnato come da pagare.');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Errore nell\'aggiornamento del pagamento.');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Filtraggio
  const riepilogosFiltrati = riepilogos.filter(r => {
    const staffNome = `${r.workPlan.staff.firstName} ${r.workPlan.staff.lastName}`.toLowerCase();
    if (filtroStaff && !staffNome.includes(filtroStaff.toLowerCase())) return false;
    if (filtroPagato === 'pagato' && !r.compensoPagato) return false;
    if (filtroPagato === 'da_pagare' && r.compensoPagato) return false;
    return true;
  });

  // Totali
  const totaleDaPagare = riepilogosFiltrati
    .filter(r => !r.compensoPagato)
    .reduce((sum, r) => sum + (r.compensoSalvato > 0 ? r.compensoSalvato : r.compensoCalcolato), 0);

  const totalePagato = riepilogosFiltrati
    .filter(r => r.compensoPagato)
    .reduce((sum, r) => sum + (r.compensoSalvato > 0 ? r.compensoSalvato : r.compensoCalcolato), 0);

  const totaleGuadagnato = riepilogosFiltrati
    .reduce((sum, r) => sum + (r.compensoSalvato > 0 ? r.compensoSalvato : r.compensoCalcolato), 0);

  // Raggruppa per operatore
  const perOperatore: Record<string, { nome: string; ruolo: string; totale: number; pagato: number; daPagare: number; incarichi: number }> = {};
  riepilogosFiltrati.forEach(r => {
    const key = r.workPlan.staff._id;
    const nome = `${r.workPlan.staff.firstName} ${r.workPlan.staff.lastName}`;
    const importo = r.compensoSalvato > 0 ? r.compensoSalvato : r.compensoCalcolato;
    if (!perOperatore[key]) {
      perOperatore[key] = { nome, ruolo: r.workPlan.staff.role, totale: 0, pagato: 0, daPagare: 0, incarichi: 0 };
    }
    perOperatore[key].totale += importo;
    perOperatore[key].incarichi += 1;
    if (r.compensoPagato) perOperatore[key].pagato += importo;
    else perOperatore[key].daPagare += importo;
  });

  if (loading) return <section><p>⏳ Caricamento compensi...</p></section>;

  return (
    <section>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Euro size={28} color="#7c3aed" />
        Compenso per Incarichi
      </h2>
      <p style={{ color: 'var(--gray-500)', marginBottom: '24px', fontSize: '0.95rem' }}>
        Visualizza tariffe, compensi maturati e totale guadagnato per ogni incarico del personale.
      </p>

      {success && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#16a34a', marginBottom: '16px' }}>
          <CheckCircle size={18} /> {success}
        </div>
      )}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', marginBottom: '16px' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* ── Riepilogo totali ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <div style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', borderRadius: '12px', padding: '20px', color: '#fff', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: '800' }}>€ {totaleGuadagnato.toFixed(2)}</div>
          <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: '4px' }}>💰 Compensi operatori</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', borderRadius: '12px', padding: '20px', color: '#fff', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: '800' }}>€ {totaleDaPagare.toFixed(2)}</div>
          <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: '4px' }}>⏳ Da pagare</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #059669, #047857)', borderRadius: '12px', padding: '20px', color: '#fff', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: '800' }}>€ {totalePagato.toFixed(2)}</div>
          <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: '4px' }}>✅ Già pagato</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', borderRadius: '12px', padding: '20px', color: '#fff', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: '800' }}>{riepilogosFiltrati.length}</div>
          <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: '4px' }}>📋 Incarichi con compenso</div>
        </div>
      </div>

      {/* ── PANNELLO GESTIONE FATTURAZIONE AL PAZIENTE ── */}
      {(() => {
        const totaleCostiPazienti = riepilogosFiltrati.reduce((sum, r) => sum + r.costoPrestazione, 0);
        const totaleCompensatiOperatori = riepilogosFiltrati.reduce((sum, r) => sum + (r.compensoSalvato > 0 ? r.compensoSalvato : r.compensoCalcolato), 0);
        const utileAdmin = Math.round((totaleCostiPazienti - totaleCompensatiOperatori) * 100) / 100;
        const incarichiConCosto = riepilogosFiltrati.filter(r => r.costoPrestazione > 0);
        return (
          <div style={{ marginBottom: '28px', border: '2px solid #166534', borderRadius: '12px', overflow: 'hidden' }}>
            {/* Header pulsante */}
            <button
              type="button"
              onClick={() => setShowFatturazione(!showFatturazione)}
              style={{
                width: '100%',
                background: showFatturazione ? 'linear-gradient(135deg, #166534, #14532d)' : 'linear-gradient(135deg, #16a34a, #15803d)',
                border: 'none',
                padding: '16px 20px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: '#fff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Receipt size={22} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: '800', fontSize: '1.05rem' }}>💼 Gestione Fatturazione al Paziente</div>
                  <div style={{ fontSize: '0.82rem', opacity: 0.9 }}>
                    Ricavi totali, compensi operatori e utile admin
                    {totaleCostiPazienti > 0 && ` — Ricavi: €${totaleCostiPazienti.toFixed(2)} | Utile: €${utileAdmin.toFixed(2)}`}
                  </div>
                </div>
              </div>
              {showFatturazione ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            {showFatturazione && (
              <div style={{ padding: '20px', background: '#f0fdf4' }}>
                {/* Card riepilogo finanziario admin */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                  <div style={{ background: 'linear-gradient(135deg, #166534, #14532d)', borderRadius: '10px', padding: '16px', color: '#fff', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: '800' }}>€ {totaleCostiPazienti.toFixed(2)}</div>
                    <div style={{ fontSize: '0.82rem', opacity: 0.9, marginTop: '4px' }}>💰 Totale ricavi da pazienti</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.75, marginTop: '2px' }}>{incarichiConCosto.length} prestazioni fatturate</div>
                  </div>
                  <div style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', borderRadius: '10px', padding: '16px', color: '#fff', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: '800' }}>€ {totaleCompensatiOperatori.toFixed(2)}</div>
                    <div style={{ fontSize: '0.82rem', opacity: 0.9, marginTop: '4px' }}>👤 Totale compensi operatori</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.75, marginTop: '2px' }}>costo del personale</div>
                  </div>
                  <div style={{ background: utileAdmin >= 0 ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'linear-gradient(135deg, #dc2626, #b91c1c)', borderRadius: '10px', padding: '16px', color: '#fff', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: '800' }}>€ {utileAdmin.toFixed(2)}</div>
                    <div style={{ fontSize: '0.82rem', opacity: 0.9, marginTop: '4px' }}>📊 Utile netto admin</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.75, marginTop: '2px' }}>ricavi − compensi</div>
                  </div>
                </div>

                {/* Dettaglio per paziente */}
                {incarichiConCosto.length === 0 ? (
                  <div style={{ background: '#fff', borderRadius: '8px', padding: '16px', color: '#888', fontStyle: 'italic', textAlign: 'center', border: '1px solid #bbf7d0' }}>
                    ℹ️ Nessun incarico ha ancora un costo prestazione al paziente impostato.<br />
                    <span style={{ fontSize: '0.85rem' }}>Imposta il "Costo prestazione al paziente" nel form di creazione piano o nella sezione Gestione Compenso.</span>
                  </div>
                ) : (
                  <div>
                    <h4 style={{ margin: '0 0 12px', color: '#166534', fontSize: '0.95rem', fontWeight: '700' }}>
                      📋 Dettaglio per prestazione
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {incarichiConCosto.map(r => {
                        const compensoOp = r.compensoSalvato > 0 ? r.compensoSalvato : r.compensoCalcolato;
                        const utile = Math.round((r.costoPrestazione - compensoOp) * 100) / 100;
                        return (
                          <div key={r.workPlan._id} style={{ background: '#fff', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <div style={{ flex: 1, minWidth: '180px' }}>
                              <div style={{ fontWeight: '700', color: '#1e4d8c', fontSize: '0.92rem' }}>
                                👤 {r.workPlan.patient.firstName} {r.workPlan.patient.lastName}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#555' }}>
                                {r.workPlan.category} — {r.workPlan.task}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#888' }}>
                                🏥 {r.workPlan.staff.firstName} {r.workPlan.staff.lastName} | 📅 {formatData(r.workPlan.date)}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                              <div style={{ textAlign: 'center', minWidth: '80px' }}>
                                <div style={{ fontSize: '0.68rem', color: '#166534', fontWeight: '700', textTransform: 'uppercase' }}>Costo al pz.</div>
                                <div style={{ fontWeight: '800', color: '#166534', fontSize: '1.05rem' }}>€ {r.costoPrestazione.toFixed(2)}</div>
                              </div>
                              <div style={{ textAlign: 'center', minWidth: '80px' }}>
                                <div style={{ fontSize: '0.68rem', color: '#7c3aed', fontWeight: '700', textTransform: 'uppercase' }}>Compenso op.</div>
                                <div style={{ fontWeight: '800', color: '#7c3aed', fontSize: '1.05rem' }}>€ {compensoOp.toFixed(2)}</div>
                              </div>
                              <div style={{ textAlign: 'center', minWidth: '80px', background: utile >= 0 ? '#dcfce7' : '#fee2e2', borderRadius: '6px', padding: '4px 10px' }}>
                                <div style={{ fontSize: '0.68rem', color: utile >= 0 ? '#166534' : '#dc2626', fontWeight: '700', textTransform: 'uppercase' }}>Utile</div>
                                <div style={{ fontWeight: '800', color: utile >= 0 ? '#166534' : '#dc2626', fontSize: '1.05rem' }}>€ {utile.toFixed(2)}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Riepilogo per operatore ── */}
      {Object.keys(perOperatore).length > 0 && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '1rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} color="#7c3aed" />
            Riepilogo per operatore
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Object.values(perOperatore).sort((a, b) => b.totale - a.totale).map((op, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', padding: '10px 14px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div>
                  <div style={{ fontWeight: '700', color: '#1e4d8c' }}>👤 {op.nome}</div>
                  <div style={{ fontSize: '0.8rem', color: '#888' }}>{op.ruolo} — {op.incarichi} incarico{op.incarichi !== 1 ? 'i' : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '700', color: '#7c3aed', fontSize: '1.1rem' }}>€ {op.totale.toFixed(2)}</div>
                    <div style={{ fontSize: '0.75rem', color: '#888' }}>totale</div>
                  </div>
                  {op.daPagare > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: '700', color: '#dc2626' }}>€ {op.daPagare.toFixed(2)}</div>
                      <div style={{ fontSize: '0.75rem', color: '#888' }}>da pagare</div>
                    </div>
                  )}
                  {op.pagato > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: '700', color: '#059669' }}>€ {op.pagato.toFixed(2)}</div>
                      <div style={{ fontSize: '0.75rem', color: '#888' }}>pagato</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Filtri ── */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ flex: 1, minWidth: '200px', fontSize: '0.88rem' }}>
          🔍 Cerca operatore
          <input
            type="text"
            value={filtroStaff}
            onChange={e => setFiltroStaff(e.target.value)}
            placeholder="Nome operatore..."
            style={{ marginTop: '4px', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', width: '100%', fontSize: '0.9rem', boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ fontSize: '0.88rem' }}>
          💳 Stato pagamento
          <select
            value={filtroPagato}
            onChange={e => setFiltroPagato(e.target.value as any)}
            style={{ marginTop: '4px', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', display: 'block', fontSize: '0.9rem' }}
          >
            <option value="tutti">Tutti</option>
            <option value="da_pagare">Da pagare</option>
            <option value="pagato">Già pagati</option>
          </select>
        </label>
        <button
          type="button"
          onClick={caricaDati}
          style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px', padding: '9px 18px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', alignSelf: 'flex-end' }}
        >
          🔄 Aggiorna
        </button>
      </div>

      {/* ── Lista incarichi con compenso ── */}
      {workplans.length === 0 ? (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid #f59e0b', borderRadius: '8px', padding: '20px', color: '#92400e', textAlign: 'center' }}>
          ⚠️ Nessun incarico con compenso configurato. Imposta le tariffe nella sezione "Piano di Lavoro".
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loadingDettagli && (
            <div style={{ textAlign: 'center', color: '#888', padding: '12px', fontSize: '0.9rem' }}>
              ⏳ Caricamento dettagli compensi...
            </div>
          )}
          {riepilogosFiltrati.length === 0 && !loadingDettagli ? (
            <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
              Nessun incarico corrisponde ai filtri selezionati.
            </p>
          ) : (
            riepilogosFiltrati.map(r => {
              const importo = r.compensoSalvato > 0 ? r.compensoSalvato : r.compensoCalcolato;
              return (
                <div
                  key={r.workPlan._id}
                  style={{
                    background: '#fff',
                    border: `1px solid ${r.compensoPagato ? '#bbf7d0' : '#e9d5ff'}`,
                    borderLeft: `4px solid ${r.compensoPagato ? '#059669' : '#7c3aed'}`,
                    borderRadius: '10px',
                    padding: '16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    {/* Info incarico */}
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ fontWeight: '700', fontSize: '1rem', color: '#1e4d8c', marginBottom: '4px' }}>
                        👤 {r.workPlan.patient.firstName} {r.workPlan.patient.lastName}
                      </div>
                      <div style={{ fontSize: '0.88rem', color: '#374151', marginBottom: '3px' }}>
                        {r.workPlan.category} — {r.workPlan.task}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#888', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <span>🏥 {r.workPlan.staff.firstName} {r.workPlan.staff.lastName} ({r.workPlan.staff.role})</span>
                        <span>📅 {formatData(r.workPlan.date)}{r.workPlan.dataFine ? ` → ${formatData(r.workPlan.dataFine)}` : ''}</span>
                      </div>
                    </div>

                    {/* Dettagli compenso */}
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {/* Tariffa */}
                      <div style={{ background: '#f5f3ff', borderRadius: '8px', padding: '10px 14px', textAlign: 'center', minWidth: '100px' }}>
                        <div style={{ fontSize: '0.72rem', color: '#7c3aed', fontWeight: '600', marginBottom: '2px', textTransform: 'uppercase' }}>
                          {r.workPlan.tipoCompenso === 'orario' ? 'Tariffa/ora' : 'Compenso fisso'}
                        </div>
                        <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#7c3aed' }}>
                          € {(r.workPlan.tariffa || 0).toFixed(2)}
                          {r.workPlan.tipoCompenso === 'orario' && <span style={{ fontSize: '0.7rem', fontWeight: '400' }}>/h</span>}
                        </div>
                      </div>

                      {/* Ore lavorate */}
                      {r.workPlan.tipoCompenso === 'orario' && (
                        <div style={{ background: '#f0f9ff', borderRadius: '8px', padding: '10px 14px', textAlign: 'center', minWidth: '80px' }}>
                          <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: '600', marginBottom: '2px', textTransform: 'uppercase' }}>Ore lavorate</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <Clock size={14} /> {r.oreTotali}h
                          </div>
                        </div>
                      )}

                      {/* Accessi */}
                      <div style={{ background: '#fefce8', borderRadius: '8px', padding: '10px 14px', textAlign: 'center', minWidth: '80px' }}>
                        <div style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: '600', marginBottom: '2px', textTransform: 'uppercase' }}>Accessi</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#d97706' }}>{r.accessiCompletati}</div>
                      </div>

                      {/* Totale guadagnato */}
                      <div style={{ background: r.compensoPagato ? '#f0fdf4' : '#fdf4ff', borderRadius: '8px', padding: '10px 14px', textAlign: 'center', minWidth: '110px', border: `1px solid ${r.compensoPagato ? '#bbf7d0' : '#e9d5ff'}` }}>
                        <div style={{ fontSize: '0.72rem', color: r.compensoPagato ? '#059669' : '#7c3aed', fontWeight: '600', marginBottom: '2px', textTransform: 'uppercase' }}>
                          {r.compensoPagato ? '✅ Pagato' : '💰 Maturato'}
                        </div>
                        <div style={{ fontSize: '1.3rem', fontWeight: '800', color: r.compensoPagato ? '#059669' : '#7c3aed' }}>
                          € {importo.toFixed(2)}
                        </div>
                      </div>

                      {/* Pulsante pagamento */}
                      <button
                        type="button"
                        onClick={() => segnaComePagato(r.workPlan._id, !r.compensoPagato)}
                        style={{
                          background: r.compensoPagato ? '#6c757d' : '#059669',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '0.82rem',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {r.compensoPagato ? '↩️ Segna da pagare' : '✅ Segna pagato'}
                      </button>
                    </div>
                  </div>

                  {/* Pannello finanziario admin: costo prestazione + utile */}
                  {r.costoPrestazione > 0 && (
                    <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', padding: '12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>💰 Costo al paziente</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#166534' }}>€ {r.costoPrestazione.toFixed(2)}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.72rem', color: '#7c3aed', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>👤 Compenso operatore</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#7c3aed' }}>€ {importo.toFixed(2)}</div>
                      </div>
                      <div style={{ textAlign: 'center', background: r.utile >= 0 ? '#dcfce7' : '#fee2e2', borderRadius: '6px', padding: '6px' }}>
                        <div style={{ fontSize: '0.72rem', color: r.utile >= 0 ? '#166534' : '#dc2626', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>📊 Utile</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: '800', color: r.utile >= 0 ? '#166534' : '#dc2626' }}>€ {r.utile.toFixed(2)}</div>
                      </div>
                    </div>
                  )}

                  {/* Nota se compenso calcolato vs salvato */}
                  {r.compensoCalcolato > 0 && r.compensoSalvato === 0 && (
                    <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#888', fontStyle: 'italic' }}>
                      ℹ️ Compenso calcolato dagli accessi (non ancora salvato). Vai su "Piano di Lavoro" → Storico per salvarlo.
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
