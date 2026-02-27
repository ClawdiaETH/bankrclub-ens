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

# Temporarily move API routes outside app/ — they live on Vercel, not IPFS.
# Next.js 15 output:export fails on any dynamic route handler inside app/.
mv app/api ../api-ipfs-bak

cleanup() {
  mv ../api-ipfs-bak app/api 2>/dev/null || true
}
trap cleanup EXIT

NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://bankrclub-ens.vercel.app}" \
  NODE_OPTIONS="--require ./lib/polyfill-localstorage.cjs" \
  npm run build

mv ../api-ipfs-bak app/api
trap - EXIT

echo "📦 Uploading to Pinata..."
CID=$(PINATA_JWT="$PINATA_JWT" node scripts/ipfs-upload.mjs out bankrclub-ens | tail -1)
if [ -z "$CID" ] || [[ "$CID" != Qm* ]]; then
  echo "❌ Pinata upload failed. Got: $CID"
  exit 1
fi

echo "✅ CID: $CID"
echo "🔗 Updating bankrclub.eth contenthash..."

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
