const BANKR_API_URL = 'https://api.bankr.bot/token-launches/deploy';

export type FeeRecipientType = 'wallet' | 'x' | 'farcaster' | 'ens';

export interface FeeRecipient {
  type: FeeRecipientType;
  value: string;
}

interface BankrDeployRequest {
  tokenName: string;
  tokenSymbol: string;
  description?: string;
  image?: string;
  tweetUrl?: string;
  websiteUrl?: string;
  feeRecipient: FeeRecipient;
  simulateOnly?: boolean;
}

export interface BankrDeployResponse {
  success: boolean;
  tokenAddress: string;
  poolId: string;
  txHash?: string;
  activityId: string;
  chain: string;
  simulated?: boolean;
  feeDistribution: {
    creator: { address: string; bps: number };
    bankr: { address: string; bps: number };
    partner: { address: string; bps: number };
    ecosystem: { address: string; bps: number };
    protocol: { address: string; bps: number };
  };
}

export interface TokenLaunchOptions {
  /** Where trading fees go — defaults to { type: 'wallet', value: holderAddress } */
  feeRecipient?: FeeRecipient;
  /** URL to an existing tweet about the token */
  tweetUrl?: string;
  /** URL to token logo image (uploaded to IPFS by Bankr) */
  image?: string;
}

export type LaunchError = 'rate_limited' | 'api_error' | 'timeout' | 'unknown';

export interface LaunchResult {
  data: BankrDeployResponse | null;
  error?: LaunchError;
}

/** Strip @ prefix from Twitter/X handles — Bankr expects bare username */
function normalizeXHandle(value: string): string {
  return value.startsWith('@') ? value.slice(1) : value;
}

function normalizeFeeRecipientValue(type: FeeRecipientType, value: string): string {
  if (type === 'x') return normalizeXHandle(value.trim());
  return value.trim();
}

export async function launchToken(
  subdomain: string,
  holderAddress: string,
  options?: TokenLaunchOptions
): Promise<LaunchResult> {
  const partnerKey = process.env.BANKR_PARTNER_KEY;
  const simulateOnly = !partnerKey || partnerKey === 'pending';

  const rawFeeRecipient = options?.feeRecipient ?? { type: 'wallet' as FeeRecipientType, value: holderAddress };
  const feeRecipient: FeeRecipient = {
    type: rawFeeRecipient.type,
    value: normalizeFeeRecipientValue(rawFeeRecipient.type, rawFeeRecipient.value),
  };

  const payload: BankrDeployRequest = {
    tokenName: subdomain.charAt(0).toUpperCase() + subdomain.slice(1),
    tokenSymbol: subdomain.toUpperCase().slice(0, 10),
    description: `Personal token for ${subdomain}.bankrclub.eth — BankrClub member`,
    websiteUrl: `https://${subdomain}.bankrclub.eth.limo`,
    feeRecipient,
    simulateOnly,
  };

  if (options?.tweetUrl) payload.tweetUrl = options.tweetUrl;
  if (options?.image) payload.image = options.image;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (partnerKey && partnerKey !== 'pending') {
    headers['X-Partner-Key'] = partnerKey;
  }

  try {
    const res = await fetch(BANKR_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000), // 15s — avoid hanging the claim endpoint
    });

    if (res.status === 429) {
      console.error('Bankr API rate limit hit (50 deploys/24h)');
      return { data: null, error: 'rate_limited' };
    }

    if (!res.ok) {
      const err = await res.text();
      console.error('Bankr API error:', res.status, err);
      return { data: null, error: 'api_error' };
    }

    return { data: await res.json() };
  } catch (e) {
    if (e instanceof Error && e.name === 'TimeoutError') {
      console.error('Bankr API timed out after 15s');
      return { data: null, error: 'timeout' };
    }
    console.error('Bankr API fetch failed:', e);
    return { data: null, error: 'unknown' };
  }
}
