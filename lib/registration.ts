import { PRICING } from './config';

export type PaymentToken = 'ETH' | 'BNKR' | 'CLAWDIA';

export const LAUNCH_ERROR_MESSAGES: Record<string, string> = {
  rate_limited: 'Token launch limit reached for today — try again tomorrow',
  api_error: 'Bankr API error — your name is registered, token launch failed',
  timeout: 'Bankr API timed out — your name is registered, token launch failed',
  unknown: 'Token launch failed — your name is registered',
};

const RESERVED = [
  'bankr', 'admin', 'www', 'api', 'app', 'mail',
  'help', 'support', 'team', 'clawdia',
];

export function validateName(name: string): { valid: boolean; reason?: string } {
  if (!name || name.length < 3) return { valid: false, reason: 'minimum 3 characters' };
  if (name.length > 32) return { valid: false, reason: 'maximum 32 characters' };
  if (!/^[a-z0-9-]+$/.test(name))
    return { valid: false, reason: 'lowercase letters, numbers, hyphens only' };
  if (name.startsWith('-') || name.endsWith('-'))
    return { valid: false, reason: 'cannot start or end with hyphen' };
  if (RESERVED.includes(name)) return { valid: false, reason: 'reserved name' };
  return { valid: true };
}

export function isPremiumName(name: string): boolean {
  return name.length < PRICING.FREE_MIN_LENGTH;
}

export function getPremiumPrice(nameOrLength: string | number): number {
  const len = typeof nameOrLength === 'string' ? nameOrLength.length : nameOrLength;
  if (len === 3) return PRICING.PREMIUM.THREE_CHAR;
  if (len === 4) return PRICING.PREMIUM.FOUR_CHAR;
  if (len === 5) return PRICING.PREMIUM.FIVE_CHAR;
  if (len === 6) return PRICING.PREMIUM.SIX_CHAR;
  if (len === 7) return PRICING.PREMIUM.SEVEN_CHAR;
  return PRICING.PREMIUM.EIGHT_CHAR;
}

export function getDiscountRate(token: PaymentToken): number {
  if (token === 'ETH') return 0;
  return PRICING.DISCOUNTS[token];
}

export function getDiscountedPremiumPrice(basePrice: number, token: PaymentToken): number {
  return parseFloat((basePrice * (1 - getDiscountRate(token))).toFixed(4));
}
