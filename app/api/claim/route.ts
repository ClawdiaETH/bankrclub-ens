import { NextRequest, NextResponse } from 'next/server';
import { checkAvailability, createRegistration, updateTokenInfo } from '@/lib/db';
import { verifyBankrClubHolder } from '@/lib/nftVerify';
import { launchToken } from '@/lib/bankrApi';

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

function getPremiumPrice(name: string): number {
  if (name.length === 3) return 0.05;
  if (name.length === 4) return 0.02;
  return 0.01;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { subdomain, address, launchTokenOnBankr, paymentToken } = body;

  if (!subdomain || !address) {
    return NextResponse.json(
      { error: 'subdomain and address required' },
      { status: 400, headers: corsHeaders }
    );
  }

  const name = subdomain.toLowerCase().trim();
  const token: PaymentToken =
    paymentToken === 'BNKR' || paymentToken === 'CLAWDIA' ? paymentToken : 'ETH';

  // Verify NFT ownership
  const { isHolder, tokenId } = await verifyBankrClubHolder(address);
  if (!isHolder) {
    return NextResponse.json({ error: 'BankrClub NFT required' }, { status: 403, headers: corsHeaders });
  }

  // Check availability
  try {
    const available = await checkAvailability(name);
    if (!available) {
      return NextResponse.json({ error: 'name already taken' }, { status: 409, headers: corsHeaders });
    }
  } catch (e) {
    console.error('DB check failed:', e);
  }

  // Calculate discounted price for logging
  const isPremium = name.length <= 5;
  const basePrice = isPremium ? getPremiumPrice(name) : 0;
  const discountedPrice = parseFloat((basePrice * (1 - DISCOUNT[token])).toFixed(4));

  if (isPremium) {
    console.log(
      `Premium claim: ${name} | base=${basePrice} ETH | token=${token} | paid=${discountedPrice} ETH`
    );
  }

  // TODO Phase 2: verify on-chain payment before registering premium names
  // For now, record payment intent and trust frontend validation

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
    const bankrResult = await launchToken(name, address);
    if (bankrResult?.success) {
      tokenInfo = {
        tokenAddress: bankrResult.tokenAddress,
        tokenSymbol: bankrResult.tokenAddress ? name.toUpperCase() : null,
        poolId: bankrResult.poolId,
        txHash: bankrResult.txHash,
        simulated: bankrResult.simulated,
        feeDistribution: bankrResult.feeDistribution,
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
      // Suppress unused variable warning
      _registration: registration?.id,
    },
    { headers: corsHeaders }
  );
}
