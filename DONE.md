# BankrClub ENS — Build Complete ✅

Built by Clawdia 🐚 on 2026-02-20.

## What Was Built

A full Next.js 15 ENS subdomain registration app for BankrClub NFT holders with Bankr Partner API token launch integration.

### Files Created / Modified

| File | What it does |
|------|-------------|
| `app/providers.tsx` | WagmiProvider + QueryClientProvider + RainbowKitProvider (Base mainnet, SSR-safe) |
| `app/layout.tsx` | Wraps app in Providers |
| `app/page.tsx` | Entry point (SSR-disabled via `next/dynamic`) |
| `app/components/HomeClient.tsx` | Full 3-state claiming UI (not connected / not holder / holder) |
| `lib/db.ts` | Vercel Postgres helpers (check availability, register, update token info) |
| `lib/nftVerify.ts` | BankrClub NFT ownership verification on Base via viem |
| `lib/bankrApi.ts` | Bankr Partner API client (simulateOnly when no key) |
| `lib/ensResolver.ts` | EIP-3668 CCIP-Read response encoding/signing |
| `lib/config.ts` | Updated with $BNKR TBD note + Bankr partner integration docs |
| `app/api/check/route.ts` | GET /api/check?name= — availability check with validation |
| `app/api/claim/route.ts` | POST /api/claim — NFT verify → register → optional token launch |
| `app/api/resolve/[...params]/route.ts` | CCIP-Read ENS gateway for bankrclub.eth subdomains |
| `app/api/init-db/route.ts` | One-time DB schema setup endpoint |
| `contracts/OffchainResolver.sol` | EIP-3668 offchain resolver contract for Ethereum mainnet |
| `scripts/deploy-resolver.sh` | Deploy script using Foundry |
| `.env.example` | All environment variables documented |

### Frontend UX

Three states:
1. **Not connected** — ConnectButton + hero + features grid
2. **Connected, not holder** — NFT required message + OpenSea link
3. **Connected + holder** — Claim form with:
   - Debounced availability check (500ms, ✓/✗ indicator)
   - "Launch my token on Bankr" toggle (default ON, explains 57% fee share)
   - Loading state during claim
   - Success state with ENS name + token address + Dexscreener link

### Architecture

```
User → Next.js app (Vercel)
         ├── /api/check → validate + DB availability check
         ├── /api/claim → NFT verify (Base RPC) → DB register → Bankr API
         └── /api/resolve/[sender]/[calldata] → CCIP-Read gateway
                                                      ↓
ENS resolver (OffchainResolver.sol on Ethereum mainnet)
```

---

## Manual Steps for Jake 🎯

### 1. Create Vercel Postgres DB
- Go to [vercel.com](https://vercel.com) → Storage → Create Database → Postgres
- Copy the `POSTGRES_URL` connection string

### 2. Generate gateway signing key
```bash
cast wallet new
# Save the private key → GATEWAY_SIGNING_KEY
# Save the address → GATEWAY_SIGNER_ADDRESS
```

### 3. Create WalletConnect project
- Go to [cloud.walletconnect.com](https://cloud.walletconnect.com)
- Create new project → copy the Project ID → `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`

### 4. Connect repo to Vercel
- [vercel.com](https://vercel.com) → New Project → Import `ClawdiaETH/bankrclub-ens`

### 5. Add environment variables to Vercel dashboard
Copy all vars from `.env.example` and fill them in:
- `POSTGRES_URL` — from step 1
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — from step 3
- `GATEWAY_SIGNING_KEY` — from step 2
- `GATEWAY_SIGNER_ADDRESS` — from step 2
- `BANKR_PARTNER_KEY` — set to `pending` for now (see step 8)
- `NEXT_PUBLIC_GATEWAY_URL` — `https://bankrclub-ens.vercel.app`

### 6. Initialize the database (one-time)
After deploying to Vercel, visit:
```
https://bankrclub-ens.vercel.app/api/init-db
```
This creates the `registrations` table + indexes.

### 7. Deploy OffchainResolver.sol
```bash
SIGNING_PUBKEY=<GATEWAY_SIGNER_ADDRESS> bash scripts/deploy-resolver.sh
```
Requires Foundry (`forge`). The script prints the `cast send` command to point `bankrclub.eth` to the deployed resolver.

### 8. Update bankrclub.eth ENS resolver
After step 7, run the printed `cast send` command to point the ENS Public Resolver to the deployed `OffchainResolver` contract. This requires the wallet that owns `bankrclub.eth` (`0x615e3faa99dd7de64812128a953215a09509f16a`).

### 9. Get Bankr Partner API key
DM **@0xDeployer** on X or Farcaster. A partner key enables real token deploys (57% of trading fees to token creator). Without it, the app runs `simulateOnly` mode (safe fallback — tokens shown but not actually deployed).

### 10. Push to main → Vercel auto-deploys
```bash
git push origin main
```

---

## Key Addresses (reference)

| Name | Address | Chain |
|------|---------|-------|
| BankrClub NFT | `0x9FAb8C51f911f0ba6dab64fD6E979BcF6424Ce82` | Base |
| $CLAWDIA | `0xbbd9aDe16525acb4B336b6dAd3b9762901522B07` | Base |
| $BNKR | TBD — update `lib/config.ts` when deployed | Base |
| ENS domain owner | `0x615e3faa99dd7de64812128a953215a09509f16a` | Ethereum |
| Bankr API | `https://api.bankr.bot/token-launches/deploy` | — |

---

## Notes

- The two warnings in `npm run build` output are from optional dev deps in MetaMask SDK and WalletConnect packages — not our code, not breaking.
- Token launches are safe by default: `simulateOnly=true` when `BANKR_PARTNER_KEY=pending`. No real tokens deployed until you get the partner key.
- CCIP-Read gateway (`/api/resolve`) returns unsigned responses in dev (no `GATEWAY_SIGNING_KEY`). Needs signing key + deployed resolver for production ENS resolution to work.

---

## IPFS / ENS Hosting Pipeline

**Deploy to `bankrclub.eth.limo`** (frontend on IPFS, API stays on Vercel):

```bash
# Set the Vercel URL as the API target, then run the deploy script
NEXT_PUBLIC_API_URL=https://bankrclub-ens.vercel.app bash scripts/deploy-ipfs.sh
```

**What it does:**
1. Builds a fully static export (`NEXT_PUBLIC_IPFS_BUILD=true` → `output: 'export'`)
2. Uploads the `out/` directory to IPFS via Pinata
3. Updates `bankrclub.eth` contenthash via the ENS Public Resolver on Ethereum mainnet

**Architecture with IPFS:**
```
https://bankrclub.eth.limo  →  IPFS (static frontend)
                                    ↓ API calls
                          https://bankrclub-ens.vercel.app  (API routes)
```

**Requirements:** `pinata_jwt` and `signing_key` in macOS Keychain (via `~/clawd/scripts/get-secret.sh`).

**Note on contenthash encoding:** The script uses a basic UTF-8 CID encoding. If ENS resolution breaks, verify the hex encoding at https://content-hash.now.sh and update the `CONTENTHASH` line in `scripts/deploy-ipfs.sh`.
