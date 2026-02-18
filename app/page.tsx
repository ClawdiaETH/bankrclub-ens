import TypewriterSubdomain from './components/TypewriterSubdomain';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-900 text-white">
      {/* Retro grid background */}
      <div className="fixed inset-0 bg-gradient-to-b from-purple-900/20 via-transparent to-orange-900/20 pointer-events-none"></div>
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none"></div>
      
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
          {/* Header with membership card */}
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
                  <p className="text-orange-400 font-semibold">
                    1,000 founding members only
                  </p>
                </div>
              </div>
              
              <p className="text-gray-300 text-lg">
                Register <span className="font-mono text-blue-400 font-semibold">yourname.bankrclub.eth</span> — a permanent, decentralized identity on Ethereum.
              </p>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 p-8">
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <div className="text-3xl mb-3">🆓</div>
              <h3 className="text-lg font-bold text-white mb-2">Free Basic Names</h3>
              <p className="text-gray-400 text-sm">6+ characters, non-dictionary</p>
            </div>
            
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <div className="text-3xl mb-3">⭐</div>
              <h3 className="text-lg font-bold text-white mb-2">Premium Names</h3>
              <p className="text-gray-400 text-sm">Short & dictionary words available</p>
            </div>
            
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <div className="text-3xl mb-3">💎</div>
              <h3 className="text-lg font-bold text-white mb-2">Token Discounts</h3>
              <p className="text-gray-400 text-sm">10% off $BNKR, 25% off $CLAWDIA</p>
            </div>
          </div>

          {/* CTA Button */}
          <div className="p-8 pt-0">
            <button
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-4 px-8 rounded-xl transition-all duration-200 transform hover:scale-[1.02] shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              disabled
            >
              Connect Wallet (Coming Soon)
            </button>
          </div>

          {/* Footer */}
          <div className="bg-gray-800/30 border-t border-gray-700 p-6 text-center space-y-2">
            <p className="text-gray-400 text-sm">
              Built by <a href="https://x.com/ClawdiaBotAI" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">@ClawdiaBotAI</a> for the <a href="https://x.com/bankrbot" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 font-medium transition-colors">Bankr</a> ecosystem 🐚
            </p>
            <p className="text-gray-500 text-xs">
              BankrClub NFT: <a href="https://basescan.org/address/0x9FAb8C51f911f0ba6dab64fD6E979BcF6424Ce82" target="_blank" rel="noopener noreferrer" className="font-mono hover:text-blue-400 transition-colors">0x9FAb...Ce82</a>
            </p>
          </div>
        </div>

        {/* Bottom features */}
        <div className="mt-8 text-center space-y-2">
          <p className="text-gray-400 text-sm">
            ⚡ Zero gas fees • 🚀 Instant registration • ✅ Verified ownership
          </p>
          <p className="text-gray-500 text-xs font-mono">
            MVP in progress • Launching Feb 24th, 2026
          </p>
        </div>
      </div>
    </main>
  );
}
