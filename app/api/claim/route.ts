import { NextRequest, NextResponse } from 'next/server';
import { checkAvailability, createRegistration, updateTokenInfo, getRegistrationByAddress } from '@/lib/db';
import { verifyBankrClubHolder } from '@/lib/nftVerify';
import { launchToken, FeeRecipient, FeeRecipientType } from '@/lib/bankrApi';
import { announceRegistration } from '@/lib/neynar';
import { getNftImage } from '@/lib/nftMeta';
import {
  LAUNCH_ERROR_MESSAGES,
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
const PINATA_GATEWAY_HOST = 'gateway.pinata.cloud';
const PINATA_GATEWAY_PATH_PREFIX = '/ipfs/';

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
    // Build fee recipient — non-wallet types use the user-supplied value
    const feeRecipient: FeeRecipient =
      recipientType === 'wallet'
        ? { type: 'wallet', value: address }
        : { type: recipientType, value: normalizedFeeRecipientValue };

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

    const { data: bankrResult, error: launchError } = await launchToken(name, address, {
      feeRecipient,
      tweetUrl: validatedTweetUrl,
      image: tokenImage,
    });

    if (launchError) {
      // Registration succeeded but token launch failed — return success with a warning
      tokenInfo = {
        error: LAUNCH_ERROR_MESSAGES[launchError] ?? LAUNCH_ERROR_MESSAGES.unknown,
      };
    } else if (bankrResult?.success) {
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
