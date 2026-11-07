# Roadmap — shared simulation layer

- [x] 1. `src/lib/sim/`: seeded RNG + `generateDataset(seed)` (interconnected customers, accounts, ledger, transfers, payouts, cards, card txns, funding, settlements)
- [x] 2. Test/Live environments: two isolated datasets from fixed seeds, toggle swaps dataset
- [x] 3. Mutation persistence: sim stores persist overlays to localStorage, hydrated post-mount via `hydrateSimStores()` in AppShell; demo money stays pending
- [x] 4. Transactions + Balances migrated onto sim (ledger/accounts/transfers/payouts stores, balance-history store-derived)
- [x] 5. Cards migrated onto sim (cards, card txns, funding, activity; totals derived)
- [x] 6. Insights + Dashboard consume the same stores (consistent by construction)
- [x] 8. Griv AI tools read the shared dataset in both environments (simulated, labelled)
- [x] 9. Tests: determinism, referential integrity, cross-module reconciliation (192 passing)

## Follow-ups (not started)
- [ ] 7. Migrate Invoices / Payment Links / Commerce (orders, POS, virtual accounts) onto sim-generated records with cross-references (ledger `linkId`/`invoiceId`/`orderId`)
- [ ] Griv AI UI redesign from the brief (conversation-first layout, rich response components, contextual drawer)
- [ ] Simulated AI actions that write mutation-log events (fund card, create invoice) with confirmation previews
