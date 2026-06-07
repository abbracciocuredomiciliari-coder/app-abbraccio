import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ReactNode } from 'react';

// Configurazione ottimizzata per React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache dei dati per 5 minuti
      staleTime: 1000 * 60 * 5,
      // Mantieni dati in cache per 30 minuti anche se non usati
      gcTime: 1000 * 60 * 30,
      // Riprova 3 volte in caso di errore
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Rifetch automatico quando la finestra torna in focus (ma solo se dati stale)
      refetchOnWindowFocus: false,
      // Rifetch quando la connessione torna
      refetchOnReconnect: true,
      // Non rifetchare al mount se i dati sono fresh
      refetchOnMount: 'always',
    },
    mutations: {
      // Riprova le mutation solo 1 volta
      retry: 1,
    },
  },
});

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} position="bottom" />
    </QueryClientProvider>
  );
}
