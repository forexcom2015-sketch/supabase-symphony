import { Component, type ReactNode, type ErrorInfo, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Outlet, createRootRoute } from '@tanstack/react-router';
import * as Sentry from '@sentry/react';

import { AuthProvider } from '@/lib/auth';
import { Toaster } from '@/components/ui/sonner';
import { backendWs } from '@/adapters/backend/ws-client';
import { initSentry } from '@/lib/sentry';
import { logger } from '@/lib/logger';
import { registerPWA } from '@/lib/pwa/register';

initSentry();

const IS_DEV = import.meta.env.DEV;

const SAFE_ERROR_PATTERNS: RegExp[] = [
  /Missing Supabase environment variable/i,
  /Variáveis ausentes/i,
  /API base URL n[ãa]o configurada/i,
  /Unauthorized/i,
];

function getSafeErrorMessage(error: Error): string {
  const msg = error.message || '';
  if (SAFE_ERROR_PATTERNS.some((p) => p.test(msg))) return msg;
  return 'Ocorreu um erro inesperado. Nossa equipe foi notificada.';
}

interface EBState {
  error: Error | null;
}
class GlobalErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error): EBState {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('[GlobalErrorBoundary]', { error, componentStack: info.componentStack });
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }
  render() {
    if (this.state.error) {
      const safeMsg = getSafeErrorMessage(this.state.error);
      return (
        <div
          style={{
            display: 'flex',
            minHeight: '100vh',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            background: '#0a0a0a',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '34rem',
              width: '100%',
              color: '#fff',
              background: '#141414',
              border: '1px solid #2a2a2a',
              borderRadius: '0.75rem',
              padding: '2rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div
                style={{
                  width: '2.5rem',
                  height: '2.5rem',
                  borderRadius: '0.5rem',
                  background: '#ef444422',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                }}
              >
                ⚠
              </div>
              <h1 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>
                Erro ao inicializar
              </h1>
            </div>
            <p style={{ fontSize: '0.875rem', color: '#a3a3a3', lineHeight: 1.6, marginTop: 0 }}>
              {safeMsg}
            </p>
            {IS_DEV && (
              <pre
                style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  background: '#0a0a0a',
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  color: '#f87171',
                  overflow: 'auto',
                }}
              >
                {this.state.error.stack}
              </pre>
            )}
            <button
              style={{
                marginTop: '1.5rem',
                padding: '0.5rem 1rem',
                background: '#1f1f1f',
                border: '1px solid #3a3a3a',
                color: '#fff',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
              onClick={() => window.location.reload()}
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  useEffect(() => {
    registerPWA();
    // Pré-conecta o WebSocket assim que o usuário estiver autenticado
    // (backendWs.connect() verifica internamente se há token)
    backendWs.connect('/ws');
  }, []);

  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Outlet />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}
