// ─────────────────────────────────────────────────────────────────────────────
// cache.ts — versão SPA (cache em memória, sem Cloudflare Workers)
// ─────────────────────────────────────────────────────────────────────────────

const memoryStore = new Map<string, { expiresAt: number; data: unknown }>();

export async function cachedJson<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const entry = memoryStore.get(key);
  if (entry && entry.expiresAt > now) {
    return entry.data as T;
  }
  const data = await fetcher();
  memoryStore.set(key, { expiresAt: now + ttlSeconds * 1000, data });
  return data;
}
