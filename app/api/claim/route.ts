import { NextRequest, NextResponse } from 'next/server';
import { checkAvailability, createRegistration, getRegistrationByAddress, isPaymentTxUsed, markPaymentTxUsed } from '@/lib/db';
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
    /** On-chain tx hash proving ETH payment was sent to treasury (premium names only) */
    paymentTxHash,
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
    const TREASURY = '0xf17b5dD382B048Ff4c05c1C9e4E24cfC5C6adAd9';
    const BASE_RPC = 'https://mainnet.base.org';

    if (!paymentTxHash || typeof paymentTxHash !== 'string') {
      return NextResponse.json(
        { error: `premium name — send ${discountedPrice} ETH to treasury first`, code: 'PAYMENT_REQUIRED', price: discountedPrice },
        { status: 402, headers: corsHeaders }
      );
    }

    // Check replay protection
    const alreadyUsed = await isPaymentTxUsed(paymentTxHash);
    if (alreadyUsed) {
      return NextResponse.json(
        { error: 'payment tx already used for another registration' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify on Base
    const rpcRes = await fetch(BASE_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionByHash', params: [paymentTxHash] }),
    });
    const { result: tx } = await rpcRes.json() as { result: { to: string; from: string; value: string; blockNumber: string } | null };

    if (!tx || !tx.blockNumber) {
      return NextResponse.json({ error: 'payment tx not found or not yet confirmed on Base' }, { status: 400, headers: corsHeaders });
    }
    if (tx.to?.toLowerCase() !== TREASURY.toLowerCase()) {
      return NextResponse.json({ error: 'payment sent to wrong address' }, { status: 400, headers: corsHeaders });
    }
    if (tx.from?.toLowerCase() !== address.toLowerCase()) {
      return NextResponse.json({ error: 'payment must be sent from your connected wallet' }, { status: 400, headers: corsHeaders });
    }

    const requiredWei = BigInt(Math.floor(discountedPrice * 1e18));
    const paidWei = BigInt(tx.value);
    if (paidWei < requiredWei) {
      return NextResponse.json(
        { error: `insufficient payment — required ${discountedPrice} ETH, received ${Number(paidWei) / 1e18} ETH` },
        { status: 400, headers: corsHeaders }
      );
    }

    await markPaymentTxUsed(paymentTxHash, address, name);
    console.log(`Premium claim: ${name} | paid=${Number(paidWei) / 1e18} ETH | tx=${paymentTxHash}`);
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
