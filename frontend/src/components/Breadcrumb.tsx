import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface BreadcrumbItem {
  label: string;
  path: string;
  isLast: boolean;
}

const ROUTE_LABELS: Record<string, string> = {
  '/': 'Home',
  '/dashboard': 'Dashboard',
  '/patients': 'Pazienti',
  '/staff': 'Personale',
  '/workplan': 'Piani di Lavoro',
  '/documentazione': 'Documentazione',
  '/protocolli': 'Protocolli',
  '/procedure': 'Procedure',
  '/strumenti': 'Strumenti',
  '/archivio-cartelle': 'Archivio Cartelle',
  '/checklist': 'Checklist',
  '/gestione-utenti': 'Gestione Utenti',
  '/portale-operatore': 'Portale Operatore',
  '/profilo': 'Profilo',
  '/compenso-incarichi': 'Compenso',
  '/esami-strumentali': 'Esami Strumentali',
  '/richieste-presidi': 'Richieste Presidi',
  '/protocolli-procedure': 'Protocolli e Procedure',
  '/piani-lavorativi': 'Piani Lavorativi',
};

export default function Breadcrumb() {
  const location = useLocation();
  const { user } = useAuth();
  
  // Non mostrare breadcrumb su login/register
  if (!user || location.pathname === '/login' || location.pathname === '/register') {
    return null;
  }

  const pathSegments = location.pathname.split('/').filter(Boolean);
  const dashboardPath = ['admin', 'coordinator', 'direttore'].includes(user.role) ? '/dashboard' : '/portale-operatore';
  const dashboardLabel = dashboardPath === '/dashboard' ? 'Dashboard' : 'Portale Operatore';
  
  // Costruisci i breadcrumb items
  const items: BreadcrumbItem[] = [];
  let currentPath = '';
  
  // Aggiungi sempre Home per prima (tranne che nella home)
  if (location.pathname !== dashboardPath) {
    items.push({
      label: dashboardLabel,
      path: dashboardPath,
      isLast: false,
    });
  }
  
  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    // Rimuovi eventuali ID dalle route dinamiche
    const cleanPath = currentPath.replace(/\/[a-f0-9]{24}$/i, '');
    const label = ROUTE_LABELS[cleanPath] || ROUTE_LABELS[currentPath] || segment.charAt(0).toUpperCase() + segment.slice(1);
    
    items.push({
      label,
      path: currentPath,
      isLast: index === pathSegments.length - 1,
    });
  });

  // Se siamo sulla home, mostra solo il nome della dashboard appropriata al ruolo
  if (location.pathname === dashboardPath) {
    return (
      <nav className="breadcrumb">
        <Home size={16} />
        <span className="breadcrumb-current">{dashboardLabel}</span>
      </nav>
    );
  }

  return (
    <nav className="breadcrumb">
      <Link to={dashboardPath}>
        <Home size={16} />
      </Link>
      <ChevronRight size={14} className="breadcrumb-separator" />
      
      {items.slice(1).map((item, index) => (
        <span key={item.path} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {item.isLast ? (
            <span className="breadcrumb-current">{item.label}</span>
          ) : (
            <>
              <Link to={item.path}>{item.label}</Link>
              <ChevronRight size={14} className="breadcrumb-separator" />
            </>
          )}
        </span>
      ))}
    </nav>
  );
}
