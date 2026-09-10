import { useEffect, useState, ChangeEvent } from 'react';
import api from '../api/api';

// ═════════════════════════════════════════════════════════════════════════════
// Tipi
// ═════════════════════════════════════════════════════════════════════════════
type TipoServizio = 'prelievo' | 'esame_strumentale' | 'prestazione' | 'assistenza';
type CategoriaPrivata = 'diagnostica' | 'assistenza_domiciliare' | 'intermediazione_badanti';
type StatoRichiesta = 'in_attesa' | 'in_revisione' | 'confermata' | 'modificata' | 'rifiutata' | 'completata';

interface Richiesta {
  _id: string;
  tipoServizio: TipoServizio;
  tipoSpecifico?: string;
  pazienteNome: string;
  pazienteIndirizzo: string;
  pazienteTelefono?: string;
  dataPreferita: string;
  orarioPreferito?: string;
  dataAlternativa?: string;
  orarioAlternativo?: string;
  priorita?: 'bassa' | 'normale' | 'alta' | 'urgente';
  noteRichiedente?: string;
  stato: StatoRichiesta;
  dataConfermata?: string;
  orarioConfermato?: string;
  staffAssegnatoNome?: string;
  noteAdmin?: string;
  createdAt: string;
  updatedAt: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// Componente
// ═════════════════════════════════════════════════════════════════════════════
export default function CentroPrenotazioniPrivato() {
  const [richieste, setRichieste] = useState<Richiesta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'tutte' | 'in_attesa' | 'confermata'>('tutte');

  // Form state
  const [formData, setFormData] = useState({
    categoriaPrivata: 'diagnostica' as CategoriaPrivata,
    tipoServizio: 'prelievo' as TipoServizio,
    tipoSpecifico: '',
    pazienteNome: '',
    pazienteIndirizzo: '',
    pazienteTelefono: '',
    dataPreferita: '',
    orarioPreferito: '',
    dataAlternativa: '',
    orarioAlternativo: '',
    priorita: 'normale' as const,
    noteRichiedente: ''
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Caricamento richieste
  // ════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    caricaRichieste();
  }, []);

  const caricaRichieste = async () => {
    try {
      const res = await api.get('/richieste-prenotazioni/mie');
      setRichieste(res.data || []);
    } catch {
      setRichieste([]);
    } finally {
      setLoading(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // Submit nuova richiesta
  // ════════════════════════════════════════════════════════════════════════════
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await api.post('/richieste-prenotazioni', formData);
      setShowForm(false);
      resetForm();
      await caricaRichieste();
      alert('✅ Richiesta inviata con successo! Riceverai una conferma via email.');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nell\'invio della richiesta');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      categoriaPrivata: 'diagnostica',
      tipoServizio: 'prelievo',
      tipoSpecifico: '',
      pazienteNome: '',
      pazienteIndirizzo: '',
      pazienteTelefono: '',
      dataPreferita: '',
      orarioPreferito: '',
      dataAlternativa: '',
      orarioAlternativo: '',
      priorita: 'normale',
      noteRichiedente: ''
    });
  };

