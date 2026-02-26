'use client';

export type PaymentToken = 'ETH' | 'BNKR' | 'CLAWDIA';

interface PaymentSelectorProps {
  basePrice: number; // in ETH
  hasBnkr: boolean;
  hasClawdia: boolean;
  selected: PaymentToken;
  onChange: (token: PaymentToken) => void;
}

export default function PaymentSelector({
  basePrice,
  hasBnkr,
  hasClawdia,
  selected,
  onChange,
}: PaymentSelectorProps) {
  const bnkrPrice = parseFloat((basePrice * 0.9).toFixed(4));
  const clawdiaPrice = parseFloat((basePrice * 0.75).toFixed(4));

  return (
    <div className="space-y-3">
      <p className="text-gray-400 text-sm font-medium">Pay with</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* ETH Option */}
        <button
          type="button"
          onClick={() => onChange('ETH')}
          className={`relative rounded-xl border p-4 text-left transition-all duration-200 ${
            selected === 'ETH'
              ? 'border-purple-500 bg-purple-900/20 ring-1 ring-purple-500'
              : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                selected === 'ETH' ? 'border-purple-400 bg-purple-400' : 'border-gray-500'
              }`}
            />
            <span className="text-white font-semibold text-sm">Pay in ETH</span>
          </div>
          <p className="text-white font-mono font-bold text-lg">{basePrice} ETH</p>
        </button>

        {/* BNKR Option */}
        <button
          type="button"
          onClick={() => (hasBnkr ? onChange('BNKR') : undefined)}
          disabled={!hasBnkr}
          title={!hasBnkr ? 'You need $BNKR to use this discount' : undefined}
          className={`relative rounded-xl border p-4 text-left transition-all duration-200 ${
            !hasBnkr
              ? 'border-gray-700 bg-gray-800/30 opacity-60 cursor-not-allowed'
              : selected === 'BNKR'
              ? 'border-orange-500 bg-orange-900/20 ring-1 ring-orange-500'
              : 'border-gray-700 bg-gray-800/50 hover:border-orange-600 cursor-pointer'
          }`}
        >
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                selected === 'BNKR' ? 'border-orange-400 bg-orange-400' : 'border-gray-500'
              }`}
            />
            <span className="text-white font-semibold text-sm">Pay in $BNKR</span>
            <span className="bg-orange-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              10% OFF
            </span>
          </div>
          {hasBnkr ? (
            <div>
              <span className="line-through text-gray-500 font-mono text-sm mr-2">
                {basePrice} ETH
              </span>
              <span className="text-orange-400 font-mono font-bold text-lg">{bnkrPrice} ETH</span>
            </div>
          ) : (
            <a
              href="https://app.uniswap.org/swap?outputCurrency=0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b&chain=base"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-orange-400 text-xs mt-1 hover:text-orange-300 underline transition-colors"
            >
              Buy $BNKR to unlock →
            </a>
          )}
        </button>

        {/* CLAWDIA Option */}
        <button
          type="button"
          onClick={() => (hasClawdia ? onChange('CLAWDIA') : undefined)}
          disabled={!hasClawdia}
          title={!hasClawdia ? 'You need $CLAWDIA to use this discount' : undefined}
          className={`relative rounded-xl border p-4 text-left transition-all duration-200 ${
            !hasClawdia
              ? 'border-gray-700 bg-gray-800/30 opacity-60 cursor-not-allowed'
              : selected === 'CLAWDIA'
              ? 'border-purple-500 bg-purple-900/20 ring-1 ring-purple-500'
              : 'border-gray-700 bg-gray-800/50 hover:border-purple-600 cursor-pointer'
          }`}
        >
          {/* Best deal pill */}
          <div className="absolute -top-2 right-3">
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">
              ★ Best deal
            </span>
          </div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                selected === 'CLAWDIA' ? 'border-purple-400 bg-purple-400' : 'border-gray-500'
              }`}
            />
            <span className="text-white font-semibold text-sm">Pay in $CLAWDIA</span>
            <span className="bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              25% OFF
            </span>
          </div>
          {hasClawdia ? (
            <div>
              <span className="line-through text-gray-500 font-mono text-sm mr-2">
                {basePrice} ETH
              </span>
              <span className="text-purple-400 font-mono font-bold text-lg">
                {clawdiaPrice} ETH
              </span>
            </div>
          ) : (
            <a
              href="https://app.uniswap.org/swap?outputCurrency=0xbbd9aDe16525acb4B336b6dAd3b9762901522B07&chain=base"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-purple-400 text-xs mt-1 hover:text-purple-300 underline transition-colors"
            >
              Buy $CLAWDIA to unlock →
            </a>
          )}
        </button>
      </div>
    </div>
  );
}
