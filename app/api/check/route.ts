import { NextRequest, NextResponse } from 'next/server';
import { checkAvailability } from '@/lib/db';
import { validateName } from '@/lib/validation';

export const dynamic = 'force-dynamic';

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

  const isPremium = name.length <= 5;
  let available = false;
  try {
    available = await checkAvailability(name);
  } catch {
    // DB not set up yet — assume available for dev
    available = true;
  }

  const basePrice = isPremium
    ? name.length === 3
      ? 0.05
      : name.length === 4
      ? 0.02
      : 0.01
    : 0;

  return NextResponse.json(
    {
      available,
      isPremium,
      price: basePrice,
      prices: isPremium
        ? {
            eth: basePrice,
            bnkr: parseFloat((basePrice * 0.9).toFixed(4)),     // 10% off
            clawdia: parseFloat((basePrice * 0.75).toFixed(4)), // 25% off
          }
        : null,
      name,
    },
    { headers: corsHeaders }
  );
}
