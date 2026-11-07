# Shared simulation layer for the whole Griv prototype

## Goal

Replace the per-module hardcoded sample stores with one shared, seeded, interconnected simulated dataset that every module — Cards, Insights, Transactions, Balances, Dashboard, Invoices, Payment Links, Transfers, Commerce and Griv AI — reads from. This removes the inconsistencies between pages (e.g. card totals that don't match any transactions, balances that don't match the ledger) and gives the future backend a single data-access interface to implement.

## What exists today

- Each module owns a small isolated store in `src/lib/demo/` (ledger: 60 generated rows with fake names; cards: 27 hardcoded cards with invented totals; accounts/balances: 6 hardcoded wallets; transfers, payouts, invoices, payment links, orders, POS: separate literals). Nothing references anything else.
- `src/lib/demo-store.ts` provides a tiny in-memory store that resets on reload.
- Test/Live toggle exists but barely changes data.

## Design

### 1. New `src/lib/sim/` module — the shared foundation

- `rng.ts` — deterministic seeded PRNG (mulberry32) + helpers (pick, weighted pick, date spread).
- `dataset.ts` — `generateDataset(seed)` builds one interconnected "world" for the primary demo business (Nova Retail Ltd.):
  - customers (~2,000), balance accounts, payment links, invoices, virtual accounts, cards, products/orders, subscriptions
  - ~10,000 payment transactions, ~1,000 transfers, ~1,500 card transactions, ~500 card funding events, settlements, refunds, fees
  - **Referential integrity everywhere:** every payment references a real customer and (when applicable) a payment link, invoice or order; card transactions reference real cards; funding events reference a card and a source balance account; refunds reference their original payment; settlements reference their underlying transactions.
  - **Derived, never invented:** balance account amounts are computed from ledger movements; card `totalSpent`/`available` come from its transactions and funding; Insights aggregates come from the same ledger.
  - **Business scenarios baked in:** a strong-growth month, a week of elevated card failures, a few delayed settlements, overdue invoices, low-stock products, weekend sales patterns — generated deterministically from the seed.
- Efficient generation (loops, not a giant JSON file); indexes (by id, by customer, by card, by date) built once; pages query through paginated/aggregated accessors, never render 10k rows.

### 2. Environments — Test and Live

- Two isolated datasets from two fixed seeds: `live` (production-like) and `test` (smaller sandbox for experimenting).
- The existing Test/Live toggle switches the active dataset; AI conversations stay scoped per environment (already the case).

### 3. Persistence & mutations

- Base dataset regenerates deterministically on load (fixed seed → identical data, no random churn between pages).
- User/demo actions (refund requests, card funding, transfers, invoice creation…) are recorded as an append-only **mutation log in localStorage**, replayed on top of the base dataset on load — so changes survive refresh and propagate to every page, and a "reset demo data" path is trivial.
- Existing rule kept: demo money movements stay pending/processing, never fake-complete.

### 4. Migrate modules onto the shared layer

Phase order (each phase keeps the app green):
1. **Transactions + Balances** — ledger, transfers, payouts, accounts read from the sim dataset; `mergeTxns` consumes sim records; balance history derived from ledger.
2. **Cards** — card list/details, spending totals, funding records and card transactions come from the sim; funding actions write mutation-log events that update both the card and the source balance.
3. **Insights + Dashboard** — aggregate the same ledger (currency-scoped, never summed across currencies), so figures match Transactions exactly.
4. **Invoices / Payment Links / Commerce** — move their stores onto sim-generated records (keeping existing builder/editor flows working against the same IDs).
5. **Griv AI** — tools query the shared dataset through the same accessors the pages use (no AI-specific data).

### 5. Tests

- Determinism: same seed → identical dataset.
- Referential integrity: every transaction's customer/link/invoice/card references resolve; refund parents exist.
- Cross-module consistency (brief's acceptance scenarios): Insights "collections in October (NGN)" equals the sum of the matching ledger rows; a card's spent total equals the sum of its settled card transactions; balance available equals derived ledger balance minus holds.
- Existing suites keep passing (adapted where they asserted old hardcoded values).

## What this does NOT include (yet)

- The Griv AI UI redesign from the brief (conversation-first layout, rich response components) — separate follow-up once the data foundation is in.
- Real backend persistence — the layer is browser-side but behind accessor functions shaped like the future API.
