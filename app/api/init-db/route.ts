import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
  // Only allow in dev or with secret
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DB_INIT) {
    return NextResponse.json({ error: 'not allowed in production' }, { status: 403 });
  }

  await sql`
    CREATE TABLE IF NOT EXISTS registrations (
      id SERIAL PRIMARY KEY,
      subdomain VARCHAR(255) UNIQUE NOT NULL,
      address VARCHAR(42) NOT NULL,
      token_id INTEGER,
      bankr_token_address VARCHAR(42),
      bankr_token_symbol VARCHAR(10),
      bankr_pool_id VARCHAR(66),
      bankr_tx_hash VARCHAR(66),
      registered_at TIMESTAMP DEFAULT NOW(),
      is_premium BOOLEAN DEFAULT FALSE,
      premium_paid_eth DECIMAL(18,8)
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_subdomain ON registrations(subdomain)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_address ON registrations(address)`;

  return NextResponse.json({ ok: true, message: 'DB initialized' });
}
