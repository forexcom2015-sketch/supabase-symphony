/**
 * Testes de segurança para requireSupabaseAuth e requireSameOrigin.
 *
 * Cobertura mínima exigida pelo laudo (QA-01 / Sprint 1):
 *  - requireSupabaseAuth: token ausente, formato inválido, JWT inválido,
 *    JWT válido, env vars ausentes.
 *  - requireSameOrigin: sem Origin (server-side legítimo), mesmo origin,
 *    cross-origin (deve bloquear), Origin malformado.
 *
 * Os middlewares dependem de @tanstack/react-start/server (getRequest) e
 * @supabase/supabase-js — ambos são mockados aqui para isolamento completo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks globais ────────────────────────────────────────────────────────────

// Mock do createClient do Supabase
const mockGetUser = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

// Mock do logger (evita output nos testes)
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// Estado mutável compartilhado pelos mocks de getRequest
let mockHeaders: Record<string, string | null> = {};

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: vi.fn(() => ({
    headers: {
      get: (key: string) => mockHeaders[key.toLowerCase()] ?? null,
    },
  })),
}));

vi.mock("@tanstack/react-start", () => ({
  createMiddleware: vi.fn(() => ({
    server: (fn: (args: { next: () => void }) => unknown) => ({ _handler: fn }),
  })),
}));

// ─── Importações após mocks ───────────────────────────────────────────────────

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireSameOrigin } from "@/integrations/supabase/csrf-middleware";

// Helper: extrai o handler do middleware mockado
function getHandler(middleware: { _handler: (args: { next: () => void }) => unknown }) {
  return middleware._handler;
}

// ─── requireSupabaseAuth ──────────────────────────────────────────────────────

describe("requireSupabaseAuth", () => {
  const next = vi.fn(() => "next_called");

  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders = {};
    // Restaurar env vars válidas por padrão
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "eyJ-publishable-key");
  });

  it("lança erro quando SUPABASE_URL não está definida", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    const handler = getHandler(requireSupabaseAuth as unknown as { _handler: (args: { next: () => void }) => unknown });
    await expect(handler({ next })).rejects.toThrow(/Missing Supabase environment variable/i);
    expect(next).not.toHaveBeenCalled();
  });

  it("lança erro quando SUPABASE_PUBLISHABLE_KEY não está definida", async () => {
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
    const handler = getHandler(requireSupabaseAuth as unknown as { _handler: (args: { next: () => void }) => unknown });
    await expect(handler({ next })).rejects.toThrow(/Missing Supabase environment variable/i);
    expect(next).not.toHaveBeenCalled();
  });

  it("lança Unauthorized quando header Authorization está ausente", async () => {
    const handler = getHandler(requireSupabaseAuth as unknown as { _handler: (args: { next: () => void }) => unknown });
    await expect(handler({ next })).rejects.toThrow(/Unauthorized/i);
    expect(next).not.toHaveBeenCalled();
  });

  it("lança Unauthorized quando token não tem prefixo 'Bearer '", async () => {
    mockHeaders["authorization"] = "Token abc123";
    const handler = getHandler(requireSupabaseAuth as unknown as { _handler: (args: { next: () => void }) => unknown });
    await expect(handler({ next })).rejects.toThrow(/Only Bearer tokens/i);
    expect(next).not.toHaveBeenCalled();
  });

  it("lança Unauthorized quando Supabase retorna erro na validação do JWT", async () => {
    mockHeaders["authorization"] = "Bearer invalid.jwt.token";
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("Invalid JWT") });
    const handler = getHandler(requireSupabaseAuth as unknown as { _handler: (args: { next: () => void }) => unknown });
    await expect(handler({ next })).rejects.toThrow(/Invalid or expired token/i);
    expect(next).not.toHaveBeenCalled();
  });

  it("lança Unauthorized quando getUser retorna user sem id", async () => {
    mockHeaders["authorization"] = "Bearer valid.but.no.id";
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: null } }, error: null });
    const handler = getHandler(requireSupabaseAuth as unknown as { _handler: (args: { next: () => void }) => unknown });
    await expect(handler({ next })).rejects.toThrow(/No user ID/i);
    expect(next).not.toHaveBeenCalled();
  });

  it("chama next() com contexto correto quando JWT é válido", async () => {
    mockHeaders["authorization"] = "Bearer valid.jwt.here";
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-uuid-123", email: "test@example.com" } },
      error: null,
    });
    const nextWithCtx = vi.fn(() => "ok");
    const handler = getHandler(requireSupabaseAuth as unknown as { _handler: (args: { next: (ctx?: unknown) => unknown }) => unknown });
    const result = await handler({ next: nextWithCtx });
    expect(nextWithCtx).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ userId: "user-uuid-123" }),
      })
    );
    expect(result).toBe("ok");
  });

  it("usa getUser() e não getClaims() — valida assinatura JWT no servidor", async () => {
    // Garante que a implementação chama getUser e não getClaims (bypass de assinatura)
    mockHeaders["authorization"] = "Bearer test.token";
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "uid-456" } },
      error: null,
    });
    const handler = getHandler(requireSupabaseAuth as unknown as { _handler: (args: { next: (ctx?: unknown) => unknown }) => unknown });
    await handler({ next: vi.fn() });
    // getUser foi chamado (valida no servidor Supabase)
    expect(mockGetUser).toHaveBeenCalledWith("test.token");
  });
});

// ─── requireSameOrigin ────────────────────────────────────────────────────────

describe("requireSameOrigin", () => {
  const next = vi.fn(() => "next_called");

  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders = {};
  });

  it("permite request sem header Origin (chamada server-side legítima)", async () => {
    // Origin ausente = cron, CLI, server-to-server — deve passar
    const handler = getHandler(requireSameOrigin as unknown as { _handler: (args: { next: () => unknown }) => unknown });
    const result = await handler({ next });
    expect(next).toHaveBeenCalled();
    expect(result).toBe("next_called");
  });

  it("permite request com mesmo Origin que o Host", async () => {
    mockHeaders["host"] = "app.signalradar.io";
    mockHeaders["origin"] = "https://app.signalradar.io";
    const handler = getHandler(requireSameOrigin as unknown as { _handler: (args: { next: () => unknown }) => unknown });
    const result = await handler({ next });
    expect(next).toHaveBeenCalled();
    expect(result).toBe("next_called");
  });

  it("bloqueia request com Origin diferente do Host (CSRF)", async () => {
    mockHeaders["host"] = "app.signalradar.io";
    mockHeaders["origin"] = "https://evil.attacker.com";
    const handler = getHandler(requireSameOrigin as unknown as { _handler: (args: { next: () => unknown }) => unknown });
    await expect(handler({ next })).rejects.toThrow(/cross-origin request rejected/i);
    expect(next).not.toHaveBeenCalled();
  });

  it("bloqueia request com Origin malformado", async () => {
    mockHeaders["host"] = "app.signalradar.io";
    mockHeaders["origin"] = "not-a-valid-url";
    const handler = getHandler(requireSameOrigin as unknown as { _handler: (args: { next: () => unknown }) => unknown });
    await expect(handler({ next })).rejects.toThrow(/malformed origin/i);
    expect(next).not.toHaveBeenCalled();
  });

  it("permite request de subdomain diferente com mesmo eTLD — host é exato", async () => {
    // host = api.signalradar.io, origin = https://app.signalradar.io → bloqueado
    // (a política é host exato, não domain suffix)
    mockHeaders["host"] = "api.signalradar.io";
    mockHeaders["origin"] = "https://app.signalradar.io";
    const handler = getHandler(requireSameOrigin as unknown as { _handler: (args: { next: () => unknown }) => unknown });
    await expect(handler({ next })).rejects.toThrow(/cross-origin request rejected/i);
    expect(next).not.toHaveBeenCalled();
  });
});
