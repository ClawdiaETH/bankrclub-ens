// POST /api/siwa/nonce
// Body: { address: string, agentId: number, agentRegistry: string }
// Returns: { nonce, issuedAt, expirationTime }
import { createSIWANonce } from '@buildersgarden/siwa';
import { corsJson } from '@buildersgarden/siwa/next';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { storeNonce } from '@/lib/db';


const client = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

export async function POST(req: Request) {
  try {
    const { address, agentId, agentRegistry } = await req.json();

    if (!address || agentId === undefined || !agentRegistry) {
      return corsJson({ error: 'address, agentId, and agentRegistry required' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await createSIWANonce({ address, agentId, agentRegistry }, client as any);

    if (result.status !== 'nonce_issued') {
      // Agent not registered or some other failure
      return corsJson({ error: (result as { error?: string }).error ?? result.status }, { status: 400 });
    }

    await storeNonce(result.nonce);

    return corsJson({
      nonce: result.nonce,
      issuedAt: result.issuedAt,
      expirationTime: result.expirationTime,
    });
  } catch (e) {
    console.error('SIWA nonce error:', e);
    return corsJson({ error: 'nonce generation failed' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-SIWA-Receipt, Signature, Signature-Input, Content-Digest',
    },
  });
}
