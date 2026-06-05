import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextValue {
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Decodifica il payload di un JWT senza librerie esterne.
 * Restituisce null se il token non è valido.
 */
function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload;
  } catch {
    return null;
  }
}

/**
 * Controlla se un token JWT è scaduto.
 * Restituisce true se scaduto o non valido.
 */
function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  // exp è in secondi Unix, Date.now() in millisecondi
  return Date.now() >= payload.exp * 1000;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Funzione per pulire il timer esistente
  const clearLogoutTimer = () => {
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  };

  // Funzione per pulire il ping interval
  const clearPingInterval = () => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  };

  // Ping automatico per tenere sveglio il server (evita cold start su Render)
  const startPingInterval = () => {
    clearPingInterval(); // Pulisci interval precedente
    
    // Ping ogni 5 minuti (300000 ms) - Render dorme dopo 15 min di inattività
    pingIntervalRef.current = setInterval(async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
        await fetch(`${API_URL}/api/health`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        console.log('[Ping] Server kept awake');
      } catch (error) {
        // Silenzioso - se il server è down, non rompere l'UX
        console.log('[Ping] Server ping failed (may be sleeping)');
      }
    }, 300000); // 5 minuti
  };

  // Funzione per impostare il timer di auto-logout
  const setupLogoutTimer = (token: string) => {
    clearLogoutTimer(); // Pulisci timer precedente
    
    const payload = decodeJwtPayload(token);
    if (payload?.exp) {
      const msAllaScadenza = payload.exp * 1000 - Date.now();
      if (msAllaScadenza > 0) {
        logoutTimerRef.current = setTimeout(() => {
          localStorage.removeItem('authToken');
          localStorage.removeItem('authUser');
          setUser(null);
          const isOnLoginPage = window.location.pathname === '/' || window.location.pathname === '/login';
          if (!isOnLoginPage) {
            window.location.href = '/?sessionExpired=1';
          }
        }, msAllaScadenza);
      }
    }
  };

  // Inizializzazione al mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const userString = localStorage.getItem('authUser');

    if (token && userString) {
      // Controlla se il token è scaduto prima di ripristinare la sessione
      if (isTokenExpired(token)) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
        return;
      }
      try {
        const storedUser = JSON.parse(userString) as User;
        setUser(storedUser);
        // Imposta timer per questo token
        setupLogoutTimer(token);
        // Avvia ping automatico se sessione ripristinata
        startPingInterval();
      } catch {
        localStorage.removeItem('authUser');
      }
    }
    
    // Cleanup quando il componente viene smontato
    return () => {
      clearLogoutTimer();
      clearPingInterval();
    };
  }, []);

  const login = (token: string, authUser: User) => {
    localStorage.setItem('authToken', token);
    localStorage.setItem('authUser', JSON.stringify(authUser));
    setUser(authUser);
    // Imposta il timer per il nuovo token
    setupLogoutTimer(token);
    // Avvia ping automatico per tenere sveglio il server
    startPingInterval();
  };

  const logout = () => {
    clearLogoutTimer();
    clearPingInterval(); // Ferma il ping quando logout
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    setUser(null);
  };

  const getToken = () => localStorage.getItem('authToken');

  const value = useMemo(() => ({ user, login, logout, getToken }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve essere usato all interno di AuthProvider');
  }
  return context;
}
