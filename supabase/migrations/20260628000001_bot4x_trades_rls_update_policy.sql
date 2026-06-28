-- [FIX ALTO-04] Política RLS de UPDATE ausente em bot4x_trades.
--
-- A migration original (20260625000008) concedeu UPDATE ao role `authenticated`
-- mas não criou a policy RLS de UPDATE. Isso significa que, em teoria, qualquer
-- usuário autenticado poderia atualizar trades de outro usuário se o RLS fosse
-- bypassado por uma vulnerabilidade futura.
--
-- Também adicionamos a policy DROP explícita para idempotência (safe re-run).

-- UPDATE: usuário só pode atualizar os próprios trades
DROP POLICY IF EXISTS "Users update own trades" ON public.bot4x_trades;
CREATE POLICY "Users update own trades"
  ON public.bot4x_trades FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE explícita (já existia via grant mas sem RLS policy):
-- Garantir que a policy de DELETE também exista formalmente.
DROP POLICY IF EXISTS "Users delete own trades" ON public.bot4x_trades;
CREATE POLICY "Users delete own trades"
  ON public.bot4x_trades FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
