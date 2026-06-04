import { Loader2 } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <Loader2 size={48} className="loading-spinner" />
        <p className="loading-text">Caricamento...</p>
      </div>
    </div>
  );
}
