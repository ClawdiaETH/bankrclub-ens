import { createWalletClient, createPublicClient, http, namehash, labelhash } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';

// ENS NameWrapper on Ethereum mainnet
const NAME_WRAPPER = '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401' as const;
// Our CCIP-Read resolver — keeps offchain resolution working
const RESOLVER = '0x3a62109CCAd858907A5750b906618eA7B433d3a3' as const;
// bankrclub.eth expiry in NameWrapper (matched to parent registration)
const PARENT_EXPIRY = BigInt(1781156915);

const NAME_WRAPPER_ABI = [
  {
    name: 'setSubnodeRecord',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'parentNode', type: 'bytes32' },
      { name: 'label',      type: 'string'  },
      { name: 'owner',      type: 'address' },
      { name: 'resolver',   type: 'address' },
      { name: 'ttl',        type: 'uint64'  },
      { name: 'fuses',      type: 'uint32'  },
      { name: 'expiry',     type: 'uint64'  },
    ],
    outputs: [{ name: 'node', type: 'bytes32' }],
  },
] as const;

/**
 * Create an on-chain ENS subdomain for `{label}.bankrclub.eth`.
 * Sets the owner to the registrant's wallet and resolver to our CCIP-Read resolver.
 * Makes the name visible in app.ens.domains and tradeable as an ERC-1155 NFT.
 *
 * Returns the transaction hash, or throws on failure.
 */
export async function createSubnodeOnchain(
  label: string,
  ownerAddress: string
): Promise<string> {
  const privateKey = process.env.SIGNING_KEY as `0x${string}` | undefined;
  if (!privateKey) throw new Error('SIGNING_KEY not configured');

  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http('https://ethereum.publicnode.com'),
  });

  const walletClient = createWalletClient({
    account,
    chain: mainnet,
    transport: http('https://ethereum.publicnode.com'),
  });

  const parentNode = namehash('bankrclub.eth') as `0x${string}`;

  const { request } = await publicClient.simulateContract({
    address: NAME_WRAPPER,
    abi: NAME_WRAPPER_ABI,
    functionName: 'setSubnodeRecord',
    args: [
      parentNode,
      label,
      ownerAddress as `0x${string}`,
      RESOLVER,
      BigInt(0),  // TTL
      0,          // fuses — no restrictions
      PARENT_EXPIRY,
    ],
    account,
  });

  const txHash = await walletClient.writeContract(request);
  console.log(`ENS subdomain created on-chain: ${label}.bankrclub.eth → ${txHash}`);
  return txHash;
}
