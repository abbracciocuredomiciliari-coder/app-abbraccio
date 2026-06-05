import { createContext, useContext, useState, ReactNode } from 'react';

export type Modalita = 'privato' | 'convenzione';

interface ModalitaContextValue {
  modalita: Modalita;
  setModalita: (m: Modalita) => void;
  isConvenzione: boolean;
}

const ModalitaContext = createContext<ModalitaContextValue | undefined>(undefined);

export function ModalitaProvider({ children }: { children: ReactNode }) {
  const [modalita, setModalitaState] = useState<Modalita>(
    () => (localStorage.getItem('modalita') as Modalita) || 'privato'
  );

  const setModalita = (m: Modalita) => {
    localStorage.setItem('modalita', m);
    setModalitaState(m);
  };

  return (
    <ModalitaContext.Provider value={{ modalita, setModalita, isConvenzione: modalita === 'convenzione' }}>
      {children}
    </ModalitaContext.Provider>
  );
}

export function useModalita() {
  const ctx = useContext(ModalitaContext);
  if (!ctx) throw new Error('useModalita deve essere usato dentro ModalitaProvider');
  return ctx;
}
