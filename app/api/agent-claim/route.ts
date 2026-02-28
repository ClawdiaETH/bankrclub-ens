// POST /api/agent-claim
//
// Auth option A — SIWA receipt (ERC-8004 registered agents):
//   Headers: X-SIWA-Receipt <receipt from /api/siwa/verify>
//   Body:    { subdomain, ...opts }
//
// Auth option B — raw personal_sign (any agent with a private key, e.g. Bankr wallets):
//   Body:    { address, nonce, signature, subdomain, ...opts }
//   1. GET /api/agent-claim?address=0x...  → { nonce, message }
//   2. Sign the returned `message` string with personal_sign (EIP-191)
//   3. POST with { address, nonce, signature, subdomain }
//
// Both paths verify BankrClub NFT ownership and follow the same registration flow.

import { NextRequest, NextResponse } from 'next/server';
import { verifyReceipt } from '@buildersgarden/siwa/receipt';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import {
  checkAvailability,
  consumeNonce,
  createRegistration,
  getRegistrationByAddress,
  RegistrationConflictError,
  storeNonce,
} from '@/lib/db';
import { verifyBankrClubHolder } from '@/lib/nftVerify';
import { FeeRecipientType } from '@/lib/bankrApi';
import { announceRegistration } from '@/lib/neynar';
import { createSubnodeOnchain } from '@/lib/ensSubdomain';
import { launchClaimToken } from '@/lib/tokenLaunch';
import {
  getPremiumPrice,
  isPremiumName,
  validateName,
} from '@/lib/registration';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-SIWA-Receipt',
};

const viemClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

// ── GET /api/agent-claim?address=0x... ──────────────────────────────────────
// Issues a nonce for personal_sign auth. Nonce expires in 5 minutes.
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return NextResponse.json(
      { error: 'valid EVM address required (?address=0x...)' },
      { status: 400, headers: corsHeaders },
    );
  }

  // Reuse the siwa_nonces table (same 5-min TTL cleanup)
  const nonce = crypto.randomUUID();
  await storeNonce(nonce);

  const message = buildSignMessage(address, nonce);

  return NextResponse.json(
    { nonce, message, expiresIn: 300 },
    { headers: corsHeaders },
  );
}

// ── POST /api/agent-claim ────────────────────────────────────────────────────
const VALID_FEE_RECIPIENT_TYPES: FeeRecipientType[] = ['wallet', 'x', 'farcaster', 'ens'];

