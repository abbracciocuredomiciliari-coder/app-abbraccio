import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '24px',
            backgroundColor: '#f8fafc',
          }}
        >
          <Card
            style={{
              maxWidth: '500px',
              width: '100%',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#fef2f2',
                margin: '0 auto 16px',
              }}
            >
              <AlertTriangle size={32} color="#dc2626" />
            </div>
            <h2
              style={{
                margin: '0 0 8px 0',
                fontSize: '1.25rem',
                fontWeight: 600,
                color: '#1f2937',
              }}
            >
              Si è verificato un errore
            </h2>
            <p
              style={{
                margin: '0 0 24px 0',
                fontSize: '0.9375rem',
                color: '#6b7280',
              }}
            >
              {this.state.error?.message || 'Qualcosa è andato storto.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button onClick={() => { window.location.href = '/dashboard'; }} variant="primary">
                Torna alla dashboard
              </Button>
              <Button onClick={this.handleReset} variant="secondary">
                Riprova
              </Button>
              <Button onClick={() => window.location.reload()} variant="secondary">
                Ricarica pagina
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
