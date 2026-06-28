# Disaster Recovery & Backup — Signal Radar

**Última atualização:** 2026-06-27  
**Responsável:** Time de Infraestrutura  
**Revisão:** Semestral (Jan / Jul)

---

## 1. Visão Geral

Este documento define as políticas de backup, os objetivos de recuperação e os procedimentos de resposta a incidentes para os componentes de infraestrutura do Signal Radar.

| Componente | Provedor | Backup | RTO | RPO |
|---|---|---|---|---|
| Banco de dados (Postgres) | Supabase Pro | Automático (diário + WAL) | 4h | 1h |
| Assets estáticos | Cloudflare Workers | Deploy revertível | 15min | 0 (CI/CD) |
| Storage de avatares | Supabase Storage | Replicado (mesmo plano) | 4h | 1h |
| Configuração de Workers | Git (wrangler.jsonc) | Versionado em Git | 30min | 0 (Git) |
| Secrets / API Keys | Cloudflare Secrets | Manual (ver Seção 4) | 2h | N/A |

**RTO** = Recovery Time Objective (tempo máximo até restauração)  
**RPO** = Recovery Point Objective (perda máxima de dados aceitável)

---

## 2. Supabase — Backup e Restore

### 2.1 Backups automáticos (Supabase Pro)

O plano Pro do Supabase inclui:
- **Point-in-Time Recovery (PITR):** WAL contínuo com granularidade de 1 segundo.
  - Retenção padrão: **7 dias**
  - Para aumentar: Settings → Backups → Point in Time Recovery
- **Backups diários:** snapshot completo do Postgres às 00:00 UTC.
  - Retenção: **14 dias** no Pro, **30 dias** no Enterprise.

> ⚠️ **Verificar:** no dashboard Supabase → Settings → Backups → confirmar que PITR está ativado e a janela de retenção está correta para o projeto `signal-radar`.

### 2.2 Backup manual pré-migration

Antes de qualquer migration de schema destrutiva (DROP COLUMN, ALTER TYPE), executar:

```bash
# Dump completo do banco (incluindo dados)
pg_dump \
  --host=<SUPABASE_HOST> \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --format=custom \
  --file="backup-$(date +%Y%m%d-%H%M%S).dump"

# Apenas schema (sem dados) — útil para validação pós-migration
pg_dump \
  --host=<SUPABASE_HOST> \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --schema-only \
  --file="schema-$(date +%Y%m%d-%H%M%S).sql"
```

Obter `<SUPABASE_HOST>` em: Supabase Dashboard → Settings → Database → Connection string → Host.

### 2.3 Restore via PITR (Point-in-Time Recovery)

**Quando usar:** corrupção de dados, migration com bug, deleção acidental em produção.

1. Abrir Supabase Dashboard → Settings → Backups
2. Selecionar **"Restore to a point in time"**
3. Inserir timestamp UTC alvo (ex: `2026-06-27T14:30:00Z`)
4. Confirmar: o restore cria um novo projeto — migrar `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` após restore
5. Validar: executar queries de sanidade nas tabelas críticas (`bot4x_trades`, `profiles`, `trade_outbox`)
6. Atualizar secrets no Cloudflare Workers após migration de URL

> ⚠️ **Restore destrói o projeto original.** Sempre testar em um projeto de staging antes de executar em produção. Se possível, usar a API REST do Supabase para exportar dados críticos antes.

### 2.4 Backup de dados financeiros (bot4x_trades)

Trades são a tabela mais crítica. Exportar semanalmente para cold storage:

```sql
-- Exportar trades da semana anterior
COPY (
  SELECT * FROM public.bot4x_trades
  WHERE created_at >= NOW() - INTERVAL '7 days'
  ORDER BY created_at
) TO STDOUT WITH CSV HEADER;
```

Armazenar no S3/R2 com retenção de 90 dias (requisito LGPD para dados financeiros).

---

## 3. Cloudflare Workers — Rollback

### 3.1 Rollback via GitHub Actions (automatizado)

Usar o workflow `deploy-with-rollback.yml`:

```
GitHub Actions → deploy-with-rollback → action: rollback
  → environment: production
  → rollback_version: <deployment-id>
```

### 3.2 Rollback manual via Wrangler CLI

```bash
# 1. Listar deployments recentes
npx wrangler deployments list --env production

# 2. Copiar o deployment ID da versão alvo
# Exemplo: 12345678-abcd-...

# 3. Executar rollback
npx wrangler rollback --env production <deployment-id>

# 4. Verificar health
curl https://signal-radar-prod.workers.dev/_health
```

### 3.3 Rollback de staging

```bash
npx wrangler rollback --env staging <deployment-id>
curl https://signal-radar-staging.workers.dev/_health
```

