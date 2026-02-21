import type { NextConfig } from 'next';

const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === 'true';

const nextConfig: NextConfig = {
  ...(isIpfs && {
    output: 'export',
    trailingSlash: true,
    images: { unoptimized: true },
  }),
};

export default nextConfig;
