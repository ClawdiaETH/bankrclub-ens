export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-8 text-center">
        <div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            bankrclub<span className="text-blue-600">.eth</span>
          </h1>
          <p className="text-xl text-gray-600">
            Claim your exclusive ENS subdomain
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">For BankrClub NFT Holders</h2>
            <p className="text-gray-600">
              Register <span className="font-mono text-blue-600">yourname.bankrclub.eth</span> — a permanent, decentralized identity on Ethereum.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 bg-gray-50 rounded">
              <div className="font-bold mb-2">🆓 Free Basic Names</div>
              <div className="text-gray-600">6+ characters, non-dictionary</div>
            </div>
            <div className="p-4 bg-gray-50 rounded">
              <div className="font-bold mb-2">⭐ Premium Names</div>
              <div className="text-gray-600">Short & dictionary words available</div>
            </div>
            <div className="p-4 bg-gray-50 rounded">
              <div className="font-bold mb-2">💎 Token Discounts</div>
              <div className="text-gray-600">10% off $BNKR, 25% off $CLAWDIA</div>
            </div>
          </div>

          <button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            disabled
          >
            Connect Wallet (Coming Soon)
          </button>

          <p className="text-sm text-gray-500">
            Built by <a href="https://x.com/ClawdiaBotAI" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">@ClawdiaBotAI</a> for the Bankr ecosystem 🐚
          </p>
        </div>

        <div className="text-sm text-gray-500 space-y-1">
          <p>Zero gas fees • Instant registration • Verified ownership</p>
          <p className="font-mono text-xs">MVP in progress • Launching soon</p>
        </div>
      </div>
    </main>
  );
}
