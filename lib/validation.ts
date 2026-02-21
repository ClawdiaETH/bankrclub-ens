export const RESERVED = [
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
