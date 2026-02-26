import { neon } from '@neondatabase/serverless';

// Lazy connection — only initializes when actually queried (not at module load)
function getDb() {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error('POSTGRES_URL not set');
  return neon(url);
}

export async function checkAvailability(subdomain: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`SELECT id FROM registrations WHERE subdomain = ${subdomain}`;
  return rows.length === 0;
}

export async function getRegistration(subdomain: string) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM registrations WHERE subdomain = ${subdomain}`;
  return rows[0] || null;
}

export async function getRegistrationByAddress(address: string) {
  const sql = getDb();
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
  const sql = getDb();
  const rows = await sql`
    INSERT INTO registrations (subdomain, address, token_id, is_premium, payment_token, premium_paid_eth)
    VALUES (
      ${data.subdomain},
      ${data.address},
      ${data.tokenId ?? null},
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
  const sql = getDb();
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
  const sql = getDb();
  const rows = await sql`
    SELECT subdomain, address, bankr_token_address, bankr_token_symbol, registered_at
    FROM registrations ORDER BY registered_at DESC LIMIT ${limit}
  `;
  return rows;
}

// SIWA nonce store (5-min TTL, serverless-safe via Postgres)
export async function storeNonce(nonce: string): Promise<void> {
  const sql = getDb();
  await sql`INSERT INTO siwa_nonces (nonce, created_at) VALUES (${nonce}, NOW())
    ON CONFLICT (nonce) DO NOTHING`;
}

export async function consumeNonce(nonce: string): Promise<boolean> {
  const sql = getDb();
  // Returns true if nonce exists and is < 5 minutes old, then deletes it
  const rows = await sql`
    DELETE FROM siwa_nonces WHERE nonce = ${nonce}
    AND created_at > NOW() - INTERVAL '5 minutes'
    RETURNING nonce`;
  return rows.length > 0;
}
