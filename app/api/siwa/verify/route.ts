// POST /api/siwa/verify
// Body: { message: string, signature: string }
// Returns: { receipt, agentId, address }
import { verifySIWA } from '@buildersgarden/siwa';
import { createReceipt } from '@buildersgarden/siwa/receipt';
import { corsJson } from '@buildersgarden/siwa/next';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { consumeNonce } from '@/lib/db';


const client = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

const DOMAIN = 'bankrclub-ens.vercel.app';

export async function POST(req: Request) {
  try {
    const { message, signature } = await req.json();

    if (!message || !signature) {
      return corsJson({ error: 'message and signature required' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await verifySIWA(
      message,
      signature,
      DOMAIN,
      async (nonce: string) => consumeNonce(nonce),
      client as any,
    );

    if (!result.valid) {
      return corsJson({ error: result.error ?? 'invalid signature' }, { status: 401 });
    }

    const secret = process.env.RECEIPT_SECRET;
    if (!secret) {
      return corsJson({ error: 'server misconfigured: RECEIPT_SECRET not set' }, { status: 500 });
    }

    const { receipt } = createReceipt(
      {
        address: result.address,
        agentId: result.agentId,
        agentRegistry: result.agentRegistry,
        chainId: result.chainId,
        verified: result.verified,
        signerType: result.signerType,
      },
      { secret },
    );

    return corsJson({
      receipt,
      agentId: result.agentId,
      address: result.address,
    });
  } catch (e) {
    console.error('SIWA verify error:', e);
    return corsJson({ error: 'verification failed' }, { status: 500 });
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
