import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, User } from 'lucide-react';
import api from '../api/api';
import { ChatWidget } from '../components/ChatWidget';

interface UnreadPatientChat {
  patientId: string;
  patientName: string;
  unreadCount: number;
  lastMessage: string;
  senderName: string;
  createdAt: string;
}

export default function ChatPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const patientId = searchParams.get('patientId');
  const patientName = searchParams.get('patientName') || 'Paziente';
  const [unreadChats, setUnreadChats] = useState<UnreadPatientChat[]>([]);
  const [loadingUnread, setLoadingUnread] = useState(!patientId);

  useEffect(() => {
    if (patientId) return;
    const loadUnreadChats = async () => {
      try {
        const res = await api.get('/messages/unread-list');
        setUnreadChats(res.data.items || []);
      } finally {
        setLoadingUnread(false);
      }
    };
    loadUnreadChats();
  }, [patientId]);

  if (patientId) {
    return (
      <div style={{ padding: '16px', maxWidth: '900px', margin: '0 auto' }}>
        <button onClick={() => navigate('/chat')} style={{ border: 'none', background: 'transparent', padding: '0 0 12px', color: '#1e4d8c', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
          <ArrowLeft size={18} /> Tutte le chat
        </button>
        <ChatWidget scope="patient" patientId={patientId} title={`Chat paziente: ${patientName}`} height={620} />
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 8px', color: '#1e4d8c' }}>💬 Comunicazioni operative</h2>
      <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '16px' }}>
        Chat interna per comunicare con coordinatore, ufficio e admin.
      </p>

      {!loadingUnread && unreadChats.length > 0 && (
        <div style={{ marginBottom: '16px', border: '1px solid #fecaca', background: '#fff7f7', borderRadius: '10px', padding: '12px' }}>
          <div style={{ color: '#991b1b', fontWeight: 700, fontSize: '0.9rem', marginBottom: '8px' }}>Messaggi non letti dai pazienti</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {unreadChats.map(chat => (
              <button
                key={chat.patientId}
                onClick={() => navigate(`/chat?patientId=${encodeURIComponent(chat.patientId)}&patientName=${encodeURIComponent(chat.patientName)}`)}
                style={{ textAlign: 'left', background: '#fff', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px', cursor: 'pointer', display: 'flex', gap: '10px', alignItems: 'center' }}
              >
                <User size={20} color="#0d9488" />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 700, color: '#1f2937' }}>{chat.patientName}</span>
                  <span style={{ display: 'block', color: '#64748b', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chat.senderName}: {chat.lastMessage}</span>
                </span>
                <span style={{ background: '#ef4444', color: '#fff', borderRadius: '999px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 700 }}>{chat.unreadCount}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <ChatWidget scope="general" title="Chat generale" height={560} />
    </div>
  );
}
