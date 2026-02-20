import { ethers } from 'ethers';

// Signs a CCIP-Read response per EIP-3668
export function encodeResult(address: string): string {
  const abiCoder = new ethers.AbiCoder();
  return abiCoder.encode(['address'], [address]);
}

export async function signResponse(
  requestData: string,
  result: string,
  validUntil: number,
  signingKey: string
): Promise<string> {
  const messageHash = ethers.solidityPackedKeccak256(
    ['bytes', 'address', 'uint64', 'bytes32', 'bytes32'],
    [
      '0x1900',
      // This would be the resolver contract address — placeholder for now
      process.env.RESOLVER_CONTRACT_ADDRESS || ethers.ZeroAddress,
      validUntil,
      ethers.keccak256(requestData),
      ethers.keccak256(result),
    ]
  );
  const wallet = new ethers.Wallet(signingKey);
  return wallet.signMessage(ethers.getBytes(messageHash));
}

export function parseSubdomainFromCalldata(calldata: string): string | null {
  try {
    // ENS resolve calldata: selector(4) + encoded DNS name + resolver data
    // Skip the selector and decode the DNS-encoded name
    const data = calldata.startsWith('0x') ? calldata.slice(2) : calldata;
    // First 4 bytes = selector (9061b923 = resolve(bytes,bytes))
    // Next is ABI-encoded bytes (DNS name)
    const abiCoder = new ethers.AbiCoder();
    const [dnsEncodedName] = abiCoder.decode(['bytes', 'bytes'], '0x' + data.slice(8));
    return decodeDNSName(dnsEncodedName as string);
  } catch {
    return null;
  }
}

function decodeDNSName(dnsEncoded: string): string {
  const bytes = ethers.getBytes(dnsEncoded);
  const labels: string[] = [];
  let i = 0;
  while (i < bytes.length && bytes[i] !== 0) {
    const length = bytes[i];
    i++;
    labels.push(Buffer.from(bytes.slice(i, i + length)).toString('utf8'));
    i += length;
  }
  return labels.join('.');
}
