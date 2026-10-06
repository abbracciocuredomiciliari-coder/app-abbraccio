import { useEffect, useMemo, useState } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Tag, Plus, Pencil, Trash2, Check, X, Search } from 'lucide-react';

interface VoceTariffario {
  _id: string;
  categoria: 'prestazioni_infermieristiche' | 'prelievi' | 'assistenza_domiciliare' | 'trasporto' | 'radiologia' | 'ecografia' | 'visite_mediche';
  nome: string;
  prezzo: number;
  unitaMisura?: string;
  note?: string;
  attivo: boolean;
  ordine: number;
  isEsameStrumentale?: boolean;
}

const CATEGORIE: { value: VoceTariffario['categoria']; label: string; color: string }[] = [
  { value: 'prestazioni_infermieristiche', label: '💉 Prestazioni Infermieristiche', color: '#0369a1' },
  { value: 'prelievi', label: '🩸 Prelievi', color: '#be123c' },
  { value: 'assistenza_domiciliare', label: '🏠 Assistenza Domiciliare', color: '#7c3aed' },
  { value: 'trasporto', label: '🚑 Trasporto', color: '#ea580c' },
  { value: 'radiologia', label: '🩻 Radiologia (RX)', color: '#b45309' },
  { value: 'ecografia', label: '🔊 Ecografie / Ecocolordoppler', color: '#059669' },
  { value: 'visite_mediche', label: '🩺 Visite Mediche', color: '#0891b2' },
];