---

## 4. Recuperação de Secrets

Secrets do Cloudflare Workers **não são recuperáveis** — se perdidos, devem ser regenerados.

### Inventário de secrets (todos os ambientes)

| Secret | Onde obter novo valor | Impacto se perdido |
|---|---|---|
| `SUPABASE_URL` | Supabase Dashboard → Settings → API | Workers param; sem impacto de dados |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → Service Role | Alto: gera novas chaves e revogar antiga |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase Dashboard → Settings → API → anon/public | Baixo: pode ser regenerada |
| `EMAIL_QUEUE_CRON_SECRET` | Gerar novo: `openssl rand -hex 32` | Médio: atualizar no pg_cron também |
| `LOVABLE_API_KEY` | Lovable Dashboard | Médio: contatar suporte Lovable |
| `VITE_SENTRY_DSN` | Sentry → Settings → Projects → Client Keys | Baixo: observabilidade interrompida |
| `CLOUDFLARE_API_TOKEN` | Cloudflare Dashboard → My Profile → API Tokens | Alto: CI/CD para; regenerar e atualizar GitHub Secrets |

### Procedimento de regeneração de `SUPABASE_SERVICE_ROLE_KEY`

```bash
# 1. Gerar nova chave no dashboard Supabase (Settings → API → Rotate Key)
# 2. Atualizar no Cloudflare staging
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env staging

# 3. Validar staging
curl https://signal-radar-staging.workers.dev/_health

# 4. Atualizar em produção
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production

# 5. Invalidar chave antiga no Supabase Dashboard
```

---

## 5. Runbooks de Incidente

### 5.1 Produção fora do ar (health check falha)

```
1. curl https://signal-radar-prod.workers.dev/_health
   → HTTP 200 com {"ok":true} → OK
   → Qualquer outro → INCIDENTE

2. Verificar status do Cloudflare: https://www.cloudflarestatus.com/
3. Verificar status do Supabase: https://status.supabase.com/

4. Se Cloudflare OK e Supabase OK:
   → Verificar logs: Cloudflare Dashboard → Workers & Pages → signal-radar-prod → Logs
   → Identificar erro e executar rollback (Seção 3)

5. Se Supabase com incidente:
   → Modo de manutenção: deploy de página estática de manutenção
   → Bot4x REAL deve ser desativado imediatamente (VITE_BOT4X_REAL_ENABLED=false)
   → Aguardar resolução do Supabase
```

### 5.2 Divergência de dados em bot4x_trades

```
1. Verificar trade_outbox:
   SELECT * FROM public.trade_outbox WHERE status = 'pending' ORDER BY created_at;

2. Se pending > 0 após 10min → pg_cron não está rodando
   → Verificar: SELECT * FROM cron.job WHERE jobname = 'reconcile-trade-outbox';
   → Executar manualmente: SELECT reconcile_trade_outbox();

3. Verificar NestJS backend (externo):
   → Ver docs/architecture/backend-boundary.md para contatos
```

### 5.3 Ataque de credential stuffing

```
1. Verificar tabela rate_limits:
   SELECT * FROM public.rate_limits ORDER BY last_request_at DESC LIMIT 20;

2. Bloquear IPs abusivos no Cloudflare WAF:
   Cloudflare Dashboard → Security → WAF → Custom Rules

3. Ativar CAPTCHA no Supabase Auth:
   Supabase Dashboard → Authentication → Providers → Enable Captcha (hCaptcha/Turnstile)
   [Nota: CAPTCHA ainda não configurado — ver VUL-04 no laudo de auditoria]

4. Alertar usuários afetados via email de segurança
```

---

## 6. Checklist de DR Mensal

Execute mensalmente (toda primeira segunda-feira do mês):

- [ ] Verificar que PITR está ativo no Supabase Dashboard
- [ ] Testar restore de um backup em ambiente de dev/sandbox
- [ ] Listar deployments e confirmar que rollback está disponível: `wrangler deployments list --env production`
- [ ] Verificar que todos os secrets estão configurados: `wrangler secret list --env production`
- [ ] Testar health check de produção e staging
- [ ] Revisar alertas Sentry da última semana
- [ ] Confirmar que `reconcile-trade-outbox` está rodando: verificar `cron.job_run_details`

---

## 7. Contatos de Emergência

| Componente | Contato / Link |
|---|---|
| Supabase Suporte | https://supabase.com/support |
| Cloudflare Status | https://www.cloudflarestatus.com/ |
| Sentry | https://status.sentry.io/ |
| NestJS Backend | Ver docs/architecture/backend-boundary.md |

---

*Documento criado como parte das correções da auditoria técnica de 27/06/2026 (DEV-06 — Backup/DR não documentado).*
