import { NextRequest, NextResponse } from 'next/server';
import { checkAvailability, createRegistration, updateTokenInfo } from '@/lib/db';
import { verifyBankrClubHolder } from '@/lib/nftVerify';
import { launchToken } from '@/lib/bankrApi';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { subdomain, address, launchTokenOnBankr } = body;

  if (!subdomain || !address) {
    return NextResponse.json({ error: 'subdomain and address required' }, { status: 400 });
  }

  const name = subdomain.toLowerCase().trim();

  // Verify NFT ownership
  const { isHolder, tokenId } = await verifyBankrClubHolder(address);
  if (!isHolder) {
    return NextResponse.json({ error: 'BankrClub NFT required' }, { status: 403 });
  }

  // Check availability
  try {
    const available = await checkAvailability(name);
    if (!available) {
      return NextResponse.json({ error: 'name already taken' }, { status: 409 });
    }
  } catch (e) {
    console.error('DB check failed:', e);
  }

  // Register
  let registration: Record<string, unknown>;
  try {
    registration = await createRegistration({
      subdomain: name,
      address,
      tokenId,
      isPremium: name.length <= 5,
    });
  } catch (e) {
    console.error('Registration failed:', e);
    return NextResponse.json({ error: 'registration failed' }, { status: 500 });
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

  return NextResponse.json({
    success: true,
    subdomain: name,
    address,
    ens: `${name}.bankrclub.eth`,
    tokenInfo,
  });
}
