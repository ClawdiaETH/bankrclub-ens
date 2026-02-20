import { NextRequest, NextResponse } from 'next/server';
import { checkAvailability } from '@/lib/db';

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
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const validation = validateName(name);
  if (!validation.valid) {
    return NextResponse.json({ available: false, reason: validation.reason });
  }

  const isPremium = name.length <= 5;
  let available = false;
  try {
    available = await checkAvailability(name);
  } catch {
    // DB not set up yet — assume available for dev
    available = true;
  }

  return NextResponse.json({
    available,
    isPremium,
    price: isPremium
      ? name.length === 3
        ? 0.05
        : name.length === 4
        ? 0.02
        : 0.01
      : 0,
    name,
  });
}
