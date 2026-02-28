import { BankrDeployResponse, FeeRecipient, FeeRecipientType, launchToken } from '@/lib/bankrApi';
import { updateTokenInfo } from '@/lib/db';
import { getNftImage } from '@/lib/nftMeta';
import { LAUNCH_ERROR_MESSAGES } from '@/lib/registration';

const PINATA_GATEWAY_HOST = 'gateway.pinata.cloud';
const PINATA_GATEWAY_PATH_PREFIX = '/ipfs/';

export type ClaimTokenInfo =
  | { error: string }
  | {
      tokenAddress: string;
      tokenSymbol: string;
      poolId: string;
      txHash?: string;
      simulated?: boolean;
      feeDistribution: BankrDeployResponse['feeDistribution'];
      feeRecipient: FeeRecipient;
    };

export interface LaunchClaimTokenParams {
  name: string;
  address: string;
  tokenId?: number | bigint | null;
  recipientType: FeeRecipientType;
  feeRecipientValue: string;
  tweetUrl?: string;
  logoUrl?: string;
}

function getPinataImageUrl(logoUrl?: string): string | undefined {
  if (!logoUrl) return undefined;
  try {
    const u = new URL(logoUrl);
    const isPinnedPinataUrl =
      u.protocol === 'https:' &&
      u.hostname === PINATA_GATEWAY_HOST &&
      u.pathname.startsWith(PINATA_GATEWAY_PATH_PREFIX);
    if (isPinnedPinataUrl) return logoUrl;
  } catch {
    // Ignore invalid logo URL.
  }
  return undefined;
}

export async function launchClaimToken({
  name,
  address,
  tokenId,
  recipientType,
  feeRecipientValue,
  tweetUrl,
  logoUrl,
}: LaunchClaimTokenParams): Promise<ClaimTokenInfo | null> {
  const feeRecipient: FeeRecipient =
    recipientType === 'wallet'
      ? { type: 'wallet', value: address }
      : { type: recipientType, value: feeRecipientValue };

  const tokenImage = getPinataImageUrl(logoUrl) ?? (await getNftImage(tokenId));

  const { data: bankrResult, error: launchError } = await launchToken(name, address, {
    feeRecipient,
    tweetUrl,
    image: tokenImage,
  });

  if (launchError) {
    return {
      error: LAUNCH_ERROR_MESSAGES[launchError] ?? LAUNCH_ERROR_MESSAGES.unknown,
    };
  }

  if (!bankrResult?.success) return null;

  const tokenSymbol = name.toUpperCase().slice(0, 10);
  try {
    await updateTokenInfo(name, {
      bankrTokenAddress: bankrResult.tokenAddress,
      bankrTokenSymbol: tokenSymbol,
      bankrPoolId: bankrResult.poolId,
      bankrTxHash: bankrResult.txHash || '',
    });
  } catch (e) {
    console.error('Failed to store token info:', e);
  }

  return {
    tokenAddress: bankrResult.tokenAddress,
    tokenSymbol,
    poolId: bankrResult.poolId,
    txHash: bankrResult.txHash,
    simulated: bankrResult.simulated,
    feeDistribution: bankrResult.feeDistribution,
    feeRecipient,
  };
}
