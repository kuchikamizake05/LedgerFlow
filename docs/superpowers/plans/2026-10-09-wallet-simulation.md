# Wallet Simulation Implementation Plan

**Goal:** Deliver customer signup, owned wallet balances, simulated top ups, instant transfers and personal history backed by the existing ledger.

**Architecture:** Dedicated CUSTOMER endpoints enforce ownership before shared ledger posting. The existing Next.js application hosts `/wallet` with customer authentication separate from internal navigation.

**Tech Stack:** Spring Boot, PostgreSQL/Flyway, Next.js and TypeScript with existing dependencies.

**Spec:** ../specs/2026-10-09-wallet-simulation-design.md (approved).

## Constraints

Simulated money only. One wallet per customer, zero initial balance, no customer promotion through staff role management. Top up requires a simulator switch and caps each request at 1,000,000. Existing staff approval flows remain enforced. No push without a new explicit request.

## Task 1: Customer API and ownership

Files: api/src/main/java/ledgerflow_api/wallet/*, auth/AppRole.java, auth/UserManagementService.java, security/SecurityConfig.java, db/migration/V11__customer_wallets.sql, wallet/WalletControllerTest.java.

- [x] Reproduce customer registration, access isolation, and ledger posting requirements with PostgreSQL integration tests.
- [x] Persist one owner/account association with foreign keys and unique constraints; transactionally create CUSTOMER identity and zero-balance EWALLET.
- [x] Implement `/api/wallet/auth/register`, `/api/wallet/auth/login`, `/api/wallet/me`, `/api/wallet/recipient/{id}`, `/api/wallet/topups`, `/api/wallet/transfers`, `/api/wallet/history`.
- [x] Derive source/target topup wallet from identity; permit transfers only to customer-owned wallets; namespace request keys by customer and operation. Reject altered retries, frozen wallets, insufficient funds, self-transfers and invalid amounts.
- [x] Reuse TransferService transaction/locking/journal behavior, recording customer-specific audit actions atomically.
- [x] Permit CUSTOMER identity refresh but deny all internal APIs. Prevent staff/customer role conversion through user management.
- [x] Run targeted integration tests and existing backend suite; inspect changes.

## Task 2: Customer web

Files: web/src/app/wallet/*, web/src/components/wallet.tsx, customer auth adapters, backend proxy allowlist, web/src/proxy.ts, frontend role/session types.

- [x] Add customer login/signup routes with HTTP-only session handling using existing auth adapter patterns.
- [x] Add wallet summary, wallet identifier, topup form, recipient lookup and confirmation, transfer form, paginated history and logout.
- [x] Preserve idempotency keys across uncertain results and changed request payloads; disable repeated pending submissions.
- [x] Restrict customer navigation to wallet and prevent internal roles from rendering customer actions. Preserve current internal UI and refresh current backend identity.
- [x] Run frontend tests, lint, typecheck and build.

## Task 3: Complete flow and documentation

- [x] Start isolated local API/web with simulator topup enabled and two customer accounts.
- [x] Verify signup, topup, recipient confirmation, transfer and both histories through browser; inspect internal statements/audit and reconciliation.
- [x] Document configuration, endpoints, limitations, verification results and any unavailable checks in README and web operations.
- [x] Review final diff and run dependency audit before local commits. Do not push.
