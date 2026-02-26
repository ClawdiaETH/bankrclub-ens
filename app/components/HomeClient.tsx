'use client';

import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useSendTransaction } from 'wagmi';
import { parseEther } from 'viem';
import TypewriterSubdomain from './TypewriterSubdomain';
import PaymentSelector, { PaymentToken } from './PaymentSelector';
import { getDiscountTokenBalances, TokenBalances } from '@/lib/tokenBalances';
import type { FeeRecipientType } from '@/lib/bankrApi';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

const BANKRCLUB_NFT = '0x9FAb8C51f911f0ba6dab64fD6E979BcF6424Ce82' as const;

const ERC721_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

interface AvailabilityResult {
  available: boolean;
  isPremium?: boolean;
  price?: number;
  prices?: { eth: number; bnkr: number; clawdia: number };
  reason?: string;
  name?: string;
}

interface FeeDistribution {
  creator: { address: string; bps: number };
  bankr: { address: string; bps: number };
  partner: { address: string; bps: number };
  ecosystem: { address: string; bps: number };
  protocol: { address: string; bps: number };
}

interface ClaimResult {
  success: boolean;
  subdomain: string;
  ens: string;
  address: string;
  paymentToken?: PaymentToken;
  tokenInfo?: {
    // Success
    tokenAddress?: string;
    tokenSymbol?: string;
    poolId?: string;
    txHash?: string;
    simulated?: boolean;
    feeDistribution?: FeeDistribution;
    feeRecipient?: { type: FeeRecipientType; value: string };
    // Error
    error?: string;
  } | null;
}

const FEE_RECIPIENT_OPTIONS: { type: FeeRecipientType; label: string; placeholder: string; hint: string }[] = [
  { type: 'wallet', label: 'My wallet', placeholder: '', hint: 'Fees go to your connected wallet' },
  { type: 'x', label: 'Twitter/X', placeholder: 'username (no @)', hint: 'Resolves to your Bankr wallet via X handle' },
  { type: 'farcaster', label: 'Farcaster', placeholder: 'username.eth or handle', hint: 'Resolves to your verified EVM address' },
  { type: 'ens', label: 'ENS', placeholder: 'yourname.eth', hint: 'Resolves to the underlying address' },
];

