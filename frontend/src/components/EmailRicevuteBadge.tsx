import { useEffect, useState } from 'react';
import api from '../api/api';

// Badge conteggio email RICEVUTE non lette (sincronizzate via IMAP) sul menu.
export function EmailRicevuteBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    const fetchCount = async () => {
      try {
        const res = await api.get('/archivio-email/ricevute/non-lette');
        if (mounted) setCount(res.data.nonLette || 0);
      } catch {
        // ignora errori silenziosamente
      }
    };
    fetchCount();
    const id = setInterval(fetchCount, 30000);
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
        background: '#2563eb',
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
