# Insights architecture
- Keep metric definitions, inclusive timezone reporting windows and currency-scoped aggregations in `src/lib/demo/insights.ts` over `mergeTxns` plus shared commerce stores, so totals reconcile with the source pages.
- Financial records and operational receipts are separate facts; deduplicate POS/order references and never add commerce sales to payment volume.
- Existing demo permissions restrict analytics and exports; explicitly label sample data in either environment and leave connected-data views empty until a real authenticated source exists.