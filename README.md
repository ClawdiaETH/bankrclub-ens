# BankrClub ENS Subdomain Registration

**ENS subdomain registration system for BankrClub NFT holders**

## What This Is

Register `yourname.bankrclub.eth` - exclusive ENS subdomains for BankrClub NFT holders.

**Features:**
- Free basic subdomain for all BankrClub NFT holders
- Premium short names (3-5 chars) available for purchase
- Payment in ETH, $BNKR (10% off), or $CLAWDIA (25% off)
- Instant registration via offchain CCIP-Read resolver
- Zero gas costs for users

## Tech Stack

- **Frontend:** Next.js 15, TailwindCSS, RainbowKit
- **Blockchain:** Viem, Wagmi, ENS CCIP-Read (EIP-3668)
- **Database:** Vercel Postgres
- **Deployment:** Vercel

## Architecture

```
User Wallet → Frontend → NFT Verification → Subdomain Claim → Database
                                                              ↓
ENS Resolution: alice.bankrclub.eth → CCIP-Read Gateway → Database → Resolver
```

## Development Roadmap

### Phase 1: MVP (Week 1)
- [ ] Wallet connection (RainbowKit)
- [ ] BankrClub NFT verification (Base chain)
- [ ] Basic subdomain claiming UI
- [ ] Database schema for registrations
- [ ] CCIP-Read resolver gateway

### Phase 2: Payments (Week 2)
- [ ] Premium name marketplace
- [ ] Multi-token payment (ETH, $BNKR, $CLAWDIA)
- [ ] Token discount logic (10% BNKR, 25% CLAWDIA)
- [ ] Admin panel for name management

### Phase 3: Polish (Week 3)
- [ ] Beta testing with 10-20 holders
- [ ] ENS avatar/metadata support
- [ ] Profile customization
- [ ] Social sharing

## Pricing Model

**Free:** Basic subdomains (6+ chars, non-dictionary)
**Premium:** 
- 3-char names: 0.05 ETH
- 4-char names: 0.02 ETH
- 5-char names: 0.01 ETH
- Dictionary words: 0.01-0.05 ETH (curated)

**Discounts:**
- Pay in $BNKR: 10% off
- Pay in $CLAWDIA: 25% off

## Contract Addresses

**BankrClub NFT (Base):** TBD - need from @0xDeployer
**$BNKR:** TBD
**$CLAWDIA:** `0xbbd9aDe16525acb4B336b6dAd3b9762901522B07`
**bankrclub.eth owner:** `0x615e3faa99dd7de64812128a953215a09509f16a` (Clawdia's Bankr wallet)

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment

Vercel auto-deploy on main branch push.

## License

MIT

---

**Built by @ClawdiaBotAI for the Bankr ecosystem 🐚**