  // ════════════════════════════════════════════════════════════════════════════
  // Helpers
  // ════════════════════════════════════════════════════════════════════════════
  const getStatoBadge = (stato: StatoRichiesta) => {
    const styles: Record<StatoRichiesta, { bg: string; color: string; label: string }> = {
      in_attesa: { bg: '#fef3c7', color: '#92400e', label: '⏳ In attesa' },
      in_revisione: { bg: '#dbeafe', color: '#1e40af', label: '📝 In revisione' },
      confermata: { bg: '#d1fae5', color: '#065f46', label: '✅ Confermata' },
      modificata: { bg: '#e0e7ff', color: '#3730a3', label: '✏️ Modificata' },
      rifiutata: { bg: '#fee2e2', color: '#991b1b', label: '❌ Rifiutata' },
      completata: { bg: '#f3e8ff', color: '#6b21a8', label: '✔️ Completata' }
    };
    const s = styles[stato];
    return (
      <span style={{ background: s.bg, color: s.color, padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>
        {s.label}
      </span>
    );
  };

  const getTipoIcon = (tipo: TipoServizio) => {
    const icons: Record<TipoServizio, string> = {
      prelievo: '💉',
      esame_strumentale: '🔬',
      prestazione: '🏥',
      assistenza: '🤝'
    };
    const labels: Record<TipoServizio, string> = {
      prelievo: 'Prelievo',
      esame_strumentale: 'Esame Strumentale',
      prestazione: 'Prestazione',
      assistenza: 'Assistenza'
    };
    return `${icons[tipo]} ${labels[tipo]}`;
  };

  const filteredRichieste = richieste.filter((r: Richiesta) => {
    if (activeTab === 'tutte') return true;
    return r.stato === activeTab;
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Render
  // ════════════════════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <section style={{ padding: '40px 20px', textAlign: 'center' }}>
        <p>Caricamento...</p>
      </section>
    );
  }

  return (
    <section style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', color: '#1e4d8c' }}>📅 Centro Prenotazioni</h1>
          <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>Richiedi prelievi, esami, prestazioni e assistenza domiciliare</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{ padding: '12px 20px', background: '#1e4d8c', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
        >
          + Nuova Richiesta
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {(['tutte', 'in_attesa', 'confermata'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
              background: activeTab === tab ? '#1e4d8c' : '#f1f5f9',
              color: activeTab === tab ? 'white' : '#475569'
            }}
          >
            {tab === 'tutte' ? 'Tutte' : tab === 'in_attesa' ? 'In attesa' : 'Confermate'}
            {tab !== 'tutte' && (
              <span style={{ marginLeft: '6px', fontSize: '0.8rem', opacity: 0.8 }}>
                ({richieste.filter((r: Richiesta) => r.stato === tab).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista richieste */}
      {filteredRichieste.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#666' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📋</div>
          <p style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>Nessuna richiesta {activeTab !== 'tutte' ? 'in questa categoria' : ''}</p>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>Clicca "Nuova Richiesta" per prenotare un servizio</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredRichieste.map((r: Richiesta) => (
            <div key={r._id} style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: r.stato === 'confermata' ? '4px solid #16a34a' : r.stato === 'rifiutata' ? '4px solid #dc2626' : '4px solid #f59e0b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#1e4d8c', marginBottom: '4px' }}>
                    {getTipoIcon(r.tipoServizio)}
                    {r.tipoSpecifico && <span style={{ color: '#666', fontWeight: 400 }}> — {r.tipoSpecifico}</span>}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#374151' }}>
                    <strong>Paziente:</strong> {r.pazienteNome}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px' }}>
                    📍 {r.pazienteIndirizzo}
                  </div>
                </div>
                {getStatoBadge(r.stato)}
              </div>

              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '0.9rem' }}>
                  <div>
                    <span style={{ color: '#666' }}>Data richiesta:</span>
                    <div style={{ fontWeight: 500 }}>
                      {new Date(r.dataPreferita).toLocaleDateString('it-IT')}
                      {r.orarioPreferito && ` alle ${r.orarioPreferito}`}
                    </div>
                    {r.dataAlternativa && (
                      <div style={{ fontSize: '0.8rem', color: '#888' }}>
                        Alt: {new Date(r.dataAlternativa).toLocaleDateString('it-IT')} {r.orarioAlternativo || ''}
                      </div>
                    )}
                  </div>

                  {r.dataConfermata && (
                    <div>
                      <span style={{ color: '#16a34a', fontWeight: 500 }}>✓ Data confermata:</span>
                      <div style={{ fontWeight: 600, color: '#16a34a' }}>
                        {new Date(r.dataConfermata).toLocaleDateString('it-IT')}
                        {r.orarioConfermato && ` alle ${r.orarioConfermato}`}
                      </div>
                    </div>
                  )}

                  {r.staffAssegnatoNome && (
                    <div>
                      <span style={{ color: '#666' }}>Operatore:</span>
                      <div style={{ fontWeight: 500 }}>{r.staffAssegnatoNome}</div>
                    </div>
                  )}

                  <div>
                    <span style={{ color: '#666' }}>Richiesta il:</span>
                    <div style={{ fontWeight: 500 }}>{new Date(r.createdAt).toLocaleDateString('it-IT')}</div>
                  </div>
                </div>

                {r.noteRichiedente && (
                  <div style={{ marginTop: '12px', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', fontSize: '0.85rem' }}>
                    <strong>Note:</strong> {r.noteRichiedente}
                  </div>
                )}

                {r.noteAdmin && (
                  <div style={{ marginTop: '8px', background: r.stato === 'rifiutata' ? '#fef2f2' : '#eff6ff', padding: '8px 12px', borderRadius: '6px', fontSize: '0.85rem', borderLeft: `3px solid ${r.stato === 'rifiutata' ? '#dc2626' : '#3b82f6'}` }}>
                    <strong>{r.stato === 'rifiutata' ? 'Motivo rifiuto:' : 'Note admin:'}</strong> {r.noteAdmin}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px', maxWidth: '600px', width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#1e4d8c' }}>📋 Nuova Richiesta</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#666' }}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Categoria privata */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>Categoria servizio *</label>
                <select
                  value={formData.categoriaPrivata}
                  onChange={e => setFormData({ ...formData, categoriaPrivata: e.target.value as CategoriaPrivata })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                  required
                >
                  <option value="diagnostica">🩺 Diagnostica (prelievi / esami)</option>
                  <option value="assistenza_domiciliare">🏥 Assistenza sanitaria domiciliare</option>
                  <option value="intermediazione_badanti">🤝 Intermediazione badanti</option>
                </select>
              </div>

              {/* Tipo servizio */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>Tipo di servizio *</label>
                <select
                  value={formData.tipoServizio}
                  onChange={e => setFormData({ ...formData, tipoServizio: e.target.value as TipoServizio })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                  required
                >
                  <option value="prelievo">💉 Prelievo</option>
                  <option value="esame_strumentale">🔬 Esame Strumentale</option>
                  <option value="prestazione">🏥 Prestazione</option>
                  <option value="assistenza">🤝 Assistenza</option>
                </select>
              </div>

              {/* Tipo specifico */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>
                  Tipo specifico {formData.tipoServizio === 'prelievo' && '(es. Emocromo, Coagulazione...)'}
                  {formData.tipoServizio === 'esame_strumentale' && '(es. ECG, Holter...)'}
                </label>
                <input
                  type="text"
                  value={formData.tipoSpecifico}
                  onChange={e => setFormData({ ...formData, tipoSpecifico: e.target.value })}
                  placeholder={formData.tipoServizio === 'prelievo' ? 'Es. Emocromo completo' : formData.tipoServizio === 'esame_strumentale' ? 'Es. ECG' : 'Specifica il tipo...'}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                />
              </div>

              {/* Dati paziente */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>Nome completo paziente *</label>
                <input
                  type="text"
                  value={formData.pazienteNome}
                  onChange={e => setFormData({ ...formData, pazienteNome: e.target.value })}
                  placeholder="Nome e cognome"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                  required
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>Indirizzo *</label>
                <input
                  type="text"
                  value={formData.pazienteIndirizzo}
                  onChange={e => setFormData({ ...formData, pazienteIndirizzo: e.target.value })}
                  placeholder="Via, numero, città"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                  required
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>Telefono paziente</label>
                <input
                  type="tel"
                  value={formData.pazienteTelefono}
                  onChange={e => setFormData({ ...formData, pazienteTelefono: e.target.value })}
                  placeholder="Numero di telefono"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                />
              </div>

              {/* Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>Data preferita *</label>
                  <input
                    type="date"
                    value={formData.dataPreferita}
                    onChange={e => setFormData({ ...formData, dataPreferita: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>Orario preferito</label>
                  <input
                    type="time"
                    value={formData.orarioPreferito}
                    onChange={e => setFormData({ ...formData, orarioPreferito: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>Data alternativa</label>
                  <input
                    type="date"
                    value={formData.dataAlternativa}
                    onChange={e => setFormData({ ...formData, dataAlternativa: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>Orario alternativo</label>
                  <input
                    type="time"
                    value={formData.orarioAlternativo}
                    onChange={e => setFormData({ ...formData, orarioAlternativo: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                  />
                </div>
              </div>

              {/* Priorità */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>Priorità</label>
                <select
                  value={formData.priorita}
                  onChange={e => setFormData({ ...formData, priorita: e.target.value as any })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                >
                  <option value="bassa">🟢 Bassa</option>
                  <option value="normale">🔵 Normale</option>
                  <option value="alta">🟠 Alta</option>
                  <option value="urgente">🔴 Urgente</option>
                </select>
              </div>

              {/* Note */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>Note aggiuntive</label>
                <textarea
                  value={formData.noteRichiedente}
                  onChange={e => setFormData({ ...formData, noteRichiedente: e.target.value })}
                  placeholder="Informazioni utili per l'operatore..."
                  rows={3}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', resize: 'vertical' }}
                />
              </div>

              {/* Azioni */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ flex: 1, padding: '14px', background: '#1e4d8c', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? '⏳ Invio...' : '📤 Invia Richiesta'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                  style={{ padding: '14px 24px', background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
                >
                  Annulla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
