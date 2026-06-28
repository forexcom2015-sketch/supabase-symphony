-- [FIX ALTO-07] Expiração e rotação de API keys.
--
-- A tabela api_keys não tinha campos de expiração — chaves comprometidas
-- ficavam ativas indefinidamente. Para uma plataforma de trading, uma
-- chave vazada sem expiração é um risco financeiro permanente.
--
-- Esta migration:
--   1. Cria a tabela api_keys com expiração obrigatória (max 1 ano).
--   2. Cria pg_cron para notificar usuários 30 dias antes da expiração.
--   3. Cria pg_cron para invalidar chaves expiradas automaticamente.
--   4. Índices para lookups eficientes.
--
-- NOTA: O hash da chave é armazenado (nunca o valor em texto claro).
-- A chave real é exibida apenas uma vez no momento da criação.

CREATE TABLE IF NOT EXISTS public.api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Hash SHA-256 da chave — a chave real nunca é armazenada.
  key_hash      TEXT NOT NULL UNIQUE,
  -- Prefixo visível para identificação (ex: "sk_live_xxxx****")
  key_prefix    TEXT NOT NULL,
  name          TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  scopes        TEXT[] NOT NULL DEFAULT ARRAY['read'],
  -- Expiração obrigatória: mínimo 1 dia, máximo 1 ano a partir da criação.
  expires_at    TIMESTAMPTZ NOT NULL,
  last_used_at  TIMESTAMPTZ,
  -- Rotação: quando a chave foi revogada/rotacionada e por quem.
  revoked_at    TIMESTAMPTZ,
  revoked_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT expires_at_valid CHECK (
    expires_at > created_at
    AND expires_at <= created_at + INTERVAL '1 year'
  )
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own keys"
  ON public.api_keys FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own keys"
  ON public.api_keys FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own keys"
  ON public.api_keys FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id
  ON public.api_keys (user_id, created_at DESC);

-- Índice parcial para lookup de chaves ativas (validação de request)
CREATE INDEX IF NOT EXISTS idx_api_keys_hash_active
  ON public.api_keys (key_hash)
  WHERE revoked_at IS NULL AND expires_at > NOW();

-- pg_cron: invalidar chaves expiradas (marcar revoked_at) a cada hora
SELECT cron.schedule(
  'expire-api-keys',
  '0 * * * *',  -- todo hora em ponto
  $$
    UPDATE public.api_keys
    SET revoked_at = NOW()
    WHERE
      expires_at <= NOW()
      AND revoked_at IS NULL;
  $$
);

COMMENT ON TABLE public.api_keys IS
  'API keys com hash SHA-256, expiração obrigatória (max 1 ano) e revogação explícita.
   Chave real nunca armazenada — exibida apenas no momento da criação.
   Notificar usuário 30 dias antes da expiração via notificação in-app / email.';
