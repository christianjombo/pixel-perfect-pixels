# Roadmap

## Dashboard pages (brief: Design Griv Dashboard Pages)
- [x] Shared building blocks (page header, tables, filters, drawers, dialogs, status badges, money formatting, sample data)
- [x] Main menu links + phone menu
- [x] Balances
- [x] Transactions
- [x] Payments
- [x] Transfers
- [x] Payouts
- [x] Payment Links
- [x] Invoices
- [x] Virtual Accounts
- [x] Online Store
- [x] Orders
- [x] Products
- [x] Inventory
- [x] POS
- [ ] Finish browser checks: create flows on Transfers, Payouts, Payment Links, Invoices, Products, Virtual Accounts; tablet and phone layouts (paused at user's request)

## Dashboard redesign (brief: redesign Dashboard page only)
- [x] Three-state preview store + switcher ("Preview dashboard state": new / verified / active)
- [x] Mock data: checklist, quick actions, feature cards, resources, range helpers (src/lib/demo/dashboard.ts)
- [x] New merchant state (verification card, checklist, quick actions, resources)
- [x] Verified merchant state (activation card, checklist, feature cards, limited overview)
- [x] Active merchant state (KPIs vs previous period, money-flow chart, insights, action required, unified ledger)
- [x] Honest preview dialogs for flows not wired up in the demo
- [x] Verify: tests (24 pass incl. 9 new dashboard-state tests), typecheck, browser check of all three states + filters, drawer, honest previews and mobile layout

## Transactions consolidation + Balances redesign (brief: Griv Transactions)
- [x] Sidebar: remove Transfers and Payouts entries; keep their routes, flows and data intact
- [x] Unified Transactions page (type tabs over one merged dataset, New transfer / Create payout / Bulk payout menu, per-type details, /transactions?q= deep link)
- [x] Advanced Filters panel (type, status, method, amount operators, date from/to, reference, payment channel, pay-in type, currency, recipient, account, original reference, keyword; Clear + Apply; draft preserved when collapsed)
- [x] Balances redesign (currency tabs, pending/available overview, Add Funds / Withdraw / Convert actions, Balance History with consistent running balances, prototype Lien History, per-currency export)
- [x] Browser checks of the new Transactions filters and the Balances redesign (desktop + phone)

## Transactions redesign (brief: MailerSend Emails-page reference)
- [x] Header: title + description only; "Show for: All transactions ▼" selector (All / Deposits / Withdrawals / Transfers)
- [x] Filter container: row 1 reference, date-range picker, status, currency; More filters expands to customer, amount min–max, method, channel, provider, source/destination account, transaction ID; Clear filters + Search apply/clear everything
- [x] Table: count + Export (CSV / CSV for Excel) toolbar, Status/Reference/Customer/Type/Amount/Fee/Channel/Date columns, soft status badges, dark failure-reason tooltips
- [x] Pagination: View 10/25/50/100 (default 25), "1–N of total" with disabled prev/next at the edges
- [x] Data: provider + internal TXN id + product origin + failure reasons on every transaction; details drawer shows them
- [x] Tests (39 pass incl. redesign rules), typecheck, browser checks desktop + phone (no console errors)


## Unified dashboard redesign (brief: MailerLite reference)
- [x] Remove three-state preview switcher; one adaptive dashboard for every merchant
- [x] Onboarding checklist (3 tasks, hides when complete) + Performance overview card
- [x] Payments / Balances & settlements / Payment links / Invoices / E-commerce sections with minimal charts, shared period + currency selectors
- [x] Tests updated (dashboard-unified.test.ts, 33 pass)
- [x] Browser check of the unified dashboard (desktop + phone, no console errors)

## Balances — second style preview (Transactions style)
- [x] New page at /balances-preview: same balances data, rebuilt in the MailerSend/Transactions style (Show for currency selector, one filter container with More filters, count + Export toolbar, Balance/Lien History tabs, View 10/25/50/100 pagination footer)
- [x] Original /balances untouched; cross-links between the two designs ("See this page in the Transactions style" / "Original style")
- [x] Typecheck, 39 tests, desktop + phone browser checks (no console errors)

## Payment Link details page redesign (brief: Stripe reference)
- [x] Stripe-style header: breadcrumb, name + "for" price, URL field with copy, Add URL parameters / Embed buy button / Download QR code, ⋯ menu (Change name, Edit, Add note, Copy to live mode, divided Deactivate/Activate with confirmation)
- [x] Overview | Payments and analytics tabs; two-column Overview with tips carousel on the right
- [x] Adaptive Products table (fixed vs preset/min/max vs recurring interval), conditional Shipping, Payment methods with Manage dialogs, dynamic Details, editable Metadata, Events and Logs
- [x] Analytics tab: live metrics + chart, Test-mode "analytics are only available for live data" state, Recent payments with View all deep link to /transactions
- [x] Tests (link-details-rules.test.ts, 49 pass), typecheck, desktop + phone browser checks (no console errors)

- [x] Link builder data model + draft store (src/lib/demo/link-builder.ts): builder config from/to PaymentLink, validation, CTA + interval helpers
- [x] Full-screen workspace route /payment-links/new and /payment-links/$linkId_/edit (top bar, Test/Live indicator, two columns 40/60, mobile Configure/Preview toggle)
- [x] Payment page tab: Select type (Products or subscriptions / Customers choose what to pay), product picker, selected product cards with qty + adjustable quantity, recommended products, inline interval-mismatch errors
- [x] Add/Edit product drawer: info + image, More options (statement descriptor, unit label, metadata, marketing features), Recurring/One-off pricing, billing period, additional prices, Show preview panel
- [x] Flexible payment section: title, description, image, category, tax, currency, preset amount, limits
- [x] Options: tax, names (optional), business names (optional), addresses (billing / billing+shipping), phone, free trial (recurring only), limit number of payments
- [x] Advanced options: custom field builder (text / numbers / dropdown + Add options modal with reordering and options-left counter), promotion codes, tax IDs, save payment details, terms, call-to-action select
- [x] After payment tab: confirmation page vs redirect, custom message, post-payment invoice
- [x] Live checkout preview (desktop/mobile): merchant identity, line items, recommended add-ons, dynamic customer fields, custom fields, payment methods, CTA, terms, promo codes; confirmation + invoice previews
- [x] Validation, unsaved-changes guard, create updates linksStore and opens the details page; edit preserves unrelated configuration
- [x] Rewire list + details entry points to the workspace; retire the old LinkForm dialog
- [x] Tests (builder rules), typecheck, build, browser checks

## Invoice details page (Stripe-style) — done 29 Oct 2026
- [x] Shared invoice store (`invoicesStore`) so listing and details stay in sync; listing rows open the details page instead of the drawer
- [x] Route pair like payment links: `invoices.tsx` parent shell (Outlet) + `invoices.index.tsx` list + `invoices.$invoiceId.tsx` detail
- [x] Header: breadcrumb, invoice number + status badge, billed-to line, hosted URL copy, Download PDF, status-aware actions (Edit/Send/Charge/More: duplicate, copy link, record external payment, credit note, void, delete draft, mark-as-paid honesty dialog)
- [x] Main column: Recent activity + Add note, two-column Summary, line items with totals (paid + remaining = total), Tax calculation, restrained Accounting empty state, Payments table linked to Transactions, Credit notes with remaining-creditable cap, Logs|Events Activity tabs with Refresh
- [x] Right column: Details (ID copy, created/finalized, payment page, enabled payment methods by currency) and editable Metadata
- [x] Real PDF download via pdf-lib (pdfMoney uses "NGN" prefix; status uses derived invoice status); visual QA via pdftoppm
- [x] InvoiceEditor gained an `initial` prop for editing existing invoices from the details page
- [x] Rules tests (totals, credit-note cap, status-aware actions, pending external payments, derived activity/events/logs); typecheck + full suite + desktop/mobile browser checks with no console errors

## Invoice creation, review & sharing (Stripe-style) — 29 Oct 2026
- [x] Dedicated editor at /invoices/new and /invoices/$id/edit inside the app shell; live PDF / Email / Payment page preview; Hide preview; mobile Edit/Preview switch
- [x] Customer search + add/edit customer dialog; currency change confirms and clears items (no FX)
- [x] Catalogue product search (NGN only) + custom items with inline editor; errors only after a save/review attempt
- [x] Invoice + line discounts (fixed/%), configured tax rates (exclusive/inclusive) with Create tax rate; one totals model everywhere
- [x] Payment collection: request payment (methods per currency), installments (% or amount, must sum), autocharge shown unavailable
- [x] Due terms (receipt/7/14/30/60/custom) from finalization date; Additional options (memo, footer, custom fields, tax ID, template, page size, branding)
- [x] Autosave + Save draft + reopen; Review modal (Finalize and send / Finalize only, PDF link, scheduled finalization); Share modal (PDF download, payment page link)
- [x] Lifecycle / payment / delivery statuses on the details page; finalized invoices locked from editing; Cancel schedule; View payment page
- [x] Tests (invoice-builder-rules, 18), typecheck, browser checks of all journeys

## Settings module (brief: GRIV — Complete Settings Module)
- [x] Foundation: /settings homepage (6 categories, search), /settings/$slug pages, shared settings UI, sidebar links, permission preview
- [x] Personal: Personal details, Security & authentication, Communication preferences (6-tab matrix), Active sessions
- [x] Business: Business profile, Branding (live preview), Compliance & documents, Team & permissions (+ change access, roles matrix), Approvals
- [x] Payments & finance: Payment methods, Settlement accounts, Settlement preferences, Fees & limits, Tax
- [x] Commerce: Invoice, Payment link, Online store, POS, Inventory, Customer settings
- [x] Developers: API keys + Webhooks + IP whitelist (environment-specific), Integrations, API logs
- [x] Monitoring: Security history, Audit logs, Access requests, Connected applications
- [x] Tests for rules (search, last owner, permission dependencies, self-approval, IP validation, env separation), browser checks

## Checkout Demo (brief: GRIV — Original Checkout System) — 3 Nov 2026
- [ ] Sidebar link (Payments → Checkout Demo) and /checkout-demo page
- [ ] Country/channel registry, minor-unit money, card/phone validation
- [ ] Checkout state machine (session vs attempts, dedupe callbacks) + timer-safe simulation hook + adapter contract
- [ ] Reusable GrivCheckout: header, summary, method selector, all 12 channel flows, auth steps, result screens, receipt
- [ ] Configuration panel, desktop/mobile/fullscreen/modal previews
- [ ] Developer tools: timeline, session inspector, webhook JSON, simulation controls
- [ ] Tests + browser checks
