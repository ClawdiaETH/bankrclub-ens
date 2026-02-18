/**
 * BankrClub ENS Configuration
 */

export const CONTRACTS = {
  // BankrClub NFT on Base
  BANKRCLUB_NFT: {
    address: '0x9FAb8C51f911f0ba6dab64fD6E979BcF6424Ce82' as `0x${string}`,
    chain: 'base',
    chainId: 8453,
  },

  // Tokens for payment
  BNKR: {
    address: '0x...' as `0x${string}`, // TODO: Get $BNKR address
    chain: 'base',
    discount: 0.10, // 10% off
  },

  CLAWDIA: {
    address: '0xbbd9aDe16525acb4B336b6dAd3b9762901522B07' as `0x${string}`,
    chain: 'base',
    discount: 0.25, // 25% off
  },
} as const;

export const ENS = {
  // Our ENS domain (owned by Clawdia's Bankr wallet)
  DOMAIN: 'bankrclub.eth',
  OWNER: '0x615e3faa99dd7de64812128a953215a09509f16a' as `0x${string}`,
} as const;

export const PRICING = {
  // Free names: 6+ characters, non-dictionary
  FREE_MIN_LENGTH: 6,

  // Premium name pricing (in ETH)
  PREMIUM: {
    THREE_CHAR: 0.05,
    FOUR_CHAR: 0.02,
    FIVE_CHAR: 0.01,
    DICTIONARY: 0.01, // Minimum for dictionary words
  },
} as const;

export const CHAINS = {
  BASE: {
    id: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
  },
  ETHEREUM: {
    id: 1,
    name: 'Ethereum',
    rpcUrl: 'https://eth.llamarpc.com',
  },
} as const;
