# LedgerFlow

LedgerFlow is a simulated financial operations console built with Spring Boot, Next.js and PostgreSQL. It does not process real money.

## Local startup

Copy `.env.example` to `.env`, set a private `LEDGERFLOW_JWT_SECRET` of at least 32 bytes, then run `docker compose up --build`. The web application is at http://localhost:3000 and the API at http://localhost:8081. PostgreSQL data persists in the Compose volume.

To create the initial treasury administrator, explicitly set both `LEDGERFLOW_BOOTSTRAP_ADMIN_EMAIL` and `LEDGERFLOW_BOOTSTRAP_ADMIN_PASSWORD` before API startup. Use a valid email and a password of at least 12 characters and no more than 72 UTF-8 bytes. Remove those two variables after successful bootstrap and recreate the API container. They are optional for later starts. Repeated bootstrap of an enabled admin leaves its password unchanged; an existing non-admin or disabled account is a conflict, never an automatic promotion.

New registrations receive AUDITOR access. This release has no role-management screen; bootstrap is the supported way to create the first operational admin.

## Permissions

| Operation | AUDITOR | OPERATOR | TREASURY_ADMIN |
| --- | --- | --- | --- |
| Read accounts, statements, audit and reconciliation | Yes | Yes | Yes |
| Transfer between ordinary accounts | No | Yes | Yes |
| Create accounts or allocate treasury funds | No | No | Yes |
| Reverse a completed original transfer | No | No | Yes |

The system treasury cannot be the source of an ordinary transfer. Allocations go through the deposits endpoint. Live actions are authorized by the backend, while demo actions affect synthetic browser state only.

## Ledger integrity

Successful movements update account balances and create paired journal entries in one transaction. Account locks use deterministic ordering. Idempotency keys identify an unchanged request; changing its payload returns a conflict. Preserve the original key and payload after uncertain confirmation, then retry the unchanged request.

Money inputs accept at most 17 integer digits and two fractional digits. Reconciliation compares each stored balance against opening balance plus credits minus debits and checks transfer journals. It reads a consistent snapshot and reports mismatches without modifying balances.

Reconciliation is available through authenticated `GET /api/reconciliation` and the Ledger page. Opening balances are explicit initialization baselines; reconciliation does not establish the provenance of those balances.

## Verification

Run `./mvnw test` in `api` (Windows: `mvnw.cmd test`). Docker is required for PostgreSQL integration tests. Run the frontend test, lint, build and browser checks described in `web/OPERATIONS.md`.

## Audit and reversals

Successful account creation, transfer, treasury allocation and reversal commit an audit event in the same transaction. Events include the actor, action, resource and timestamp, and reject updates, deletes and truncation. Retries create no extra success event. The `/audit` page supports paginated browsing and exact action/resource filters. Historical transactions before audit was introduced are not backfilled with invented actors; login attempts are outside this audit scope.

Admins can reverse a completed original transfer in the live Ledger transaction drawer or via `POST /api/transfers/{id}/reversal`, supplying `idempotencyKey` and a nonblank `reason`. A reversal creates a new linked transfer and compensating journal; the original becomes REVERSED and retains its postings. Insufficient refund balance or destination overflow prevents any change. The same key and reason replay the result; a second distinct attempt, changed payload or reversal of a compensating transfer returns conflict. Demo mode does not provide persisted audit or reversals.

## Current boundaries

Account freeze, approvals, rate limiting, token revocation and production deployment are not implemented. Logout removes the browser cookie; an already issued bearer token remains valid until expiry. Direct local API startup currently has a development-only JWT fallback; always provide a private secret for a deployed environment. The default local database credentials are development credentials.
