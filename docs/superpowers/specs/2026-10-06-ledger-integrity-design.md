# Ledger integrity and operational access

The user approved this sprint after the repository review on 2026-10-06.

## Scope

Keep the operations console and its AUDITOR, OPERATOR, and TREASURY_ADMIN roles. Accounts are shared operational records, not personal wallets. Preserve the modular Spring application and Next.js adapter.

- Forward statement query parameters unchanged through the adapter.
- Ordinary transfers reject the system treasury as their source. Treasury allocations use the admin-only deposits endpoint.
- Monetary inputs fit NUMERIC(19,2): at most 17 integer digits and two fractional digits.
- Transfer and deposit retries preserve the same payload and return the original movement without additional postings. Concurrent retries remain successful even if the first execution exhausts the source balance.
- An explicit, optional environment bootstrap creates one enabled treasury administrator. It never promotes an existing non-admin or resets a password.
- Live frontend actions reflect authenticated roles; demo actions remain synthetic. Expired sessions return the user to login without silently discarding uncertain payment references.
- Reconciliation reads a consistent database snapshot. Expected balance equals opening balance plus credits minus debits. It also detects missing or unbalanced transfer journals. It never repairs balances.
- Remove unsupported claims of audit logging and update the obsolete operations documentation.

## Reconciliation contract

GET /api/reconciliation is available to all authenticated roles. Return checkedAt, status (BALANCED or MISMATCH), accountCount, mismatchedAccountCount, unbalancedTransferCount, accounts, and unbalancedTransfers. Each account has accountId, openingBalance, currentBalance, expectedBalance, difference (current minus expected), and status. Each invalid transfer has transferId, debitTotal, creditTotal, difference (debit minus credit), and entryCount. Money is represented as decimal strings.

## Validation

Use real PostgreSQL integration tests for transaction rollback, duplicate requests, role enforcement, and reconciliation corruption detection. Use unit tests for bootstrap validation and browser tests for login, permissions, live statement filtering, and reconciliation feedback. Run frontend lint/build, all backend tests, and inspect the final diff.

## Deferred

Audit trail, reversals, freeze/unfreeze, rate limiting, remote deployment, and queues remain subsequent work. No external publishing or pushing is authorized by this sprint.
