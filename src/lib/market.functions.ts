// ─────────────────────────────────────────────────────────────────────────────
// market.functions.ts — versão SPA (sem createServerFn / Cloudflare cache)
// Faz fetch direto das APIs públicas no browser.
// ─────────────────────────────────────────────────────────────────────────────
import { logger } from '@/lib/logger';

const COIN_IDS = [
  'bitcoin', 'ethereum', 'tether', 'binancecoin', 'solana',
  'usd-coin', 'ripple', 'cardano', 'avalanche-2', 'dogecoin',
  'shiba-inu', 'chainlink', 'polkadot', 'polygon', 'bitcoin-cash',
  'near', 'litecoin', 'uniswap', 'toncoin', 'staked-ether',
].join(',');

const SYMBOL_MAP: Record<string, string> = {
  bitcoin: 'BTC', ethereum: 'ETH', tether: 'USDT',
  binancecoin: 'BNB', solana: 'SOL', 'usd-coin': 'USDC',
  ripple: 'XRP', cardano: 'ADA', 'avalanche-2': 'AVAX',
  dogecoin: 'DOGE', 'shiba-inu': 'SHIB', chainlink: 'LINK',
  polkadot: 'DOT', polygon: 'MATIC', 'bitcoin-cash': 'BCH',
  near: 'NEAR', litecoin: 'LTC', uniswap: 'UNI',
  toncoin: 'TON', 'staked-ether': 'STETH',
};

export interface CoinPriceDTO {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: number | null;
  volume24h: number;
  high24h: number;
  low24h: number;
}

export interface GlobalMetricsDTO {
  totalMarketCap: number;
  totalVolume: number;
  btcDominance: number;
  marketCapChange24h: number;
}

export interface FearGreedDTO {
  value: number;
  label: string;
}

export async function getCoinPrices(): Promise<CoinPriceDTO[]> {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COIN_IDS}&order=market_cap_desc&per_page=20&page=1&price_change_percentage=24h&sparkline=false`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data = await res.json();
    return (data as any[]).map((c) => ({
      id: c.id,
      symbol: SYMBOL_MAP[c.id] ?? c.symbol.toUpperCase(),
      name: c.name,
      price: c.current_price ?? 0,
      change24h: c.price_change_percentage_24h ?? 0,
      marketCap: c.market_cap ?? null,
      volume24h: c.total_volume ?? 0,
      high24h: c.high_24h ?? 0,
      low24h: c.low_24h ?? 0,
    }));
  } catch (e) {
    logger.error('[market.functions] getCoinPrices', e);
    return [];
  }
}

export async function getGlobalMetrics(): Promise<GlobalMetricsDTO | null> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/global');
    if (!res.ok) throw new Error(`CoinGecko global ${res.status}`);
    const { data } = await res.json();
    return {
      totalMarketCap: data.total_market_cap?.usd ?? 0,
      totalVolume: data.total_volume?.usd ?? 0,
      btcDominance: data.market_cap_percentage?.btc ?? 0,
      marketCapChange24h: data.market_cap_change_percentage_24h_usd ?? 0,
    };
  } catch (e) {
    logger.error('[market.functions] getGlobalMetrics', e);
    return null;
  }
}

export async function getFearGreed(): Promise<FearGreedDTO | null> {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1');
    if (!res.ok) throw new Error(`FearGreed ${res.status}`);
    const { data } = await res.json();
    const item = data?.[0];
    if (!item) return null;
    return { value: Number(item.value), label: item.value_classification };
  } catch (e) {
    logger.error('[market.functions] getFearGreed', e);
    return null;
  }
}
