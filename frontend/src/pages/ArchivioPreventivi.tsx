import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useModalita } from '../context/ModalitaContext';
import api from '../api/api';
import { ClipboardList, ChevronUp, ChevronDown, Eye, Download, Trash2, FileText, Mail } from 'lucide-react';

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
  stato: 'emesso' | 'firmato' | 'annullato' | 'rifiutato';
  motivazioneRifiuto?: string;
  rifiutatoIl?: string;
  note?: string;
  documentoOrigineId?: string;
  firma?: {
    firmato: boolean;
    firmatoIl?: string;
    inviatoIl?: string;
    nome?: string;
    email?: string;
    token?: string;
    rifiutoRegistro?: boolean;
  };
}

function formatData(d?: string) {
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

function badgeStato(doc: DocumentoFatturazione) {
  if (doc.stato === 'firmato' || doc.firma?.firmato) {
    return { testo: '✍️ Firmato', bg: '#dcfce7', color: '#166534' };
  }
  if (doc.stato === 'rifiutato') {
    return { testo: '🚫 Rifiutato', bg: '#fee2e2', color: '#b91c1c' };
  }
  return { testo: '✅ Emesso', bg: '#fef3c7', color: '#92400e' };
}

export default function ArchivioPreventivi() {
  const { user } = useAuth();
  const { isConvenzione, isConsulenza } = useModalita();
  const [documenti, setDocumenti] = useState<DocumentoFatturazione[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchivio, setShowArchivio] = useState(true);
  const [ricerca, setRicerca] = useState('');

  // Archivio preventivi: tutti i preventivi (emessi, firmati, rifiutati) tranne gli annullati.
  const archivioPreventivi = useMemo(() => {
    return documenti
      .filter(d => d.tipo === 'preventivo' && d.stato !== 'annullato')
      .filter(d => {
        if (!ricerca.trim()) return true;
        const q = ricerca.trim().toLowerCase();
        const nomeCompleto = `${d.patient?.firstName || ''} ${d.patient?.lastName || ''}`.toLowerCase();
        return nomeCompleto.includes(q) || d.numero.toLowerCase().includes(q);
      });
  }, [documenti, ricerca]);

  const caricaDocumenti = async () => {
    setLoading(true);
    try {
      const res = await api.get('/fatturazione-documenti', { params: { area: isConsulenza ? 'consulenza' : 'gestionale' } });
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

  const isFirmato = (doc: DocumentoFatturazione) => doc.stato === 'firmato' || !!doc.firma?.firmato;

  const endpointPdf = (doc: DocumentoFatturazione) =>
    isFirmato(doc) ? `/fatturazione-documenti/${doc._id}/firmato` : `/fatturazione-documenti/${doc._id}/pdf`;

  const nomeFilePdf = (doc: DocumentoFatturazione) =>
    `PREVENTIVO-${doc.numero}${isFirmato(doc) ? '-firmato' : ''}.pdf`;

  const anteprimaDocumento = async (doc: DocumentoFatturazione) => {
    try {
      const res = await api.get(endpointPdf(doc), { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nella generazione anteprima PDF');
    }
  };

  const scaricaDocumentoPDF = async (doc: DocumentoFatturazione) => {
    try {
      const res = await api.get(endpointPdf(doc), { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeFilePdf(doc);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nel download PDF');
    }
  };

  const rinviaDocumento = async (doc: DocumentoFatturazione) => {
    const email = window.prompt('Email del destinatario', doc.firma?.email || (doc.patient as any)?.email || '');
    if (!email) return;
    try {
      await api.post(`/fatturazione-documenti/${doc._id}/rinvia-email`, { email });
      alert(`Preventivo ${doc.numero} rispedito a ${email}`);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Errore nell'invio");
    }
  };

  const eliminaDocumento = async (doc: DocumentoFatturazione) => {
    if (!confirm(`Eliminare definitivamente il preventivo ${doc.numero}?\n\nQuesta azione non può essere annullata.`)) return;
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
          <ClipboardList size={28} />Archivio Preventivi
        </h1>
        <p style={{ color: '#6b7280', marginTop: '24px' }}>L&apos;archivio preventivi è disponibile solo nella modalità privata.</p>
      </section>
    );
  }

  return (
    <section className="fade-in section-wide">
      <h1 style={{ margin: 0, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', color: '#1e4d8c' }}>
        <ClipboardList size={28} />Archivio Preventivi
      </h1>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}><p>Caricamento...</p></div>
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
          <div onClick={() => setShowArchivio(!showArchivio)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#374151' }}>
              <FileText size={20} />Preventivi emessi e firmati
              <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: '20px', padding: '2px 10px', fontSize: '0.8rem' }}>{archivioPreventivi.length}</span>
            </h3>
            {showArchivio ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
          {showArchivio && (
            <>
              <div style={{ marginTop: '14px', marginBottom: '4px' }}>
                <input
                  type="text"
                  value={ricerca}
                  onChange={e => setRicerca(e.target.value)}
                  placeholder="Cerca per paziente o numero preventivo..."
                  style={{ width: '100%', maxWidth: '380px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                />
              </div>
              {archivioPreventivi.length === 0 ? (
                <p style={{ color: '#9ca3af', marginTop: '14px', marginBottom: 0 }}>Nessun preventivo in archivio.</p>
              ) : (
                <div style={{ overflowX: 'auto', marginTop: '14px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Preventivo</th>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Paziente</th>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Data doc.</th>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Firmato/Rifiutato il</th>
                        <th style={{ textAlign: 'right', padding: '8px' }}>Totale</th>
                        <th style={{ textAlign: 'center', padding: '8px' }}>Stato</th>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Fattura collegata</th>
                        <th style={{ padding: '8px' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {archivioPreventivi.map(prev => {
                        const fattura = documenti.find(d => d.tipo === 'fattura' && d.documentoOrigineId === prev._id);
                        const badge = badgeStato(prev);
                        const rigaOpacity = prev.stato === 'rifiutato' ? 0.65 : 1;
                        return (
                          <tr key={prev._id} style={{ borderBottom: '1px solid #f1f5f9', opacity: rigaOpacity }}>
                            <td style={{ padding: '8px', fontWeight: 600 }}>{prev.numero}</td>
                            <td style={{ padding: '8px' }}>{prev.patient?.firstName} {prev.patient?.lastName}</td>
                            <td style={{ padding: '8px' }}>{formatData(prev.data)}</td>
                            <td style={{ padding: '8px' }}>
                              {prev.firma?.firmato && prev.firma.firmatoIl
                                ? formatData(prev.firma.firmatoIl)
                                : prev.stato === 'rifiutato'
                                  ? formatData(prev.rifiutatoIl)
                                  : '-'}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#166534' }}>{formatEuro(prev.totale)}</td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>
                              <span
                                title={prev.stato === 'rifiutato' ? (prev.motivazioneRifiuto || 'Motivazione non indicata') : undefined}
                                style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700, background: badge.bg, color: badge.color, whiteSpace: 'nowrap' }}
                              >
                                {badge.testo}
                              </span>
                            </td>
                            <td style={{ padding: '8px' }}>{fattura ? fattura.numero : '-'}</td>
                            <td style={{ padding: '8px' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                <button
                                  onClick={() => anteprimaDocumento(prev)}
                                  title={prev.firma?.firmato ? 'Anteprima preventivo firmato' : 'Anteprima preventivo'}
                                  style={{ background: '#f0f9ff', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#0ea5e9' }}
                                >
                                  <Eye size={14} />
                                </button>
                                <button
                                  onClick={() => scaricaDocumentoPDF(prev)}
                                  title={prev.firma?.firmato ? 'Scarica preventivo firmato' : 'Scarica preventivo'}
                                  style={{ background: prev.firma?.firmato ? '#dcfce7' : '#eff6ff', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: prev.firma?.firmato ? '#166534' : '#2563eb' }}
                                >
                                  <Download size={14} />
                                </button>
                                <button
                                  onClick={() => rinviaDocumento(prev)}
                                  title="Rinvia per email"
                                  style={{ background: '#eff6ff', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#2563eb' }}
                                >
                                  <Mail size={14} />
                                </button>
                                {user?.role === 'admin' && (
                                  <button
                                    onClick={() => eliminaDocumento(prev)}
                                    title="Elimina definitivamente"
                                    style={{ background: '#fee2e2', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#b91c1c' }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
