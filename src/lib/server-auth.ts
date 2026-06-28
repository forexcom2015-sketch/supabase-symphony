// ─────────────────────────────────────────────────────────────────────────────
// server-auth.ts — versão SEM Lovable Cloud / createServerFn
// Valida o token JWT client-side (browser) usando o cliente Supabase normal.
// Numa stack puramente SPA (Vite + React) não há "server functions" —
// toda a autenticação passa pelo AuthProvider + JwtGuard do NestJS.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '@/integrations/supabase/client';

export type AuthSession =
  | { isAuthenticated: true; userId: string }
  | { isAuthenticated: false; userId?: undefined };

/**
 * Verifica a sessão atual no Supabase (client-side).
 * Substituímos o createServerFn do Lovable por uma chamada direta ao Supabase.
 */
export async function getAuthSession(): Promise<AuthSession> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user?.id) {
      return { isAuthenticated: false };
    }
    return { isAuthenticated: true, userId: data.session.user.id };
  } catch {
    return { isAuthenticated: false };
  }
}
