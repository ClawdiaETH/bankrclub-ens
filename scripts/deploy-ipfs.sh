#!/bin/bash
# deploy-ipfs.sh — Build static export, upload to Pinata, set ENS contenthash
# Deployed: 2026-02-22
# CID: QmeNVogmzKAG4m3A2BXP94412ScTAaAB6jJzBGfFA5VrAV
# TX: 0x4e33e6434a70a90da7a67d25c203f279864054b68ec82201c78b3b399c5d90f0
set -e

PINATA_JWT=$(~/clawd/scripts/get-secret.sh pinata_jwt 2>/dev/null)
SIGNING_KEY=$(~/clawd/scripts/get-secret.sh signing_key 2>/dev/null)
RESOLVER="0x3a62109CCAd858907A5750b906618eA7B433d3a3"
RPC="https://eth-mainnet.public.blastapi.io"

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

# Temporarily hide API routes (force-dynamic not compatible with static export)
trap 'mv /tmp/api-routes-bak-deploy app/api 2>/dev/null' EXIT
mv app/api /tmp/api-routes-bak-deploy

NEXT_PUBLIC_IPFS_BUILD=true \
  NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://bankrclub-ens.vercel.app}" \
  DATABASE_URL="postgresql://localhost/dev" \
  NODE_OPTIONS="--require ./lib/polyfill-localstorage.cjs" \
  npm run build || { mv /tmp/api-routes-bak-deploy app/api; exit 1; }

mv /tmp/api-routes-bak-deploy app/api
echo "✅ Static export ready ($(find out -type f | wc -l | tr -d ' ') files)"

echo "📦 Uploading to Pinata..."
UPLOAD_SCRIPT=$(mktemp /tmp/pinata-upload-XXXX.mjs)
cat > "$UPLOAD_SCRIPT" << 'JSEOF'
import fs from 'fs';
import path from 'path';
const PINATA_JWT = process.env.PINATA_JWT;
const OUT_DIR = process.argv[2];
function walkDir(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(full));
    else results.push(full);
  }
  return results;
}
const files = walkDir(OUT_DIR);
const formData = new FormData();
for (const file of files) {
  const rel = path.relative(OUT_DIR, file);
  formData.append('file', new File([fs.readFileSync(file)], rel));
}
formData.append('pinataMetadata', JSON.stringify({ name: 'bankrclub-ens' }));
formData.append('pinataOptions', JSON.stringify({ cidVersion: 0, wrapWithDirectory: true }));
const resp = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
  method: 'POST',
  headers: { Authorization: `Bearer ${PINATA_JWT}` },
  body: formData,
});
const json = await resp.json();
console.log(JSON.stringify(json));
JSEOF

RESPONSE=$(PINATA_JWT="$PINATA_JWT" node "$UPLOAD_SCRIPT" "$(pwd)/out")
rm -f "$UPLOAD_SCRIPT"

CID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['IpfsHash'])")
if [ -z "$CID" ]; then
  echo "❌ Pinata upload failed. Response: $RESPONSE"
  exit 1
fi
echo "✅ CID: $CID"

echo "🔗 Encoding ENS contenthash..."
# ENS IPFS contenthash = varint(ipfs-namespace=0xe3) + CIDv1 bytes
# For CIDv0 (Qm...): prefix e3 01 01 70 + bs58decode(CID)
ENS_DEPLOY_DIR="$HOME/clawd/scripts/ens-deploy"
CONTENTHASH=$(node -e "
const bs58 = require('$ENS_DEPLOY_DIR/node_modules/bs58').default;
const decoded = bs58.decode('$CID');
const prefix = Buffer.from('e3010170', 'hex');
console.log('0x' + Buffer.concat([prefix, decoded]).toString('hex'));
")
echo "Contenthash: $CONTENTHASH"

echo "⛓️  Setting contenthash on ENS resolver..."
set +e
CAST_OUTPUT=$(cast send "$RESOLVER" \
  "setContenthash(bytes32,bytes)" \
  "$(cast namehash bankrclub.eth)" \
  "$CONTENTHASH" \
  --private-key "$SIGNING_KEY" \
  --rpc-url "$RPC" \
  --json)
CAST_EXIT=$?
set -e
if [ $CAST_EXIT -ne 0 ]; then
  echo "❌ cast send failed (exit code $CAST_EXIT)"
  echo "$CAST_OUTPUT"
  exit 1
fi
TX=$(echo "$CAST_OUTPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('transactionHash',''))")
if [ -z "$TX" ]; then
  echo "❌ Failed to extract transaction hash from cast output"
  echo "$CAST_OUTPUT"
  exit 1
fi

echo ""
echo "🚀 Deployed!"
echo "   CID: $CID"
echo "   TX:  $TX"
echo "   IPFS: https://ipfs.io/ipfs/$CID"
echo "   ENS:  https://bankrclub.eth.limo"
