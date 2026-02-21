import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { CONTRACTS } from './config';

const client = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export interface TokenBalances {
  bnkr: bigint;
  clawdia: bigint;
  hasBnkr: boolean;
  hasClawdia: boolean;
}

export async function getDiscountTokenBalances(address: string): Promise<TokenBalances> {
  try {
    const [bnkr, clawdia] = await Promise.all([
      client
        .readContract({
          address: CONTRACTS.BNKR.address,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address as `0x${string}`],
        })
        .catch(() => 0n),
      client
        .readContract({
          address: CONTRACTS.CLAWDIA.address,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address as `0x${string}`],
        })
        .catch(() => 0n),
    ]);
    return {
      bnkr,
      clawdia,
      hasBnkr: bnkr > 0n,
      hasClawdia: clawdia > 0n,
    };
  } catch {
    return { bnkr: 0n, clawdia: 0n, hasBnkr: false, hasClawdia: false };
  }
}
