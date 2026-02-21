'use client';

import { useState, useEffect, useCallback } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract } from 'wagmi';
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
    tokenAddress: string;
    tokenSymbol: string;
    poolId: string;
    txHash?: string;
    simulated?: boolean;
    feeDistribution?: FeeDistribution;
    feeRecipient?: { type: FeeRecipientType; value: string };
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
  const [tweetUrl, setTweetUrl] = useState('');

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

  // Validate fee recipient value for non-wallet types
  const feeRecipientValid =
    feeRecipientType === 'wallet' ||
    (feeRecipientValue.trim().length > 0);

  const handleClaim = async () => {
    if (!address || !availability?.available || !feeRecipientValid) return;
    setClaiming(true);
    setClaimError(null);
    try {
      const res = await fetch(`${API_BASE}/api/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subdomain: name.toLowerCase().trim(),
          address,
          launchTokenOnBankr: launchToken,
          paymentToken,
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
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadingLogo(true);
    // Show local preview immediately
    setLogoPreview(URL.createObjectURL(file));
    try {
      const form = new FormData();
      form.append('file', file);
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
            Exclusive ENS subdomains for BankrClub NFT holders
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
                    For BankrClub NFT Holders
                  </h2>
                  <p className="text-orange-400 font-semibold">1,000 founding members only</p>
                </div>
              </div>
              <p className="text-gray-300 text-lg">
                Register{' '}
                <span className="font-mono text-blue-400 font-semibold">
                  yourname.bankrclub.eth
                </span>{' '}
                — a permanent, decentralized identity on Ethereum.
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
                {claimResult.tokenInfo && (
                  <div className="bg-gray-800 rounded-xl p-6 border border-orange-500 space-y-3 text-left">
                    <p className="text-orange-400 font-semibold text-center">
                      🚀 Token launched on Bankr!
                    </p>
                    {claimResult.tokenInfo.simulated && (
                      <p className="text-yellow-400 text-sm text-center">
                        ⚠️ Simulated — token not live yet (partner key pending)
                      </p>
                    )}
                    {claimResult.tokenInfo.tokenAddress && (
                      <div>
                        <p className="text-gray-400 text-xs">Token address</p>
                        <p className="font-mono text-white text-sm break-all">
                          {claimResult.tokenInfo.tokenAddress}
                        </p>
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
                          <span className="text-gray-400">Protocol</span>
                          <span className="text-gray-300">
                            {bpsToPercent(claimResult.tokenInfo.feeDistribution.protocol.bps)}%
                          </span>
                        </div>
                      </div>
                    )}
                    {claimResult.tokenInfo.poolId && !claimResult.tokenInfo.simulated && (
                      <a
                        href={`https://dexscreener.com/base/${claimResult.tokenInfo.poolId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-center bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                      >
                        View on Dexscreener →
                      </a>
                    )}
                  </div>
                )}
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
                  <h3 className="text-lg font-bold text-white mb-2">Free Basic Names</h3>
                  <p className="text-gray-400 text-sm">6+ characters, yours forever</p>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                  <div className="text-3xl mb-3">⭐</div>
                  <h3 className="text-lg font-bold text-white mb-2">Premium Names</h3>
                  <p className="text-gray-400 text-sm">3-5 char names from 0.01 ETH</p>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                  <div className="text-3xl mb-3">🪙</div>
                  <h3 className="text-lg font-bold text-white mb-2">Launch Your Token</h3>
                  <p className="text-gray-400 text-sm">57% of trading fees go to you</p>
                </div>
              </div>
              <div className="p-8 pt-0 flex justify-center">
                <ConnectButton label="Connect Wallet to Claim" />
              </div>
            </>
          )}

          {/* ── State: Connected, not holder ── */}
          {isConnected && !isHolder && !claimResult && (
            <div className="p-8 text-center space-y-6">
              <div className="text-5xl">🔒</div>
              <h3 className="text-2xl font-bold text-white">BankrClub NFT Required</h3>
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
                <h3 className="text-xl font-bold text-white">Claim Your Subdomain</h3>
                <ConnectButton />
              </div>
              <div className="bg-green-900/30 border border-green-700 rounded-xl p-4 text-sm text-green-400">
                ✅ BankrClub NFT holder verified
              </div>

              {/* ── Name input ── */}
              <div>
                <label className="block text-gray-400 text-sm mb-2">Choose your name</label>
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
                      57% of trading fees go directly to you. Token named after your ENS.
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
                disabled={!availability?.available || claiming || !name || !feeRecipientValid || uploadingLogo || (logoMode === 'custom' && !customLogoUrl)}
                className="w-full bg-gradient-to-r from-purple-600 to-orange-600 hover:from-purple-500 hover:to-orange-500 text-white font-bold py-4 px-8 rounded-xl transition-all duration-200 transform hover:scale-[1.02] shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {claiming ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⚙️</span> Claiming...
                  </span>
                ) : (
                  `Claim ${name ? `${name}.bankrclub.eth` : 'your name'}`
                )}
              </button>

              <p className="text-gray-500 text-xs text-center">
                One name per wallet. Registration is permanent and offchain (gas-free).
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
            Powered by CCIP-Read (EIP-3668) • Launching Feb 24th, 2026
          </p>
        </div>
      </div>
    </main>
  );
}
