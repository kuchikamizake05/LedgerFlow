# Wallet onboarding and receipt — approved A

User selected A from onboarding-transaction-references.html on 2026-10-10. Preserve A2 cream/white/lime styling. Add a collapsible checklist after the wallet card: account ready, treasury funding, first outgoing transfer. Derive completion server-side across full history, not balance or current history page. Hiding the guide is local per account and reversible. Frozen accounts show guidance but cannot navigate through enabled transaction actions.

Add GET /api/wallet/progress and /api/wallet/transactions/{id}. Receipt requires authenticated CUSTOMER and owns either source or target account; unknown/unrelated transactions return the same 404. DTO excludes idempotency keys and other users balances/auth details. Include actual amount/status/time, participant IDs/names, description, reversal reference and direction. Classify reversal before treasury funding. Progress excludes compensation transfers. No migrations or money movement changes.

History rows open an accessible Base UI dialog: side panel desktop, full width on phone. Loading/error/retry, focus/Escape/backdrop supported. Successful mutation also offers receipt using confirmed response transfer ID. Print CSS shows only loaded receipt, simulation label, complete references and actual status. Printing uses browser Save as PDF. No fabricated fields.

Tests: backend ownership/progress/reversal/missing cases, frontend helpers and real API browser onboarding persistence, details, retries, keyboard/phone/print. Preserve prior smoke flows and local changes. No commit/push/deploy requested.
