# Account freeze and dependency cleanup validation

## Changes

Admins can freeze/unfreeze ordinary accounts with a required reason and atomic audit event. Account row locks serialize status changes with financial movements. New transfer, deposit and reversal paths reject frozen endpoints without changing balances or journals; completed exact replays still return their existing result. Read access remains available and the system treasury cannot be frozen.

The Accounts screen shows status and live admin confirmation. Demo mode has no persisted freeze operation. The adapter forwards freeze/unfreeze while retaining origin checks.

Next and eslint-config-next move from 16.3.4 to 16.3.8. The shadcn CLI dependency is removed while its existing 4.21.0 stylesheet is retained locally with MIT license. Narrow compatible overrides patch brace-expansion and source-map-js; cn remains because UI components import it.

## Verification

- Backend: 69 PostgreSQL integration tests, no failures/errors, including 7 account freeze tests.
- Frontend: 11 Node tests passed; lint and production build passed.
- Browser: mocked freeze/unfreeze controls passed for admin, operator and auditor, including required reason and refreshed account state.
- Existing browser demo, live permissions/reconciliation/session-expiry, and audit/reversal recovery suites passed against the production build.
- Dependency audit: 14 initial findings (2 critical, 10 high, 2 moderate) reduced to 5 high; production-only audit reports zero findings.

RED checkpoints capture six missing backend-contract failures and the missing adapter route. Tests cover authorization, reason validation, default state, treasury protection, audit attribution and duplicate-state behavior, blocked source/target movements, post-unfreeze recovery and completed replay after freeze. Dedicated freeze-versus-transfer race testing was not added; shared row-lock ordering was inspected. Repository-wide coverage percentage remains unmeasured.

## Residual dependency findings

Five audit entries represent the development lint chain `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces@3.0.3`. No patched compatible braces release was available during verification. The [upstream issue](https://github.com/micromatch/braces/issues/73) tracks the problem. The Next fix is covered by its [security advisory](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j).

Backend tests use real PostgreSQL; browser responses are mocked. Agents used GPT-6 Luna. No push or deployment was performed.
