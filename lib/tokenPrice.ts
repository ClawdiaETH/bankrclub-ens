import { parseUnits } from 'viem';

/**
 * Fetch token price in ETH from DexScreener (Base chain).
 * Returns price of 1 token in ETH (priceNative).
 */
export async function getTokenPriceInEth(tokenAddress: string): Promise<number> {
  const res = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
    { next: { revalidate: 30 } } // 30s cache on server
  );
  if (!res.ok) throw new Error(`DexScreener error: ${res.status}`);
  const data = await res.json() as {
    pairs?: Array<{ chainId: string; priceNative: string; liquidity?: { usd: number } }>;
  };
  const basePairs = (data.pairs ?? []).filter(p => p.chainId === 'base');
  if (!basePairs.length) throw new Error('No Base pairs found for token');
  // Use highest-liquidity pair
  basePairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
  const price = parseFloat(basePairs[0].priceNative);
  if (!price || isNaN(price)) throw new Error('Invalid price data');
  return price;
}

export const BNKR_ADDRESS = '0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b';
export const CLAWDIA_ADDRESS = '0xbbd9aDe16525acb4B336b6dAd3b9762901522B07';
export const TOKEN_DECIMALS = 18;

/** ERC20 Transfer event topic */
export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

/** Calculate token amount (in whole tokens) needed to equal ethAmount */
export function calcTokenAmount(ethAmount: number, tokenPriceInEth: number): number {
  return ethAmount / tokenPriceInEth;
}

/** Convert token amount to bigint with 18 decimals */
export function toTokenWei(tokenAmount: number): bigint {
  if (!Number.isFinite(tokenAmount) || tokenAmount < 0) {
    throw new Error('Invalid token amount');
  }
  const normalized = tokenAmount.toLocaleString('en-US', {
    useGrouping: false,
    maximumFractionDigits: TOKEN_DECIMALS,
  });
  return parseUnits(normalized, TOKEN_DECIMALS);
}
