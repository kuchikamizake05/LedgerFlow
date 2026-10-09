# Wallet simulation: first complete slice

## Product direction

LedgerFlow remains the internal financial operations console. Add a customer wallet web experience in the existing Next.js application under `/wallet`, backed by the existing Spring Boot API and PostgreSQL ledger. All funds are simulated. No payment gateway, separate service, or mobile app is required for this slice.

## Verified current state

- `AuthService.register` provisions AUDITOR users, not customers.
- `Account` has no link to an authenticated owner.
- Security currently grants internal roles broad read access to accounts and transactions.
- Internal transfers require an approval request; deposits require TREASURY_ADMIN.
- `TransferService` already implements atomic balance updates, paired journal entries, deterministic account locking, payload-sensitive idempotency, freeze checks, and balance limits.
- Existing audit, reversal, and reconciliation features provide the operational foundation.
- The code graph omits some recent routes and has stale source positions; findings above were checked against current files.

## Alternatives

1. Recommended: a wallet route group in the existing web application and dedicated customer API routes. Reuses deployment and ledger while separating access.
2. A separate wallet web application with the same backend. Allows separate releases but adds setup and session management before validating the core flow.
3. A mock-only wallet. Useful for visual exploration but cannot demonstrate real ledger consistency or isolation.

## Identity and ownership

Introduce a CUSTOMER role and a dedicated customer registration endpoint. Registration atomically creates a customer identity and one owned wallet account with zero opening balance. Ownership is persisted with foreign keys and a unique owner constraint. Existing ordinary accounts remain internal accounts without an invented owner.

Keep internal and customer identities distinct for this slice: no promotion of CUSTOMER through the existing staff role-management endpoint, and no customer access to internal account lists, audit, reconciliation, or staff APIs. Customer login validates CUSTOMER membership before returning a session. Staff provisioning and existing internal registration behavior stay documented separately; neither is a customer signup flow.

Customer API derives the source wallet from the authenticated identity. Customer requests cannot select a debit account. Ownership checks apply to every balance, statement, and transaction-detail read, including retries. The destination is a public wallet identifier resolved server-side; only a minimal recipient name is returned, never a user directory or recipient balance.

## Money movement

Recommended customer behavior: ordinary wallet transfers settle immediately after validation. Internal manual transfers retain their existing approval flow. Customer transfers use a dedicated service boundary to authorize ownership and destinations before invoking shared ledger posting logic.

Top up is explicitly a simulator action. A configuration switch enables it for local/demo environments, with a documented per-operation maximum of 1,000,000 simulated units. It derives the destination from the signed-in customer and uses the existing funded treasury path; insufficient treasury funds fail without posting. It does not claim that external payment has occurred.

Both operations retain a stable idempotency key after uncertain confirmation. Keys are namespaced for customer identity and operation before shared posting, so another customer cannot replay or inspect a different customer's result. The same key with a changed payload conflicts. Repeated success posts no extra journal or audit event. Frozen wallets, insufficient funds, self-transfers, invalid destinations, and overflow reject without changing balances.

Successful customer top ups and transfers remain visible through the internal ledger and account statements. Their audit events identify the customer actor and distinguish simulator top ups from internal treasury allocations. Existing reversal and reconciliation continue to operate on their shared postings.

## Web experience

Customer routes provide signup, login, wallet balance and identifier, simulator top up, recipient confirmation, transfer confirmation, and paginated personal history. Use the current design system. Show simulated-funds labeling and recoverable errors. Preserve request keys until the outcome is known. Keep wallet navigation separate from the internal console, and prevent role-inappropriate routes on both server and API.

## Completion evidence

- Two customers can register with separate zero-balance wallets.
- A simulator top up and subsequent customer transfer appear in internal statements and audit.
- Sender and recipient balances match the journal, and reconciliation reports no mismatches.
- Another customer cannot read or debit a wallet by altering an identifier or replay key.
- Concurrent transfers cannot overspend; retries cannot duplicate postings.
- Customer sessions cannot access internal APIs or gain staff roles.
- Existing internal approval, allocation, freeze, and reversal checks still pass.
- Browser verification covers signup, login, top up, transfer, history, and restricted internal navigation.

## Sequencing

First implement customer identity, ownership, and API isolation with regression coverage. Next add customer posting endpoints and ledger tests. Then add wallet pages and verify the complete flow with the real backend. Account recovery, report exports, backup/restore tooling, and expanded onboarding follow after this first slice. No external publication or push is part of this design task.

## Approved decision

The user approved immediate customer settlement, with approval reserved for internal operations, on 2026-10-09.
