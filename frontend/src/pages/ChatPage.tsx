import { ChatWidget } from '../components/ChatWidget';

export default function ChatPage() {
  return (
    <div style={{ padding: '16px', maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 16px', color: '#1e4d8c' }}>💬 Comunicazioni operative</h2>
      <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '16px' }}>
        Chat interna per comunicare con coordinatore, ufficio e admin.
      </p>
      <ChatWidget scope="general" title="Chat generale" height={560} />
    </div>
  );
}
