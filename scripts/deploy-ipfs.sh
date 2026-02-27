#!/bin/bash
set -e

PINATA_JWT=$(~/clawd/scripts/get-secret.sh pinata_jwt 2>/dev/null)
SIGNING_KEY=$(~/clawd/scripts/get-secret.sh signing_key 2>/dev/null)

if [ -z "$PINATA_JWT" ]; then
  echo "❌ Could not load pinata_jwt from secrets"
  exit 1
fi

if [ -z "$SIGNING_KEY" ]; then
  echo "❌ Could not load signing_key from secrets"
  exit 1
fi

echo "🔨 Building static export..."
rm -rf .next out

# Temporarily hide API routes — they live on Vercel, not IPFS.
# Next.js 15 output:export fails if API routes exist without force-static.
mv app/api app/api-bak

cleanup() {
  mv app/api-bak app/api 2>/dev/null || true
}
trap cleanup EXIT

NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://bankrclub-ens.vercel.app}" \
  NODE_OPTIONS="--require ./lib/polyfill-localstorage.cjs" \
  npm run build

mv app/api-bak app/api
trap - EXIT

echo "📦 Uploading to Pinata..."
# wrapWithDirectory:false = CID points directly to the app files (no extra subfolder level)
# cidVersion:0 = CIDv0 (Qm...) for simpler ENS contenthash encoding
RESPONSE=$(curl -s -X POST "https://api.pinata.cloud/pinning/pinFileToIPFS" \
  -H "Authorization: Bearer $PINATA_JWT" \
  -F "file=@out;filename=out" \
  --form-string 'pinataMetadata={"name":"bankrclub-ens"}' \
  --form-string 'pinataOptions={"cidVersion":0,"wrapWithDirectory":false}')

CID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['IpfsHash'])")
if [ -z "$CID" ]; then
  echo "❌ Pinata upload failed. Response: $RESPONSE"
  exit 1
fi

echo "✅ CID: $CID"
echo "🔗 Updating bankrclub.eth contenthash..."

# Encode CIDv0 (Qm...) as ENS contenthash:
# 0xe3 0x01 = ipfs-ns varint codec, then CIDv1 header 0x01 0x70 (version + dag-pb), then multihash bytes
CONTENTHASH=$(python3 -c "
ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
def b58decode(s):
    n = 0
    for c in s:
        n = n * 58 + ALPHABET.index(c)
    result = []
    while n > 0:
        result.append(n % 256)
        n //= 256
    result.extend([0] * (len(s) - len(s.lstrip('1'))))
    return bytes(reversed(result))
cid = '$CID'
cid_bytes = b58decode(cid)
print('0xe3010170' + cid_bytes.hex())
")

cast send 0x3a62109CCAd858907A5750b906618eA7B433d3a3 \
  "setContenthash(bytes32,bytes)" \
  "$(cast namehash bankrclub.eth)" \
  "$CONTENTHASH" \
  --private-key "$SIGNING_KEY" \
  --rpc-url https://ethereum.publicnode.com

echo ""
echo "🚀 Live at https://bankrclub.eth.limo"
echo "   CID: $CID"
echo "   IPFS: https://ipfs.io/ipfs/$CID"
