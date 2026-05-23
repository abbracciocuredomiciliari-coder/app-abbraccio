import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import FarmaciSection from '../components/FarmaciSection';
import api from '../api/api';

// Interfacce per le apparecchiature elettromedicali
interface Apparecchiatura {
  _id?: string;
  id: string;
  tipo: string;
  matricola: string;
  controlloEseguito: boolean;
  dataControllo: string;
}

// Interfacce per i documenti delle apparecchiature
interface EquipmentDocument {
  _id: string;
  equipment: string;
  documentType: 'conformita' | 'manutenzione' | 'manuale';
  fileName: string;
  contentType: string;
  createdAt: string;
  updatedAt: string;
}

// Interfacce per i presidi sanitari
interface PresidioSanitario {
  _id?: string;
  id: string;
  nome: string;
  quantita: number;
  scadenza: string;
  unitaMisura?: string;
  scortaMinima?: number;
}

// Interfaccia per i movimenti di magazzino
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

// Etichette per i tipi di documento
const documentTypeLabels: Record<string, string> = {
  conformita: 'Certificato di conformità',
  manutenzione: 'Libretto di manutenzione',
  manuale: "Manuale d'uso",
};

// Colori per i tipi di documento
const documentTypeColors: Record<string, string> = {
  conformita: '#28a745',
  manutenzione: '#17a2b8',
  manuale: '#6c757d',
};

