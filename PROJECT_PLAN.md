# BankrClub ENS - Build Plan

**Target:** MVP by Feb 24th, 2026
**Builder:** Clawdia (autonomous)
**Owner:** starl3xx

---

## Week 1: Core Infrastructure (Feb 18-24)

### Day 1 (Today, Feb 17):
- [x] Project setup (Next.js, TypeScript, Tailwind)
- [ ] Install dependencies (RainbowKit, Wagmi, Viem)
- [ ] Basic app structure
- [ ] Wallet connection page

### Day 2-3 (Feb 18-19):
- [ ] BankrClub NFT verification logic
- [ ] Database schema (Vercel Postgres)
- [ ] Basic claiming UI
- [ ] Name availability check

### Day 4-5 (Feb 20-21):
- [ ] CCIP-Read resolver gateway
- [ ] ENS subdomain registration flow
- [ ] Test with local ENS resolver

### Day 6-7 (Feb 22-24):
- [ ] Deploy to Vercel
- [ ] Configure bankrclub.eth resolver
- [ ] End-to-end testing
- [ ] **MVP COMPLETE**

---

## Week 2: Payments & Premium Names (Feb 25 - Mar 3)

### Features:
- Premium name marketplace
- Multi-token payment (ETH, $BNKR, $CLAWDIA)
- Token discount logic:
  - **10% off with $BNKR**
  - **25% off with $CLAWDIA**
- Admin panel for name curation

---

## Week 3: Beta Testing (Mar 4-10)

### Goals:
- Invite 10-20 BankrClub holders
- Collect feedback
- Fix bugs
- Optimize UX

---

## Week 4: Launch (Mar 11-17)

### Launch sequence:
1. **DM @0xDeployer** with working product (Mar 11)
   - "Built this for BankrClub holders, want to feature it?"
   - Offer co-promotion
   - Position as complementary, not competitive

2. **Wait for response** (Mar 11-13)
   - If positive: Coordinate launch announcement
   - If neutral: Launch independently with Bankr credit
   - If negative: Pivot strategy (unlikely)

3. **Public launch** (Mar 14)
   - Twitter thread with demo video
   - Farcaster announcement
   - Post in Bankr Discord (if permitted)

4. **Growth phase** (Mar 15-17)
   - Showcase early adopters
   - Social proof flywheel
   - Monitor registrations

---

## Key Decisions Made

### Technical:
- ✅ Use bankrclub.eth (we own it)
- ✅ CCIP-Read offchain resolver (zero gas)
- ✅ Next.js + Vercel stack
- ✅ Vercel Postgres for data

### Pricing:
- ✅ Free basic names (6+ chars, non-dictionary)
- ✅ Premium names: 0.01-0.05 ETH
- ✅ 10% off with $BNKR
- ✅ 25% off with $CLAWDIA

### Strategy:
- ✅ Build first, pitch second
- ✅ Get @0xDeployer blessing before public launch
- ✅ Position as ecosystem infrastructure
- ✅ Credit Bankr prominently

---

## Open Questions

1. **BankrClub NFT contract address on Base?**
   - Need from @0xDeployer or find onchain

2. **$BNKR token address?**
   - Need for payment processing

3. **Premium name curation strategy?**
   - Dictionary API?
   - Manual curation?
   - Community voting?

4. **Revenue split with Bankr?**
   - Offer @0xDeployer 10-20% of premium sales?
   - Or keep 100% but credit him heavily?

---

## Success Metrics

### MVP (Week 1):
- Working wallet connection
- BankrClub NFT verification
- Basic name claiming
- ENS resolution working

### Beta (Week 3):
- 10-20 test registrations
- Zero critical bugs
- Positive feedback from testers

### Launch (Week 4):
- @0xDeployer endorsement
- 75+ registrations by end of week
- 3+ premium name sales

### Month 1:
- 150+ total registrations
- $1,000+ revenue
- Integration discussions with Bankr

---

**Status:** Day 1 in progress
**Next:** Install dependencies, build wallet connection page
