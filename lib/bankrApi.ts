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

export async function launchToken(
  subdomain: string,
  holderAddress: string,
  options?: TokenLaunchOptions
): Promise<BankrDeployResponse | null> {
  const partnerKey = process.env.BANKR_PARTNER_KEY;
  const simulateOnly = !partnerKey || partnerKey === 'pending';

  const feeRecipient: FeeRecipient = options?.feeRecipient ?? {
    type: 'wallet',
    value: holderAddress,
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
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('Bankr API error:', res.status, err);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error('Bankr API fetch failed:', e);
    return null;
  }
}
