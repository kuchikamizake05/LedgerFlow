# User Role Management Implementation Plan

**Goal:** Administrators safely change registered users' roles and existing sessions obey current access.

**Architecture:** Database-backed JWT principal resolution and serialized transactional role mutation; existing Next adapter and workspace refresh expose the current user.

**Tech Stack:** Spring Boot, PostgreSQL, Next.js, existing Node and Python Playwright tests.

**Spec:** ../specs/2026-10-09-user-role-management-design.md

## Global constraints

Preserve package manager, runtime, three existing roles, registration default and private configuration. Workers use GPT-6 Luna, own separate paths, do not commit and preserve other edits. Parent owns checkpoints and final review. No push or deployment without authorization.

## Backend slice — api/**

- [x] Add and execute RED tests for missing users endpoints/current persisted role enforcement; parent commits the tests before implementation.
- [x] Implement GET users paging and POST role change with validation, current actor recheck, advisory serialization, last-admin protection and atomic audit.
- [x] Resolve persisted enabled identity for verified JWT and expose GET auth/me; migrate JWT test fixtures to persisted users.
- [x] Verify matching regression tests, concurrent admin demotions, stale tokens and complete API suite; parent reviews diff and commits GREEN.

## Frontend slice — web/src/** and web/tests/**

- [x] Execute RED adapter tests for users routes; parent commits before implementation.
- [x] Add Users page, role controls, reason and confirmation, errors/pagination and demo limitation.
- [x] Refresh auth session from backend current user, update self-demotion navigation, and handle unknown mutation outcome with fresh read.
- [x] Run Node tests, lint, typecheck, build and users/existing browser smokes; parent reviews and commits GREEN.

## Parent integration and redesign

- [x] Docker PostgreSQL 17 available; no fallback database provisioning required.
- [x] Review lock order, authorization, current audit actor, no password exposure; run dependency audit and update operations docs.
- [x] Once user management is complete, compare frontend-workbench references and follow user's selected direction.
- [x] Implement coherent visual slices preserving features, inspect actual desktop/mobile screenshots, verify flows, record provenance and QA.

## User management verification

RED checkpoints: 67227c1 (missing users adapter returned 404), f6927bc (nine backend tests executed and failed on missing endpoints/current access). GREEN checkpoints: ee27eeb frontend, 116ec1b backend. API: 92 tests, zero failures/errors/skips on PostgreSQL 17 Testcontainers, Flyway through V10. Web: 13 Node tests, lint, typecheck, production build, users smoke and all five prior browser smokes passed before redesign. Browser tests mock authentication/API; no actual full-stack browser claim. Production npm audit zero findings; existing five high development lint-chain findings remain. Coverage percentage remains unmeasured. No push/deployment.

Redesign: navigation RED checkpoint 2486574 captures missing aria-controls. Light tokens, shared surfaces, buttons/dialogs, table/card spacing and mobile navigation completed. Thirteen Node tests, lint/typecheck/build and seven browser smokes passed; final CSS fixes rechecked with build/lint and relevant smokes. Actual screenshots and selected computed contrast ratios are recorded in .frontend/qa.md. Parent inspected desktop/phone layouts and populated approval/user dialogs. No new dependency or remote deployment.
