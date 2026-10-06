# Ledger integrity implementation plan

**Goal:** Make existing operations respect role and money invariants, then expose read-only reconciliation.

**Architecture:** Retain the Spring modular monolith, PostgreSQL transactions, and allowlisted Next.js proxy. Independent backend modules and frontend changes run in parallel, followed by integration review.

**Tech stack:** Java 21, Spring Boot 4.1.1, PostgreSQL 17, Next.js 16.3.4, React 19, Node test runner, Python Playwright.

**Spec:** ../specs/2026-10-06-ledger-integrity-design.md

## Constraints

No auto repair, no secret logging, no external deployment. Treasury source is reserved for deposits. Decimal amounts fit NUMERIC(19,2). Other agents' edits must be preserved. Parent coordinates git checkpoints.

## Task 1: Transaction hardening

Files: account/transfer DTOs, TransferService, AccountController, new authenticated transaction integration tests.

- [x] Write and execute failing tests for treasury bypass, excess decimals, duplicate deposits, and exhausted-balance retries.
- [x] Checkpoint tests, implement shared transactional execution and replay recovery, rerun the same tests.
- [x] Verify existing functional and concurrency tests remain green.

## Task 2: Reconciliation

Files: new reconciliation controller/service/response records and integration tests.

- [x] Write and execute failing endpoint tests for balanced, corrupt, missing-entry and unauthenticated cases.
- [x] Checkpoint tests; implement aggregate reads in a REPEATABLE_READ transaction.
- [x] Return the exact response contract in the spec and verify no database writes occur.

## Task 3: Admin bootstrap

Files: new auth bootstrap service/configuration, tests, application.properties, .env.example.

- [x] Write and execute failing validation and lifecycle tests.
- [x] Checkpoint tests; create an admin only from paired explicit environment variables.
- [x] Verify repeated startup preserves credentials and conflicts fail without promotion.

## Task 4: Frontend integration

Files: backend adapter, workspace, account/payment/ledger UI, auth session route, browser and adapter tests.

- [x] Reproduce query loss and permission behavior in tests.
- [x] Checkpoint tests; forward queries, expose role capabilities, handle expiry, display explicit reconciliation results.
- [x] Update smoke setup for authentication; verify demo workflows and live reads.
- [x] Run lint, build, unit/adapter tests and browser smoke.

## Task 5: Integrate and document

Files: web/OPERATIONS.md, compose.yml, root README.md, this plan.

- [x] Document role matrix, admin bootstrap, reconciliation, retry rules and remaining limitations.
- [x] Pass optional bootstrap variables through Compose.
- [x] Run all backend tests, inspect final diff and dependency audit, checkpoint completed work.
