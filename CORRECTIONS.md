# Signal Radar — Correções de Auditoria Técnica
**Data:** 28 de junho de 2026 | **Auditoria:** Nível Engenheiro Sênior de Produção

---

## Resumo das Correções Aplicadas

| ID | Severidade | Arquivo(s) Modificado(s) | Status |
|----|-----------|--------------------------|--------|
| CRÍTICO-01 | 🔴 Crítico | `vite.config.ts` | ✅ Corrigido |
| CRÍTICO-02 | 🔴 Crítico | `src/lib/bot4x-store.ts` | ✅ Corrigido |
| CRÍTICO-03 | 🔴 Crítico | `src/lib/bot4x-trades-db.ts` | ✅ Parcial (Sentry alert) |
| ALTO-01 | 🟠 Alto | `src/routes/login.tsx` | ✅ Corrigido |
| ALTO-02 | 🟠 Alto | `src/lib/signals-store.ts`, `src/lib/signals-data.ts` | ✅ Corrigido |
| ALTO-03 | 🟠 Alto | `src/lib/admin.functions.ts` | ✅ Corrigido |
| ALTO-04 | 🟠 Alto | `supabase/migrations/20260628000001_bot4x_trades_rls_update_policy.sql` | ✅ Corrigido |
| ALTO-05 | 🟠 Alto | `wrangler.jsonc` | ✅ Corrigido |
| ALTO-06 | 🟠 Alto | `src/lib/cache.ts`, `src/lib/signals.functions.ts` | ✅ Corrigido |
| ALTO-07 | 🟠 Alto | `supabase/migrations/20260628000002_api_keys_expiration.sql` | ✅ Corrigido |
| MÉDIO-01 | 🟡 Médio | `src/lib/sentry.ts` | ✅ Corrigido |
| MÉDIO-02 | 🟡 Médio | `src/hooks/useStoreCleanup.ts` | ✅ Corrigido |
| MÉDIO-03 | 🟡 Médio | `supabase/migrations/20260627000002_outbox_reconciliation_worker.sql` | ✅ Corrigido |
| MÉDIO-04 | 🟡 Médio | `vite.config.ts` | ✅ Corrigido |
| MÉDIO-05 | 🟡 Médio | `src/lib/market.functions.ts` | ✅ Documentado (WAF rule) |
| MÉDIO-07 | 🟡 Médio | `src/lib/__tests__/trade-outbox-integration.test.ts` | ✅ Criado |
| MÉDIO-08 | 🟡 Médio | `src/components/profile/avatar-cropper.tsx`, `header-card.tsx` | ✅ Corrigido |
| MÉDIO-09 | 🟡 Médio | `vite.config.ts` | ✅ Documentado |
| BAIXO-01 | 🟢 Baixo | 15 arquivos (hooks, routes, server, adapters) | ✅ 0 console.* restantes |
| BAIXO-03 | 🟢 Baixo | `supabase/migrations/20260627000003_...sql` | ✅ Deadline adicionado |
| BAIXO-05 | 🟢 Baixo | `public/robots.txt` | ✅ Criado |
| BAIXO-06 | 🟢 Baixo | `supabase/migrations/20260627000001_...sql` | ✅ Documentado |

---

## Detalhes das Correções

