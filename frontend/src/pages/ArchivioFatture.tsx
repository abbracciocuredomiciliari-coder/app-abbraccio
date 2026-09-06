import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useModalita } from '../context/ModalitaContext';
import api from '../api/api';
import { Archive, ChevronUp, ChevronDown, Eye, Download, Trash2, FileText } from 'lucide-react';

interface Patient {
  _id: string;
  firstName: string;
  lastName: string;
}

interface DocumentoFatturazione {
  _id: string;
  numero: string;
  tipo: 'preventivo' | 'fattura';
  patient: Patient;
  prestazioni: { descrizione: string; quantita: number; prezzoUnitario: number; importo: number }[];
  totale: number;
  data: string;
  dataPrestazione?: string;
  stato: 'emesso' | 'firmato' | 'annullato';
  note?: string;
  documentoOrigineId?: string;
  firma?: {
    firmato: boolean;
    firmatoIl?: string;
    nome?: string;
    email?: string;
    token?: string;
    rifiutoRegistro?: boolean;
  };
}

function formatData(d: string) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(d);
  }
}

function formatEuro(n: number) {
  return `€${(Number(n) || 0).toFixed(2)}`;
}

export default function ArchivioFatture() {
  const { user } = useAuth();
  const { isConvenzione } = useModalita();
  const [documenti, setDocumenti] = useState<DocumentoFatturazione[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchivio, setShowArchivio] = useState(true);

  const archivioFatture = useMemo(
    () => documenti.filter(d => d.tipo === 'fattura' && d.stato === 'firmato'),
    [documenti]
  );

  const caricaDocumenti = async () => {
    setLoading(true);
    try {
      const res = await api.get('/fatturazione-documenti');
      setDocumenti(res.data);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nel caricamento dei documenti');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    caricaDocumenti();
  }, []);

  const anteprimaDocumento = async (doc: DocumentoFatturazione) => {
    try {
      const res = await api.get(`/fatturazione-documenti/${doc._id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nella generazione anteprima PDF');
    }
  };

  const scaricaDocumentoPDF = async (doc: DocumentoFatturazione) => {
    try {
      const res = await api.get(`/fatturazione-documenti/${doc._id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.tipo === 'fattura' ? 'FATTURA' : 'PREVENTIVO'}-${doc.numero}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nel download PDF');
    }
  };

  const scaricaDocumentoFirmato = async (doc: DocumentoFatturazione) => {
    try {
      const res = await api.get(`/fatturazione-documenti/${doc._id}/firmato`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.tipo === 'fattura' ? 'FATTURA' : 'PREVENTIVO'}-${doc.numero}-firmato.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nel download PDF firmato');
    }
  };

  const annullaDocumento = async (doc: DocumentoFatturazione) => {
    if (!confirm(`Annullare il documento ${doc.numero}?`)) return;
    try {
      await api.patch(`/fatturazione-documenti/${doc._id}/annulla`);
      await caricaDocumenti();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Errore nell'annullamento");
    }
  };

  const eliminaDocumento = async (doc: DocumentoFatturazione) => {
    if (!confirm(`Eliminare definitivamente il documento ${doc.numero}?\n\nQuesta azione non può essere annullata.`)) return;
    try {
      await api.delete(`/fatturazione-documenti/${doc._id}`);
      await caricaDocumenti();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nella eliminazione');
    }
  };

  if (isConvenzione) {
    return (
      <section className="fade-in section-wide">
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px', color: '#1e4d8c' }}>
          <Archive size={28} />Archivio Fatture
        </h1>
        <p style={{ color: '#6b7280', marginTop: '24px' }}>L&apos;archivio fatture è disponibile solo nella modalità privata.</p>
      </section>
    );
  }

  return (
    <section className="fade-in section-wide">
      <h1 style={{ margin: 0, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', color: '#1e4d8c' }}>
        <Archive size={28} />Archivio Fatture
      </h1>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}><p>Caricamento...</p></div>
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
          <div onClick={() => setShowArchivio(!showArchivio)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#374151' }}>
              <FileText size={20} />Archivio Fatture Firmate
              <span style={{ background: '#f3e8ff', color: '#7e22ce', borderRadius: '20px', padding: '2px 10px', fontSize: '0.8rem' }}>{archivioFatture.length}</span>
            </h3>
            {showArchivio ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
          {showArchivio && (
            archivioFatture.length === 0 ? (
              <p style={{ color: '#9ca3af', marginTop: '14px', marginBottom: 0 }}>Nessuna fattura firmata archiviata.</p>
            ) : (
              <div style={{ overflowX: 'auto', marginTop: '14px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Fattura</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Preventivo collegato</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Paziente</th>
                      <th style={{ textAlign: 'right', padding: '8px' }}>Totale</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Data</th>
                      <th style={{ padding: '8px' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {archivioFatture.map(fattura => {
                      const preventivo = documenti.find(d => d._id === fattura.documentoOrigineId);
                      return (
                        <tr key={fattura._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px', fontWeight: 600 }}>{fattura.numero}</td>
                          <td style={{ padding: '8px' }}>{preventivo ? preventivo.numero : '-'}</td>
                          <td style={{ padding: '8px' }}>{fattura.patient?.firstName} {fattura.patient?.lastName}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#166534' }}>{formatEuro(fattura.totale)}</td>
                          <td style={{ padding: '8px' }}>{formatData(fattura.data)}</td>
                          <td style={{ padding: '8px' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button onClick={() => anteprimaDocumento(fattura)} title="Anteprima fattura" style={{ background: '#f0f9ff', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#0ea5e9' }}><Eye size={14} /></button>
                              <button onClick={() => scaricaDocumentoPDF(fattura)} title="Scarica fattura" style={{ background: '#eff6ff', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#2563eb' }}><Download size={14} /></button>
                              {fattura.firma?.firmato && (
                                <button onClick={() => scaricaDocumentoFirmato(fattura)} title="Scarica fattura firmata" style={{ background: '#dcfce7', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#166534' }}><Download size={14} /></button>
                              )}
                              {preventivo && (
                                <>
                                  <button onClick={() => anteprimaDocumento(preventivo)} title="Anteprima preventivo" style={{ background: '#fefce8', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#ca8a04' }}><Eye size={14} /></button>
                                  <button onClick={() => scaricaDocumentoPDF(preventivo)} title="Scarica preventivo" style={{ background: '#fef3c7', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#92400e' }}><Download size={14} /></button>
                                </>
                              )}
                              <button onClick={() => annullaDocumento(fattura)} title="Annulla" style={{ background: '#fef2f2', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#dc2626' }}>✕</button>
                              {user?.role === 'admin' && (
                                <button onClick={() => eliminaDocumento(fattura)} title="Elimina definitivamente" style={{ background: '#fee2e2', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#b91c1c' }}><Trash2 size={14} /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}
    </section>
  );
}
