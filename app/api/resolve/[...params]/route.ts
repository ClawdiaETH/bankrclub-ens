import { NextRequest, NextResponse } from 'next/server';
import { getRegistration } from '@/lib/db';
import { encodeResult, signResponse, parseSubdomainFromCalldata } from '@/lib/ensResolver';
import { ethers } from 'ethers';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ params: string[] }> }
) {
  const resolvedParams = await params;
  const [sender, calldata] = resolvedParams.params;

  if (!sender || !calldata) {
    return NextResponse.json({ error: 'invalid CCIP-Read request' }, { status: 400, headers: corsHeaders });
  }

  // Parse subdomain from calldata
  const fullName = parseSubdomainFromCalldata(calldata);
  if (!fullName) {
    return NextResponse.json({ error: 'could not parse name' }, { status: 400, headers: corsHeaders });
  }

  // Extract subdomain (remove .bankrclub.eth or .bankrclub)
  const subdomain = fullName
    .replace(/\.bankrclub\.eth$/, '')
    .replace(/\.bankrclub$/, '');

  // Look up in DB
  let address = '0x0000000000000000000000000000000000000000';
  try {
    const registration = await getRegistration(subdomain);
    if (registration) address = registration.address;
  } catch (e) {
    console.error('DB lookup failed:', e);
  }

  const result = encodeResult(address);
  const validUntil = Math.floor(Date.now() / 1000) + 3600; // 1hr TTL

  const signingKey = process.env.GATEWAY_SIGNING_KEY;
  if (!signingKey) {
    // Return unsigned response for dev
    return NextResponse.json({ data: result }, { headers: corsHeaders });
  }

  const sig = await signResponse(calldata, result, validUntil, signingKey);
  const abiEncoded = encodeResponse(result, validUntil, sig);

  return NextResponse.json({ data: abiEncoded }, { headers: corsHeaders });
}

function encodeResponse(result: string, validUntil: number, sig: string): string {
  const abiCoder = new ethers.AbiCoder();
  return abiCoder.encode(['bytes', 'uint64', 'bytes'], [result, validUntil, sig]);
}
