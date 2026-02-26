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
            <p className="text-gray-500 text-xs mt-1 italic">need $BNKR to unlock</p>
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
            <p className="text-gray-500 text-xs mt-1 italic">need $CLAWDIA to unlock</p>
          )}
        </button>
      </div>
    </div>
  );
}
