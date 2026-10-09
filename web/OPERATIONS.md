# LedgerFlow frontend operations

Run `npm ci` and `npm run dev` from `web`. The root redirects to `/accounts`; login and registration are at `/auth/login` and `/auth/register`.

## Authentication and data modes

The Next.js server stores the access token in an HttpOnly cookie and forwards it as a bearer token to Spring. Public registration creates an AUDITOR. Create the first TREASURY_ADMIN with the explicit environment bootstrap described in the root README. In production the token cookie requires HTTPS.

- Demo preview is the default. Account creation, transfers and allocations affect synthetic session state. Reloading or changing mode resets it.
- Local API connects to Spring at `http://127.0.0.1:8081`. Override the origin through `LEDGERFLOW_API_URL` in `.env.local`, then restart Next.js. Requests change the development database.

Live actions follow the signed-in role: auditors read, operators submit ordinary transfer requests, and treasury administrators also decide other users' requests, create accounts and allocate from treasury. The backend remains authoritative.

## Users and roles

Treasury administrators can open `/users` in Local API mode to browse registered users and change their role. Select a user, choose a role, supply a reason and confirm the change. The last enabled administrator cannot be demoted. The audit trail records the acting user, target, previous/new roles and reason. Existing tokens obey the current database role on subsequent requests. Self-demotion refreshes the current session and removes admin controls.

An uncertain response triggers a fresh read rather than a success claim; inspect the current role and audit trail before another change. Demo mode offers no persisted user management. Failed identity refresh removes cached role controls without pretending the backend accepted a change.

## Transfer approvals

Live ordinary transfer submission creates a pending request and does not reserve or move funds. Open `/approvals` to browse requests and inspect their status. A different treasury administrator approves or rejects with a required reason. Approval rechecks funds and frozen accounts, then posts the transfer and journal atomically. Failed approval leaves the request pending. Rejection posts no money movement. Requesters cannot decide their own requests. Treasury deposits and completed-transfer reversals keep their existing workflows. Demo mode makes no claim of persisted approvals.

## Statements and reconciliation

Select an account on `/ledger` to retrieve its statement. Pagination, direction, transfer ID and Jakarta date-range filters are forwarded to Spring. Monetary fields remain decimal strings and browser display arithmetic uses integer minor units.

Run reconciliation explicitly from the Ledger page in Local API mode. The report checks stored account balances against opening balance plus credits minus debits and validates transfer journals. Signed differences identify mismatches. Reconciliation does not repair data or infer the provenance of opening balances. Demo mode does not verify the database.

## Safe retries

After unknown payment confirmation, keep the same idempotency key and original payload. Retrying an unchanged transfer or allocation returns the existing result without another movement. A changed payload returns a conflict. Inputs accept a period decimal separator and at most two fractional digits.

Unconfirmed approval decisions are saved separately for each user and request in browser storage. Reopen the request to retry the original action and reason; changing either after a committed decision returns a conflict. Browser storage must be available before deciding. Clearing it removes the saved retry reference.

## Audit and reversals

Use `/audit` in Local API mode to browse committed actions with actor attribution and pagination. Filter by action or resource ID. Demo mode shows no fabricated persisted events.

Open a transaction from its ledger entry to inspect status and journal postings. Treasury administrators can confirm a reversal with a reason. Original journal entries remain unchanged; a new linked transfer posts the refund. Keep the same request reference and reason after uncertain confirmation. A transfer can be reversed once and compensating transfers cannot be reversed again.

Unconfirmed reversal references are saved in browser storage separately for each user and transfer. Reopen the transaction in Local API mode to retry the unchanged request. Browser storage must be available before submission; clearing that storage removes recovery references.

## Account status

In Local API mode the Accounts screen shows Active/Frozen status. Treasury administrators can freeze or unfreeze ordinary accounts with a required reason. Frozen accounts reject new incoming and outgoing financial movements; records remain readable. Demo mode does not persist account freezes.

## Verification commands

- `npm run test`
- `npm run lint`
- `npm run build`
- Start development on `127.0.0.1:3100`, then run `python tests/smoke.py` (Python Playwright and Chromium required).
- Run `python tests/live_smoke.py` against the same server for mocked live permissions, filters, expiry and reconciliation flows.
- Run `python tests/reversal_audit_smoke.py` for mocked audit and reversal confirmation flows.
- Run `python tests/freeze_smoke.py` for mocked admin freeze/unfreeze and read-only role controls.
- Run the approval browser test described in `tests/approval_smoke.py` for mocked submission and decisions.

Browser tests use isolated mocked authentication and API responses where documented in the test; backend authorization and financial correctness are verified separately using real PostgreSQL integration tests. Screenshots are stored under ignored `tests/artifacts/`.

## Remaining limitations

Global journal browsing, volume aggregates, server request metrics and persisted health history are unavailable. The concurrency lab does not send load. Token revocation and rate limiting remain subsequent work. Audit covers successful financial mutations, account freeze status and role changes; login-event audit is not implemented. Health details are shown only when the backend exposes them.
