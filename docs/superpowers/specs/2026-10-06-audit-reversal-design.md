# Audit trail and compensating reversals

The user approved the next audit/reversal sprint after ledger integrity hardening.

## Audit

Successful account creation, ordinary transfer, treasury deposit and reversal record actor ID, email, role, action, resource ID, description and timestamp. Audit entries join the same database transaction as the financial change. Failed transactions and idempotent replays create no success audit record. JWT values and credentials are never recorded. Existing internal/filter-disabled tests may use explicitly attributed SYSTEM events; real business endpoints require authentication.

GET /api/audit returns a paginated response with optional exact action/resource filters, available to all signed-in roles. Audit records reject updates and deletes. Historical operations before this migration are not backfilled with invented actors.

## Reversal

POST /api/transfers/{id}/reversal accepts a nonblank reason (maximum 255 characters) and idempotencyKey (maximum 100 characters). Only TREASURY_ADMIN can invoke it. Reversal creates a new COMPLETED transfer and balanced journal from the original recipient back to the original sender. The new transfer references reversalOf; the original becomes REVERSED while retaining all original postings.

Lock the original transfer and accounts, reject insufficient refund balance or destination overflow, and commit refund, original status and audit together. A transfer can be reversed once; a compensating transfer cannot itself be reversed. Same-key same-payload retry returns the existing compensating transfer; changed payload or distinct second attempt returns conflict. A unique reversal_of constraint provides an additional concurrency boundary.

## UI and verification

Expose paginated audit browsing and admin-only reversal within live transaction inspection. Demo mode makes no claim of persisted audit/reversal. Confirmation requires a reason; uncertain results retain the same request reference. Test role permissions, journal immutability, duplicate and concurrent reversal, rollback, audit attribution and reconciliation. No publishing, remote deployment, login-event audit or account freeze is included.
