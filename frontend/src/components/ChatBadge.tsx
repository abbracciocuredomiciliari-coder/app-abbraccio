import { useEffect, useState } from 'react';
import api from '../api/api';

export function ChatBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    const fetchCount = async () => {
      try {
        const res = await api.get('/messages/unread-count');
        if (mounted) setCount(res.data.total || 0);
      } catch {
        // ignora errori silenziosamente
      }
    };
    fetchCount();
    const id = setInterval(fetchCount, 10000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  if (count <= 0) return null;

  return (
    <span
      style={{
        marginLeft: 'auto',
        background: '#ef4444',
        color: '#fff',
        borderRadius: '999px',
        padding: '2px 8px',
        fontSize: '0.7rem',
        fontWeight: 700,
        minWidth: '20px',
        textAlign: 'center',
      }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
