// ─────────────────────────────────────────────────────────────────────────────
// signals.functions.ts — versão SPA (sem createServerFn do Lovable)
// Busca sinais diretamente do backend NestJS via apiClient (REST).
// ─────────────────────────────────────────────────────────────────────────────
import { api } from '@/adapters/backend/api.adapter';

export interface SignalListItemDTO {
  id: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  confidence: number;
  entry: number;
  sl?: number;
  tp?: number;
  state: 'active' | 'closed' | 'pending';
  tf?: string;
  exchange?: string;
  createdAt?: string;
}

export async function getSignalsList(): Promise<SignalListItemDTO[]> {
  try {
    return await api.get<SignalListItemDTO[]>('/signals');
  } catch {
    return [];
  }
}
