// @ts-nocheck
import { createFileRoute, useNavigate, Outlet, redirect } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth';
import { useEffect, lazy, Suspense } from 'react';
import { Bot4xCompactPill } from '@/components/global/bot4x-compact-pill';
import { Bot4xGlobalNotifier } from '@/components/global/bot4x-notifier';
import { MobileBottomNav } from '@/components/dashboard/mobile-bottom-nav';
import { TourController } from '@/components/tour/tour-controller';
import { useBot4xStore } from '@/lib/bot4x-store';
import { useDnaAutoCorrector } from '@/lib/dna-auto-corrector';
import { useTraderProfile } from '@/hooks/useTraderProfile';
import { useMarketContext } from '@/hooks/useMarketContext';
import { useCopilotUI } from '@/lib/copilot-ui-store';
import { useStoreCleanup } from '@/hooks/useStoreCleanup';
import { Skeleton } from '@/components/ui/skeleton';
import { OfflineBanner } from '@/components/offline-banner';
import { getAuthSession } from '@/lib/server-auth';

const Bot4xFloatingWidget = lazy(() =>
  import('@/components/bot4x/floating-widget').then((m) => ({ default: m.Bot4xFloatingWidget })),
);
const CopilotPanel = lazy(() =>
  import('@/components/copilot/CopilotPanel').then((m) => ({ default: m.CopilotPanel })),
);

export const Route = createFileRoute('/_authenticated')({
  // Verificação client-side — sem createServerFn do Lovable
  beforeLoad: async () => {
    const auth = await getAuthSession();
    if (!auth.isAuthenticated && typeof window !== 'undefined') {
      throw redirect({ to: '/login' });
    }
    return { serverUserId: auth.isAuthenticated ? auth.userId : undefined };
  },
  component: AuthGate,
});

function AuthGate() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: '/login' });
  }, [loading, session, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Skeleton className="w-48 h-8" />
      </div>
    );
  }
  if (!session) return null;

  return <AuthenticatedLayout />;
}

function AuthenticatedLayout() {
  const { isOpen: isCopilotOpen } = useCopilotUI();
  useTraderProfile();
  useMarketContext();
  useDnaAutoCorrector();
  useStoreCleanup();

  return (
    <div className="min-h-screen bg-background">
      <OfflineBanner />
      <Outlet />
      <MobileBottomNav />
      <Bot4xCompactPill />
      <Suspense fallback={null}>
        <Bot4xFloatingWidget />
      </Suspense>
      {isCopilotOpen && (
        <Suspense fallback={null}>
          <CopilotPanel />
        </Suspense>
      )}
      <Bot4xGlobalNotifier />
      <TourController />
    </div>
  );
}