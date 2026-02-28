/**
 * POST /api/upload
 * Accepts a multipart form-data image, pins it to Pinata, returns the IPFS gateway URL.
 * Used for custom token logos before submitting to the Bankr deploy API.
 */
import { NextRequest, NextResponse } from 'next/server';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

export async function POST(req: NextRequest) {
  const pinataJwt = process.env.PINATA_JWT;
  if (!pinataJwt) {
    return NextResponse.json({ error: 'upload not configured' }, { status: 503, headers: corsHeaders });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid multipart form data' }, { status: 400, headers: corsHeaders });
  }

  const addressField = formData.get('address');
  const address = typeof addressField === 'string' ? addressField.trim() : '';
  if (!address) {
    return NextResponse.json({ error: 'address field required' }, { status: 400, headers: corsHeaders });
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'file field required' }, { status: 400, headers: corsHeaders });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `unsupported type — use ${ALLOWED_TYPES.join(', ')}` },
      { status: 400, headers: corsHeaders }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'max file size is 5 MB' },
      { status: 400, headers: corsHeaders }
    );
  }

  // Pin to Pinata using Files API
  const pinForm = new FormData();
  pinForm.append('file', file, file.name || 'token-logo');
  pinForm.append(
    'pinataMetadata',
    JSON.stringify({ name: `bankrclub-token-logo-${Date.now()}` })
  );
  pinForm.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

  const pinRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pinataJwt}` },
    body: pinForm,
  });

  if (!pinRes.ok) {
    const err = await pinRes.text();
    console.error('Pinata error:', pinRes.status, err);
    return NextResponse.json({ error: 'upload to IPFS failed' }, { status: 502, headers: corsHeaders });
  }

  const { IpfsHash } = await pinRes.json() as { IpfsHash: string };
  const url = `https://gateway.pinata.cloud/ipfs/${IpfsHash}`;

  return NextResponse.json({ url, cid: IpfsHash }, { headers: corsHeaders });
}