export default function Tariffario() {
  const { user } = useAuth();
  const puoGestire = user && ['admin', 'coordinator', 'direttore'].includes(user.role);
  const [voci, setVoci] = useState<VoceTariffario[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFiltro, setCatFiltro] = useState<'tutte' | VoceTariffario['categoria']>('tutte');
  const [editId, setEditId] = useState<string | null>(null);
  const [editPrezzo, setEditPrezzo] = useState<number>(0);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nuova, setNuova] = useState({ categoria: 'prestazioni_infermieristiche' as VoceTariffario['categoria'], nome: '', prezzo: 0, unitaMisura: '', note: '' });

  const carica = async () => {
    setLoading(true);
    try {
      const res = await api.get('/tariffario');
      setVoci(res.data);
    } catch { /***/ }
    setLoading(false);
  };

  useEffect(() => { carica(); }, []);

  const vociFiltrate = useMemo(() => {
    let list = voci;
    if (catFiltro !== 'tutte') list = list.filter(v => v.categoria === catFiltro);
    const t = search.toLowerCase().trim();
    if (t) list = list.filter(v => v.nome.toLowerCase().includes(t));
    return list;
  }, [voci, catFiltro, search]);

  const vociPerCategoria = useMemo(() => {
    const map = new Map<string, VoceTariffario[]>();
    vociFiltrate.forEach(v => {
      if (!map.has(v.categoria)) map.set(v.categoria, []);
      map.get(v.categoria)!.push(v);
    });
    return map;
  }, [vociFiltrate]);

  const salvaPrezzo = async (id: string) => {
    try {
      await api.put(`/tariffario/${id}`, { prezzo: editPrezzo });
      setEditId(null);
      await carica();
    } catch { alert('Errore aggiornamento prezzo'); }
  };

  const toggleAttivo = async (v: VoceTariffario) => {
    try { await api.put(`/tariffario/${v._id}`, { attivo: !v.attivo }); await carica(); } catch { /***/ }
  };

  const eliminaVoce = async (id: string) => {
    if (!confirm('Eliminare definitivamente questa voce dal tariffario?')) return;
    try { await api.delete(`/tariffario/${id}`); await carica(); } catch { alert('Errore eliminazione'); }
  };

  const creaVoce = async () => {
    if (!nuova.nome.trim() || nuova.prezzo < 0) return;
    setSaving(true);
    try {
      await api.post('/tariffario', nuova);
      setShowForm(false);
      setNuova({ categoria: 'prestazioni_infermieristiche', nome: '', prezzo: 0, unitaMisura: '', note: '' });
      await carica();
    } catch { alert('Errore creazione voce'); }
    setSaving(false);
  };

  const formatEuro = (n: number) => `€ ${n.toFixed(2)}`;

  if (loading) return <section><p style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>⏳ Caricamento tariffario...</p></section>;

  return (
    <section className="fade-in section-wide">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#1e4d8c' }}>
          <Tag size={26} /> Tariffario Prestazioni
        </h1>
        {puoGestire && (
          <Button variant="primary" onClick={() => setShowForm(true)} icon={<Plus size={18} />}>
            Nuova voce
          </Button>
        )}
      </div>

      {/* Filtri */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Cerca prestazione..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '10px 10px 10px 34px', borderRadius: '8px', border: '1px solid #d1d5db' }}
          />
        </div>
        <select value={catFiltro} onChange={e => setCatFiltro(e.target.value as any)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
          <option value="tutte">Tutte le categorie</option>
          {CATEGORIE.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {/* Elenco per categoria */}
      {CATEGORIE.filter(c => catFiltro === 'tutte' || catFiltro === c.value).map(cat => {
        const items = vociPerCategoria.get(cat.value) || [];
        if (items.length === 0) return null;
        return (
          <div key={cat.value} style={{ marginBottom: '28px' }}>
            <h3 style={{ color: cat.color, marginBottom: '10px' }}>{cat.label} <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: '0.85rem' }}>({items.length})</span></h3>
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '0.82rem', color: '#64748b' }}>Prestazione</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '0.82rem', color: '#64748b' }}>Unità</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: '0.82rem', color: '#64748b' }}>Prezzo</th>
                    {puoGestire && <th style={{ padding: '10px 14px' }} />}
                  </tr>
                </thead>
                <tbody>
                  {items.map(v => (
                    <tr key={v._id} style={{ borderBottom: '1px solid #f1f5f9', opacity: v.attivo ? 1 : 0.45 }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{v.nome}</div>
                        {v.note && <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{v.note}</div>}
                        {!v.attivo && <span style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 700 }}>DISATTIVATA</span>}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '0.85rem', color: '#64748b' }}>{v.unitaMisura || '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        {editId === v._id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            <input
                              type="number" step="0.01" autoFocus
                              value={editPrezzo}
                              onChange={e => setEditPrezzo(Number(e.target.value))}
                              style={{ width: '90px', padding: '6px', borderRadius: '6px', border: '1px solid #2563eb', textAlign: 'right' }}
                            />
                            <button onClick={() => salvaPrezzo(v._id)} style={{ background: '#dcfce7', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: '#16a34a' }}><Check size={14} /></button>
                            <button onClick={() => setEditId(null)} style={{ background: '#fee2e2', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: '#dc2626' }}><X size={14} /></button>
                          </div>
                        ) : (
                          <span
                            onClick={() => { if (puoGestire) { setEditId(v._id); setEditPrezzo(v.prezzo); } }}
                            style={{ fontWeight: 700, color: cat.color, cursor: puoGestire ? 'pointer' : 'default' }}
                            title={puoGestire ? 'Clic per modificare il prezzo' : ''}
                          >
                            {formatEuro(v.prezzo)}
                          </span>
                        )}
                      </td>
                      {puoGestire && (
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button onClick={() => { setEditId(v._id); setEditPrezzo(v.prezzo); }} title="Modifica prezzo" style={{ background: '#eff6ff', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: '#2563eb' }}><Pencil size={13} /></button>
                            <button onClick={() => toggleAttivo(v)} title={v.attivo ? 'Disattiva' : 'Riattiva'} style={{ background: v.attivo ? '#fef3c7' : '#dcfce7', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: v.attivo ? '#92400e' : '#16a34a' }}>
                              {v.attivo ? <X size={13} /> : <Check size={13} />}
                            </button>
                            <button onClick={() => eliminaVoce(v._id)} title="Elimina" style={{ background: '#fef2f2', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', color: '#dc2626' }}><Trash2 size={13} /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {vociFiltrate.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px', background: '#f9fafb', borderRadius: '12px' }}>
          <Tag size={48} style={{ color: '#9ca3af', marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 8px', color: '#4b5563' }}>Nessuna voce trovata</h3>
        </div>
      )}

      {/* Modal nuova voce */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px', maxWidth: '480px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, color: '#1e4d8c' }}>Nuova voce tariffario</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '0.88rem' }}>Categoria *</label>
              <select value={nuova.categoria} onChange={e => setNuova({ ...nuova, categoria: e.target.value as any })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
                {CATEGORIE.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '0.88rem' }}>Nome prestazione *</label>
              <input type="text" value={nuova.nome} onChange={e => setNuova({ ...nuova, nome: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '0.88rem' }}>Prezzo (€) *</label>
                <input type="number" step="0.01" value={nuova.prezzo} onChange={e => setNuova({ ...nuova, prezzo: Number(e.target.value) })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '0.88rem' }}>Unità misura</label>
                <input type="text" placeholder="es. 1 tratto, ora..." value={nuova.unitaMisura} onChange={e => setNuova({ ...nuova, unitaMisura: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
              </div>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '0.88rem' }}>Note</label>
              <input type="text" value={nuova.note} onChange={e => setNuova({ ...nuova, note: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button variant="primary" onClick={creaVoce} disabled={saving} fullWidth>{saving ? 'Salvataggio...' : 'Salva voce'}</Button>
              <Button variant="secondary" onClick={() => setShowForm(false)}>Annulla</Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
