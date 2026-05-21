import { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

interface Farmaco {
  _id?: string;
  id: string;
  nome: string;
  dosaggio: string;
  quantita: number;
  scadenza: string;
  scortaMinima?: number;
}

interface SupplyMovement {
  _id: string;
  supply: string;
  tipo: 'carico' | 'scarico';
  quantita: number;
  motivazione?: string;
  eseguitoDaNome?: string;
  dataMovimento: string;
  quantitaPrecedente: number;
  quantitaSuccessiva: number;
}

interface FarmaciSectionProps {
  getToken: () => string | null;
  canEdit: boolean;
  formatData: (data: string | Date) => string;
  formatDataOra: (data: string | Date) => string;
  eScadutoOProssimo: (scadenza: string) => boolean;
}

export default function FarmaciSection({ getToken, canEdit, formatData, formatDataOra, eScadutoOProssimo }: FarmaciSectionProps) {
  const [farmaci, setFarmaci] = useState<Farmaco[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFarmaco, setSelectedFarmaco] = useState<Farmaco | null>(null);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementType, setMovementType] = useState<'carico' | 'scarico'>('carico');
  const [movementQuantity, setMovementQuantity] = useState<number>(1);
  const [movementNote, setMovementNote] = useState('');
  const [movements, setMovements] = useState<SupplyMovement[]>([]);

  useEffect(() => {
    fetchFarmaci();
  }, []);

  const [nuovoFarmaco, setNuovoFarmaco] = useState({
    nome: '',
    dosaggio: '',
    quantita: 0,
    scadenza: '',
    scortaMinima: 0,
  });

  // Carica farmaci dal backend
  const fetchFarmaci = async () => {
    const token = getToken();
    if (!token) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/supplies?category=farmaco`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setFarmaci(data.map((item: any) => ({
          ...item,
          id: item._id,
        })));
      } else {
        setError('Errore nel caricamento dei farmaci');
      }
    } catch (err) {
      console.warn('Errore nel caricamento farmaci:', err);
      setError('Errore di connessione');
    } finally {
      setLoading(false);
    }
  };

  // Carica movimenti per un farmaco
  const fetchMovements = async (supplyId: string) => {
    const token = getToken();
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/supplies/${supplyId}/movements`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setMovements(data);
      }
    } catch (err) {
      console.error('Errore nel caricamento movimenti:', err);
    }
  };

  // Aggiungere nuovo farmaco
  const aggiungiFarmaco = async () => {
    if (!nuovoFarmaco.nome || !nuovoFarmaco.dosaggio) {
      alert('Inserire nome e dosaggio del farmaco');
      return;
    }

    const token = getToken();
    if (!token) {
      alert('Devi essere autenticato per aggiungere farmaci');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/supplies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...nuovoFarmaco,
          unitaMisura: 'confezioni',
          category: 'farmaco',
        }),
      });

      if (response.ok) {
        const nuovo = await response.json();
        setFarmaci([...farmaci, { ...nuovo, id: nuovo._id }]);
        setNuovoFarmaco({
          nome: '',
          dosaggio: '',
          quantita: 0,
          scadenza: '',
          scortaMinima: 0,
        });
        alert('Farmaco aggiunto con successo!');
      } else {
        const error = await response.json();
        alert(error.message || 'Errore nell\'aggiunta del farmaco');
      }
    } catch (err) {
      alert('Errore di connessione');
    }
  };

  // Eliminare farmaco
  const eliminaFarmaco = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo farmaco?')) return;

    const token = getToken();
    if (!token) {
      alert('Devi essere autenticato per eliminare farmaci');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/supplies/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setFarmaci(farmaci.filter((f) => f.id !== id));
        alert('Farmaco eliminato con successo!');
      } else {
        const error = await response.json();
        alert(error.message || 'Errore nell\'eliminazione del farmaco');
      }
    } catch (err) {
      alert('Errore di connessione');
    }
  };

  // Apri modal movimenti
  const apriMovimenti = async (farmaco: Farmaco) => {
    setSelectedFarmaco(farmaco);
    setMovementType('carico');
    setMovementQuantity(1);
    setMovementNote('');
    await fetchMovements(farmaco.id);
    setShowMovementModal(true);
  };

  // Chiudi modal movimenti
  const chiudiMovimenti = () => {
    setShowMovementModal(false);
    setSelectedFarmaco(null);
    setMovements([]);
  };

  // Effettua movimento
  const eseguiMovimento = async () => {
    if (!selectedFarmaco) return;
    if (movementQuantity <= 0) {
      alert('Inserire una quantità valida');
      return;
    }

    if (movementType === 'scarico' && movementQuantity > selectedFarmaco.quantita) {
      alert(`Quantità insufficiente. Disponibilità: ${selectedFarmaco.quantita} confezioni`);
      return;
    }

    const token = getToken();
    if (!token) {
      alert('Devi essere autenticato per eseguire movimenti');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/supplies/${selectedFarmaco.id}/movements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tipo: movementType,
          quantita: movementQuantity,
          motivazione: movementNote,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setFarmaci(farmaci.map(f =>
          f.id === selectedFarmaco.id
            ? { ...f, quantita: result.supply.quantita }
            : f
        ));
        await fetchMovements(selectedFarmaco.id);
        setMovementQuantity(1);
        setMovementNote('');
        alert(`Movimento registrato! Nuova quantità: ${result.supply.quantita} confezioni`);
      } else {
        const error = await response.json();
        alert(error.message || 'Errore nell\'esecuzione del movimento');
      }
    } catch (err) {
      alert('Errore di connessione');
    }
  };

  return (
    <>
      {/* Sezione Farmaci */}
      <div className="dashboard-folder" style={{ marginBottom: '32px' }}>
        <h3>💊 Farmaci</h3>

        {/* Form aggiunta farmaco */}
        {canEdit && (
          <div className="user-form" style={{ marginBottom: '20px', maxWidth: '600px' }}>
            <h4>Aggiungi nuovo farmaco</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <label>
                Nome farmaco *
                <input
                  type="text"
                  value={nuovoFarmaco.nome}
                  onChange={(e) => setNuovoFarmaco({ ...nuovoFarmaco, nome: e.target.value })}
                  placeholder="Es. Tachipirina"
                />
              </label>
              <label>
                Dosaggio *
                <input
                  type="text"
                  value={nuovoFarmaco.dosaggio}
                  onChange={(e) => setNuovoFarmaco({ ...nuovoFarmaco, dosaggio: e.target.value })}
                  placeholder="Es. 500mg, 1g"
                />
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <label>
                Quantità iniziale (confezioni)
                <input
                  type="number"
                  min="0"
                  value={nuovoFarmaco.quantita}
                  onChange={(e) => setNuovoFarmaco({ ...nuovoFarmaco, quantita: parseInt(e.target.value) || 0 })}
                />
              </label>
              <label>
                Scorta minima
                <input
                  type="number"
                  min="0"
                  value={nuovoFarmaco.scortaMinima}
                  onChange={(e) => setNuovoFarmaco({ ...nuovoFarmaco, scortaMinima: parseInt(e.target.value) || 0 })}
                />
              </label>
            </div>
            <label>
              Scadenza
              <input
                type="date"
                value={nuovoFarmaco.scadenza}
                onChange={(e) => setNuovoFarmaco({ ...nuovoFarmaco, scadenza: e.target.value })}
              />
            </label>
            <button type="button" onClick={aggiungiFarmaco}>
              Aggiungi farmaco
            </button>
          </div>
        )}

        {/* Stato caricamento */}
        {loading && <p style={{ color: '#666' }}>Caricamento farmaci...</p>}
        {error && <p style={{ color: '#dc3545' }}>{error}</p>}

        {/* Lista farmaci */}
        {!loading && farmaci.length > 0 ? (
          <div className="document-list">
            <h4>Elenco farmaci ({farmaci.length})</h4>
            <ul>
              {farmaci.map((farmaco) => {
                const sottoScorta = farmaco.scortaMinima && farmaco.quantita <= farmaco.scortaMinima;
                return (
                  <li key={farmaco.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <strong style={{ fontSize: '1.05rem' }}>{farmaco.nome}</strong>
                        <span style={{
                          marginLeft: '8px',
                          padding: '2px 8px',
                          backgroundColor: '#f0f0f0',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          color: '#666',
                        }}>
                          {farmaco.dosaggio}
                        </span>
                        <span style={{ marginLeft: '12px', color: '#666' }}>
                          Qta: <span style={{
                            fontWeight: '700',
                            color: sottoScorta ? '#dc3545' : '#28a745',
                            fontSize: '1.1em',
                          }}>{farmaco.quantita}</span> conf.
                          {sottoScorta && <span style={{ color: '#dc3545', fontWeight: '600', marginLeft: '8px' }}>⚠️ Sotto scorta!</span>}
                        </span>
                        {farmaco.scadenza && (
                          <span style={{ marginLeft: '12px', color: eScadutoOProssimo(farmaco.scadenza) ? '#dc3545' : '#666' }}>
                            Scad.: {formatData(farmaco.scadenza)}
                            {eScadutoOProssimo(farmaco.scadenza) && ' ⚠️'}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => apriMovimenti(farmaco)}
                          style={{ background: '#17a2b8' }}
                        >
                          📦 Movimenti
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => eliminaFarmaco(farmaco.id)}
                            style={{ background: '#dc3545' }}
                          >
                            Elimina
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          !loading && <p>Nessun farmaco presente.</p>
        )}
      </div>

      {/* Modal per i movimenti di magazzino farmaci */}
      {showMovementModal && selectedFarmaco && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div className="modal-content" style={{
            backgroundColor: '#fff',
            padding: '24px',
            borderRadius: '8px',
            maxWidth: '700px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0 }}>Gestione Movimenti - {selectedFarmaco.nome}</h3>
                <p style={{ margin: '4px 0 0', color: '#666', fontSize: '0.92rem' }}>
                  Dosaggio: {selectedFarmaco.dosaggio}
                </p>
              </div>
              <button
                type="button"
                onClick={chiudiMovimenti}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}
              >
                ×
              </button>
            </div>

            {/* Informazioni farmaco */}
            <div style={{
              marginBottom: '20px',
              padding: '12px',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <span style={{ color: '#666' }}>Quantità attuale: </span>
                <strong style={{ fontSize: '1.2em', color: '#28a745' }}>
                  {selectedFarmaco.quantita} confezioni
                </strong>
              </div>
              {selectedFarmaco.scadenza && (
                <div>
                  <span style={{ color: '#666' }}>Scadenza: </span>
                  <strong>{formatData(selectedFarmaco.scadenza)}</strong>
                </div>
              )}
            </div>

            {/* Form movimento */}
            <div style={{
              marginBottom: '24px',
              padding: '16px',
              border: '2px dashed #dee2e6',
              borderRadius: '4px',
              backgroundColor: '#f8f9fa',
            }}>
              <h4 style={{ marginTop: 0, marginBottom: '16px' }}>Nuovo Movimento</h4>

              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '120px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Tipo movimento</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setMovementType('carico')}
                      style={{
                        flex: 1,
                        background: movementType === 'carico' ? '#28a745' : '#6c757d',
                        padding: '10px',
                      }}
                    >
                      ⬆ Carico
                    </button>
                    <button
                      type="button"
                      onClick={() => setMovementType('scarico')}
                      style={{
                        flex: 1,
                        background: movementType === 'scarico' ? '#dc3545' : '#6c757d',
                        padding: '10px',
                      }}
                    >
                      ⬇ Scarico
                    </button>
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: '120px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                    Quantità (confezioni)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={movementQuantity}
                    onChange={(e) => setMovementQuantity(parseInt(e.target.value) || 1)}
                    style={{ width: '100%', padding: '10px', fontSize: '16px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  Motivazione (opzionale)
                </label>
                <input
                  type="text"
                  value={movementNote}
                  onChange={(e) => setMovementNote(e.target.value)}
                  placeholder={movementType === 'carico' ? 'Es. Fornitura, acquisto...' : 'Es. Somministrato a paziente, scaduto...'}
                  style={{ width: '100%', padding: '10px' }}
                />
              </div>

              {movementType === 'scarico' && (
                <div style={{
                  padding: '10px',
                  backgroundColor: movementQuantity > selectedFarmaco.quantita ? '#f8d7da' : '#d4edda',
                  borderRadius: '4px',
                  marginBottom: '16px',
                  color: movementQuantity > selectedFarmaco.quantita ? '#721c24' : '#155724',
                }}>
                  {movementQuantity > selectedFarmaco.quantita ? (
                    <strong>⚠️ Quantità insufficiente!</strong>
                  ) : (
                    `Nuova quantità dopo scarico: ${selectedFarmaco.quantita - movementQuantity} confezioni`
                  )}
                </div>
              )}

              {movementType === 'carico' && (
                <div style={{
                  padding: '10px',
                  backgroundColor: '#d4edda',
                  borderRadius: '4px',
                  marginBottom: '16px',
                  color: '#155724',
                }}>
                  Nuova quantità dopo carico: {selectedFarmaco.quantita + movementQuantity} confezioni
                </div>
              )}

              <button
                type="button"
                onClick={eseguiMovimento}
                disabled={movementQuantity <= 0 || (movementType === 'scarico' && movementQuantity > selectedFarmaco.quantita)}
                style={{
                  width: '100%',
                  background: movementType === 'carico' ? '#28a745' : '#dc3545',
                  padding: '12px',
                  fontSize: '16px',
                  opacity: movementQuantity <= 0 || (movementType === 'scarico' && movementQuantity > selectedFarmaco.quantita) ? 0.6 : 1,
                }}
              >
                Conferma {movementType === 'carico' ? 'Carico' : 'Scarico'}
              </button>
            </div>

            {/* Storico movimenti */}
            <div>
              <h4 style={{ marginTop: 0, marginBottom: '12px' }}>Storico Movimenti</h4>

              {movements.length === 0 ? (
                <p style={{ color: '#666', fontStyle: 'italic' }}>Nessun movimento registrato.</p>
              ) : (
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {movements.map((mov) => (
                    <div
                      key={mov._id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '10px',
                        border: '1px solid #dee2e6',
                        borderRadius: '4px',
                        backgroundColor: '#f8f9fa',
                        marginBottom: '8px',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: mov.tipo === 'carico' ? '#28a745' : '#dc3545',
                          color: '#fff',
                          fontSize: '12px',
                          fontWeight: '600',
                          marginRight: '12px',
                        }}
                      >
                        {mov.tipo === 'carico' ? '⬆' : '⬇'} {mov.tipo.toUpperCase()}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div>
                          <strong>{mov.quantita}</strong> confezioni
                          {mov.motivazione && <span style={{ color: '#666', marginLeft: '8px' }}>- {mov.motivazione}</span>}
                        </div>
                        <div style={{ fontSize: '11px', color: '#666' }}>
                          {formatDataOra(mov.dataMovimento)}
                          {mov.eseguitoDaNome && <span> - Da: {mov.eseguitoDaNome}</span>}
                          <span style={{ marginLeft: '8px' }}>
                            {mov.quantitaPrecedente} → {mov.quantitaSuccessiva}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}