const BANKR_API_URL = 'https://api.bankr.bot/token-launches/deploy';

interface BankrDeployRequest {
  tokenName: string;
  tokenSymbol: string;
  description?: string;
  image?: string;
  websiteUrl?: string;
  feeRecipient: { type: 'wallet'; value: string };
  simulateOnly?: boolean;
}

interface BankrDeployResponse {
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

export async function launchToken(
  subdomain: string,
  holderAddress: string
): Promise<BankrDeployResponse | null> {
  const partnerKey = process.env.BANKR_PARTNER_KEY;
  const simulateOnly = !partnerKey || partnerKey === 'pending';

  const payload: BankrDeployRequest = {
    tokenName: subdomain.charAt(0).toUpperCase() + subdomain.slice(1),
    tokenSymbol: subdomain.toUpperCase().slice(0, 10),
    description: `Personal token for ${subdomain}.bankrclub.eth — BankrClub member`,
    websiteUrl: `https://${subdomain}.bankrclub.eth.limo`,
    feeRecipient: { type: 'wallet', value: holderAddress },
    simulateOnly,
  };

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
