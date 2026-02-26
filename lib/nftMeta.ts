/**
 * Fetch metadata for a BankrClub NFT token.
 * Used to grab the holder's NFT art and use it as their personal token logo.
 */

const BANKRCLUB_NFT = '0x9FAb8C51f911f0ba6dab64fD6E979BcF6424Ce82';
const BASE_RPC = 'https://mainnet.base.org';

/** Convert ipfs:// URIs to a public HTTP gateway URL */
function ipfsToHttp(url: string): string {
  if (url.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${url.slice(7)}`;
  }
  return url;
}

/**
 * ABI-decode an eth_call result that returns a single `string`.
 * Format: 0x + 32-byte offset + 32-byte length + utf8 bytes
 */
function decodeAbiString(hex: string): string {
  const data = hex.startsWith('0x') ? hex.slice(2) : hex;
  const offset = parseInt(data.slice(0, 64), 16) * 2;
  const strLen = parseInt(data.slice(offset, offset + 64), 16);
  const strHex = data.slice(offset + 64, offset + 64 + strLen * 2);
  return Buffer.from(strHex, 'hex').toString('utf8');
}

/**
 * Fetch the image URL for a BankrClub NFT.
 * Returns undefined if the lookup fails (non-fatal — token launch still proceeds).
 */
export async function getNftImage(
  tokenId: number | bigint | null | undefined
): Promise<string | undefined> {
  if (tokenId === null || tokenId === undefined) return undefined;

  try {
    // Encode tokenURI(uint256) call — selector 0xc87b56dd
    const tokenIdHex = BigInt(tokenId).toString(16).padStart(64, '0');
    const callData = '0xc87b56dd' + tokenIdHex;

    const rpcRes = await fetch(BASE_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to: BANKRCLUB_NFT, data: callData }, 'latest'],
        id: 1,
      }),
    });

    const rpcData = await rpcRes.json();
    if (!rpcData.result || rpcData.result === '0x') return undefined;

    let uri = decodeAbiString(rpcData.result);

    // Handle inline base64 JSON (data:application/json;base64,...)
    if (uri.startsWith('data:application/json;base64,')) {
      const json = JSON.parse(Buffer.from(uri.slice(29), 'base64').toString('utf8'));
      return json.image ? ipfsToHttp(json.image) : undefined;
    }

    // Handle inline JSON
    if (uri.startsWith('data:application/json,')) {
      const json = JSON.parse(decodeURIComponent(uri.slice(22)));
      return json.image ? ipfsToHttp(json.image) : undefined;
    }

    // Fetch external metadata JSON
    uri = ipfsToHttp(uri);
    const metaRes = await fetch(uri, { signal: AbortSignal.timeout(5000) });
    if (!metaRes.ok) return undefined;
    const meta = await metaRes.json();
    return meta.image ? ipfsToHttp(meta.image as string) : undefined;
  } catch (e) {
    console.error('getNftImage failed (non-fatal):', e);
    return undefined;
  }
}
