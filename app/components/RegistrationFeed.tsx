'use client';

import { useEffect, useState, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface Registration {
  subdomain: string;
  ens: string;
  address: string;
  hasToken: boolean;
  tokenSymbol: string | null;
  tokenAddress: string | null;
  registeredAt: string;
}

interface FeedData {
  count: number;
  items: Registration[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function RegistrationFeed() {
  const [data, setData] = useState<FeedData | null>(null);
  const [error, setError] = useState(false);

  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/registrations?limit=20`);
      if (!res.ok) throw new Error('bad response');
      const json = await res.json() as FeedData;
      setData(json);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
    const interval = setInterval(fetchFeed, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchFeed]);

  if (error || !data) return null;
  if (data.items.length === 0) return null;

  return (
    <div className="mt-8 space-y-4">
      {/* Counter */}
      <div className="text-center">
        <span className="inline-flex items-center gap-2 bg-gray-800/60 border border-gray-700 rounded-full px-5 py-2 text-sm">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white font-semibold">{data.count}</span>
          <span className="text-gray-400">name{data.count !== 1 ? 's' : ''} registered</span>
        </span>
      </div>

      {/* Feed */}
      <div className="bg-gray-800/40 border border-gray-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-700 flex items-center justify-between">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Recent registrations</p>
          <span className="text-gray-600 text-xs">live</span>
        </div>
        <ul className="divide-y divide-gray-700/50">
          {data.items.map((item) => (
            <li key={item.subdomain} className="flex items-center justify-between px-5 py-3 hover:bg-gray-700/20 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                {/* Avatar placeholder — first letter of subdomain */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-orange-600 flex items-center justify-center text-white text-xs font-bold shrink-0 select-none">
                  {item.subdomain[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <a
                    href={`https://app.ens.domains/${item.ens}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sm text-blue-400 hover:text-blue-300 transition-colors truncate block"
                  >
                    {item.ens}
                  </a>
                  <p className="text-gray-500 text-xs">{item.address}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-3">
                {item.hasToken && item.tokenSymbol && (
                  <a
                    href={item.tokenAddress ? `https://bankr.bot/launches/${item.tokenAddress}` : 'https://bankr.bot'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-400 text-xs font-semibold hover:text-orange-300 transition-colors"
                  >
                    ${item.tokenSymbol}
                  </a>
                )}
                <span className="text-gray-600 text-xs whitespace-nowrap">{timeAgo(item.registeredAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
