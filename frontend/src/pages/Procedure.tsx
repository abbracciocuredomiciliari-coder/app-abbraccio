import { useEffect, useRef, useState } from 'react';
import api from '../api/api';
import {
  FileText,
  Search,
  Upload,
  Download,
  Printer,
  Trash2,
  Eye,
  RefreshCw,
  AlertCircle,
  Loader2,
  X,
  Pencil,
  Check,
} from 'lucide-react';

interface DocumentItem {
  _id: string;
  category: 'procedure';
  fileName: string;
  displayName: string;
  contentType: string;
  createdAt: string;
  updatedAt: string;
}

function Procedure() {
  const [procedureFile, setProcedureFile] = useState<File | null>(null);
  const [procedureDocs, setProcedureDocs] = useState<DocumentItem[]>([]);
  const [procedureMessage, setProcedureMessage] = useState('');
  const [downloadMessage, setDownloadMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredDocs, setFilteredDocs] = useState<DocumentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [updatingDocId, setUpdatingDocId] = useState<string | null>(null);
  const procedureInputRef = useRef<HTMLInputElement | null>(null);
  const updateInputRef = useRef<HTMLInputElement | null>(null);

  // Nome personalizzato per il nuovo file
  const [newDisplayName, setNewDisplayName] = useState('');

  // Rinomina inline
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    loadProcedureDocuments();
  }, []);

  useEffect(() => {
    filterDocuments();
  }, [searchTerm, procedureDocs]);

  const loadProcedureDocuments = async () => {
    try {
      const response = await api.get('/procedure-documents?category=procedure');
      setProcedureDocs(response.data);
    } catch (error) {
      console.error('Errore caricamento procedure sanitarie', error);
    }
  };

  const filterDocuments = () => {
    if (!searchTerm.trim()) {
      setFilteredDocs(procedureDocs);
      return;
    }
    const term = searchTerm.toLowerCase();
    const filtered = procedureDocs.filter(doc =>
      (doc.displayName || doc.fileName).toLowerCase().includes(term) ||
      doc.fileName.toLowerCase().includes(term) ||
      new Date(doc.createdAt).toLocaleDateString('it-IT').includes(term)
    );
    setFilteredDocs(filtered);
  };

  const openProcedureFileDialog = () => {
    procedureInputRef.current?.click();
  };

  const handleProcedureFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setProcedureFile(file);
    setProcedureMessage('');
    // Pre-compila il nome con il nome del file (senza estensione) se non già impostato
    if (file && !newDisplayName) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      setNewDisplayName(nameWithoutExt);
    }
  };

  const uploadDocument = async (file: File | null) => {
    if (!file) return;

    const formData = new FormData();
    formData.append('document', file);
    formData.append('category', 'procedure');
    formData.append('displayName', newDisplayName.trim() || file.name);

    setUploading(true);
    try {
      const response = await api.post('/procedure-documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setProcedureMessage('File procedura caricato con successo.');
      setProcedureFile(null);
      setNewDisplayName('');
      loadProcedureDocuments();

      if (response.status !== 201) {
        throw new Error('Risposta inattesa dal server');
      }
    } catch (error: any) {
      console.error('Errore caricamento documento', error);
      const serverMessage = error?.response?.data?.message || error?.message || 'Errore generico';
      setProcedureMessage(`Errore durante il caricamento della procedura: ${serverMessage}`);
    } finally {
      setUploading(false);
    }
  };

  const openUpdateDialog = (documentId: string) => {
    setUpdatingDocId(documentId);
    updateInputRef.current?.click();
  };

  const handleUpdateFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !updatingDocId) return;

    const formData = new FormData();
    formData.append('document', file);
    formData.append('category', 'procedure');

    setUploading(true);
    try {
      await api.put(`/procedure-documents/${updatingDocId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setProcedureMessage('Procedura aggiornata con successo!');
      setUpdatingDocId(null);
      loadProcedureDocuments();
    } catch (error: any) {
      console.error('Errore aggiornamento documento', error);
      setProcedureMessage(`Errore durante l'aggiornamento: ${error?.response?.data?.message || error?.message}`);
    } finally {
      setUploading(false);
    }
  };

  const deleteDocument = async (documentId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa procedura?')) return;
    try {
      await api.delete(`/procedure-documents/${documentId}`);
      loadProcedureDocuments();
    } catch (error) {
      console.error('Errore eliminazione documento', error);
    }
  };

  // Avvia rinomina inline
  const startRename = (doc: DocumentItem) => {
    setRenamingId(doc._id);
    setRenameValue(doc.displayName || doc.fileName);
  };

  // Salva rinomina
  const saveRename = async (documentId: string) => {
    if (!renameValue.trim()) { alert('Il nome non può essere vuoto'); return; }
    try {
      const res = await api.patch(`/procedure-documents/${documentId}/rename`, { displayName: renameValue.trim() });
      setProcedureDocs(procedureDocs.map(d => d._id === documentId ? { ...d, displayName: res.data.displayName } : d));
      setRenamingId(null);
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Errore durante la rinomina');
    }
  };

  const previewLocalFile = (file: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const isPdf = file.type.toLowerCase().includes('pdf');
    if (isPdf) {
      window.open(url, '_blank');
    } else {
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const downloadDocument = async (documentId: string, fileName: string) => {
    try {
      setDownloadMessage('');
      const response = await api.get(`/procedure-documents/${documentId}/download`, { responseType: 'blob' });
      const contentType = response.headers['content-type'];
      const blob = new Blob([response.data], { type: typeof contentType === 'string' ? contentType : 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Errore download documento', error);
      setDownloadMessage('Impossibile scaricare il documento.');
    }
  };

  const openDocument = async (documentId: string, contentType: string, fileName: string) => {
    try {
      setDownloadMessage('');
      const response = await api.get(`/procedure-documents/${documentId}/download`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: typeof contentType === 'string' ? contentType : 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const isPdf = typeof contentType === 'string' && contentType.toLowerCase().includes('pdf');
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      if (!isPdf) link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      if (!isPdf) setDownloadMessage('Il documento è stato scaricato. Aprilo con Word per visualizzarlo.');
    } catch (error) {
      console.error('Errore apertura documento', error);
      setDownloadMessage('Impossibile aprire il documento.');
    }
  };

  const printDocument = async (documentId: string, contentType: string, fileName: string) => {
    try {
      setDownloadMessage('');
      const response = await api.get(`/procedure-documents/${documentId}/download`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: typeof contentType === 'string' ? contentType : 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const isPdf = typeof contentType === 'string' && contentType.toLowerCase().includes('pdf');
      if (isPdf) {
        const newWindow = window.open(url, '_blank');
        if (newWindow) { newWindow.focus(); newWindow.onload = () => { newWindow.print(); }; }
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setDownloadMessage('Documento non in formato PDF: è stato scaricato per la stampa da Word.');
      }
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) {
      console.error('Errore stampa documento', error);
      setDownloadMessage('Impossibile stampare o visualizzare il documento.');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  return (
    <section>
      <h2>
        <FileText size={28} />
        Procedure Sanitarie
      </h2>

      {procedureMessage && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px',
          backgroundColor: procedureMessage.includes('successo') ? 'var(--success-bg)' : 'var(--danger-bg)',
          border: `1px solid ${procedureMessage.includes('successo') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
          borderRadius: 'var(--radius-md)',
          color: procedureMessage.includes('successo') ? 'var(--success)' : 'var(--danger)',
          marginBottom: '16px',
        }}>
          <AlertCircle size={18} />
          {procedureMessage}
          <button onClick={() => setProcedureMessage('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="dashboard-folder">
        {/* Search Bar */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
            <input
              type="text"
              placeholder="Cerca procedura per nome o data..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '12px 14px 12px 44px', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-md)', fontSize: '0.95rem', outline: 'none' }}
            />
          </div>
        </div>

        {/* Upload Section */}
        <div style={{ marginBottom: '24px', padding: '20px', border: '2px dashed var(--gray-300)', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--gray-50)' }}>
          <h4 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Upload size={18} />
            Carica Nuova Procedura
          </h4>
          <p style={{ marginBottom: '16px', color: 'var(--gray-600)', fontSize: '0.92rem' }}>
            Trova sul computer e carica il file di procedura sanitaria.
          </p>

          {/* Campo nome personalizzato */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '0.92rem' }}>
              Nome da visualizzare (opzionale)
            </label>
            <input
              type="text"
              placeholder="Es. Procedura medicazione ferite, Protocollo igiene mani..."
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              style={{ width: '100%', maxWidth: '480px', padding: '9px 12px', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-md)', fontSize: '0.93rem', outline: 'none' }}
            />
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--gray-500)' }}>
              Se lasci vuoto, verrà usato il nome del file originale.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input ref={procedureInputRef} type="file" accept="*/*" style={{ display: 'none' }} onChange={handleProcedureFileChange} />
            <button type="button" onClick={openProcedureFileDialog} disabled={uploading}>
              Cerca file
            </button>
            {procedureFile && (
              <span style={{ color: 'var(--gray-600)', fontSize: '0.92rem' }}>{procedureFile.name}</span>
            )}
          </div>

          {procedureFile && (
            <div style={{ marginTop: '16px', padding: '12px', border: '1px solid #0078d4', borderRadius: '8px', backgroundColor: '#eef6ff' }}>
              <p style={{ margin: '0 0 4px' }}>
                <strong>File:</strong> {procedureFile.name}
              </p>
              {newDisplayName && (
                <p style={{ margin: '0 0 12px', color: '#0078d4', fontSize: '0.9rem' }}>
                  <strong>Verrà salvato come:</strong> {newDisplayName}
                </p>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => previewLocalFile(procedureFile)} style={{ background: 'var(--secondary)' }}>
                  <Eye size={16} />
                  Anteprima
                </button>
                <button type="button" onClick={() => uploadDocument(procedureFile)} disabled={uploading} style={{ background: 'var(--primary)', opacity: uploading ? 0.6 : 1 }}>
                  {uploading ? (<><Loader2 size={16} className="spin" />Caricamento...</>) : (<><Upload size={16} />Carica procedura</>)}
                </button>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: 'var(--gray-500)' }}>
                Usa <strong>Anteprima</strong> per verificare il contenuto prima del caricamento.
              </p>
            </div>
          )}
        </div>

        {/* Documents List */}
        {filteredDocs.length > 0 ? (
          <div className="document-list">
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <FileText size={20} />
              Procedure Salvate ({filteredDocs.length})
            </h4>
            <ul>
              {filteredDocs.map((document) => (
                <li key={document._id} style={{
                  display: 'flex', alignItems: 'center', gap: '16px', padding: '16px',
                  border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)', backgroundColor: 'white',
                }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--info-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <FileText size={24} color="var(--info)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {renamingId === document._id ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveRename(document._id); if (e.key === 'Escape') setRenamingId(null); }}
                          autoFocus
                          style={{ flex: 1, padding: '6px 10px', border: '1px solid #0078d4', borderRadius: '4px', fontSize: '14px' }}
                        />
                        <button type="button" onClick={() => saveRename(document._id)} style={{ background: '#28a745', padding: '6px 10px' }}>
                          <Check size={14} />
                        </button>
                        <button type="button" onClick={() => setRenamingId(null)} style={{ background: '#6c757d', padding: '6px 10px' }}>
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                            {document.displayName || document.fileName}
                          </strong>
                          <button type="button" onClick={() => startRename(document)} title="Rinomina" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--gray-400)' }}>
                            <Pencil size={14} />
                          </button>
                        </div>
                        {document.displayName && document.displayName !== document.fileName && (
                          <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--gray-400)' }}>
                            File: {document.fileName}
                          </p>
                        )}
                        <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--gray-500)' }}>
                          Caricata: {formatDate(document.createdAt)}
                          {document.updatedAt !== document.createdAt && ` • Aggiornata: ${formatDate(document.updatedAt)}`}
                        </p>
                      </>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => openDocument(document._id, document.contentType, document.fileName)} style={{ background: 'var(--info)' }}>
                      <Eye size={16} />Visualizza
                    </button>
                    <button type="button" onClick={() => printDocument(document._id, document.contentType, document.fileName)} style={{ background: 'var(--secondary)' }}>
                      <Printer size={16} />Stampa
                    </button>
                    <button type="button" onClick={() => downloadDocument(document._id, document.fileName)} style={{ background: 'var(--success)' }}>
                      <Download size={16} />Scarica
                    </button>
                    <button type="button" onClick={() => openUpdateDialog(document._id)} style={{ background: 'var(--warning)' }}>
                      <RefreshCw size={16} />Aggiorna
                    </button>
                    <button type="button" onClick={() => deleteDocument(document._id)} style={{ background: 'var(--danger)' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p style={{ textAlign: 'center', padding: '32px', color: 'var(--gray-500)' }}>
            {searchTerm ? 'Nessuna procedura trovata.' : 'Nessuna procedura presente.'}
          </p>
        )}

        {downloadMessage && (
          <p style={{ marginTop: '12px', color: 'var(--warning)', fontSize: '0.9rem' }}>{downloadMessage}</p>
        )}

        {/* Hidden input for file updates */}
        <input ref={updateInputRef} type="file" accept="*/*" style={{ display: 'none' }} onChange={handleUpdateFileChange} />
      </div>
    </section>
  );
}

export default Procedure;
