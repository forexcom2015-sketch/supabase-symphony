// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// admin.functions.ts — versão SPA
// Chama o Supabase diretamente com o cliente de browser (anon key + RLS).
// Funções de admin exigem role 'admin' — RLS e RPCs do banco controlam acesso.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '@/integrations/supabase/client';
import { PLAN_TIERS } from './plan-tier';

export async function adminListUsers(opts?: { search?: string; limit?: number; cursor?: string }) {
  const limit = opts?.limit ?? 20;
  let query = supabase
    .from('profiles')
    .select('id, full_name, username, email, plan_tier, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (opts?.search) query = query.ilike('username', `%${opts.search}%`);
  if (opts?.cursor) query = query.lt('created_at', opts.cursor);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function adminUpdateUserField(
  targetUserId: string,
  field: string,
  value: string,
) {
  if (!['full_name', 'username', 'bio', 'country', 'plan_tier'].includes(field)) {
    throw new Error(`Campo não permitido: ${field}`);
  }
  if (field === 'plan_tier' && !PLAN_TIERS.includes(value as any)) {
    throw new Error(`Plano inválido: ${value}`);
  }
  const { error } = await supabase
    .from('profiles')
    .update({ [field]: value })
    .eq('id', targetUserId);
  if (error) throw error;
  return { ok: true };
}