import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../api/api';
import { useAuth } from './AuthContext';

export type Modalita = 'privato' | 'convenzione' | 'consulenza';
export type ModalitaAbilitata = 'entrambi' | 'privato' | 'convenzione';

interface ModalitaContextValue {
  modalita: Modalita;
  setModalita: (m: Modalita) => void;
  isConvenzione: boolean;
  isConsulenza: boolean;
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
    // La modalità scelta nei pulsanti del login è in localStorage: ri-sincronizza
    // lo stato a ogni cambio utente (altrimenti resta quella del mount iniziale)
    const stored = localStorage.getItem('modalita');
    const sceltaLogin: Modalita =
      stored === 'convenzione' || stored === 'consulenza' ? stored : 'privato';
    if (isPrivilegiato) {
      setModalitaAbilitata('entrambi');
      setModalitaState(sceltaLogin);
      return;
    }
    // Operatori: leggi dal profilo staff
    api.get('/workplan/mio-profilo-staff')
      .then(res => {
        const abilitata: ModalitaAbilitata = res.data.modalitaAbilitata || 'entrambi';
        setModalitaAbilitata(abilitata);
        // Se l'operatore è abilitato a una sola area, prevale l'abilitazione
        // (consulenza è un'area privata: vi rientra chi ha 'entrambi' o 'privato')
        const target: Modalita =
          abilitata === 'entrambi' ? sceltaLogin :
          abilitata === 'convenzione' ? 'convenzione' :
          (sceltaLogin === 'convenzione' ? 'privato' : sceltaLogin);
        setModalitaState(target);
        localStorage.setItem('modalita', target);
      })
      .catch(() => {
        setModalitaAbilitata('entrambi');
        setModalitaState(sceltaLogin);
      });
  }, [user?.id]);

  const setModalita = (m: Modalita) => {
    // Blocca se non abilitato (consulenza appartiene all'area privata)
    if (modalitaAbilitata === 'privato' && m === 'convenzione') return;
    if (modalitaAbilitata === 'convenzione' && (m === 'privato' || m === 'consulenza')) return;
    localStorage.setItem('modalita', m);
    setModalitaState(m);
  };

  const canSwitch = isPrivilegiato ? true : modalitaAbilitata === 'entrambi';

  return (
    <ModalitaContext.Provider value={{ modalita, setModalita, isConvenzione: modalita === 'convenzione', isConsulenza: modalita === 'consulenza', modalitaAbilitata, canSwitch }}>
      {children}
    </ModalitaContext.Provider>
  );
}

export function useModalita() {
  const ctx = useContext(ModalitaContext);
  if (!ctx) throw new Error('useModalita deve essere usato dentro ModalitaProvider');
  return ctx;
}
