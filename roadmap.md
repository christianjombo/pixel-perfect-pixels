# Roadmap — shared simulation layer

- [ ] 1. `src/lib/sim/`: seeded RNG + `generateDataset(seed)` (interconnected customers, accounts, ledger, transfers, payouts, invoices, payment links, cards, card txns, funding, settlements, orders, products, subscriptions)
- [ ] 2. Test/Live environments: two isolated datasets from fixed seeds, toggle swaps dataset
- [ ] 3. Mutation log in localStorage replayed over base dataset; demo money stays pending
- [ ] 4. Migrate Transactions + Balances onto sim
- [ ] 5. Migrate Cards onto sim
- [ ] 6. Migrate Insights + Dashboard onto sim
- [ ] 7. Migrate Invoices / Payment Links / Commerce onto sim
- [ ] 8. Griv AI tools read shared accessors
- [ ] 9. Tests: determinism, referential integrity, cross-module consistency; keep existing suites green
