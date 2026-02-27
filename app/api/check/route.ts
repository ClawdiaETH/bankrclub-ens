import { NextRequest, NextResponse } from 'next/server';
import { checkAvailability } from '@/lib/db';
import {
  getDiscountedPremiumPrice,
  getPremiumPrice,
  isPremiumName,
  validateName,
} from '@/lib/registration';

export const dynamic = process.env.NEXT_PUBLIC_IPFS_BUILD === 'true' ? 'auto' : 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')?.toLowerCase().trim();
  if (!name) {
    return NextResponse.json({ error: 'name required' }, { status: 400, headers: corsHeaders });
  }

  const validation = validateName(name);
  if (!validation.valid) {
    return NextResponse.json(
      { available: false, reason: validation.reason },
      { headers: corsHeaders }
    );
  }

  const isPremium = isPremiumName(name);
  let available = false;
  try {
    available = await checkAvailability(name);
  } catch {
    // DB not set up yet — assume available for dev
    available = true;
  }

  const basePrice = isPremium ? getPremiumPrice(name) : 0;

  return NextResponse.json(
    {
      available,
      isPremium,
      price: basePrice,
      prices: isPremium
        ? {
            eth: getDiscountedPremiumPrice(basePrice, 'ETH'),
            bnkr: getDiscountedPremiumPrice(basePrice, 'BNKR'),
            clawdia: getDiscountedPremiumPrice(basePrice, 'CLAWDIA'),
          }
        : null,
      name,
    },
    { headers: corsHeaders }
  );
}
