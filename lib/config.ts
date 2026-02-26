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

  // Discount tokens
  BNKR: {
    address: '0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b' as `0x${string}`,
    symbol: 'BNKR',
    chain: 'base',
    discount: 0.10, // 10% off premium names
  },

  CLAWDIA: {
    address: '0xbbd9aDe16525acb4B336b6dAd3b9762901522B07' as `0x${string}`,
    symbol: 'CLAWDIA',
    chain: 'base',
    discount: 0.25, // 25% off premium names
  },
} as const;

export const ENS = {
  // Our ENS domain (owned by Clawdia's Bankr wallet: 0x615e3faa99dd7de64812128a953215a09509f16a)
  DOMAIN: 'bankrclub.eth',
  OWNER: '0x615e3faa99dd7de64812128a953215a09509f16a' as `0x${string}`,
} as const;

export const PRICING = {
  // Free names: 6+ characters
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

/**
 * Bankr Partner Integration
 *
 * The Bankr Partner API (https://api.bankr.bot/token-launches/deploy) allows
 * registered partners to launch tokens with custom fee routing.
 *
 * Fee split with a valid partner key:
 *   - 57% → token creator (the ENS registrant)
 *   - 23% → Bankr protocol
 *   - 10% → partner (BankrClub ENS)
 *   - 5%  → ecosystem
 *   - 5%  → protocol liquidity
 *
 * Without a partner key (BANKR_PARTNER_KEY=pending), all launches run in
 * simulateOnly mode — safe for dev/testing, no real tokens deployed.
 *
 * To get a partner key: DM @0xDeployer on X or Farcaster.
 */
export const BANKR = {
  API_URL: 'https://api.bankr.bot/token-launches/deploy',
} as const;