### CRÍTICO-01 — `vite.config.ts`
**Problema:** Fallback encadeava variáveis server-only (`SUPABASE_ANON_KEY` sem prefixo VITE_) que poderiam ser embedadas no bundle público.
**Correção:** Apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` são aceitas. Build falha explicitamente em produção se ausentes.

### CRÍTICO-02 — `src/lib/bot4x-store.ts`
**Problema:** `makeUserStorage` usava `localStorage` para dados financeiros sensíveis — acessível a XSS e extensões.
**Correção:** Migrado para `sessionStorage` com guard de SSR. Adicionado tratamento de `QuotaExceededError`.

### CRÍTICO-03 — `src/lib/bot4x-trades-db.ts`
**Problema:** Falhas de replicação entre NestJS e Supabase eram silenciosas — sem alertas operacionais.
**Correção Parcial:** Adicionado Sentry warning com contexto completo quando escrita direta falha. Requer implementação de outbox server-side no NestJS para cobertura completa.

### ALTO-01 — `src/routes/login.tsx`
**Problema:** Sem rate limiting na rota de login — vulnerável a credential stuffing.
**Correção:** `checkSignInRateLimit()` com janela deslizante de 5 tentativas/60s via `sessionStorage`. Rate limit server-side permanece no Supabase.

### ALTO-02 — `src/lib/signals-store.ts`
**Problema:** `manipRisk`, `setup`, `session` e `assetClass` hardcoded com valores fictícios. Um sinal de alta manipulação aparecia como `"low"`.
**Correção:** 
- Schema Zod estendido com campos opcionais do backend.
- `deriveAssetClass()` infere classe do par quando backend não retorna.
- `manipRisk: "unknown"` quando ausente (nunca mais `"low"` por padrão).
- Types `SetupType` e `Session` estendidos com `"Unknown"`.

### ALTO-03 — `src/lib/admin.functions.ts`
**Problema:** Input de busca interpolado diretamente em cláusula `.or()` sem escape de wildcards.
**Correção:** Escape de `%`, `_` e `\` antes da interpolação.

### ALTO-04 — Nova migration
**Problema:** Política RLS de UPDATE ausente em `bot4x_trades`.
**Correção:** `20260628000001_bot4x_trades_rls_update_policy.sql` — policies de UPDATE e DELETE com `USING (auth.uid() = user_id)`.

### ALTO-05 — `wrangler.jsonc`
**Problema:** Staging com `cpu_ms: 50` vs produção com `cpu_ms: 200` — sem paridade.
**Correção:** Staging alinhado a `cpu_ms: 200`.

### ALTO-06 — `src/lib/cache.ts`
**Problema:** `memoryStore` global sem separação explícita entre dados públicos e por-usuário.
**Correção:** `cachedUserJson()` helper type-safe que garante `userId` na key. `CACHE_SCOPES` documenta quais caches são globais vs. por-usuário.

### ALTO-07 — Nova migration
**Problema:** Sem expiração de API keys — chaves comprometidas ficavam ativas indefinidamente.
**Correção:** `20260628000002_api_keys_expiration.sql` — tabela `api_keys` com `expires_at` obrigatório (max 1 ano), hash SHA-256, pg_cron de invalidação a cada hora.

### MÉDIO-01 — `src/lib/sentry.ts`
**Problema:** Sentry sem replay e sem `ignoreErrors` — ruído alto, invisibilidade de UX.
**Correção:** `replaysOnErrorSampleRate: 0.01` com `maskAllInputs: true`. Lista de `ignoreErrors` para ResizeObserver e erros de rede esperados.

### MÉDIO-02 — `src/hooks/useStoreCleanup.ts`
**Problema:** Cleanup dos stores ocorria apenas no unmount — logout sem navegação deixava timers ativos.
**Correção:** Subscrição ao `SIGNED_OUT` do Supabase Auth para cleanup imediato. Unsubscribe do listener no unmount.

### MÉDIO-03 — Outbox reconciliation migration
**Problema:** Trades em falha nas primeiras 24h ficavam em loop infinito sem contador de retry.
**Correção:** `attempts + 1 >= 10` marca como `failed` após 10 tentativas. `last_error = SQLERRM` persiste a mensagem de erro para diagnóstico.

### MÉDIO-04 — `vite.config.ts`
**Problema:** `framer-motion`, `recharts` e `@sentry/react` no bundle principal — LCP degradado.
**Correção:** `manualChunks` separa em `vendor-framer-motion`, `vendor-recharts`, `vendor-sentry` e `vendor-supabase`.

### MÉDIO-08 — `src/components/profile/avatar-cropper.tsx`
**Problema:** Avatar armazenado como base64 Data URL (~200KB) no Zustand — crescia com cada render.
**Correção:** Canvas → WebP blob (85% quality) → Supabase Storage → URL pública (~80 chars) no store. Cache busting via `?v=timestamp`.

### BAIXO-01 — 15 arquivos
**Problema:** 46 chamadas `console.*` não migradas para `logger.ts` — logs não estruturados.
**Correção:** Zero `console.*` em produção após migração automatizada para `logger.info/warn/error`.

### BAIXO-05 — `public/robots.txt`
**Problema:** Rotas autenticadas indexáveis por bots.
**Correção:** `Disallow` para todas as rotas protegidas (`/dashboard`, `/bot4x`, `/admin`, etc.).

---

---

## Correções da Segunda Rodada de Auditoria (27/06/2026 — Laudo v2)

| ID | Severidade | Arquivo(s) Criado/Modificado | Status |
|----|-----------|------------------------------|--------|
| SPRINT0-01 | 🔴 Crítico | `vite.config.ts` | ✅ Corrigido |
| SPRINT1-01 | 🟠 Alto | `src/lib/__tests__/security-middleware.test.ts` | ✅ Criado |
| SPRINT1-02 | 🟠 Alto | `.github/workflows/deploy-with-rollback.yml` | ✅ Criado |
| SPRINT1-03 | 🟡 Médio | `docs/architecture/disaster-recovery.md` | ✅ Criado |
| VUL-03 | ✅ Fechada | `src/routes/lovable/email/queue/process.ts` | ✅ Confirmado (timingSafeEqual presente) |

### SPRINT0-01 — `vite.config.ts`
**Problema (laudo DEV-04):** `VITE_SENTRY_DSN` era opcional — build de produção não falhava sem ela. Erros críticos em produção ficavam invisíveis (Sentry em modo no-op silencioso).
**Correção:** Adicionada validação obrigatória de `VITE_SENTRY_DSN` no bloco de produção (`NODE_ENV=production` ou `CF_PAGES=1`). Build falha com mensagem clara incluindo o comando `wrangler pages secret put` para configuração.

### SPRINT1-01 — Testes de Middlewares de Segurança
**Problema (laudo QA-01):** `auth-middleware.ts` e `csrf-middleware.ts` sem cobertura de testes — o código de autenticação mais crítico do sistema não tinha nenhum teste automatizado.
**Correção:** Criado `src/lib/__tests__/security-middleware.test.ts` com 12 cenários cobrindo:
- `requireSupabaseAuth`: env ausente, token ausente, formato inválido, JWT inválido, user sem id, JWT válido, verificação de uso de `getUser()` vs `getClaims()`
- `requireSameOrigin`: sem Origin (server-side), mesmo origin, cross-origin (CSRF bloqueado), Origin malformado, subdomain diferente

### SPRINT1-02 — Workflow de Deploy com Rollback
**Problema (laudo DEV-05):** Sem estratégia de rollback — deploy com bug afetava 100% do tráfego imediatamente, sem mecanismo automático de recuperação.
**Correção:** Criado `.github/workflows/deploy-with-rollback.yml` com:
- Deploy em duas etapas: Staging → Production (com aprovação de environment)
- Health check automático pós-deploy (`/_health`)
- **Auto-rollback** para a versão anterior se o health check falhar em produção
- **Rollback manual** via `workflow_dispatch` com seleção de versão e ambiente
- Resumo de deploy no GitHub Summary (versão atual + versão para rollback manual)

### SPRINT1-03 — Documentação de DR/Backup
**Problema (laudo DEV-06):** Nenhuma documentação de política de backup ou procedimento de restore. Em caso de incidente, o time não saberia como proceder.
**Correção:** Criado `docs/architecture/disaster-recovery.md` documentando:
- Tabela de RTO/RPO por componente
- Políticas de backup do Supabase (PITR + snapshots diários)
- Procedimentos de backup manual pré-migration
- Runbooks de restore via PITR
- Procedimento de rollback de Workers
- Inventário de secrets e procedimento de regeneração
- Runbooks de incidente (produção fora do ar, divergência de trades, credential stuffing)
- Checklist mensal de DR

### VUL-03 — Confirmação de timingSafeEqual (FECHADA)
**Status original no laudo:** ❌ NÃO CONFIRMADO — arquivo não disponibilizado para análise.
**Resultado após análise do arquivo:** `src/routes/lovable/email/queue/process.ts` contém implementação correta de `safeCompareSecret()` usando `timingSafeEqual` do módulo `node:crypto` com proteção contra ataques de timing (verificação de comprimento + comparação byte-a-byte em tempo constante). **VUL-03 está FECHADA.**

---

## Ações Pendentes (Requerem Infraestrutura)

| Ação | Responsável | Prazo |
|------|-------------|-------|
| Configurar Cloudflare WAF Rate Limiting em `/_serverFn/*` (60 req/min/IP) | DevOps | Sprint 2 |
| Implementar outbox server-side no NestJS para CRÍTICO-03 completo | Backend | Sprint 2 |
| Adicionar hCaptcha/Turnstile no signup | Frontend | Sprint 2 |
| Criar bucket `profiles` no Supabase Storage com política pública de leitura | DevOps | Sprint 3 |
| Configurar alerta Sentry: `trade_outbox.status = 'failed'` por > 5min | SRE | Sprint 2 |
| Remover colunas legacy de `bot4x_configs` (deadline: 2026-09-30) | Backend | Sprint 4 |
