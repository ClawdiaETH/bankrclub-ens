'use client';

import dynamic from 'next/dynamic';

// Disable SSR — wagmi/rainbowkit require browser APIs (localStorage)
const HomeClient = dynamic(() => import('./components/HomeClient'), {
  ssr: false,
  loading: () => (
    <main className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-gray-400 animate-pulse">Loading...</div>
    </main>
  ),
});

export default function Page() {
  return <HomeClient />;
}
