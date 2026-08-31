import { useEffect, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import api from '../api/api';
import { Button } from '../components/ui/Button';

interface DocumentItem {
  _id: string;
  category: 'procedure' | 'protocol';
  fileName: string;
  contentType: string;
  createdAt: string;
}

function Documentazione() {
  const [procedureFile, setProcedureFile] = useState<File | null>(null);
  const [protocolFile, setProtocolFile] = useState<File | null>(null);
  const [procedureDocs, setProcedureDocs] = useState<DocumentItem[]>([]);
  const [protocolDocs, setProtocolDocs] = useState<DocumentItem[]>([]);
  const [procedureMessage, setProcedureMessage] = useState('');
  const [protocolMessage, setProtocolMessage] = useState('');
  const [downloadMessage, setDownloadMessage] = useState('');
  const procedureInputRef = useRef<HTMLInputElement | null>(null);
  const protocolInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadProcedureDocuments();
    loadProtocolDocuments();
  }, []);

  const loadProcedureDocuments = async () => {
    try {
      const response = await api.get('/procedure-documents?category=procedure');
      setProcedureDocs(response.data);
    } catch (error) {
      console.error('Errore caricamento procedure sanitarie', error);
    }
  };

  const loadProtocolDocuments = async () => {
    try {
      const response = await api.get('/procedure-documents?category=protocol');
      setProtocolDocs(response.data);
    } catch (error) {
      console.error('Errore caricamento protocolli sanitari', error);
    }
  };

  const openProcedureFileDialog = () => {
    procedureInputRef.current?.click();
  };

  const openProtocolFileDialog = () => {
    protocolInputRef.current?.click();
  };

  const handleProcedureFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setProcedureFile(event.target.files?.[0] || null);
    setProcedureMessage('');
  };

  const handleProtocolFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setProtocolFile(event.target.files?.[0] || null);
    setProtocolMessage('');
  };

  const uploadDocument = async (category: 'procedure' | 'protocol', file: File | null) => {
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append('document', file);
    formData.append('category', category);

    try {
      const response = await api.post('/procedure-documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (category === 'procedure') {
        setProcedureMessage('File procedura caricato con successo.');
        setProcedureFile(null);
        loadProcedureDocuments();
      } else {
        setProtocolMessage('File protocollo caricato con successo.');
        setProtocolFile(null);
        loadProtocolDocuments();
      }

      if (response.status !== 201) {
        throw new Error('Risposta inattesa dal server');
      }
    } catch (error: any) {
      console.error('Errore caricamento documento', error);
      const serverMessage = error?.response?.data?.message || error?.message || 'Errore generico';
      if (category === 'procedure') {
        setProcedureMessage(`Errore durante il caricamento della procedura: ${serverMessage}`);
      } else {
        setProtocolMessage(`Errore durante il caricamento del protocollo: ${serverMessage}`);
      }
    }
  };

  const deleteDocument = async (documentId: string, category: 'procedure' | 'protocol') => {
    try {
      await api.delete(`/procedure-documents/${documentId}`);
      if (category === 'procedure') {
        loadProcedureDocuments();
      } else {
        loadProtocolDocuments();
      }
    } catch (error) {
      console.error('Errore eliminazione documento', error);
    }
  };

  const previewLocalFile = (file: File | null) => {
    if (!file) {
      return;
    }
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
      const response = await api.get(`/procedure-documents/${documentId}/download`, {
        responseType: 'blob'
      });
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
      const response = await api.get(`/procedure-documents/${documentId}/download`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: typeof contentType === 'string' ? contentType : 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const isPdf = typeof contentType === 'string' && contentType.toLowerCase().includes('pdf');
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      if (!isPdf) {
        link.download = fileName;
      }
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      if (!isPdf) {
        setDownloadMessage('Il documento è stato scaricato. Aprilo con Word per visualizzarlo.');
      }
    } catch (error) {
      console.error('Errore apertura documento', error);
      setDownloadMessage('Impossibile aprire il documento.');
    }
  };

  const printDocument = async (documentId: string, contentType: string, fileName: string) => {
    try {
      setDownloadMessage('');
      const response = await api.get(`/procedure-documents/${documentId}/download`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: typeof contentType === 'string' ? contentType : 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const isPdf = typeof contentType === 'string' && contentType.toLowerCase().includes('pdf');
      if (isPdf) {
        const newWindow = window.open(url, '_blank');
        if (newWindow) {
          newWindow.focus();
          newWindow.onload = () => {
            newWindow.print();
          };
        }
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

  const buildDocumentSummaryLines = () => {
    const allDocs = [...procedureDocs, ...protocolDocs];
    return allDocs.map((document, index) => {
      const categoryLabel = document.category === 'procedure' ? 'Procedura' : 'Protocollo';
      const createdAt = new Date(document.createdAt).toLocaleDateString();
      return `${index + 1}. ${categoryLabel} - ${document.fileName} (${createdAt})`;
    });
  };

  const exportDocumentListAsPdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const title = 'Elenco documenti sanitari';
    const lines = buildDocumentSummaryLines();
    const splitTitle = doc.splitTextToSize(title, 520);
    doc.setFontSize(16);
    doc.text(splitTitle, 40, 60);
    doc.setFontSize(11);
    let y = 90;

    lines.forEach((line) => {
      const splitLine = doc.splitTextToSize(line, 520);
      if (y + splitLine.length * 14 > 780) {
        doc.addPage();
        y = 40;
      }
      doc.text(splitLine, 40, y);
      y += splitLine.length * 14;
    });

    doc.save('documentazione-sanitaria.pdf');
  };

  const exportDocumentListAsWord = () => {
    const title = '<h1>Elenco documenti sanitari</h1>';
    const rows = buildDocumentSummaryLines()
      .map((line) => `<p>${line}</p>`)
      .join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Documentazione sanitaria</title></head><body>${title}${rows}</body></html>`;
    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'documentazione-sanitaria.doc';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section>
      <h2>Documentazione sanitaria</h2>
      <div className="document-export-actions">
        <Button variant="primary" onClick={exportDocumentListAsPdf}>
          Esporta elenco in PDF
        </Button>
        <Button variant="secondary" onClick={exportDocumentListAsWord}>
          Esporta elenco in Word
        </Button>
      </div>
      {downloadMessage && <p className="info-text">{downloadMessage}</p>}
      <div className="dashboard-folders">
        <section className="dashboard-folder">
          <h3>Procedure sanitarie</h3>
          <p>Trova sul computer e carica il file di procedura sanitaria.</p>
          <Button variant="secondary" onClick={openProcedureFileDialog}>
            Cerca file
          </Button>
          <input
            ref={procedureInputRef}
            type="file"
            accept="*/*"
            className="tw-hidden"
            onChange={handleProcedureFileChange}
          />
          {procedureFile && (
            <div className="selected-file-actions tw-border tw-border-blue-600 tw-p-3 tw-rounded-lg tw-bg-blue-50">
              <p>
                <strong>File selezionato:</strong> {procedureFile.name}
              </p>
              <button type="button" onClick={() => previewLocalFile(procedureFile)}>
                Anteprima file selezionato
              </button>
              <p className="info-text tw-mt-2">
                Usa <strong>Anteprima file selezionato</strong> per verificare il contenuto prima del caricamento.
                Dopo il salvataggio, usa <strong>Visualizza</strong>, <strong>Stampa</strong> o <strong>Scarica</strong> nella lista documenti.
              </p>
            </div>
          )}
          <button type="button" disabled={!procedureFile} onClick={() => uploadDocument('procedure', procedureFile)}>
            Carica procedura
          </button>
          {procedureMessage && <p className="info-text">{procedureMessage}</p>}
          {procedureDocs.length > 0 && (
            <div className="document-list">
              <h4>Procedure salvate</h4>
              <ul>
                {procedureDocs.map((document) => (
                  <li key={document._id}>
                    <span>{document.fileName}</span>
                    <span className="document-meta">{new Date(document.createdAt).toLocaleDateString()}</span>
                    <button type="button" onClick={() => openDocument(document._id, document.contentType, document.fileName)}>
                      Visualizza
                    </button>
                    <button type="button" onClick={() => printDocument(document._id, document.contentType, document.fileName)}>
                      Stampa
                    </button>
                    <button type="button" onClick={() => downloadDocument(document._id, document.fileName)}>
                      Scarica
                    </button>
                    <button type="button" onClick={() => deleteDocument(document._id, 'procedure')}>
                      Elimina
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="dashboard-folder">
          <h3>Protocolli sanitari</h3>
          <p>Trova sul computer e carica il file del protocollo sanitario.</p>
          <Button variant="secondary" onClick={openProtocolFileDialog}>
            Cerca file
          </Button>
          <input
            ref={protocolInputRef}
            type="file"
            accept="*/*"
            className="tw-hidden"
            onChange={handleProtocolFileChange}
          />
          {protocolFile && (
            <div className="selected-file-actions tw-border tw-border-blue-600 tw-p-3 tw-rounded-lg tw-bg-blue-50">
              <p>
                <strong>File selezionato:</strong> {protocolFile.name}
              </p>
              <button type="button" onClick={() => previewLocalFile(protocolFile)}>
                Anteprima file selezionato
              </button>
              <p className="info-text tw-mt-2">
                Usa <strong>Anteprima file selezionato</strong> per verificare il contenuto prima del caricamento.
                Dopo il salvataggio, usa <strong>Visualizza</strong>, <strong>Stampa</strong> o <strong>Scarica</strong> nella lista documenti.
              </p>
            </div>
          )}
          <button type="button" disabled={!protocolFile} onClick={() => uploadDocument('protocol', protocolFile)}>
            Carica protocollo
          </button>
          {protocolMessage && <p className="info-text">{protocolMessage}</p>}
          {protocolDocs.length > 0 && (
            <div className="document-list">
              <h4>Protocolli salvati</h4>
              <ul>
                {protocolDocs.map((document) => (
                  <li key={document._id}>
                    <span>{document.fileName}</span>
                    <span className="document-meta">{new Date(document.createdAt).toLocaleDateString()}</span>
                    <button type="button" onClick={() => openDocument(document._id, document.contentType, document.fileName)}>
                      Visualizza
                    </button>
                    <button type="button" onClick={() => printDocument(document._id, document.contentType, document.fileName)}>
                      Stampa
                    </button>
                    <button type="button" onClick={() => downloadDocument(document._id, document.fileName)}>
                      Scarica
                    </button>
                    <button type="button" onClick={() => deleteDocument(document._id, 'protocol')}>
                      Elimina
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

export default Documentazione;
