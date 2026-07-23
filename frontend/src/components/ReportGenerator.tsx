import { useState } from 'react';
import api from '../api/api';
import { FileText, Send, Loader2, X, Signature, Save } from 'lucide-react';
import { Button } from './ui';
import FirmaCanvas from './FirmaCanvas';

interface ReportGeneratorProps {
  patientId: string;
  patientName: string;
}

export function ReportGenerator({ patientId, patientName }: ReportGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState('');
  const [email, setEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showFirma, setShowFirma] = useState(false);
  const [firmaBase64, setFirmaBase64] = useState<string | null>(null);
  const [savingSigned, setSavingSigned] = useState(false);

  const generate = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await api.post(`/reports/patient/${patientId}`, {});
      setReport(res.data.report || '');
      setOpen(true);
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Errore generazione relazione');
    } finally {
      setLoading(false);
    }
  };

  const sendReport = async () => {
    if (!email || !report) return;
    setSendingEmail(true);
    setMessage(null);
    try {
      const res = await api.post(`/reports/patient/${patientId}`, { recipientEmail: email });
      if (res.data.emailSent) {
        setMessage('Relazione inviata con successo');
      } else {
        setMessage('Invio email fallito — verifica la configurazione SMTP');
      }
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Errore invio relazione');
    } finally {
      setSendingEmail(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(report);
    setMessage('Testo copiato negli appunti');
  };

  const saveSignedReport = async () => {
    if (!report || !firmaBase64) return;
    setSavingSigned(true);
    setMessage(null);
    try {
      await api.post(`/reports/patient/${patientId}/sign`, {
        reportText: report,
        signatureBase64: firmaBase64,
      });
      setMessage('Relazione firmata salvata');
      setShowFirma(false);
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Errore salvataggio relazione firmata');
    } finally {
      setSavingSigned(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        onClick={generate}
        disabled={loading}
        variant="secondary"
        icon={loading ? <Loader2 size={16} /> : <FileText size={16} />}
      >
        {loading ? 'Generazione...' : 'Relazione LLM'}
      </Button>

      {message && !open && (
        <span style={{ color: message.includes('fallito') || message.includes('Errore') ? '#b91c1c' : '#15803d', fontSize: '0.8rem', marginLeft: '8px' }}>
          {message}
        </span>
      )}

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#1e4d8c' }}>
                📝 Relazione LLM — {patientName}
              </h3>
              <button onClick={() => setOpen(false)} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {message && (
              <div style={{ padding: '10px 12px', borderRadius: '6px', background: message.includes('fallito') || message.includes('Errore') ? '#fef2f2' : '#f0fdf4', color: message.includes('fallito') || message.includes('Errore') ? '#991b1b' : '#166534', marginBottom: '12px', fontSize: '0.85rem' }}>
                {message}
              </div>
            )}

            <textarea
              value={report}
              onChange={e => setReport(e.target.value)}
              style={{ flex: 1, minHeight: '300px', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontFamily: 'Arial, sans-serif', fontSize: '0.9rem', lineHeight: 1.5, resize: 'vertical' }}
            />

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: '220px' }}>
                <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Email destinatario</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="coordinatore@esempio.it"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <Button type="button" onClick={sendReport} disabled={sendingEmail || !email || !report} variant="primary" icon={sendingEmail ? <Loader2 size={16} /> : <Send size={16} />}>
                {sendingEmail ? 'Invio...' : 'Invia'}
              </Button>
              <Button type="button" onClick={copy} variant="secondary" icon={<FileText size={16} />}>
                Copia
              </Button>
              <Button type="button" onClick={() => setShowFirma(prev => !prev)} variant="secondary" icon={<Signature size={16} />}>
                {showFirma ? 'Chiudi firma' : 'Firma e salva'}
              </Button>
            </div>

            {showFirma && (
              <div style={{ marginTop: '16px', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }}>
                {firmaBase64 ? (
                  <div style={{ textAlign: 'center' }}>
                    <img src={firmaBase64} alt="Firma" style={{ maxWidth: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white' }} />
                    <div style={{ display: 'flex', gap: '10px', marginTop: '12px', justifyContent: 'center' }}>
                      <Button type="button" onClick={() => { setFirmaBase64(null); }} variant="secondary">
                        Rifirma
                      </Button>
                      <Button type="button" onClick={saveSignedReport} disabled={savingSigned} variant="success" icon={savingSigned ? <Loader2 size={16} /> : <Save size={16} />}>
                        {savingSigned ? 'Salvataggio...' : 'Salva relazione firmata'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <FirmaCanvas
                    label="Firma della relazione"
                    sublabel="Usa il dito o una penna sullo schermo"
                    onFirmaCompleta={setFirmaBase64}
                    onCancella={() => setFirmaBase64(null)}
                    altezza={200}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
