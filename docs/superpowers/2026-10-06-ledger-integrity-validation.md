# Ledger integrity validation

- Backend: `mvnw.cmd test` passed 50 tests using isolated PostgreSQL Testcontainers, with no failures or errors.
- Frontend: `npm test` passed eight tests covering the actual Next.js adapter, query forwarding, exact money, role permissions and authentication-cookie handling.
- Frontend lint and production build passed.
- Browser demo smoke passed account creation, transfer, journal inspection, treasury allocation, mobile layout and unavailable API handling.
- Browser live smoke passed all three role controls, reconciliation mismatches, signed amounts, failed rechecks, expired-session redirect and pending-request restoration. Live browser responses are mocked; database correctness and backend authorization use integration tests separately.
- RED checkpoints captured query loss, missing reconciliation, missing bootstrap, treasury bypass, amount precision, deposit retries, exhausted-source concurrent replay, destination overflow and pending-reference overwrites before their respective fixes.

`npm audit` reports 14 dependency findings (2 moderate, 10 high, 2 critical) in the existing dependency tree. Dependency upgrades are not part of this sprint; do not treat passing feature tests as a clean dependency audit. No coverage instrumentation is configured, so a repository-wide coverage percentage has not been established.

No push, publishing or deployment was performed. Audit trail, reversals and account freeze remain deferred.
