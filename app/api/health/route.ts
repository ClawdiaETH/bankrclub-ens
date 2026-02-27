import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
};

export async function GET() {
  const checks: Record<string, string> = {};

  // DB connectivity
  try {
    const sql = getDb();
    const result = await sql`SELECT COUNT(*) AS count FROM registrations`;
    checks.db = `ok (${result[0].count} registrations)`;
  } catch (e) {
    checks.db = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Env vars present
  checks.bankrPartnerKey = process.env.BANKR_PARTNER_KEY ? 'set' : 'MISSING';
  checks.neynarApiKey = process.env.NEYNAR_API_KEY ? 'set' : 'MISSING';
  checks.signingKey = process.env.SIGNING_KEY ? 'set' : 'MISSING';
  checks.postgresUrl = process.env.POSTGRES_URL ? 'set' : 'MISSING';

  const allOk = checks.db.startsWith('ok') &&
    checks.bankrPartnerKey === 'set' &&
    checks.neynarApiKey === 'set' &&
    checks.signingKey === 'set' &&
    checks.postgresUrl === 'set';

  return NextResponse.json(
    { status: allOk ? 'ok' : 'degraded', checks, ts: new Date().toISOString() },
    { status: allOk ? 200 : 503, headers: corsHeaders }
  );
}
