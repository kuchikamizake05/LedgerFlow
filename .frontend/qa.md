# Redesign QA

Status: completed for the selected light-theme redesign and mobile navigation scope.

| Check | Evidence | Result |
| --- | --- | --- |
| Reference preview | Tabler public light dashboard observed in in-app browser on 2026-10-09 | passed |
| License/source | GitHub pinned Tabler MIT and shadcn MIT notices read | passed |
| Target build/lint/typecheck | npm test 13/13; npm run lint; npx tsc --noEmit; npm run build. Build/lint rerun after final CSS contrast and dialog-action fixes | passed |
| Desktop/mobile/tablet | Production screenshots under web/tests/artifacts/redesign; accounts/transfers/ledger/approvals/users/auth at desktop 1365x900, phone 390x844 and tablet 768. Parent inspected actual screenshots including populated mocked approvals/users and confirmation dialog | passed |
| Financial/approval/user flows | smoke.py, live_smoke.py, reversal_audit_smoke.py, freeze_smoke.py, approval_smoke.py, users_smoke.py and navigation_smoke.py on localhost:3200; users/navigation rerun after dialog fix | passed |
| Mobile navigation focus | Closed sidebar hidden from keyboard; aria-expanded/controls, open focus, Tab containment, Escape/backdrop dismissal and focus restoration tested | passed |
| Contrast | Computed rendered colors: ink/canvas 12.07:1, muted/canvas 4.68:1, muted/white 5.03:1, white/primary 5.30:1. These selected pairs do not establish full WCAG conformance | passed for selected pairs |
| Responsive overflow | 18 route/viewport checks at 360, 390 and 768 pixels found no document overflow; wide tables deliberately scroll in their containers | passed |
| Reduced motion | CSS removes transitions/animations under prefers-reduced-motion; comprehensive motion accessibility audit not performed | partial |

Browser smokes with mocked API responses verify UI behavior; real PostgreSQL integration tests verify backend authorization and financial correctness separately. No deployment is included.

Backend user-management phase: 92 tests, zero failures/errors/skips on PostgreSQL 17 Testcontainers. No measured coverage percentage or full-stack browser result is claimed. npm production audit found zero vulnerabilities; five existing high development lint-chain findings remain. No new dependencies or donor runtime were installed. Server left on port 3200 for local inspection; user port 3100 untouched.
