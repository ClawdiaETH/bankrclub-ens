import { NextRequest, NextResponse } from 'next/server';
import { checkAvailability, createRegistration, updateTokenInfo, getRegistrationByAddress } from '@/lib/db';
import { verifyBankrClubHolder } from '@/lib/nftVerify';
import { launchToken, FeeRecipient, FeeRecipientType } from '@/lib/bankrApi';
import { getNftImage } from '@/lib/nftMeta';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

type PaymentToken = 'ETH' | 'BNKR' | 'CLAWDIA';

const DISCOUNT: Record<PaymentToken, number> = {
  ETH: 0,
  BNKR: 0.10,
  CLAWDIA: 0.25,
};

const RESERVED = [
  'bankr', 'admin', 'www', 'api', 'app', 'mail',
  'help', 'support', 'team', 'clawdia',
];

const VALID_FEE_RECIPIENT_TYPES: FeeRecipientType[] = ['wallet', 'x', 'farcaster', 'ens'];
const PINATA_GATEWAY_HOST = 'gateway.pinata.cloud';
const PINATA_GATEWAY_PATH_PREFIX = '/ipfs/';

function validateName(name: string): { valid: boolean; reason?: string } {
  if (!name || name.length < 3) return { valid: false, reason: 'minimum 3 characters' };
  if (name.length > 32) return { valid: false, reason: 'maximum 32 characters' };
  if (!/^[a-z0-9-]+$/.test(name))
    return { valid: false, reason: 'lowercase letters, numbers, hyphens only' };
  if (name.startsWith('-') || name.endsWith('-'))
    return { valid: false, reason: 'cannot start or end with hyphen' };
  if (RESERVED.includes(name)) return { valid: false, reason: 'reserved name' };
  return { valid: true };
}

function getPremiumPrice(name: string): number {
  if (name.length === 3) return 0.05;
  if (name.length === 4) return 0.02;
  return 0.01;
}

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

  // Validate tweetUrl if provided
  let validatedTweetUrl: string | undefined;
  if (tweetUrl && typeof tweetUrl === 'string') {
    try {
      const u = new URL(tweetUrl);
      if (u.hostname === 'x.com' || u.hostname === 'twitter.com') {
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
  const isPremium = name.length <= 5;
  const basePrice = isPremium ? getPremiumPrice(name) : 0;
  const discountedPrice = parseFloat((basePrice * (1 - DISCOUNT[token])).toFixed(4));

  if (isPremium) {
    console.log(
      `Premium claim: ${name} | base=${basePrice} ETH | token=${token} | paid=${discountedPrice} ETH`
    );
    return NextResponse.json(
      { error: 'premium names (5 characters or less) require payment verification - coming soon' },
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

  // Optional: launch token on Bankr
  let tokenInfo = null;
  if (launchTokenOnBankr) {
    const normalizedFeeRecipientValue =
      typeof feeRecipientValue === 'string' ? feeRecipientValue.trim() : '';

    // Build fee recipient — non-wallet types use the user-supplied value
    const feeRecipient: FeeRecipient =
      recipientType === 'wallet'
        ? { type: 'wallet', value: address }
        : { type: recipientType, value: normalizedFeeRecipientValue || address };

    // Determine token logo: prefer user-uploaded URL, fall back to NFT art
    let tokenImage: string | undefined;
    if (logoUrl && typeof logoUrl === 'string') {
      // Validate it's the Pinata gateway URL returned by /api/upload
      try {
        const u = new URL(logoUrl);
        const isPinnedPinataUrl =
          u.protocol === 'https:' &&
          u.hostname === PINATA_GATEWAY_HOST &&
          u.pathname.startsWith(PINATA_GATEWAY_PATH_PREFIX);
        if (isPinnedPinataUrl) tokenImage = logoUrl;
      } catch { /* ignore invalid */ }
    }
    if (!tokenImage) {
      tokenImage = await getNftImage(tokenId);
    }

    const bankrResult = await launchToken(name, address, {
      feeRecipient,
      tweetUrl: validatedTweetUrl,
      image: tokenImage,
    });

    if (bankrResult?.success) {
      tokenInfo = {
        tokenAddress: bankrResult.tokenAddress,
        tokenSymbol: name.toUpperCase().slice(0, 10),
        poolId: bankrResult.poolId,
        txHash: bankrResult.txHash,
        simulated: bankrResult.simulated,
        feeDistribution: bankrResult.feeDistribution,
        feeRecipient,
      };
      try {
        await updateTokenInfo(name, {
          bankrTokenAddress: bankrResult.tokenAddress,
          bankrTokenSymbol: name.toUpperCase().slice(0, 10),
          bankrPoolId: bankrResult.poolId,
          bankrTxHash: bankrResult.txHash || '',
        });
      } catch (e) {
        console.error('Failed to store token info:', e);
      }
    }
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
