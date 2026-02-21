'use client';
import { useState, useEffect, useRef } from 'react';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { base } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@rainbow-me/rainbowkit/styles.css';

// Create config lazily inside the component to avoid SSR localStorage access
function useWagmiConfig() {
  const configRef = useRef<ReturnType<typeof getDefaultConfig> | null>(null);
  const queryClientRef = useRef<QueryClient | null>(null);

  if (!configRef.current) {
    configRef.current = getDefaultConfig({
      appName: 'BankrClub ENS',
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'placeholder',
      chains: [base],
      ssr: false,
    });
  }
  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient();
  }

  return { config: configRef.current, queryClient: queryClientRef.current };
}

function WagmiProviders({ children }: { children: React.ReactNode }) {
  const { config, queryClient } = useWagmiConfig();
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Render children without wallet context during SSR to avoid localStorage errors
  if (!mounted) {
    return <>{children}</>;
  }

  return <WagmiProviders>{children}</WagmiProviders>;
}
