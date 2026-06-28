import { useEffect } from "react";
import { useSignalsStore } from "@/lib/signals-store";
import { useDashboardStore } from "@/lib/dashboard-store";
import { useBot4xStore } from "@/lib/bot4x-store";
import { supabase } from "@/integrations/supabase/client";

/**
 * Centraliza o cleanup dos stores Zustand que mantêm setInterval/setTimeout
 * em runtime (signals, dashboard, bot4x).
 *
 * [FIX MÉDIO-02] Além do cleanup no unmount do componente, agora também
 * subscreve ao evento SIGNED_OUT do Supabase para limpar imediatamente
 * quando o usuário faz logout — mesmo sem navegar para fora do shell
 * autenticado. Sem isso, o _ticker do Bot4x continuava disparando com
 * token expirado, gerando erros 401 silenciosos em loop.
 */
export function useStoreCleanup() {
  useEffect(() => {
    // Cleanup no SIGNED_OUT — cobre o caso de logout sem unmount do componente
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        useSignalsStore.getState().cleanup();
        useDashboardStore.getState().cleanup();
        useBot4xStore.getState().cleanup();
      }
    });

    // Cleanup no unmount — cobre hot reload, navegação e fechamento de aba
    return () => {
      sub.subscription.unsubscribe();
      useSignalsStore.getState().cleanup();
      useDashboardStore.getState().cleanup();
      useBot4xStore.getState().cleanup();
    };
  }, []);
}
