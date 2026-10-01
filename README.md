# NUBI AI (A.A.L.D.I aka Agentic AI Living Digital IP) — Rare Apepes Companion

**As** the Rare Labs operator,
**I want** the RARE SYNC holder flow proven end to end on a Vercel Preview with a real holding wallet,
**so that** production promotion is a verified decision rather than an assumption.
 
---
 
## Acceptance criteria
 
1. Anonymous Nubi chat works on the Preview with no wallet connected and no added friction.
2. Wallet links through the existing Privy/Glyph flow without modification.
3. Pressing RARE SYNC presents a plain signature message that states it does not authorize a transaction.
4. After signing, owned assets across all four approved collections are detected and displayed correctly.
5. `SYNC SIGNAL` completes and Sync Score renders.
6. For a wallet owning more than 24 assets, an item **beyond the first 24** is selectable as Active Sync Asset.
7. Sending Nubi a message completes `DIRECT CHANNEL` after a RARE SYNC refresh.
8. Opening RAK 3022 from the integrated Play button and keeping the modal open ≥5 minutes completes `ENTER RAK 3022` after close + refresh.
9. Closing and reopening the browser tab preserves the session until 24-hour expiry.
10. Switching to a second wallet does **not** expose the first wallet's Sync Score or activity.
11. A bare wallet address without its RARE SYNC session cannot read, load, update, or delete private Nubi memory via `/api/brain`.
12. A wallet owning none of the approved assets may verify wallet control but remains ineligible.
13. The full flow passes at a mobile-width viewport.
14. Closing the RAK modal while `game_start` is still in flight does not orphan a game session.
---
 
## Dev notes — embedded context
 
**Do not read the whole repo. Everything needed is here.**
 
### Relevant modules
- `lib/rare-sync/auth.js` — `createChallenge` (single-use nonce, 10 min), `verifyChallenge`, `createSession` (random, 24h), `getSession`
- `lib/rare-sync/eligibility.js` — `getEligibleHoldings`, OpenSea V2 across all four collections, fails closed on partial data or pagination ceiling
- `lib/rare-sync/profile.js` — `verifyAndUpdateProfile`, `selectActiveAsset`, `markNubi`, `startGame`, `stopGame`
- `lib/rare-sync/score.js` — `utcDay`, `blankDaily`, `calculateScore`, `completedBounties`, `dailyXp`
- `components/RareSyncPanel.js` — entire UI surface
- `pages/api/rare-sync/{challenge,sync,status,activity,health}.js`
### Bounty definitions (source of truth: `RARE_SYNC.dailyBounties` in `lib/rare-sync/config.js`)
| Key | Trigger | XP |
| --- | --- | --- |
| `sync` | Verified eligible wallet | 100 |
| `nubi` | Successful Nubi reply after sync | 150 |
| `rak` | Authenticated RAK session ≥300s | 250 |
 
Day boundaries are **UTC**, via `utcDay()`. Game session is capped at 2 hours server-side.
 
### Approved collections
- Rare Apepes `0x31d45de84fde2fb36575085e05754a4932dd5170` (721)
- Zombie Apepes `0xf902a8baf88793ddf636a8791bd55a62b71c9ef4` (721)
- Apepe Odyssey `0x1e50c58f9d26298a9c7c4f3050c43eb29ea4a0f0` (1155)
- Apepe Loot `0x86440bb01856c2f537498f3de1413ca345d578f6` (1155)
### Environment (points mode)
`NEXT_PUBLIC_RARE_SYNC_MODE=points`, `NEXT_PUBLIC_RARE_SYNC_CHAIN_ID=46630`. Token/rewards/signer/TBA vars must be **blank**. `OPENSEA_API_KEY` is required — OpenSea V2 account-NFT API needs `x-api-key`.
 
### Constraints
- This story is **test execution only**. If a defect is found, raise a new story; do not patch opportunistically inside this one.
- Do not modify the live RAK deployment. The embedded game points at the existing public URL.
- Do not weaken session binding to make a test pass.
---
 
## Testing
 
Execute AC1–14 in order on the Preview URL. For each, record: pass/fail, browser, wallet address used (holder vs non-holder), and screenshot for AC4, AC6, AC10.
 
**Cross-wallet isolation (AC10, AC11) is the release-blocking test.** Any leakage of one wallet's private data to another halts the epic.
 
Suggested wallets: one owning >24 assets across at least two collections; one owning exactly one asset; one owning none.
 
---
 
## Definition of done
 
All 14 criteria pass on desktop and mobile viewport, evidence recorded, no open P1 defects. Story 1.7 (promote to production) is unblocked only on this.
 
---
 
## Dev agent record
 
_To be completed by the implementing agent._
 
- Agent/model used:
- Debug log:
- Completion notes:
- File list changed:
