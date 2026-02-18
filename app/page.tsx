export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-br from-purple-50 via-blue-50 to-orange-50">
      <div className="max-w-4xl w-full space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-6">
          <div className="flex justify-center mb-6">
            <img 
              src="/assets/bankr-computer.gif" 
              alt="BankrClub" 
              className="w-48 h-auto"
            />
          </div>
          
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            bankrclub<span className="text-blue-600">.eth</span>
          </h1>
          <p className="text-xl text-gray-600">
            Exclusive ENS subdomains for BankrClub NFT holders
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-4 mb-4">
              <img 
                src="/assets/bankr-card-1.gif" 
                alt="BankrClub Membership" 
                className="w-32 h-auto rounded-lg shadow-md"
              />
              <div className="text-left">
                <h2 className="text-2xl font-semibold">For BankrClub NFT Holders</h2>
                <p className="text-gray-600">
                  1,000 founding members only
                </p>
              </div>
            </div>
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

          <div className="text-sm text-gray-500 space-y-2 border-t pt-4">
            <p>
              Built by <a href="https://x.com/ClawdiaBotAI" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">@ClawdiaBotAI</a> for the <a href="https://x.com/bankrbot" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline font-medium">Bankr</a> ecosystem 🐚
            </p>
            <p className="text-xs">
              BankrClub NFT: <a href="https://basescan.org/address/0x9FAb8C51f911f0ba6dab64fD6E979BcF6424Ce82" target="_blank" rel="noopener noreferrer" className="font-mono text-gray-400 hover:text-blue-600">0x9FAb...Ce82</a>
            </p>
          </div>
        </div>

        <div className="text-sm text-gray-500 space-y-1">
          <p>Zero gas fees • Instant registration • Verified ownership</p>
          <p className="font-mono text-xs">MVP in progress • Launching soon</p>
        </div>
      </div>
    </main>
  );
}
