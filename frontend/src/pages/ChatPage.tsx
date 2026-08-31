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
      <div className="tw-p-4 tw-max-w-[900px] tw-mx-auto">
        <button onClick={() => navigate('/chat')} className="tw-border-0 tw-bg-transparent tw-p-0 tw-pb-3 tw-text-brand tw-cursor-pointer tw-inline-flex tw-items-center tw-gap-1.5 tw-font-semibold">
          <ArrowLeft size={18} /> Tutte le chat
        </button>
        <ChatWidget scope="patient" patientId={patientId} title={`Chat paziente: ${patientName}`} height={620} />
      </div>
    );
  }

  return (
    <div className="tw-p-4 tw-max-w-[900px] tw-mx-auto">
      <h2 className="tw-m-0 tw-mb-2 tw-text-brand">💬 Comunicazioni operative</h2>
      <p className="tw-text-slate-500 tw-text-[0.9rem] tw-mb-4">
        Chat interna per comunicare con coordinatore, ufficio e admin.
      </p>

      {!loadingUnread && unreadChats.length > 0 && (
        <div className="tw-mb-4 tw-border tw-border-red-200 tw-bg-red-50 tw-rounded-[10px] tw-p-3">
          <div className="tw-text-red-800 tw-font-bold tw-text-[0.9rem] tw-mb-2">Messaggi non letti dai pazienti</div>
          <div className="tw-flex tw-flex-col tw-gap-2">
            {unreadChats.map(chat => (
              <button
                key={chat.patientId}
                onClick={() => navigate(`/chat?patientId=${encodeURIComponent(chat.patientId)}&patientName=${encodeURIComponent(chat.patientName)}`)}
                className="tw-text-left tw-bg-white tw-border tw-border-red-200 tw-rounded-lg tw-p-2.5 tw-cursor-pointer tw-flex tw-gap-2.5 tw-items-center"
              >
                <User size={20} color="#0d9488" />
                <span className="tw-flex-1 tw-min-w-0">
                  <span className="tw-block tw-font-bold tw-text-slate-800">{chat.patientName}</span>
                  <span className="tw-block tw-text-slate-500 tw-text-[0.8rem] tw-overflow-hidden tw-text-ellipsis tw-whitespace-nowrap">{chat.senderName}: {chat.lastMessage}</span>
                </span>
                <span className="tw-bg-red-500 tw-text-white tw-rounded-full tw-px-2 tw-py-0.5 tw-text-[0.75rem] tw-font-bold">{chat.unreadCount}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <ChatWidget scope="general" title="Chat generale" height={560} />
    </div>
  );
}