export async function POST(req: NextRequest) {
  const body = await req.json();

  // ── Auth: determine address ──────────────────────────────────────────────
  let address: string;

  const receiptToken = req.headers.get('x-siwa-receipt');

  if (receiptToken) {
    // Option A: SIWA receipt (ERC-8004 registered agents)
    const secret = process.env.RECEIPT_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'server misconfigured: RECEIPT_SECRET not set' },
        { status: 500, headers: corsHeaders },
      );
    }
    const payload = verifyReceipt(receiptToken, secret);
    if (!payload) {
      return NextResponse.json(
        { error: 'invalid or expired SIWA receipt' },
        { status: 401, headers: corsHeaders },
      );
    }
    address = payload.address;
  } else {
    // Option B: raw personal_sign
    const { address: rawAddress, nonce, signature } = body;

    if (!rawAddress || !nonce || !signature) {
      return NextResponse.json(
        {
          error:
            'authentication required — provide X-SIWA-Receipt header (SIWA) or {address, nonce, signature} body (personal_sign)',
        },
        { status: 401, headers: corsHeaders },
      );
    }

    if (!/^0x[0-9a-fA-F]{40}$/.test(rawAddress)) {
      return NextResponse.json(
        { error: 'invalid address format' },
        { status: 400, headers: corsHeaders },
      );
    }

    // Consume nonce (one-time use, 5-min TTL)
    const nonceValid = await consumeNonce(nonce);
    if (!nonceValid) {
      return NextResponse.json(
        { error: 'nonce invalid or expired — request a fresh nonce from GET /api/agent-claim?address=...' },
        { status: 401, headers: corsHeaders },
      );
    }

    // Verify the personal_sign signature (EIP-191)
    const message = buildSignMessage(rawAddress, nonce);
    let valid = false;
    try {
      valid = await viemClient.verifyMessage({
        address: rawAddress as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });
    } catch {
      // verifyMessage throws on malformed sig
    }

    if (!valid) {
      return NextResponse.json(
        { error: 'signature verification failed — sign the exact message returned by GET /api/agent-claim?address=...' },
        { status: 401, headers: corsHeaders },
      );
    }

    address = rawAddress;
  }

  // ── Parse opts ───────────────────────────────────────────────────────────
  const {
    subdomain,
    launchTokenOnBankr,
    feeRecipientType,
    feeRecipientValue,
    tweetUrl,
    logoUrl,
  } = body;

  if (!subdomain) {
    return NextResponse.json(
      { error: 'subdomain required' },
      { status: 400, headers: corsHeaders },
    );
  }

  const name = subdomain.toLowerCase().trim();

  const validation = validateName(name);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.reason },
      { status: 400, headers: corsHeaders },
    );
  }

  const recipientType: FeeRecipientType =
    feeRecipientType && VALID_FEE_RECIPIENT_TYPES.includes(feeRecipientType)
      ? feeRecipientType
      : 'wallet';
  const normalizedFeeRecipientValue =
    typeof feeRecipientValue === 'string' ? feeRecipientValue.trim() : '';

  if (launchTokenOnBankr && recipientType !== 'wallet' && !normalizedFeeRecipientValue) {
    return NextResponse.json(
      { error: 'fee recipient value required for selected type' },
      { status: 400, headers: corsHeaders },
    );
  }

  let validatedTweetUrl: string | undefined;
  if (tweetUrl && typeof tweetUrl === 'string') {
    try {
      const u = new URL(tweetUrl);
      const host = u.hostname.toLowerCase().replace(/^www\./, '');
      if (host === 'x.com' || host === 'twitter.com') validatedTweetUrl = tweetUrl;
    } catch {
      // ignore invalid URL
    }
  }

  // ── BankrClub NFT check ──────────────────────────────────────────────────
  const { isHolder, tokenId } = await verifyBankrClubHolder(address);
  if (!isHolder) {
    return NextResponse.json(
      { error: 'BankrClub NFT required' },
      { status: 403, headers: corsHeaders },
    );
  }

  // ── One-per-wallet ───────────────────────────────────────────────────────
  try {
    const existing = await getRegistrationByAddress(address);
    if (existing) {
      return NextResponse.json(
        { error: 'one name per wallet — you already have a registration' },
        { status: 409, headers: corsHeaders },
      );
    }
  } catch {
    return NextResponse.json(
      { error: 'wallet check failed' },
      { status: 500, headers: corsHeaders },
    );
  }

  // ── Availability ─────────────────────────────────────────────────────────
  try {
    const available = await checkAvailability(name);
    if (!available) {
      return NextResponse.json(
        { error: 'name already taken' },
        { status: 409, headers: corsHeaders },
      );
    }
  } catch {
    return NextResponse.json(
      { error: 'availability check failed' },
      { status: 500, headers: corsHeaders },
    );
  }

  // ── Block premium names for agents (no payment flow yet) ─────────────────
  const isPremium = isPremiumName(name);
  if (isPremium) {
    const price = getPremiumPrice(name);
    return NextResponse.json(
      {
        error: 'premium names (8 characters or fewer) require on-chain payment — use the web UI at bankrclub.eth.limo',
        code: 'PAYMENT_REQUIRED',
        price,
      },
      { status: 402, headers: corsHeaders },
    );
  }

  // ── Register ─────────────────────────────────────────────────────────────
  let registration: Record<string, unknown>;
  try {
    registration = await createRegistration({
      subdomain: name,
      address,
      tokenId,
      isPremium: false,
      paymentToken: 'ETH',
    });
  } catch (e) {
    if (e instanceof RegistrationConflictError && e.reason === 'ADDRESS_TAKEN') {
      return NextResponse.json(
        { error: 'one name per wallet — you already have a registration' },
        { status: 409, headers: corsHeaders },
      );
    }
    console.error('Registration failed:', e);
    return NextResponse.json(
      { error: 'registration failed' },
      { status: 500, headers: corsHeaders },
    );
  }

  // ── Side effects (fire-and-forget) ───────────────────────────────────────
  announceRegistration(name, address, true).catch(() => {});
  createSubnodeOnchain(name, address).catch((e) =>
    console.error(`ENS on-chain subdomain failed for ${name}:`, e),
  );

  // ── Optional token launch ────────────────────────────────────────────────
  let tokenInfo = null;
  if (launchTokenOnBankr) {
    tokenInfo = await launchClaimToken({
      name,
      address,
      tokenId,
      recipientType,
      feeRecipientValue: normalizedFeeRecipientValue,
      tweetUrl: validatedTweetUrl,
      logoUrl,
    });
  }

  return NextResponse.json(
    {
      success: true,
      subdomain: name,
      address,
      ens: `${name}.bankrclub.eth`,
      tokenInfo,
      _registration: registration?.id,
    },
    { headers: corsHeaders },
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildSignMessage(address: string, nonce: string): string {
  return (
    `bankrclub.eth agent registration\n\n` +
    `I am registering a bankrclub.eth subdomain.\n` +
    `Address: ${address}\n` +
    `Nonce: ${nonce}`
  );
}
