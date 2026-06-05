import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../api/api';
import { useAuth } from './AuthContext';

export type Modalita = 'privato' | 'convenzione';
export type ModalitaAbilitata = 'entrambi' | 'privato' | 'convenzione';

interface ModalitaContextValue {
  modalita: Modalita;
  setModalita: (m: Modalita) => void;
  isConvenzione: boolean;
  modalitaAbilitata: ModalitaAbilitata;
  canSwitch: boolean;
}

const ModalitaContext = createContext<ModalitaContextValue | undefined>(undefined);

export function ModalitaProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [modalita, setModalitaState] = useState<Modalita>(
    () => (localStorage.getItem('modalita') as Modalita) || 'privato'
  );
  const [modalitaAbilitata, setModalitaAbilitata] = useState<ModalitaAbilitata>('entrambi');

  // Admin/coordinator/direttore hanno sempre accesso a tutto
  const isPrivilegiato = user && ['admin', 'coordinator', 'direttore'].includes(user.role);

  useEffect(() => {
    if (!user) return;
    if (isPrivilegiato) {
      setModalitaAbilitata('entrambi');
      return;
    }
    // Operatori: leggi dal profilo staff
    api.get('/workplan/mio-profilo-staff')
      .then(res => {
        const abilitata: ModalitaAbilitata = res.data.modalitaAbilitata || 'entrambi';
        setModalitaAbilitata(abilitata);
        // Correggi la modalità corrente se non abilitata
        if (abilitata === 'privato' && modalita === 'convenzione') {
          setModalitaState('privato');
          localStorage.setItem('modalita', 'privato');
        } else if (abilitata === 'convenzione' && modalita === 'privato') {
          setModalitaState('convenzione');
          localStorage.setItem('modalita', 'convenzione');
        }
      })
      .catch(() => setModalitaAbilitata('entrambi'));
  }, [user?.role]);

  const setModalita = (m: Modalita) => {
    // Blocca se non abilitato
    if (modalitaAbilitata === 'privato' && m === 'convenzione') return;
    if (modalitaAbilitata === 'convenzione' && m === 'privato') return;
    localStorage.setItem('modalita', m);
    setModalitaState(m);
  };

  const canSwitch = isPrivilegiato ? true : modalitaAbilitata === 'entrambi';

  return (
    <ModalitaContext.Provider value={{ modalita, setModalita, isConvenzione: modalita === 'convenzione', modalitaAbilitata, canSwitch }}>
      {children}
    </ModalitaContext.Provider>
  );
}

export function useModalita() {
  const ctx = useContext(ModalitaContext);
  if (!ctx) throw new Error('useModalita deve essere usato dentro ModalitaProvider');
  return ctx;
}
