import { useEffect, useRef, useState } from 'react';
import { Send, Paperclip, Image as ImageIcon, X, Loader2, Check, CheckCheck } from 'lucide-react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui';

interface Attachment {
  url: string;
  type: string;
  name: string;
}

interface Recipient {
  id: string;
  name: string;
  role: string;
}

interface Message {
  _id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  attachments: Attachment[];
  createdAt: string;
  readBy: { userId: string; at: string }[];
}

interface ChatWidgetProps {
  scope: 'patient' | 'general';
  patientId?: string;
  title?: string;
  height?: number | string;
}

export function ChatWidget({ scope, patientId, title, height = 360 }: ChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState<'all' | 'coordinators' | 'office_admin'>('all');
  const [recipientId, setRecipientId] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { user } = useAuth();
  const userId = user?.id || '';

  const fetchMessages = async (silent = true) => {
    try {
      const params: Record<string, string> = { scope };
      if (patientId) params.patientId = patientId;
      if (scope === 'general') {
        params.channel = channel;
        if (recipientId) params.recipientId = recipientId;
      }
      const qs = new URLSearchParams(params).toString();
      const res = await api.get(`/messages?${qs}`);
      setMessages(res.data.messages || []);
      if (!silent) setError(null);
    } catch (err: any) {
      if (!silent) setError(err.response?.data?.message || 'Errore caricamento chat');
    }
  };

  useEffect(() => {
    setMessages([]);
    setInput('');
    setFiles([]);
    setError(null);
    setLoading(true);
    fetchMessages(false).finally(() => setLoading(false));

    intervalRef.current = setInterval(() => fetchMessages(true), 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, patientId]);

  useEffect(() => {
    if (scope !== 'general') return;
    fetchMessages(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, recipientId]);

  useEffect(() => {
    if (scope !== 'general' || !['admin', 'coordinator', 'direttore'].includes(user?.role || '')) return;
    api.get('/messages/recipients')
      .then(res => setRecipients(res.data.recipients || []))
      .catch(() => setRecipients([]));
  }, [scope, user?.role]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text && files.length === 0) return;

    setSending(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('scope', scope);
      if (scope === 'general') {
        formData.append('channel', channel);
        if (recipientId) formData.append('recipientId', recipientId);
      }
      if (patientId) formData.append('patientId', patientId);
      formData.append('content', text);
      files.forEach(file => formData.append('attachments', file));

      await api.post('/messages', formData, {
        timeout: 120000,
      });

      setInput('');
      setFiles([]);
      await fetchMessages(true);
    } catch (err: any) {
      console.error('[ChatWidget] Errore invio:', err);
      const detail = err.response?.data?.error || err.message || '';
      const base = err.response?.data?.message || 'Errore invio messaggio';
      setError(detail ? `${base} — ${detail}` : base);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const addFiles = (selectedFiles: File[]) => {
    const oversized = selectedFiles.find(file => file.size > 20 * 1024 * 1024);
    if (oversized) {
      setError(`Il file "${oversized.name}" supera il limite di 20 MB.`);
      return;
    }
    setError(null);
    setFiles(prev => [...prev, ...selectedFiles].slice(0, 5));
  };

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const isMine = (m: Message) => m.senderId === userId;
  const isRead = (m: Message) => m.readBy.some(r => r.userId !== m.senderId);

  const esportaPdf = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const titolo = title || (scope === 'patient' ? 'Chat paziente' : 'Chat generale');
    const righe = messages.map(m => `<div class="messaggio"><strong>${m.senderName.replace(/</g, '&lt;')} · ${m.senderRole.replace(/</g, '&lt;')}</strong><span>${new Date(m.createdAt).toLocaleString('it-IT')}</span><p>${(m.content || '').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>${m.attachments?.length ? `<small>Allegati: ${m.attachments.map(a => a.name.replace(/</g, '&lt;')).join(', ')}</small>` : ''}</div>`).join('');
    win.document.write(`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${titolo}</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:auto;padding:28px;color:#1f2937}h1{color:#0d9488;font-size:20px;border-bottom:2px solid #0d9488;padding-bottom:10px}.messaggio{border-bottom:1px solid #cbd5e1;padding:12px 0;white-space:normal}.messaggio span{float:right;color:#64748b;font-size:12px}.messaggio p{white-space:normal;line-height:1.45;margin:7px 0}@media print{body{padding:12px}}</style></head><body><h1>${titolo}</h1><p>Esportata il ${new Date().toLocaleString('it-IT')}</p>${righe || '<p>Nessun messaggio nella conversazione.</p>'}<script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', background: '#fff', height }}>
      <div style={{ padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#1e4d8c', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <span>{title || (scope === 'patient' ? 'Chat paziente' : 'Chat generale')}</span>
        <button type="button" onClick={esportaPdf} style={{ border: '1px solid #93c5fd', borderRadius: '6px', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer', padding: '5px 8px', fontSize: '.75rem', fontWeight: 700 }}>📄 Esporta PDF</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#f1f5f9' }}>
        {loading && (
          <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
            Caricamento...
          </div>
        )}

        {messages.map(m => (
          <div key={m._id} style={{ alignSelf: isMine(m) ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            <div style={{
              padding: '10px 12px',
              borderRadius: '12px',
              background: isMine(m) ? '#0d9488' : '#fff',
              color: isMine(m) ? '#fff' : '#1f2937',
              border: isMine(m) ? 'none' : '1px solid #e2e8f0',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              fontSize: '0.9rem',
              whiteSpace: 'pre-wrap',
            }}>
              <div style={{ fontSize: '0.72rem', opacity: 0.8, marginBottom: '4px', fontWeight: 600 }}>
                {m.senderName} · {m.senderRole}
              </div>
              {m.content && <div>{m.content}</div>}
              {m.attachments?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: m.content ? '8px' : 0 }}>
                  {m.attachments.map((att, i) => (
                    <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', maxWidth: '140px' }}>
                      {att.type.startsWith('image/') ? (
                        <img src={att.url} alt={att.name} style={{ width: '100%', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.08)' }} />
                      ) : (
                        <div style={{ padding: '6px 8px', background: 'rgba(0,0,0,0.06)', borderRadius: '6px', fontSize: '0.75rem', color: isMine(m) ? '#fff' : '#0d9488' }}>
                          {att.name || 'Allegato'}
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              )}
              <div style={{ fontSize: '0.7rem', opacity: 0.75, marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                {new Date(m.createdAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                {isMine(m) && (isRead(m) ? <CheckCheck size={12} /> : <Check size={12} />)}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div style={{ padding: '8px 12px', background: '#fef2f2', color: '#991b1b', fontSize: '0.8rem', borderTop: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      {files.length > 0 && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {files.map((file, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#e2e8f0', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem' }}>
              {file.name}
              <button type="button" onClick={() => removeFile(i)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {scope === 'general' && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Destinatario:</label>
          {['admin', 'coordinator', 'direttore'].includes(user?.role || '') ? (
            <select value={recipientId} onChange={e => setRecipientId(e.target.value)} style={{ flex: 1, minWidth: '180px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}>
              <option value="">Chat generale (tutti)</option>
              {recipients.map(recipient => <option key={recipient.id} value={recipient.id}>{recipient.name} · {recipient.role}</option>)}
            </select>
          ) : (
            <select value={channel} onChange={e => setChannel(e.target.value as 'all' | 'coordinators' | 'office_admin')} style={{ flex: 1, minWidth: '180px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}>
              <option value="all">Tutti</option>
              <option value="coordinators">Coordinatore</option>
              <option value="office_admin">Ufficio / admin</option>
            </select>
          )}
        </div>
      )}

      <div style={{ padding: '10px 12px', borderTop: '1px solid #e2e8f0', background: '#fff', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          ref={cameraInputRef}
          onChange={e => {
            if (e.target.files) addFiles(Array.from(e.target.files));
            e.target.value = '';
          }}
        />
        <input
          type="file"
          accept="image/*,application/pdf"
          multiple
          style={{ display: 'none' }}
          ref={fileInputRef}
          onChange={e => {
            if (e.target.files) addFiles(Array.from(e.target.files));
            e.target.value = '';
          }}
        />
        <button type="button" onClick={() => cameraInputRef.current?.click()} title="Foto" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#0d9488', padding: '8px' }}>
          <ImageIcon size={20} />
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()} title="Allega" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', padding: '8px' }}>
          <Paperclip size={20} />
        </button>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Scrivi un messaggio..."
          rows={1}
          style={{ flex: 1, resize: 'none', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontFamily: 'inherit' }}
        />
        <Button
          type="button"
          onClick={handleSend}
          disabled={sending || (!input.trim() && files.length === 0)}
          variant="primary"
          icon={sending ? <Loader2 size={18} /> : <Send size={18} />}
        >
          {sending ? 'Invio...' : 'Invia'}
        </Button>
      </div>
    </div>
  );
}
