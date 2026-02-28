// GET /api/registrations?limit=20
// Returns recent registrations for the social proof feed.
// Public endpoint — address truncated, no sensitive data.
import { NextRequest, NextResponse } from 'next/server';
import { getRecentRegistrations, getRegistrationCount } from '@/lib/db';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const runtime = 'edge';

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  const limitParam = req.nextUrl.searchParams.get('limit');
  const limit = Math.min(Math.max(parseInt(limitParam ?? '20', 10) || 20, 1), 50);

  try {
    const [registrations, count] = await Promise.all([
      getRecentRegistrations(limit),
      getRegistrationCount(),
    ]);

    const items = registrations.map((r) => ({
      subdomain: r.subdomain as string,
      ens: `${r.subdomain}.bankrclub.eth`,
      address: truncateAddress(r.address as string),
      hasToken: !!(r.bankr_token_address),
      tokenSymbol: (r.bankr_token_symbol as string) ?? null,
      tokenAddress: (r.bankr_token_address as string) ?? null,
      registeredAt: r.registered_at,
    }));

    return NextResponse.json({ count, items }, { headers: corsHeaders });
  } catch (e) {
    console.error('Registrations fetch failed:', e);
    return NextResponse.json(
      { error: 'failed to fetch registrations' },
      { status: 500, headers: corsHeaders },
    );
  }
}

function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
