import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';

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

        // Pianifica auto-logout alla scadenza del token
        const payload = decodeJwtPayload(token);
        if (payload?.exp) {
          const msAllaScadenza = payload.exp * 1000 - Date.now();
          if (msAllaScadenza > 0) {
            const timer = setTimeout(() => {
              localStorage.removeItem('authToken');
              localStorage.removeItem('authUser');
              setUser(null);
              alert('La tua sessione è scaduta. Effettua nuovamente il login.');
            }, msAllaScadenza);
            // Cleanup del timer se il componente viene smontato
            return () => clearTimeout(timer);
          }
        }
      } catch {
        localStorage.removeItem('authUser');
      }
    }
  }, []);

  const login = (token: string, authUser: User) => {
    localStorage.setItem('authToken', token);
    localStorage.setItem('authUser', JSON.stringify(authUser));
    setUser(authUser);
  };

  const logout = () => {
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
