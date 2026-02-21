import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const BANKRCLUB_NFT = '0x9FAb8C51f911f0ba6dab64fD6E979BcF6424Ce82';

const client = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

const ERC721_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'tokenOfOwnerByIndex',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export async function verifyBankrClubHolder(
  address: string
): Promise<{ isHolder: boolean; tokenId?: number }> {
  try {
    const balance = await client.readContract({
      address: BANKRCLUB_NFT as `0x${string}`,
      abi: ERC721_ABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    });

    if (balance === 0n) return { isHolder: false };

    // Try to get first token ID (contract may not support enumerable)
    try {
      const tokenId = await client.readContract({
        address: BANKRCLUB_NFT as `0x${string}`,
        abi: ERC721_ABI,
        functionName: 'tokenOfOwnerByIndex',
        args: [address as `0x${string}`, 0n],
      });
      return { isHolder: true, tokenId: Number(tokenId) };
    } catch {
      return { isHolder: true }; // Has NFT but can't get specific tokenId
    }
  } catch {
    return { isHolder: false };
  }
}