function bpsToPercent(bps: number) {
  return (bps / 100).toFixed(2).replace(/\.00$/, '');
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();

  const { data: nftBalance } = useReadContract({
    address: BANKRCLUB_NFT,
    abi: ERC721_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const isHolder = nftBalance !== undefined && nftBalance > 0n;

  // Claim form state
  const [name, setName] = useState('');
  const [availability, setAvailability] = useState<AvailabilityResult | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [launchToken, setLaunchToken] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Payment token state
  const [paymentToken, setPaymentToken] = useState<PaymentToken>('ETH');
  const [tokenBalances, setTokenBalances] = useState<TokenBalances | null>(null);

  // Fee recipient state
  const [feeRecipientType, setFeeRecipientType] = useState<FeeRecipientType>('wallet');
  const [feeRecipientValue, setFeeRecipientValue] = useState('');

  // Token logo state
  const [logoMode, setLogoMode] = useState<'nft' | 'custom'>('nft');
  const [customLogoUrl, setCustomLogoUrl] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Advanced options state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const pricingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPricing) return;
    const handler = (e: MouseEvent) => {
      if (pricingRef.current && !pricingRef.current.contains(e.target as Node)) {
        setShowPricing(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPricing]);
  const [tweetUrl, setTweetUrl] = useState('');

  useEffect(() => {
    return () => {
      if (logoPreview) {
        URL.revokeObjectURL(logoPreview);
      }
    };
  }, [logoPreview]);

  // Fetch discount token balances once wallet is verified as holder
  useEffect(() => {
    if (!address || !isHolder) {
      setTokenBalances(null);
      return;
    }
    getDiscountTokenBalances(address).then(setTokenBalances).catch(() => setTokenBalances(null));
  }, [address, isHolder]);

  // Reset state when wallet changes
  useEffect(() => {
    setPaymentToken('ETH');
    setFeeRecipientType('wallet');
    setFeeRecipientValue('');
  }, [address]);

  // Debounced availability check
  const checkAvailability = useCallback(async (n: string) => {
    if (!n || n.length < 3) {
      setAvailability(null);
      return;
    }
    setCheckingAvailability(true);
    try {
      const res = await fetch(`${API_BASE}/api/check?name=${encodeURIComponent(n)}`);
      const data = await res.json();
      setAvailability(data);
    } catch {
      setAvailability(null);
    } finally {
      setCheckingAvailability(false);
    }
  }, []);

  useEffect(() => {
    const trimmed = name.toLowerCase().trim();
    if (!trimmed) {
      setAvailability(null);
      return;
    }
    const timer = setTimeout(() => checkAvailability(trimmed), 500);
    return () => clearTimeout(timer);
  }, [name, checkAvailability]);

  // Compute displayed price
  const displayPrice = (() => {
    if (!availability?.isPremium || !availability.price) return null;
    if (availability.prices) {
      if (paymentToken === 'BNKR') return availability.prices.bnkr;
      if (paymentToken === 'CLAWDIA') return availability.prices.clawdia;
    }
    return availability.price;
  })();

  // Fee recipient validation only matters when token launch is enabled
  const feeRecipientValid =
    !launchToken ||
    feeRecipientType === 'wallet' ||
    (feeRecipientValue.trim().length > 0);

  const [claimStatus, setClaimStatus] = useState<string | null>(null);

  const handleClaim = async () => {
    if (!address || !availability?.available || !feeRecipientValid) return;
    setClaiming(true);
    setClaimError(null);
    setClaimStatus(null);

    let paymentTxHash: string | undefined;

    try {
      // Step 1: Send ETH payment for premium names
      if (availability.isPremium && displayPrice) {
        const TREASURY = '0xf17b5dD382B048Ff4c05c1C9e4E24cfC5C6adAd9';
        setClaimStatus(`Sending ${displayPrice} ETH payment…`);
        try {
          const hash = await sendTransactionAsync({
            to: TREASURY as `0x${string}`,
            value: parseEther(String(displayPrice)),
            chainId: 8453,
          });
          paymentTxHash = hash;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          setClaimError(msg.includes('rejected') || msg.includes('denied') ? 'Payment cancelled.' : `Payment failed: ${msg}`);
          return;
        }

        // Wait for confirmation on Base (~2s blocks)
        setClaimStatus('Confirming payment on Base…');
        for (let attempt = 0; attempt < 30; attempt++) {
          await new Promise(r => setTimeout(r, 2000));
          const rpc = await fetch('https://mainnet.base.org', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [paymentTxHash] }),
          });
          const { result } = await rpc.json() as { result: { status: string } | null };
          if (result?.status === '0x1') break;
          if (result?.status === '0x0') { setClaimError('Payment transaction failed on-chain.'); return; }
          if (attempt === 29) { setClaimError('Payment confirmation timed out — please try again.'); return; }
        }
      }

      // Step 2: Register
      setClaimStatus(launchToken ? 'Registering name and launching token…' : 'Registering name…');
      const res = await fetch(`${API_BASE}/api/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subdomain: name.toLowerCase().trim(),
          address,
          launchTokenOnBankr: launchToken,
          paymentToken,
          paymentTxHash,
          feeRecipientType,
          feeRecipientValue: feeRecipientType === 'wallet' ? address : feeRecipientValue.trim(),
          tweetUrl: tweetUrl.trim() || undefined,
          logoUrl: logoMode === 'custom' && customLogoUrl ? customLogoUrl : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setClaimError(data.error || 'Claim failed');
      } else {
        setClaimResult({ ...data, paymentToken });
      }
    } catch {
      setClaimError('Network error. Please try again.');
    } finally {
      setClaiming(false);
      setClaimStatus(null);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!address) {
      setUploadError('Connect wallet first');
      return;
    }
    setUploadError(null);
    setCustomLogoUrl('');
    setUploadingLogo(true);
    // Show local preview immediately
    setLogoPreview(URL.createObjectURL(file));
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('address', address);
      const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || 'Upload failed');
        setLogoPreview(null);
      } else {
        setCustomLogoUrl(data.url);
      }
    } catch {
      setUploadError('Network error during upload');
      setLogoPreview(null);
    } finally {
      setUploadingLogo(false);
    }
  };

  const discountLabel = (() => {
    if (claimResult?.paymentToken === 'BNKR') return 'Paid with $BNKR — 10% off!';
    if (claimResult?.paymentToken === 'CLAWDIA') return 'Paid with $CLAWDIA — 25% off!';
    return null;
  })();

  const selectedFeeOption = FEE_RECIPIENT_OPTIONS.find(o => o.type === feeRecipientType)!;

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      {/* Retro grid background */}
      <div className="fixed inset-0 bg-gradient-to-b from-purple-900/20 via-transparent to-orange-900/20 pointer-events-none" />
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center space-y-8 mb-16">
          <div className="flex justify-center mb-8">
            <img
              src="/assets/bankr-computer.gif"
              alt="BankrClub"
              className="w-64 h-auto drop-shadow-2xl"
            />
          </div>
          <TypewriterSubdomain />
          <p className="text-xl sm:text-2xl text-gray-300 max-w-2xl mx-auto">
            Your name. Your token. Your fees — forever.
          </p>
          <p className="text-base text-gray-500 max-w-xl mx-auto">
            BankrClub members get a free ENS subdomain + earn 57% of every trade on their personal token.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border border-gray-700 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-orange-600 p-1">
            <div className="bg-gray-900 p-8">
              <div className="flex flex-col md:flex-row items-center gap-6 mb-6">
                <img
                  src="/assets/bankr-card-1.gif"
                  alt="BankrClub Membership"
                  className="w-48 h-auto rounded-lg shadow-xl border-2 border-purple-500"
                />
                <div className="text-center md:text-left">
                  <h2 className="text-3xl font-bold text-white mb-2">
                    For BankrClub NFT holders
                  </h2>
                  <p className="text-orange-400 font-semibold">1,000 founding members only</p>
                </div>
              </div>
              <p className="text-gray-300 text-lg">
                Register{' '}
                <span className="font-mono text-blue-400 font-semibold">
                  yourname.bankrclub.eth
                </span>{' '}
                — your permanent web3 identity, free for BankrClub members.
              </p>
            </div>
          </div>

          {/* ── State: Success ── */}
          {claimResult && (
            <div className="p-8 space-y-6">
              <div className="text-center space-y-4">
                <div className="text-6xl">🎉</div>
                <h3 className="text-3xl font-bold text-white">You&apos;re registered!</h3>
                <div className="bg-gray-800 rounded-xl p-6 border border-purple-500">
                  <p className="text-gray-400 text-sm mb-2">Your ENS name</p>
                  <p className="text-3xl font-mono font-bold text-purple-400">
                    {claimResult.ens}
                  </p>
                </div>
                {discountLabel && (
                  <div className="bg-gray-800 rounded-xl p-4 border border-green-700">
                    <p className="text-green-400 font-semibold text-sm">💸 {discountLabel}</p>
                  </div>
                )}
                {claimResult.tokenInfo?.error && (
                  <div className="bg-gray-800 rounded-xl p-4 border border-yellow-700">
                    <p className="text-yellow-400 text-sm">⚠️ {claimResult.tokenInfo.error}</p>
                  </div>
                )}
                {claimResult.tokenInfo && !claimResult.tokenInfo.error && (
                  <div className="bg-gray-800 rounded-xl p-6 border border-orange-500 space-y-3 text-left">
                    <p className="text-orange-400 font-semibold text-center">
                      🚀 Token launched on Bankr!
                    </p>
                    {claimResult.tokenInfo.tokenAddress && (
                      <div>
                        <p className="text-gray-400 text-xs mb-1">Token address</p>
                        <a
                          href={`https://bankr.bot/launches/${claimResult.tokenInfo.tokenAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-orange-400 hover:text-orange-300 text-sm break-all underline transition-colors"
                        >
                          {claimResult.tokenInfo.tokenAddress}
                        </a>
                      </div>
                    )}
                    {claimResult.tokenInfo.feeRecipient && claimResult.tokenInfo.feeRecipient.type !== 'wallet' && (
                      <div>
                        <p className="text-gray-400 text-xs">Trading fees routed to</p>
                        <p className="text-white text-sm">
                          {claimResult.tokenInfo.feeRecipient.type === 'x' && '𝕏 '}
                          {claimResult.tokenInfo.feeRecipient.type === 'farcaster' && '🟣 '}
                          {claimResult.tokenInfo.feeRecipient.type === 'ens' && '🔷 '}
                          {claimResult.tokenInfo.feeRecipient.value}
                        </p>
                      </div>
                    )}
                    {claimResult.tokenInfo.feeDistribution && (
                      <div className="pt-2 border-t border-gray-700">
                        <p className="text-gray-400 text-xs mb-2">Fee distribution (1.2% per swap)</p>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <span className="text-gray-400">You (creator)</span>
                          <span className="text-green-400 font-semibold">
                            {bpsToPercent(claimResult.tokenInfo.feeDistribution.creator.bps)}%
                          </span>
                          <span className="text-gray-400">Partner</span>
                          <span className="text-orange-400">
                            {bpsToPercent(claimResult.tokenInfo.feeDistribution.partner.bps)}%
                          </span>
                          <span className="text-gray-400">Bankr</span>
                          <span className="text-gray-300">
                            {bpsToPercent(claimResult.tokenInfo.feeDistribution.bankr.bps)}%
                          </span>
                          <span className="text-gray-400">Ecosystem</span>
                          <span className="text-gray-300">
                            {bpsToPercent(claimResult.tokenInfo.feeDistribution.ecosystem.bps)}%
                          </span>
                          <span className="text-gray-400">Protocol</span>
                          <span className="text-gray-300">
                            {bpsToPercent(claimResult.tokenInfo.feeDistribution.protocol.bps)}%
                          </span>
                        </div>
                      </div>
                    )}
                    {claimResult.tokenInfo.tokenAddress && !claimResult.tokenInfo.simulated && (
                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <a
                          href={`https://bankr.bot/launches/${claimResult.tokenInfo.tokenAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 block text-center bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                        >
                          View on Bankr →
                        </a>
                        {claimResult.tokenInfo.poolId && (
                          <a
                            href={`https://dexscreener.com/base/${claimResult.tokenInfo.poolId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 block text-center bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                          >
                            Dexscreener →
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 text-left space-y-3">
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">How to use your ENS</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span>🔍</span>
                      <span className="text-gray-300">
                        Look it up on{' '}
                        <a href={`https://app.ens.domains/${claimResult.ens}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">app.ens.domains</a>
                        {' '}— resolves via CCIP-Read
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span>💳</span>
                      <span className="text-gray-300">Use <span className="font-mono text-blue-400">{claimResult.ens}</span> as your username in Rainbow, MetaMask, or any ENS-aware app — send ETH to it like an address</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span>🌐</span>
                      <span className="text-gray-300">
                        Your profile page:{' '}
                        <a href={`https://${claimResult.ens}.limo`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline font-mono">{claimResult.ens}.limo</a>
                      </span>
                    </div>
                    {claimResult.tokenInfo && !claimResult.tokenInfo.error && (
                      <div className="flex items-start gap-2">
                        <span>📈</span>
                        <span className="text-gray-300">
                          Track{' '}
                          <a
                            href={claimResult.tokenInfo.tokenAddress
                              ? `https://bankr.bot/launches/${claimResult.tokenInfo.tokenAddress}`
                              : 'https://bankr.bot'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-orange-400 hover:text-orange-300"
                          >your token on Bankr</a>
                          {' '}— fees land in your wallet automatically
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <a
                  href={`https://${claimResult.ens}.limo`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-blue-400 hover:text-blue-300 underline text-sm"
                >
                  Visit {claimResult.ens}.limo →
                </a>
              </div>
            </div>
          )}

          {/* ── State: Not connected ── */}
          {!isConnected && !claimResult && (
            <>
              <div className="grid md:grid-cols-3 gap-6 p-8">
                <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                  <div className="text-3xl mb-3">🆓</div>
                  <h3 className="text-lg font-bold text-white mb-2">Free names</h3>
                  <p className="text-gray-400 text-sm">9+ characters — permanent, no gas</p>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                  <div className="text-3xl mb-3">⭐</div>
                  <h3 className="text-lg font-bold text-white mb-2">Premium names</h3>
                  <p className="text-gray-400 text-sm">
                    3–8 chars from 0.002 ETH<br />
                    <span className="text-orange-400">10% off with $BNKR · 25% off with $CLAWDIA</span>
                  </p>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                  <div className="text-3xl mb-3">🪙</div>
                  <h3 className="text-lg font-bold text-white mb-2">Launch your token</h3>
                  <p className="text-gray-400 text-sm">57% of every trade's fees — yours automatically, forever</p>
                </div>
              </div>
              <div className="p-8 pt-0 space-y-4">
                <div className="flex justify-center">
                  <ConnectButton label="Connect wallet to claim" />
                </div>
                <p className="text-center text-gray-600 text-xs">
                  🤖 AI agent?{' '}
                  <a
                    href="https://github.com/ClawdiaETH/bankrclub-ens#agent-api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 hover:text-gray-300 underline transition-colors"
                  >
                    Register via REST API →
                  </a>
                </p>
              </div>
            </>
          )}

          {/* ── State: Connected, not holder ── */}
          {isConnected && !isHolder && !claimResult && (
            <div className="p-8 text-center space-y-6">
              <div className="text-5xl">🔒</div>
              <h3 className="text-2xl font-bold text-white">BankrClub NFT required</h3>
              <p className="text-gray-400 max-w-md mx-auto">
                You need to hold a BankrClub NFT to claim a{' '}
                <span className="font-mono text-blue-400">yourname.bankrclub.eth</span> subdomain.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="https://opensea.io/collection/bankr-club"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gradient-to-r from-purple-600 to-orange-600 text-white font-bold py-3 px-8 rounded-xl hover:opacity-90 transition-opacity"
                >
                  Get BankrClub NFT →
                </a>
                <div className="flex justify-center items-center">
                  <ConnectButton />
                </div>
              </div>
              <p className="text-gray-500 text-xs font-mono">
                NFT: 0x9FAb8C51f911f0ba6dab64fD6E979BcF6424Ce82 on Base
              </p>
            </div>
          )}

          {/* ── State: Connected + holder — Claim form ── */}
          {isConnected && isHolder && !claimResult && (
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold text-white">Claim your subdomain</h3>
                <ConnectButton />
              </div>
              <div className="bg-green-900/30 border border-green-700 rounded-xl p-4 text-sm text-green-400">
                ✅ BankrClub NFT holder verified
              </div>

              {/* ── Name input ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-gray-400 text-sm">Choose your name</label>
                  <div className="relative" ref={pricingRef}>
                    <button
                      type="button"
                      onClick={() => setShowPricing(p => !p)}
                      className="text-gray-500 text-xs cursor-pointer hover:text-gray-300 transition-colors select-none"
                    >
                      Pricing {showPricing ? '▴' : '▾'}
                    </button>
                    {showPricing && (
                      <div className="absolute right-0 top-7 z-20 bg-gray-900 border border-gray-700 rounded-2xl p-5 shadow-2xl w-80 text-sm">
                        <p className="text-white font-semibold mb-3">Name pricing</p>
                        <div className="grid grid-cols-3 gap-x-4 gap-y-2 mb-4">
                          <span className="text-gray-500 text-xs uppercase tracking-wide">Length</span>
                          <span className="text-gray-500 text-xs uppercase tracking-wide">ETH</span>
                          <span className="text-gray-500 text-xs uppercase tracking-wide">Best price</span>
                          {[
                            ['3 chars', '0.05',  '0.0375'],
                            ['4 chars', '0.02',  '0.015'],
                            ['5 chars', '0.01',  '0.0075'],
                            ['6 chars', '0.005', '0.00375'],
                            ['7 chars', '0.003', '0.00225'],
                            ['8 chars', '0.002', '0.0015'],
                          ].map(([len, price, best]) => (
                            <Fragment key={len}>
                              <span className="text-gray-300">{len}</span>
                              <span className="text-white font-mono">{price}</span>
                              <span className="text-purple-400 font-mono">{best}</span>
                            </Fragment>
                          ))}
                          <span className="text-green-400 font-semibold">9+ chars</span>
                          <span className="text-green-400 font-semibold font-mono col-span-2">Free!</span>
                        </div>
                        <div className="pt-3 border-t border-gray-700 space-y-2">
                          <p className="text-gray-400 text-xs">Hold tokens to unlock discounts:</p>
                          <div className="flex items-center justify-between">
                            <span className="text-orange-400 font-semibold">$BNKR</span>
                            <span className="text-gray-400 text-xs">10% off</span>
                            <a href="https://app.uniswap.org/swap?outputCurrency=0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b&chain=base" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 text-xs underline">Buy →</a>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-purple-400 font-semibold">$CLAWDIA</span>
                            <span className="text-gray-400 text-xs">25% off</span>
                            <a href="https://app.uniswap.org/swap?outputCurrency=0xbbd9aDe16525acb4B336b6dAd3b9762901522B07&chain=base" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 text-xs underline">Buy →</a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="yourname"
                      maxLength={32}
                      className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-mono text-lg"
                    />
                    {checkingAvailability && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-pulse">...</span>
                    )}
                    {!checkingAvailability && availability && (
                      <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-lg ${
                        availability.available ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {availability.available ? '✓' : '✗'}
                      </span>
                    )}
                  </div>
                  <span className="text-gray-400 font-mono whitespace-nowrap">.bankrclub.eth</span>
                </div>
                {availability && !checkingAvailability && (
                  <div className={`mt-2 text-sm ${availability.available ? 'text-green-400' : 'text-red-400'}`}>
                    {availability.available ? (
                      <>
                        ✓ Available
                        {availability.isPremium && ` — Premium name (${displayPrice ?? availability.price} ETH)`}
                        {!availability.isPremium && ' — Free!'}
                      </>
                    ) : (
                      <>✗ {availability.reason || 'Not available'}</>
                    )}
                  </div>
                )}
                {name.length > 0 && name.length < 3 && (
                  <p className="mt-2 text-sm text-yellow-400">Minimum 3 characters</p>
                )}
              </div>

              {/* ── Payment selector (premium only) ── */}
              {availability?.available && availability.isPremium && availability.price && (
                <PaymentSelector
                  basePrice={availability.price}
                  hasBnkr={tokenBalances?.hasBnkr ?? false}
                  hasClawdia={tokenBalances?.hasClawdia ?? false}
                  selected={paymentToken}
                  onChange={setPaymentToken}
                />
              )}

              {/* ── Token launch toggle ── */}
              <div
                className={`bg-gray-800/50 rounded-xl p-5 border cursor-pointer transition-colors ${
                  launchToken ? 'border-orange-500' : 'border-gray-700'
                }`}
                onClick={() => setLaunchToken(!launchToken)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-semibold">🚀 Launch my token on Bankr</p>
                    <p className="text-gray-400 text-sm mt-1">
                      {name
                        ? <>57% of trading fees go to you. Deploys as <span className="text-white font-semibold font-mono">${name.toUpperCase().slice(0, 10)}</span> on Base.</>
                        : '57% of trading fees go directly to you. Enter your name to see your token symbol.'
                      }
                    </p>
                  </div>
                  <div className={`w-12 h-6 rounded-full transition-colors flex items-center shrink-0 ml-4 ${
                    launchToken ? 'bg-orange-500' : 'bg-gray-600'
                  }`}>
                    <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${
                      launchToken ? 'translate-x-6' : 'translate-x-0'
                    }`} />
                  </div>
                </div>
              </div>

              {/* ── Token logo picker (only when launch is on) ── */}
              {launchToken && (
                <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700 space-y-3">
                  <p className="text-white font-semibold text-sm">🖼️ Token logo</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setLogoMode('nft'); setCustomLogoUrl(''); setLogoPreview(null); setUploadError(null); }}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                        logoMode === 'nft'
                          ? 'bg-purple-600 border-purple-500 text-white'
                          : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      Use my NFT art
                    </button>
                    <button
                      onClick={() => setLogoMode('custom')}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                        logoMode === 'custom'
                          ? 'bg-purple-600 border-purple-500 text-white'
                          : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      Upload custom
                    </button>
                  </div>

                  {logoMode === 'nft' && (
                    <p className="text-gray-500 text-xs">Your BankrClub NFT image will be used automatically.</p>
                  )}

                  {logoMode === 'custom' && (
                    <div className="space-y-3">
                      <label className="block cursor-pointer">
                        <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                          logoPreview ? 'border-purple-500' : 'border-gray-600 hover:border-gray-500'
                        }`}>
                          {logoPreview ? (
                            <div className="flex flex-col items-center gap-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={logoPreview} alt="Logo preview" className="w-24 h-24 rounded-xl object-cover border border-gray-600" />
                              {uploadingLogo && <p className="text-gray-400 text-sm animate-pulse">Uploading to IPFS...</p>}
                              {!uploadingLogo && customLogoUrl && <p className="text-green-400 text-xs">✓ Uploaded to IPFS</p>}
                              <p className="text-gray-500 text-xs">Click to change</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-gray-400 text-sm">
                                {uploadingLogo ? '⏳ Uploading...' : '📁 Click to upload image'}
                              </p>
                              <p className="text-gray-600 text-xs">PNG, JPG, GIF, WebP — max 5 MB</p>
                            </div>
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                          onChange={handleLogoUpload}
                          disabled={uploadingLogo}
                          className="hidden"
                        />
                      </label>
                      {uploadError && (
                        <p className="text-red-400 text-xs">❌ {uploadError}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Fee recipient selector (only shown when token launch is on) ── */}
              {launchToken && (
                <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700 space-y-4">
                  <div>
                    <p className="text-white font-semibold text-sm mb-1">💸 Who receives trading fees?</p>
                    <p className="text-gray-500 text-xs">{selectedFeeOption.hint}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {FEE_RECIPIENT_OPTIONS.map((opt) => (
                      <button
                        key={opt.type}
                        onClick={() => {
                          setFeeRecipientType(opt.type);
                          setFeeRecipientValue('');
                        }}
                        className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                          feeRecipientType === opt.type
                            ? 'bg-purple-600 border-purple-500 text-white'
                            : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-500'
                        }`}
                      >
                        {opt.type === 'wallet' && '🏦 '}
                        {opt.type === 'x' && '𝕏 '}
                        {opt.type === 'farcaster' && '🟣 '}
                        {opt.type === 'ens' && '🔷 '}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {feeRecipientType !== 'wallet' && (
                    <input
                      type="text"
                      value={feeRecipientValue}
                      onChange={(e) => setFeeRecipientValue(e.target.value)}
                      placeholder={selectedFeeOption.placeholder}
                      className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm"
                    />
                  )}
                  {feeRecipientType === 'wallet' && address && (
                    <p className="font-mono text-gray-500 text-xs break-all">{address}</p>
                  )}
                </div>
              )}

              {/* ── Advanced options ── */}
              {launchToken && (
                <div>
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-gray-500 hover:text-gray-300 text-sm flex items-center gap-1 transition-colors"
                  >
                    <span>{showAdvanced ? '▾' : '▸'}</span>
                    Advanced options
                  </button>
                  {showAdvanced && (
                    <div className="mt-3 bg-gray-800/50 rounded-xl p-5 border border-gray-700 space-y-3">
                      <div>
                        <label className="block text-gray-400 text-sm mb-1">
                          Tweet URL <span className="text-gray-600">(optional)</span>
                        </label>
                        <input
                          type="url"
                          value={tweetUrl}
                          onChange={(e) => setTweetUrl(e.target.value)}
                          placeholder="https://x.com/yourhandle/status/..."
                          className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm"
                        />
                        <p className="text-gray-500 text-xs mt-1">
                          Link a tweet about your token — stored in on-chain metadata.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Error ── */}
              {claimError && (
                <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-sm text-red-400">
                  ❌ {claimError}
                </div>
              )}

              {/* ── Claim button ── */}
              <button
                onClick={handleClaim}
                disabled={!availability?.available || claiming || !name || !feeRecipientValid || (launchToken && logoMode === 'custom' && (uploadingLogo || !customLogoUrl))}
                className="w-full bg-gradient-to-r from-purple-600 to-orange-600 hover:from-purple-500 hover:to-orange-500 text-white font-bold py-4 px-8 rounded-xl transition-all duration-200 transform hover:scale-[1.02] shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {claiming ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⚙️</span>
                    {claimStatus || 'Claiming…'}
                  </span>
                ) : (
                  `Claim ${name ? `${name}.bankrclub.eth` : 'your name'}`
                )}
              </button>

              <p className="text-gray-500 text-xs text-center">
                One name per wallet. Permanent registration
                {availability?.isPremium ? ` — ${displayPrice} ETH payment on Base.` : ' — no gas fees.'}
              </p>
            </div>
          )}

          {/* ── Footer ── */}
          <div className="bg-gray-800/30 border-t border-gray-700 p-6 text-center space-y-2">
            <p className="text-gray-400 text-sm">
              Built by{' '}
              <a
                href="https://x.com/ClawdiaBotAI"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                @ClawdiaBotAI
              </a>{' '}
              for the{' '}
              <a
                href="https://x.com/bankrbot"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-400 hover:text-orange-300 font-medium transition-colors"
              >
                Bankr
              </a>{' '}
              ecosystem 🐚
            </p>
            <p className="text-gray-500 text-xs">
              BankrClub NFT:{' '}
              <a
                href="https://basescan.org/address/0x9FAb8C51f911f0ba6dab64fD6E979BcF6424Ce82"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono hover:text-blue-400 transition-colors"
              >
                0x9FAb...Ce82
              </a>
            </p>
          </div>
        </div>

        {/* Bottom features */}
        <div className="mt-8 text-center space-y-2">
          <p className="text-gray-400 text-sm">
            ⚡ Zero gas fees • 🚀 Instant registration • ✅ Verified ownership
          </p>
          <p className="text-gray-500 text-xs font-mono">
            Powered by CCIP-Read (EIP-3668) • Live on Base
          </p>
        </div>
      </div>
    </main>
  );
}
