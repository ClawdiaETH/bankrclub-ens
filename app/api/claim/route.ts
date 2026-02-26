import { NextRequest, NextResponse } from 'next/server';
import { checkAvailability, createRegistration, getRegistrationByAddress } from '@/lib/db';
import { verifyBankrClubHolder } from '@/lib/nftVerify';
import { FeeRecipientType } from '@/lib/bankrApi';
import { announceRegistration } from '@/lib/neynar';
import { launchClaimToken } from '@/lib/tokenLaunch';
import {
  PaymentToken,
  getDiscountedPremiumPrice,
  getPremiumPrice,
  isPremiumName,
  validateName,
} from '@/lib/registration';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

const VALID_FEE_RECIPIENT_TYPES: FeeRecipientType[] = ['wallet', 'x', 'farcaster', 'ens'];

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    subdomain,
    address,
    launchTokenOnBankr,
    paymentToken,
    // Fee recipient — where trading fees go (defaults to connected wallet)
    feeRecipientType,
    feeRecipientValue,
    // Optional metadata for the Bankr token launch
    tweetUrl,
    /** Pre-uploaded IPFS URL for the token logo (user's custom image) */
    logoUrl,
  } = body;

  if (!subdomain || !address) {
    return NextResponse.json(
      { error: 'subdomain and address required' },
      { status: 400, headers: corsHeaders }
    );
  }

  const name = subdomain.toLowerCase().trim();
  const token: PaymentToken =
    paymentToken === 'BNKR' || paymentToken === 'CLAWDIA' ? paymentToken : 'ETH';

  // Validate name format
  const validation = validateName(name);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.reason },
      { status: 400, headers: corsHeaders }
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
      { status: 400, headers: corsHeaders }
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

  // Verify NFT ownership
  const { isHolder, tokenId } = await verifyBankrClubHolder(address);
  if (!isHolder) {
    return NextResponse.json({ error: 'BankrClub NFT required' }, { status: 403, headers: corsHeaders });
  }

  // Enforce one-per-wallet restriction
  try {
    const existingRegistration = await getRegistrationByAddress(address);
    if (existingRegistration) {
      return NextResponse.json(
        { error: 'one name per wallet - you already have a registration' },
        { status: 409, headers: corsHeaders }
      );
    }
  } catch (e) {
    console.error('Wallet check failed:', e);
    return NextResponse.json({ error: 'wallet check failed' }, { status: 500, headers: corsHeaders });
  }

  // Check availability
  try {
    const available = await checkAvailability(name);
    if (!available) {
      return NextResponse.json({ error: 'name already taken' }, { status: 409, headers: corsHeaders });
    }
  } catch (e) {
    console.error('DB check failed:', e);
    return NextResponse.json({ error: 'availability check failed' }, { status: 500, headers: corsHeaders });
  }

  // Calculate discounted price for logging
  const isPremium = isPremiumName(name);
  const basePrice = isPremium ? getPremiumPrice(name) : 0;
  const discountedPrice = getDiscountedPremiumPrice(basePrice, token);

  if (isPremium) {
    console.log(
      `Premium claim: ${name} | base=${basePrice} ETH | token=${token} | paid=${discountedPrice} ETH`
    );
    return NextResponse.json(
      { error: 'premium names (8 characters or less) require payment verification - coming soon' },
      { status: 400, headers: corsHeaders }
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
      paymentToken: token,
      premiumPaidEth: isPremium ? discountedPrice : undefined,
    });
  } catch (e) {
    console.error('Registration failed:', e);
    return NextResponse.json({ error: 'registration failed' }, { status: 500, headers: corsHeaders });
  }

  // Fire-and-forget Neynar announcement (non-blocking)
  announceRegistration(name, address, false).catch(() => {});

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
      paymentToken: token,
      tokenInfo,
      _registration: registration?.id,
    },
    { headers: corsHeaders }
  );
}
