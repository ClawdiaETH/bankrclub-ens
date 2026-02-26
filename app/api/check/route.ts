import { NextRequest, NextResponse } from 'next/server';
import { checkAvailability } from '@/lib/db';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

const RESERVED = [
  'bankr', 'admin', 'www', 'api', 'app', 'mail',
  'help', 'support', 'team', 'clawdia',
];

function validateName(name: string): { valid: boolean; reason?: string } {
  if (!name || name.length < 3) return { valid: false, reason: 'minimum 3 characters' };
  if (name.length > 32) return { valid: false, reason: 'maximum 32 characters' };
  if (!/^[a-z0-9-]+$/.test(name))
    return { valid: false, reason: 'lowercase letters, numbers, hyphens only' };
  if (name.startsWith('-') || name.endsWith('-'))
    return { valid: false, reason: 'cannot start or end with hyphen' };
  if (RESERVED.includes(name)) return { valid: false, reason: 'reserved name' };
  return { valid: true };
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

  const isPremium = name.length <= 8;
  let available = false;
  try {
    available = await checkAvailability(name);
  } catch {
    // DB not set up yet — assume available for dev
    available = true;
  }

  function getPremiumPrice(len: number): number {
    if (len === 3) return 0.05;
    if (len === 4) return 0.02;
    if (len === 5) return 0.01;
    if (len === 6) return 0.005;
    if (len === 7) return 0.003;
    return 0.002; // 8 chars
  }

  const basePrice = isPremium ? getPremiumPrice(name.length) : 0;

  return NextResponse.json(
    {
      available,
      isPremium,
      price: basePrice,
      prices: isPremium
        ? {
            eth:     basePrice,
            bnkr:    parseFloat((basePrice * 0.90).toFixed(4)),  // 10% off
            clawdia: parseFloat((basePrice * 0.75).toFixed(4)),  // 25% off
          }
        : null,
      name,
    },
    { headers: corsHeaders }
  );
}
