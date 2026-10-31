import { ChevronLeft } from 'lucide-react';

// Link "← Torna al sito" per le pagine pubbliche raggiunte dal sito vetrina
// (calcolatori preventivo, richieste, iscrizioni). Chi arriva da una scheda
// servizio del sito deve poter tornare indietro senza perdersi.
const URL_SITO = 'https://www.abbracciocuredomiciliari.it';

export function TornaAlSito({ color = '#1e4d8c' }: { color?: string }) {
  return (
    <a
      href={URL_SITO}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        color,
        fontWeight: 700,
        fontSize: '0.85rem',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <ChevronLeft size={16} /> Torna al sito
    </a>
  );
}
