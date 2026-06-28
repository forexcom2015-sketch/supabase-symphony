// ─────────────────────────────────────────────────────────────────────────────
// Supabase Client — SEM Lovable Cloud
// Aponta para o seu Supabase próprio via variáveis de ambiente.
// Configure em .env:  VITE_SUPABASE_URL  e  VITE_SUPABASE_ANON_KEY
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function createSupabaseClient() {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ['VITE_SUPABASE_URL'] : []),
      ...(!SUPABASE_ANON_KEY ? ['VITE_SUPABASE_ANON_KEY'] : []),
    ];
    throw new Error(
      `[Supabase] Variáveis ausentes: ${missing.join(', ')}. Configure no .env`
    );
  }

  // Sessão em sessionStorage (mais seguro que localStorage contra XSS).
  const sessionOnlyStorage =
    typeof window !== 'undefined'
      ? {
          getItem: (key: string) => sessionStorage.getItem(key),
          setItem: (key: string, value: string) => sessionStorage.setItem(key, value),
          removeItem: (key: string) => sessionStorage.removeItem(key),
        }
      : undefined;

  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: sessionOnlyStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
