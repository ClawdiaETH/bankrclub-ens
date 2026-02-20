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
NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://bankrclub-ens.vercel.app}" \
  NODE_OPTIONS="--require ./lib/polyfill-localstorage.cjs" \
  npm run build

echo "📦 Uploading to Pinata..."
RESPONSE=$(curl -s -X POST "https://api.pinata.cloud/pinning/pinFileToIPFS" \
  -H "Authorization: Bearer $PINATA_JWT" \
  -F "file=@out" \
  --form-string 'pinataMetadata={"name":"bankrclub-ens"}' \
  --form-string 'pinataOptions={"cidVersion":1}')

CID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['IpfsHash'])")
if [ -z "$CID" ]; then
  echo "❌ Pinata upload failed. Response: $RESPONSE"
  exit 1
fi

echo "✅ CID: $CID"
echo "🔗 Updating bankrclub.eth contenthash..."

# Encode as IPFS contenthash: e3010170 prefix + UTF-8 CID bytes
# Note: for production use https://content-hash.now.sh to verify the encoding
CONTENTHASH=$(python3 -c "cid='$CID'; print('0xe3010170' + cid.encode().hex())")

cast send 0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41 \
  "setContenthash(bytes32,bytes)" \
  "$(cast namehash bankrclub.eth)" \
  "$CONTENTHASH" \
  --private-key "$SIGNING_KEY" \
  --rpc-url https://eth.llamarpc.com

echo ""
echo "🚀 Live at https://bankrclub.eth.limo"
echo "   CID: $CID"
echo "   IPFS: https://ipfs.io/ipfs/$CID"
