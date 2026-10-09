# User Role Management Implementation Plan

**Goal:** Administrators safely change registered users' roles and existing sessions obey current access.

**Architecture:** Database-backed JWT principal resolution and serialized transactional role mutation; existing Next adapter and workspace refresh expose the current user.

**Tech Stack:** Spring Boot, PostgreSQL, Next.js, existing Node and Python Playwright tests.

**Spec:** ../specs/2026-10-09-user-role-management-design.md

## Global constraints

Preserve package manager, runtime, three existing roles, registration default and private configuration. Workers use GPT-6 Luna, own separate paths, do not commit and preserve other edits. Parent owns checkpoints and final review. No push or deployment without authorization.

## Backend slice — api/**

- [ ] Add and execute RED tests for missing users endpoints/current persisted role enforcement; parent commits the tests before implementation.
- [ ] Implement GET users paging and POST role change with validation, current actor recheck, advisory serialization, last-admin protection and atomic audit.
- [ ] Resolve persisted enabled identity for verified JWT and expose GET auth/me; migrate JWT test fixtures to persisted users.
- [ ] Verify matching regression tests, concurrent admin demotions, stale tokens and complete API suite; parent reviews diff and commits GREEN.

## Frontend slice — web/src/** and web/tests/**

- [ ] Execute RED adapter tests for users routes; parent commits before implementation.
- [ ] Add Users page, role controls, reason and confirmation, errors/pagination and demo limitation.
- [ ] Refresh auth session from backend current user, update self-demotion navigation, and handle unknown mutation outcome with fresh read.
- [ ] Run Node tests, lint, typecheck, build and users/existing browser smokes; parent reviews and commits GREEN.

## Parent integration and redesign

- [ ] Provision disposable test database only if Docker unavailable; remove database, role and local credential file afterward.
- [ ] Review lock order, authorization, current audit actor, no password exposure; run dependency audit and update operations docs.
- [ ] Once user management is complete, compare frontend-workbench references and follow user's selected direction.
- [ ] Implement coherent visual slices preserving features, inspect actual desktop/mobile screenshots, verify flows, record provenance and QA.