function Strumenti() {
  const { user, getToken } = useAuth();
  const [apparecchiature, setApparecchiature] = useState<Apparecchiatura[]>([]);
  const [presidi, setPresidi] = useState<PresidioSanitario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stato per la gestione dei documenti
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [documents, setDocuments] = useState<EquipmentDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stato per la gestione movimenti presidi
  const [selectedPresidio, setSelectedPresidio] = useState<PresidioSanitario | null>(null);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementType, setMovementType] = useState<'carico' | 'scarico'>('carico');
  const [movementQuantity, setMovementQuantity] = useState<number>(1);
  const [movementNote, setMovementNote] = useState('');
  const [movements, setMovements] = useState<SupplyMovement[]>([]);

  // Form stati per le apparecchiature
  const [nuovaApparecchiatura, setNuovaApparecchiatura] = useState({
    tipo: '',
    matricola: '',
    controlloEseguito: false,
    dataControllo: '',
  });

  // Form stati per i presidi sanitari
  const [nuovoPresidio, setNuovoPresidio] = useState({
    nome: '',
    quantita: 0,
    scadenza: '',
    unitaMisura: 'pezzi',
    scortaMinima: 0,
  });

  useEffect(() => {
    fetchApparecchiature();
    fetchPresidi();
  }, []);

  const fetchApparecchiature = async () => {
    try {
      const res = await api.get('/equipment');
      setApparecchiature(res.data.map((item: any) => ({ ...item, id: item._id || item.id })));
    } catch (err) {
      console.warn('Errore nel caricamento delle apparecchiature:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPresidi = async () => {
    try {
      const res = await api.get('/supplies');
      setPresidi(res.data.map((item: any) => ({ ...item, id: item._id || item.id })));
    } catch (err) {
      console.warn('Errore nel caricamento dei presidi:', err);
    }
  };

  const fetchDocuments = async (equipmentId: string) => {
    try {
      const res = await api.get(`/equipment/${equipmentId}/documents`);
      setDocuments(res.data);
    } catch (err) {
      console.error('Errore nel caricamento documenti:', err);
    }
  };

  const fetchMovements = async (supplyId: string) => {
    try {
      const res = await api.get(`/supplies/${supplyId}/movements`);
      setMovements(res.data);
    } catch (err) {
      console.error('Errore nel caricamento movimenti:', err);
    }
  };

  const formatData = (data: string | Date) => {
    if (!data) return 'N/A';
    return new Date(data).toLocaleDateString('it-IT');
  };

  const formatDataOra = (data: string | Date) => {
    if (!data) return 'N/A';
    return new Date(data).toLocaleString('it-IT');
  };

  const eScadutoOProssimo = (scadenza: string) => {
    const oggi = new Date();
    const dataScadenza = new Date(scadenza);
    const differenzaGiorni = Math.ceil((dataScadenza.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24));
    return differenzaGiorni <= 30;
  };

  // Aggiungere nuova apparecchiatura
  const aggiungiApparecchiatura = async () => {
    if (!nuovaApparecchiatura.tipo || !nuovaApparecchiatura.matricola) {
      alert('Inserire tipo e matricola');
      return;
    }
    try {
      const res = await api.post('/equipment', nuovaApparecchiatura);
      setApparecchiature([...apparecchiature, { ...res.data, id: res.data._id }]);
      setNuovaApparecchiatura({ tipo: '', matricola: '', controlloEseguito: false, dataControllo: '' });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Errore di connessione';
      alert(msg);
    }
  };

  // Eliminare apparecchiatura
  const eliminaApparecchiatura = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa apparecchiatura e tutti i suoi documenti?')) return;
    try {
      await api.delete(`/equipment/${id}`);
      setApparecchiature(apparecchiature.filter((a) => a.id !== id));
      if (selectedEquipment === id) {
        setShowDocumentsModal(false);
        setSelectedEquipment(null);
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore di connessione');
    }
  };

  // Aggiungere nuovo presidio
  const aggiungiPresidio = async () => {
    if (!nuovoPresidio.nome) {
      alert('Inserire nome del presidio');
      return;
    }
    try {
      const res = await api.post('/supplies', nuovoPresidio);
      setPresidi([...presidi, { ...res.data, id: res.data._id }]);
      setNuovoPresidio({ nome: '', quantita: 0, scadenza: '', unitaMisura: 'pezzi', scortaMinima: 0 });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Errore di connessione';
      alert(msg);
    }
  };

  // Eliminare presidio
  const eliminaPresidio = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo presidio?')) return;
    try {
      await api.delete(`/supplies/${id}`);
      setPresidi(presidi.filter((p) => p.id !== id));
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore di connessione');
    }
  };

  // Effettua movimento di magazzino
  const eseguiMovimento = async () => {
    if (!selectedPresidio) return;
    if (movementQuantity <= 0) { alert('Inserire una quantità valida'); return; }
    if (movementType === 'scarico' && movementQuantity > selectedPresidio.quantita) {
      alert(`Quantità insufficiente. Disponibilità: ${selectedPresidio.quantita} ${selectedPresidio.unitaMisura || 'pezzi'}`);
      return;
    }
    try {
      const res = await api.post(`/supplies/${selectedPresidio.id}/movements`, {
        tipo: movementType,
        quantita: movementQuantity,
        motivazione: movementNote,
      });
      setPresidi(presidi.map(p => p.id === selectedPresidio.id ? { ...p, quantita: res.data.supply.quantita } : p));
      await fetchMovements(selectedPresidio.id);
      setMovementQuantity(1);
      setMovementNote('');
      alert(`Movimento registrato! Nuova quantità: ${res.data.supply.quantita} ${selectedPresidio.unitaMisura || 'pezzi'}`);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore di connessione');
    }
  };

  const apriDocumenti = async (equipmentId: string) => {
    setSelectedEquipment(equipmentId);
    await fetchDocuments(equipmentId);
    setShowDocumentsModal(true);
  };

  const chiudiDocumenti = () => {
    setShowDocumentsModal(false);
    setSelectedEquipment(null);
    setDocuments([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const apriMovimenti = async (presidio: PresidioSanitario) => {
    setSelectedPresidio(presidio);
    setMovementType('carico');
    setMovementQuantity(1);
    setMovementNote('');
    await fetchMovements(presidio.id);
    setShowMovementModal(true);
  };

  const chiudiMovimenti = () => {
    setShowMovementModal(false);
    setSelectedPresidio(null);
    setMovements([]);
  };

  // Carica un documento (usa fetch per FormData con token da localStorage)
  const caricaDocumento = async (documentType: 'conformita' | 'manutenzione' | 'manuale') => {
    const fileInput = fileInputRef.current;
    if (!fileInput?.files?.length) { alert('Seleziona un file da caricare'); return; }
    const file = fileInput.files[0];
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) { alert('Tipo di file non consentito. Usa PDF, immagini (JPG, PNG) o documenti Word.'); return; }
    if (file.size > 20 * 1024 * 1024) { alert('File troppo grande. Dimensione massima: 20MB'); return; }
    if (!selectedEquipment) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('documentType', documentType);
      // Per FormData usiamo axios senza Content-Type (lo imposta automaticamente)
      await api.post(`/equipment/${selectedEquipment}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await fetchDocuments(selectedEquipment);
      if (fileInputRef.current) fileInputRef.current.value = '';
      alert('Documento caricato con successo!');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nel caricamento del documento');
    } finally {
      setUploading(false);
    }
  };

  // Scarica un documento
  const scaricaDocumento = async (documentId: string, fileName: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const baseURL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/$/, '');
      const url = baseURL.endsWith('/api') ? `${baseURL}/equipment/documents/${documentId}` : `${baseURL}/api/equipment/documents/${documentId}`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) {
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert('Errore nel download del documento');
      }
    } catch (err) {
      alert('Errore di connessione');
    }
  };

  // Elimina un documento
  const eliminaDocumento = async (documentId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo documento?')) return;
    try {
      await api.delete(`/equipment/documents/${documentId}`);
      await fetchDocuments(selectedEquipment!);
      alert('Documento eliminato con successo!');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore di connessione');
    }
  };

  const canEdit = !!(user);

  return (
    <section>
      <h2>Strumenti e Presidi</h2>

      {/* Sezione Apparecchiature Elettromedicali */}
      <div className="dashboard-folder" style={{ marginBottom: '32px' }}>
        <h3>Apparecchiature Elettromedicali</h3>

        {loading ? (
          <p>Caricamento apparecchiature...</p>
        ) : error ? (
          <p style={{ color: '#dc3545' }}>{error}</p>
        ) : (
          <>
            {canEdit && (
              <div className="user-form" style={{ marginBottom: '20px', maxWidth: '500px' }}>
                <h4>Aggiungi nuova apparecchiatura</h4>
                <label>
                  Tipo apparecchiatura
                  <input
                    type="text"
                    value={nuovaApparecchiatura.tipo}
                    onChange={(e) => setNuovaApparecchiatura({ ...nuovaApparecchiatura, tipo: e.target.value })}
                    placeholder="Es. Elettrocardiografo"
                  />
                </label>
                <label>
                  Matricola
                  <input
                    type="text"
                    value={nuovaApparecchiatura.matricola}
                    onChange={(e) => setNuovaApparecchiatura({ ...nuovaApparecchiatura, matricola: e.target.value })}
                    placeholder="Es. ECG-2024-001"
                  />
                </label>
                <label style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={nuovaApparecchiatura.controlloEseguito}
                    onChange={(e) => setNuovaApparecchiatura({ ...nuovaApparecchiatura, controlloEseguito: e.target.checked })}
                    style={{ width: 'auto' }}
                  />
                  Controllo eseguito
                </label>
                {nuovaApparecchiatura.controlloEseguito && (
                  <label>
                    Data controllo
                    <input
                      type="date"
                      value={nuovaApparecchiatura.dataControllo}
                      onChange={(e) => setNuovaApparecchiatura({ ...nuovaApparecchiatura, dataControllo: e.target.value })}
                    />
                  </label>
                )}
                <button type="button" onClick={aggiungiApparecchiatura}>
                  Aggiungi apparecchiatura
                </button>
              </div>
            )}

            {apparecchiature.length > 0 ? (
              <div className="document-list">
                <h4>Elenco apparecchiature ({apparecchiature.length})</h4>
                <ul>
                  {apparecchiature.map((apparecchiatura) => (
                    <li key={apparecchiatura.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <strong>{apparecchiatura.tipo}</strong>
                          <span style={{ marginLeft: '12px', color: '#666' }}>Matricola: {apparecchiatura.matricola}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {apparecchiatura.controlloEseguito ? (
                            <span style={{ color: '#28a745', fontWeight: '600' }}>
                              ✓ Controllato il {formatData(apparecchiatura.dataControllo)}
                            </span>
                          ) : (
                            <span style={{ color: '#dc3545', fontWeight: '600' }}>✗ Da controllare</span>
                          )}
                          <button type="button" onClick={() => apriDocumenti(apparecchiatura.id)} style={{ background: '#17a2b8' }}>
                            📎 Documenti
                          </button>
                          {canEdit && (
                            <button type="button" onClick={() => eliminaApparecchiatura(apparecchiatura.id)} style={{ background: '#dc3545' }}>
                              Elimina
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p>Nessuna apparecchiatura presente.</p>
            )}
          </>
        )}
      </div>

      {/* Sezione Farmaci */}
      <FarmaciSection
        getToken={getToken}
        canEdit={canEdit}
        formatData={formatData}
        formatDataOra={formatDataOra}
        eScadutoOProssimo={eScadutoOProssimo}
      />

      {/* Sezione Presidi Sanitari */}
      <div className="dashboard-folder">
        <h3>Presidi Sanitari</h3>

        {canEdit && (
          <div className="user-form" style={{ marginBottom: '20px', maxWidth: '500px' }}>
            <h4>Aggiungi nuovo presidio</h4>
            <label>
              Nome presidio
              <input
                type="text"
                value={nuovoPresidio.nome}
                onChange={(e) => setNuovoPresidio({ ...nuovoPresidio, nome: e.target.value })}
                placeholder="Es. Garze sterili 10x10"
              />
            </label>
            <label>
              Quantità iniziale
              <input
                type="number"
                min="0"
                value={nuovoPresidio.quantita}
                onChange={(e) => setNuovoPresidio({ ...nuovoPresidio, quantita: parseInt(e.target.value) || 0 })}
              />
            </label>
            <label>
              Unità di misura
              <select value={nuovoPresidio.unitaMisura} onChange={(e) => setNuovoPresidio({ ...nuovoPresidio, unitaMisura: e.target.value })}>
                <option value="pezzi">Pezzi</option>
                <option value="confezioni">Confezioni</option>
                <option value="scatole">Scatole</option>
                <option value="ml">Metri lineari</option>
                <option value="kg">Kg</option>
                <option value="l">Litri</option>
              </select>
            </label>
            <label>
              Scadenza
              <input
                type="date"
                value={nuovoPresidio.scadenza}
                onChange={(e) => setNuovoPresidio({ ...nuovoPresidio, scadenza: e.target.value })}
              />
            </label>
            <label>
              Scorta minima (opzionale)
              <input
                type="number"
                min="0"
                value={nuovoPresidio.scortaMinima}
                onChange={(e) => setNuovoPresidio({ ...nuovoPresidio, scortaMinima: parseInt(e.target.value) || 0 })}
              />
            </label>
            <button type="button" onClick={aggiungiPresidio}>
              Aggiungi presidio
            </button>
          </div>
        )}

        {presidi.length > 0 ? (
          <div className="document-list">
            <h4>Elenco presidi ({presidi.length})</h4>
            <ul>
              {presidi.map((presidio) => {
                const unita = presidio.unitaMisura || 'pezzi';
                const sottoScorta = presidio.scortaMinima && presidio.quantita <= presidio.scortaMinima;
                return (
                  <li key={presidio.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <strong>{presidio.nome}</strong>
                        <span style={{ marginLeft: '12px', color: '#666' }}>
                          Qta: <span style={{ fontWeight: '700', color: sottoScorta ? '#dc3545' : '#28a745', fontSize: '1.1em' }}>{presidio.quantita}</span> {unita}
                          {sottoScorta && <span style={{ color: '#dc3545', fontWeight: '600', marginLeft: '8px' }}>⚠️ Sotto scorta!</span>}
                        </span>
                        {presidio.scadenza && (
                          <span style={{ marginLeft: '12px', color: eScadutoOProssimo(presidio.scadenza) ? '#dc3545' : '#666' }}>
                            Scad.: {formatData(presidio.scadenza)}{eScadutoOProssimo(presidio.scadenza) && ' ⚠️'}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button type="button" onClick={() => apriMovimenti(presidio)} style={{ background: '#17a2b8' }}>
                          📦 Movimenti
                        </button>
                        {canEdit && (
                          <button type="button" onClick={() => eliminaPresidio(presidio.id)} style={{ background: '#dc3545' }}>
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
          <p>Nessun presidio presente.</p>
        )}
      </div>

      {/* Modal documenti apparecchiature */}
      {showDocumentsModal && selectedEquipment && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', maxWidth: '700px', width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Gestione Documenti</h3>
              <button type="button" onClick={chiudiDocumenti} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>×</button>
            </div>

            {(() => {
              const eq = apparecchiature.find(a => a.id === selectedEquipment);
              return eq ? (
                <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                  <strong>{eq.tipo}</strong>
                  <span style={{ marginLeft: '12px', color: '#666' }}>Matricola: {eq.matricola}</span>
                </div>
              ) : null;
            })()}

            <input ref={fileInputRef} type="file" style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />

            {canEdit && (
              <div style={{ marginBottom: '24px', padding: '16px', border: '2px dashed #dee2e6', borderRadius: '4px' }}>
                <h4 style={{ marginTop: 0, marginBottom: '12px' }}>Carica nuovo documento</h4>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '8px' }}>1. Seleziona il file (PDF, JPG, PNG, DOC, DOCX - max 20MB)</label>
                  <button type="button" onClick={() => fileInputRef.current?.click()} style={{ background: '#6c757d' }}>Scegli file...</button>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '8px' }}>2. Seleziona il tipo di documento</label>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {(['conformita', 'manutenzione', 'manuale'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => caricaDocumento(type)}
                        disabled={uploading}
                        style={{ background: documentTypeColors[type], opacity: uploading ? 0.6 : 1 }}
                      >
                        {uploading ? 'Caricamento...' : documentTypeLabels[type]}
                      </button>
                    ))}
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Nota: se esiste già un documento dello stesso tipo, verrà sostituito.</p>
              </div>
            )}

            <div>
              <h4 style={{ marginTop: 0, marginBottom: '12px' }}>Documenti archiviati</h4>
              {documents.length === 0 ? (
                <p style={{ color: '#666', fontStyle: 'italic' }}>Nessun documento caricato per questa apparecchiatura.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {documents.map((doc) => (
                    <div key={doc._id} style={{ display: 'flex', alignItems: 'center', padding: '12px', border: '1px solid #dee2e6', borderRadius: '4px', backgroundColor: '#f8f9fa' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', backgroundColor: documentTypeColors[doc.documentType], color: '#fff', fontSize: '12px', fontWeight: '600' }}>
                            {documentTypeLabels[doc.documentType]}
                          </span>
                          <strong>{doc.fileName}</strong>
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>Caricato il: {formatData(doc.createdAt)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" onClick={() => scaricaDocumento(doc._id, doc.fileName)} style={{ background: '#28a745' }}>⬇ Scarica</button>
                        {canEdit && <button type="button" onClick={() => eliminaDocumento(doc._id)} style={{ background: '#dc3545' }}>Elimina</button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal movimenti presidi */}
      {showMovementModal && selectedPresidio && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', maxWidth: '700px', width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Gestione Movimenti - {selectedPresidio.nome}</h3>
              <button type="button" onClick={chiudiMovimenti} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>×</button>
            </div>

            <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ color: '#666' }}>Quantità attuale: </span>
                <strong style={{ fontSize: '1.2em', color: '#28a745' }}>{selectedPresidio.quantita} {selectedPresidio.unitaMisura || 'pezzi'}</strong>
              </div>
              {selectedPresidio.scadenza && (
                <div><span style={{ color: '#666' }}>Scadenza: </span><strong>{formatData(selectedPresidio.scadenza)}</strong></div>
              )}
            </div>

            <div style={{ marginBottom: '24px', padding: '16px', border: '2px dashed #dee2e6', borderRadius: '4px', backgroundColor: '#f8f9fa' }}>
              <h4 style={{ marginTop: 0, marginBottom: '16px' }}>Nuovo Movimento</h4>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '120px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Tipo movimento</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" onClick={() => setMovementType('carico')} style={{ flex: 1, background: movementType === 'carico' ? '#28a745' : '#6c757d', padding: '10px' }}>⬆ Carico</button>
                    <button type="button" onClick={() => setMovementType('scarico')} style={{ flex: 1, background: movementType === 'scarico' ? '#dc3545' : '#6c757d', padding: '10px' }}>⬇ Scarico</button>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: '120px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Quantità ({selectedPresidio.unitaMisura || 'pezzi'})</label>
                  <input type="number" min="1" value={movementQuantity} onChange={(e) => setMovementQuantity(parseInt(e.target.value) || 1)} style={{ width: '100%', padding: '10px', fontSize: '16px' }} />
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Motivazione (opzionale)</label>
                <input type="text" value={movementNote} onChange={(e) => setMovementNote(e.target.value)} placeholder={movementType === 'carico' ? 'Es. Fornitura, acquisto...' : 'Es. Consegnato a reparto, scaduto...'} style={{ width: '100%', padding: '10px' }} />
              </div>
              {movementType === 'scarico' && (
                <div style={{ padding: '10px', backgroundColor: movementQuantity > selectedPresidio.quantita ? '#f8d7da' : '#d4edda', borderRadius: '4px', marginBottom: '16px', color: movementQuantity > selectedPresidio.quantita ? '#721c24' : '#155724' }}>
                  {movementQuantity > selectedPresidio.quantita ? <strong>⚠️ Quantità insufficiente!</strong> : `Nuova quantità dopo scarico: ${selectedPresidio.quantita - movementQuantity} ${selectedPresidio.unitaMisura || 'pezzi'}`}
                </div>
              )}
              {movementType === 'carico' && (
                <div style={{ padding: '10px', backgroundColor: '#d4edda', borderRadius: '4px', marginBottom: '16px', color: '#155724' }}>
                  Nuova quantità dopo carico: {selectedPresidio.quantita + movementQuantity} {selectedPresidio.unitaMisura || 'pezzi'}
                </div>
              )}
              <button
                type="button"
                onClick={eseguiMovimento}
                disabled={movementQuantity <= 0 || (movementType === 'scarico' && movementQuantity > selectedPresidio.quantita)}
                style={{ width: '100%', background: movementType === 'carico' ? '#28a745' : '#dc3545', padding: '12px', fontSize: '16px', opacity: movementQuantity <= 0 || (movementType === 'scarico' && movementQuantity > selectedPresidio.quantita) ? 0.6 : 1 }}
              >
                Conferma {movementType === 'carico' ? 'Carico' : 'Scarico'}
              </button>
            </div>

            <div>
              <h4 style={{ marginTop: 0, marginBottom: '12px' }}>Storico Movimenti</h4>
              {movements.length === 0 ? (
                <p style={{ color: '#666', fontStyle: 'italic' }}>Nessun movimento registrato.</p>
              ) : (
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {movements.map((mov) => (
                    <div key={mov._id} style={{ display: 'flex', alignItems: 'center', padding: '10px', border: '1px solid #dee2e6', borderRadius: '4px', backgroundColor: '#f8f9fa', marginBottom: '8px' }}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', backgroundColor: mov.tipo === 'carico' ? '#28a745' : '#dc3545', color: '#fff', fontSize: '12px', fontWeight: '600', marginRight: '12px' }}>
                        {mov.tipo === 'carico' ? '⬆' : '⬇'} {mov.tipo.toUpperCase()}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div>
                          <strong>{mov.quantita}</strong> {selectedPresidio.unitaMisura || 'pezzi'}
                          {mov.motivazione && <span style={{ color: '#666', marginLeft: '8px' }}>- {mov.motivazione}</span>}
                        </div>
                        <div style={{ fontSize: '11px', color: '#666' }}>
                          {formatDataOra(mov.dataMovimento)}
                          {mov.eseguitoDaNome && <span> - Da: {mov.eseguitoDaNome}</span>}
                          <span style={{ marginLeft: '8px' }}>{mov.quantitaPrecedente} → {mov.quantitaSuccessiva}</span>
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
    </section>
  );
}

export default Strumenti;
