/**
 * Sentry bootstrap. Idempotent: chamadas múltiplas (HMR) são no-op após a
 * primeira. Em dev (sem DSN) o módulo expõe stubs que não fazem nada,
 * mantendo o mesmo contrato para o resto do código.
 */
import * as Sentry from "@sentry/react";

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) {
    // [OPS] MEDIA-06 corrigido: em produção, a ausência do DSN é um erro
    // operacional grave — erros críticos de usuários reais passariam despercebidos.
    // Logamos como erro visível (não silencioso) para ser detectado no deploy.
    if (import.meta.env.PROD) {
      console.error(
        "[Sentry] VITE_SENTRY_DSN não configurada em produção. " +
        "Erros críticos NÃO serão capturados. " +
        "Configure no painel do Cloudflare Pages: wrangler pages secret put VITE_SENTRY_DSN"
      );
    }
    // Sem DSN: Sentry permanece como no-op. captureException/Message viram
    // chamadas vazias quando o client não foi inicializado.
    return;
  }
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    enabled: import.meta.env.PROD,
    // Traces: 10% de amostragem para performance monitoring.
    tracesSampleRate: 0.1,
    // [FIX MÉDIO-01] Replay: captura reprodução de sessão apenas em erros (1%)
    // para diagnóstico de UX sem custo excessivo de bandwidth.
    // Não capturar replay de sessões sem erro (replaysSessionSampleRate: 0)
    // para respeitar privacidade do usuário em dados financeiros.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.01,
    integrations: [
      Sentry.replayIntegration({
        // Mascarar todos os inputs (senhas, emails, dados de trading)
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    ],
    // Ignorar erros de extensões de browser e ruído de rede esperado
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured",
      /^Network Error$/,
      /^Request failed with status code 401$/,
    ],
    // Integrations padrão do browser SDK já cobrem fetch/xhr/history.
    // Se o pacote @sentry/tanstackstart-react for adicionado depois,
    // trocar aqui pelo tanstackRouterBrowserTracingIntegration.
  });
  initialized = true;
}

export { Sentry };
