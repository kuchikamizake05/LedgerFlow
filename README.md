# LedgerFlow

LedgerFlow is a simulated financial operations console built with Spring Boot, Next.js and PostgreSQL. It does not process real money.

## Local startup

Copy `.env.example` to `.env`, set a private `LEDGERFLOW_JWT_SECRET` of at least 32 bytes, then run `docker compose up --build`. The web application is at http://localhost:3000 and the API at http://localhost:8081. PostgreSQL data persists in the Compose volume.

To create the initial treasury administrator, explicitly set both `LEDGERFLOW_BOOTSTRAP_ADMIN_EMAIL` and `LEDGERFLOW_BOOTSTRAP_ADMIN_PASSWORD` before API startup. Use a valid email and a password of at least 12 characters and no more than 72 UTF-8 bytes. Remove those two variables after successful bootstrap and recreate the API container. They are optional for later starts. Repeated bootstrap of an enabled admin leaves its password unchanged; an existing non-admin or disabled account is a conflict, never an automatic promotion.

New registrations receive AUDITOR access. Bootstrap creates the initial operational admin; subsequent role changes are available to administrators on `/users`.

## Permissions

| Operation | AUDITOR | OPERATOR | TREASURY_ADMIN |
| --- | --- | --- | --- |
| Read accounts, statements, approval queue, audit and reconciliation | Yes | Yes | Yes |
| Submit ordinary transfer requests | No | Yes | Yes |
| Approve/reject another user's transfer request | No | No | Yes |
| Create accounts or allocate treasury funds | No | No | Yes |
| Reverse a completed original transfer | No | No | Yes |
| Freeze or unfreeze an ordinary account | No | No | Yes |
| List users and change roles with an audit reason | No | No | Yes |

The system treasury cannot be the source of an ordinary transfer. Allocations go through the deposits endpoint. Live actions are authorized by the backend, while demo actions affect synthetic browser state only.

Administrators browse `GET /api/users?page=0&size=20` and change a role through `POST /api/users/{id}/role` with `{role, reason}`. Roles are AUDITOR, OPERATOR and TREASURY_ADMIN; the reason is required and accepts at most 255 characters. The last enabled administrator cannot be demoted, including concurrent changes. Unchanged roles create no extra audit event. Successful changes and their full reason commit together in the audit trail. Password hashes are never returned.

Every authenticated request checks that the signed token's user still exists and is enabled, then uses the current database role. Existing tokens therefore gain or lose role permissions on subsequent requests without another login. `GET /api/auth/me` returns the current identity; the frontend refreshes it and drops cached privileges when it cannot confirm access. Logout still does not revoke an otherwise valid bearer token.

## Ledger integrity

All live ordinary transfers require approval. Submit the existing transfer payload to `POST /api/transfer-requests`; a pending request moves and reserves no money. Read the queue through `GET /api/transfer-requests` with page, size and optional status filters. Another treasury administrator decides through `POST /api/transfer-requests/{id}/approve` or `/reject` with a required reason (up to 255 characters). Requesters cannot decide their own requests. Approval rechecks funds, freeze state and destination limits and commits the completed transfer, journal and audit together. Failed approval leaves the request pending. Rejection changes no balances. Direct `POST /api/transfers` returns 409 to prevent bypass.

Keep submission keys and payloads unchanged after uncertain confirmation. The same decision actor, action and reason can retry without duplicate postings. Deposit and reversal keep their existing admin flows. To exercise approvals locally, use distinct authenticated users; a second admin can be provisioned by starting the API with a different new bootstrap email and removing the bootstrap credentials afterward.

Successful movements update account balances and create paired journal entries in one transaction. Account locks use deterministic ordering. Idempotency keys identify an unchanged request; changing its payload returns a conflict. Preserve the original key and payload after uncertain confirmation, then retry the unchanged request.

Money inputs accept at most 17 integer digits and two fractional digits. Reconciliation compares each stored balance against opening balance plus credits minus debits and checks transfer journals. It reads a consistent snapshot and reports mismatches without modifying balances.

Reconciliation is available through authenticated `GET /api/reconciliation` and the Ledger page. Opening balances are explicit initialization baselines; reconciliation does not establish the provenance of those balances.

## Verification

Run `./mvnw test` in `api` (Windows: `mvnw.cmd test`). Docker is required for PostgreSQL integration tests. Run the frontend test, lint, build and browser checks described in `web/OPERATIONS.md`.

When Docker is unavailable, an optional test-only profile uses an existing dedicated PostgreSQL database. Set `LEDGERFLOW_TEST_DB_URL`, `LEDGERFLOW_TEST_DB_USERNAME`, and `LEDGERFLOW_TEST_DB_PASSWORD`, then run `mvnw.cmd -Dspring.profiles.active=local-test-db test`. The test user must be able to create schemas; each Spring context creates and removes its own randomly named schema. Use a disposable test database. This profile does not change application runtime configuration or replace verification against the default PostgreSQL 17 container.

## Audit and reversals

Successful account creation, transfer, treasury allocation and reversal commit an audit event in the same transaction. Events include the actor, action, resource and timestamp, and reject updates, deletes and truncation. Retries create no extra success event. The `/audit` page supports paginated browsing and exact action/resource filters. Historical transactions before audit was introduced are not backfilled with invented actors; login attempts are outside this audit scope.

Admins can reverse a completed original transfer in the live Ledger transaction drawer or via `POST /api/transfers/{id}/reversal`, supplying `idempotencyKey` and a nonblank `reason`. A reversal creates a new linked transfer and compensating journal; the original becomes REVERSED and retains its postings. Insufficient refund balance or destination overflow prevents any change. The same key and reason replay the result; a second distinct attempt, changed payload or reversal of a compensating transfer returns conflict. Demo mode does not provide persisted audit or reversals.

## Current boundaries

Admins can freeze/unfreeze ordinary accounts from the live Accounts page or `POST /api/accounts/{id}/freeze` and `/unfreeze` with a required reason (up to 255 characters). New transfers, treasury allocations and reversals involving a frozen account return 409 without financial changes. Previously committed exact retries remain readable. Reads and reconciliation continue; the system treasury cannot be frozen. State changes record audit events atomically; repeating the current state creates no additional event.

Rate limiting, token revocation and production deployment are not implemented. Logout removes the browser cookie; an already issued bearer token remains valid until expiry. Direct local API startup currently has a development-only JWT fallback; always provide a private secret for a deployed environment. The default local database credentials are development credentials.
