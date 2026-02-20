#!/bin/bash
# Deploy OffchainResolver to Ethereum mainnet
# Requires: forge (Foundry), GATEWAY_URL, SIGNING_PUBKEY env vars, and a wallet with ETH
#
# Usage:
#   SIGNING_PUBKEY=0xYourSignerAddress GATEWAY_URL=https://bankrclub-ens.vercel.app/api/resolve \
#     bash scripts/deploy-resolver.sh

set -e

SIGNING_KEY=$(~/clawd/scripts/get-secret.sh signing_key)
GATEWAY_URL="${GATEWAY_URL:-https://bankrclub-ens.vercel.app/api/resolve}"
SIGNING_PUBKEY="${SIGNING_PUBKEY:-0xYourGatewaySignerAddress}"

if [ "$SIGNING_PUBKEY" = "0xYourGatewaySignerAddress" ]; then
  echo "❌ Set SIGNING_PUBKEY env var to your gateway signer address"
  echo "   Generate one with: cast wallet new"
  exit 1
fi

echo "📦 Deploying OffchainResolver..."
echo "   Gateway URL : $GATEWAY_URL"
echo "   Signer      : $SIGNING_PUBKEY"
echo ""

forge create contracts/OffchainResolver.sol:OffchainResolver \
  --constructor-args "$GATEWAY_URL" "$SIGNING_PUBKEY" \
  --private-key "$SIGNING_KEY" \
  --rpc-url https://eth.llamarpc.com \
  --verify

echo ""
echo "✅ Deploy complete! After deployment, point bankrclub.eth to this resolver:"
echo ""
echo "cast send 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e \\"
echo "  'setResolver(bytes32,address)' \\"
echo "  \$(cast namehash bankrclub.eth) <DEPLOYED_ADDRESS> \\"
echo "  --private-key \$SIGNING_KEY \\"
echo "  --rpc-url https://eth.llamarpc.com"
