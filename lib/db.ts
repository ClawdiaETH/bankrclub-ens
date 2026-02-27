import { neon } from '@neondatabase/serverless';

// Lazy connection — only initializes when actually queried (not at module load)
function getDb() {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error('POSTGRES_URL not set');
  return neon(url);
}

export type RegistrationConflictReason = 'ADDRESS_TAKEN' | 'PAYMENT_TX_USED';

export class RegistrationConflictError extends Error {
  reason: RegistrationConflictReason;

  constructor(reason: RegistrationConflictReason) {
    super(reason);
    this.name = 'RegistrationConflictError';
    this.reason = reason;
  }
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
    WITH wallet_lock AS (
      SELECT pg_advisory_xact_lock(hashtext(lower(${data.address}::text)))
    ),
    inserted AS (
      INSERT INTO registrations (subdomain, address, token_id, is_premium, payment_token, premium_paid_eth)
      SELECT
        ${data.subdomain},
        ${data.address},
        ${data.tokenId ?? null},
        ${data.isPremium || false},
        ${data.paymentToken || 'ETH'},
        ${data.premiumPaidEth ?? null}
      FROM wallet_lock
      WHERE NOT EXISTS (
        SELECT 1 FROM registrations WHERE LOWER(address) = LOWER(${data.address})
      )
      RETURNING *
    )
    SELECT * FROM inserted
  `;
  if (rows.length === 0) {
    throw new RegistrationConflictError('ADDRESS_TAKEN');
  }
  return rows[0];
}

export async function createPremiumRegistration(data: {
  subdomain: string;
  address: string;
  tokenId?: number;
  isPremium?: boolean;
  paymentToken?: string;
  premiumPaidEth?: number;
  paymentTxHash: string;
}) {
  const sql = getDb();
  const txHash = data.paymentTxHash.toLowerCase();
  const rows = await sql`
    WITH wallet_lock AS (
      SELECT pg_advisory_xact_lock(hashtext(lower(${data.address}::text)))
    ),
    wallet_free AS (
      SELECT 1 AS ok
      FROM wallet_lock
      WHERE NOT EXISTS (
        SELECT 1 FROM registrations WHERE LOWER(address) = LOWER(${data.address})
      )
    ),
    tx_insert AS (
      INSERT INTO payment_txhashes (tx_hash, address, name, created_at)
      SELECT ${txHash}, ${data.address.toLowerCase()}, ${data.subdomain}, NOW()
      FROM wallet_free
      ON CONFLICT (tx_hash) DO NOTHING
      RETURNING tx_hash
    ),
    registration_insert AS (
      INSERT INTO registrations (subdomain, address, token_id, is_premium, payment_token, premium_paid_eth)
      SELECT
        ${data.subdomain},
        ${data.address},
        ${data.tokenId ?? null},
        ${data.isPremium || false},
        ${data.paymentToken || 'ETH'},
        ${data.premiumPaidEth ?? null}
      FROM tx_insert
      RETURNING *
    )
    SELECT
      CASE
        WHEN (SELECT COUNT(*) FROM wallet_free) = 0 THEN 'ADDRESS_TAKEN'
        WHEN (SELECT COUNT(*) FROM tx_insert) = 0 THEN 'PAYMENT_TX_USED'
        ELSE 'OK'
      END AS outcome,
      (SELECT row_to_json(registration_insert) FROM registration_insert LIMIT 1) AS registration
  `;

  const result = rows[0] as { outcome: 'OK' | RegistrationConflictReason; registration: Record<string, unknown> | null } | undefined;
  if (!result || result.outcome !== 'OK' || !result.registration) {
    const reason: RegistrationConflictReason =
      result?.outcome === 'PAYMENT_TX_USED' ? 'PAYMENT_TX_USED' : 'ADDRESS_TAKEN';
    throw new RegistrationConflictError(reason);
  }

  return result.registration;
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
  await sql`DELETE FROM siwa_nonces WHERE created_at <= NOW() - INTERVAL '5 minutes'`;
  await sql`INSERT INTO siwa_nonces (nonce, created_at) VALUES (${nonce}, NOW())
    ON CONFLICT (nonce) DO UPDATE SET created_at = NOW()`;
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
