// POST /api/agent-claim
// Headers: X-SIWA-Receipt (bearer receipt from /api/siwa/verify)
// Body: { subdomain, launchTokenOnBankr?, feeRecipientType?, feeRecipientValue?, tweetUrl?, logoUrl? }
// Authenticates via SIWA receipt instead of wallet connect, then follows same flow as /api/claim
import { NextRequest, NextResponse } from 'next/server';
import { verifyReceipt } from '@buildersgarden/siwa/receipt';
import {
  checkAvailability,
  createRegistration,
  getRegistrationByAddress,
} from '@/lib/db';
import { verifyBankrClubHolder } from '@/lib/nftVerify';
import { FeeRecipientType } from '@/lib/bankrApi';
import { announceRegistration } from '@/lib/neynar';
import { launchClaimToken } from '@/lib/tokenLaunch';
import {
  getPremiumPrice,
  isPremiumName,
  validateName,
} from '@/lib/registration';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-SIWA-Receipt',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

const VALID_FEE_RECIPIENT_TYPES: FeeRecipientType[] = ['wallet', 'x', 'farcaster', 'ens'];

export async function POST(req: NextRequest) {
  // --- SIWA Receipt Auth ---
  const receiptToken = req.headers.get('x-siwa-receipt');
  if (!receiptToken) {
    return NextResponse.json(
      { error: 'X-SIWA-Receipt header required' },
      { status: 401, headers: corsHeaders },
    );
  }

  const secret = process.env.RECEIPT_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'server misconfigured: RECEIPT_SECRET not set' },
      { status: 500, headers: corsHeaders },
    );
  }

  const receiptPayload = verifyReceipt(receiptToken, secret);
  if (!receiptPayload) {
    return NextResponse.json(
      { error: 'invalid or expired SIWA receipt' },
      { status: 401, headers: corsHeaders },
    );
  }

  const address = receiptPayload.address;

  // --- Parse body ---
  const body = await req.json();
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

  // Validate name format
  const validation = validateName(name);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.reason },
      { status: 400, headers: corsHeaders },
    );
  }

  // Validate fee recipient type if provided
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

  // Validate tweetUrl if provided
  let validatedTweetUrl: string | undefined;
  if (tweetUrl && typeof tweetUrl === 'string') {
    try {
      const u = new URL(tweetUrl);
      const normalizedHostname = u.hostname.toLowerCase().replace(/^www\./, '');
      if (normalizedHostname === 'x.com' || normalizedHostname === 'twitter.com') {
        validatedTweetUrl = tweetUrl;
      }
    } catch {
      // Invalid URL — ignore silently
    }
  }

  // Verify BankrClub NFT ownership (address from SIWA receipt)
  const { isHolder, tokenId } = await verifyBankrClubHolder(address);
  if (!isHolder) {
    return NextResponse.json(
      { error: 'BankrClub NFT required' },
      { status: 403, headers: corsHeaders },
    );
  }

  // Enforce one-per-wallet restriction
  try {
    const existingRegistration = await getRegistrationByAddress(address);
    if (existingRegistration) {
      return NextResponse.json(
        { error: 'one name per wallet - you already have a registration' },
        { status: 409, headers: corsHeaders },
      );
    }
  } catch (e) {
    console.error('Wallet check failed:', e);
    return NextResponse.json(
      { error: 'wallet check failed' },
      { status: 500, headers: corsHeaders },
    );
  }

  // Check availability
  try {
    const available = await checkAvailability(name);
    if (!available) {
      return NextResponse.json(
        { error: 'name already taken' },
        { status: 409, headers: corsHeaders },
      );
    }
  } catch (e) {
    console.error('DB check failed:', e);
    return NextResponse.json(
      { error: 'availability check failed' },
      { status: 500, headers: corsHeaders },
    );
  }

  // Block premium names (same as /api/claim)
  const isPremium = isPremiumName(name);
  const basePrice = isPremium ? getPremiumPrice(name) : 0;
  if (isPremium) {
    console.log(`Agent premium claim: ${name} | base=${basePrice} ETH`);
    return NextResponse.json(
      { error: 'premium names (8 characters or less) require payment verification - coming soon' },
      { status: 400, headers: corsHeaders },
    );
  }

  // Register
  let registration: Record<string, unknown>;
  try {
    registration = await createRegistration({
      subdomain: name,
      address,
      tokenId,
      isPremium,
      paymentToken: 'ETH',
    });
  } catch (e) {
    console.error('Registration failed:', e);
    return NextResponse.json(
      { error: 'registration failed' },
      { status: 500, headers: corsHeaders },
    );
  }

  // Fire-and-forget Neynar announcement (agent emoji 🤖)
  announceRegistration(name, address, true).catch(() => {});

  // Optional: launch token on Bankr
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
