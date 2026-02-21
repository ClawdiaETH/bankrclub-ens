import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.POSTGRES_URL!);

// Schema (run once via /api/init-db):
// CREATE TABLE IF NOT EXISTS registrations (
//   id SERIAL PRIMARY KEY,
//   subdomain VARCHAR(255) UNIQUE NOT NULL,
//   address VARCHAR(42) NOT NULL,
//   token_id INTEGER,
//   bankr_token_address VARCHAR(42),
//   bankr_token_symbol VARCHAR(10),
//   bankr_pool_id VARCHAR(66),
//   bankr_tx_hash VARCHAR(66),
//   registered_at TIMESTAMP DEFAULT NOW(),
//   is_premium BOOLEAN DEFAULT FALSE,
//   premium_paid_eth DECIMAL(18,8),
//   payment_token VARCHAR(10) DEFAULT 'ETH'
// );

export async function checkAvailability(subdomain: string): Promise<boolean> {
  const rows = await sql`SELECT id FROM registrations WHERE subdomain = ${subdomain}`;
  return rows.length === 0;
}

export async function getRegistration(subdomain: string) {
  const rows = await sql`SELECT * FROM registrations WHERE subdomain = ${subdomain}`;
  return rows[0] || null;
}

export async function getRegistrationByAddress(address: string) {
  const rows = await sql`SELECT * FROM registrations WHERE LOWER(address) = LOWER(${address}) LIMIT 1`;
  return rows[0] || null;
}

export async function createRegistration(data: {
  subdomain: string;
  address: string;
  tokenId?: number;
  isPremium?: boolean;
  paymentToken?: string;
  premiumPaidEth?: number;
}) {
  const rows = await sql`
    INSERT INTO registrations (subdomain, address, token_id, is_premium, payment_token, premium_paid_eth)
    VALUES (
      ${data.subdomain},
      ${data.address},
      ${data.tokenId || null},
      ${data.isPremium || false},
      ${data.paymentToken || 'ETH'},
      ${data.premiumPaidEth || null}
    )
    RETURNING *
  `;
  return rows[0];
}

export async function updateTokenInfo(
  subdomain: string,
  tokenInfo: {
    bankrTokenAddress: string;
    bankrTokenSymbol: string;
    bankrPoolId: string;
    bankrTxHash: string;
  }
) {
  await sql`
    UPDATE registrations SET
      bankr_token_address = ${tokenInfo.bankrTokenAddress},
      bankr_token_symbol = ${tokenInfo.bankrTokenSymbol},
      bankr_pool_id = ${tokenInfo.bankrPoolId},
      bankr_tx_hash = ${tokenInfo.bankrTxHash}
    WHERE subdomain = ${subdomain}
  `;
}

export async function getRecentRegistrations(limit = 10) {
  const rows = await sql`
    SELECT subdomain, address, bankr_token_address, bankr_token_symbol, registered_at
    FROM registrations ORDER BY registered_at DESC LIMIT ${limit}
  `;
  return rows;
}
