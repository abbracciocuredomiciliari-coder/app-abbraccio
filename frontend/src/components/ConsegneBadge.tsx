import { useEffect, useState } from 'react';
import api from '../api/api';

// Badge conteggio consegne amministrative DA GESTIRE (non ancora prese in
// carico): scende a ogni presa in carico e sparisce quando sono tutte prese.
export function ConsegneBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    const fetchCount = async () => {
      try {
        const res = await api.get('/consegne-amministrative/conteggio');
        if (mounted) setCount(res.data.daGestire || 0);
      } catch {
        // ignora errori silenziosamente
      }
    };
    fetchCount();
    const id = setInterval(fetchCount, 20000);
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
        background: '#f59e0b',
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
