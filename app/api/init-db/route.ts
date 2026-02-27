import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';


export async function GET() {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DB_INIT) {
    return NextResponse.json({ error: 'not allowed in production' }, { status: 403 });
  }
  const sql = neon(process.env.POSTGRES_URL!);
  await sql`CREATE TABLE IF NOT EXISTS registrations (
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
    premium_paid_eth DECIMAL(18,8),
    payment_token VARCHAR(10) DEFAULT 'ETH'
  )`;
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS payment_token VARCHAR(10) DEFAULT 'ETH'`;
  await sql`CREATE INDEX IF NOT EXISTS idx_subdomain ON registrations(subdomain)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_address ON registrations(address)`;
  await sql`CREATE TABLE IF NOT EXISTS siwa_nonces (
    nonce TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS payment_txhashes (
    tx_hash TEXT PRIMARY KEY,
    claimer TEXT NOT NULL,
    subdomain TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`ALTER TABLE payment_txhashes ADD COLUMN IF NOT EXISTS claimer TEXT`;
  await sql`ALTER TABLE payment_txhashes ADD COLUMN IF NOT EXISTS subdomain TEXT`;
  return NextResponse.json({ ok: true, message: 'DB initialized' });
}
