# Agent registration — bankrclub.eth

Register a `name.bankrclub.eth` subdomain without a browser wallet.  
Works for any agent that can sign a message with a private key (Bankr wallets, ERC-8004 agents, cast, ethers, viem, etc.).

**Base URL:** `https://bankrclub-ens.vercel.app`

---

## Requirements

- BankrClub NFT held in the registering wallet
- Free names only via this API (9+ characters). Premium names (≤8 chars) require payment via the web UI at [bankrclub.eth.limo](https://bankrclub.eth.limo).

---

## Flow — raw personal_sign (no ERC-8004 needed)

### Step 1 — get a nonce

```
GET /api/agent-claim?address=0xYOUR_WALLET_ADDRESS
```

Response:
```json
{
  "nonce": "550e8400-e29b-41d4-a716-446655440000",
  "message": "bankrclub.eth agent registration\n\nI am registering a bankrclub.eth subdomain.\nAddress: 0xYOUR_WALLET_ADDRESS\nNonce: 550e8400-e29b-41d4-a716-446655440000",
  "expiresIn": 300
}
```

The nonce expires in **5 minutes**.

### Step 2 — sign the message

Sign the exact `message` string using `personal_sign` (EIP-191 prefix — `eth_sign` compatible).

**Using cast:**
```bash
cast wallet sign --private-key $PRIVATE_KEY "bankrclub.eth agent registration\n\nI am registering a bankrclub.eth subdomain.\nAddress: 0xYOUR_ADDRESS\nNonce: {nonce}"
```

**Using ethers (Node.js):**
```js
const signature = await wallet.signMessage(message);
```

**Using viem:**
```ts
const signature = await walletClient.signMessage({ message });
```

### Step 3 — claim

```
POST /api/agent-claim
Content-Type: application/json

{
  "address": "0xYOUR_WALLET_ADDRESS",
  "nonce": "550e8400-...",
  "signature": "0xabc123...",
  "subdomain": "yourname"
}
```

Success response:
```json
{
  "success": true,
  "subdomain": "yourname",
  "address": "0x...",
  "ens": "yourname.bankrclub.eth"
}
```

### Optional: launch a token on Bankr

Add to the POST body:
```json
{
  "launchTokenOnBankr": true,
  "feeRecipientType": "wallet",
  "tweetUrl": "https://x.com/yourhandle/status/123"
}
```

---

## Flow — SIWA receipt (ERC-8004 registered agents)

If you're registered in an ERC-8004 agent registry (e.g. [erc8004.com](https://erc8004.com)):

1. `POST /api/siwa/nonce` with `{address, agentId, agentRegistry}`
2. Sign the returned SIWA message
3. `POST /api/siwa/verify` → get `receipt`
4. `POST /api/agent-claim` with `X-SIWA-Receipt: {receipt}` header

---

## Errors

| Status | Meaning |
|--------|---------|
| 400 | Bad input or name validation failed |
| 401 | Auth failed (bad/expired nonce, bad signature) |
| 402 | Premium name — payment required via web UI |
| 403 | BankrClub NFT not found in wallet |
| 409 | Name taken or wallet already has a registration |
| 500 | Server error |
