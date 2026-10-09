# Transfer approval implementation plan

**Goal:** Require a second authenticated administrator to authorize ordinary money movements.

**Architecture:** Separate request aggregate with immutable payload and locked decisions; use existing transactional movement service to create completed journals. Adapt live payment submission and add paginated approval browsing.

- [x] Backend worker owns api/**: RED tests, request migration/model/controller/service, actor enforcement, global key namespace, decision lock and audit; migrate previous direct-POST tests to approved workflows or explicit internal ledger tests; full PostgreSQL suite.
- [x] Frontend worker owns web/src/** and web/tests/**: adapter RED, pending submission receipt, queue/details/role controls and required decision reason, unknown retry continuity; lint/build/browser tests.
- [x] Parent owns docs and commits: review actor/lock/atomicity and bypass paths, record RED/GREEN evidence, dependency audit, final validation and clean tree.

Workers use GPT-6 Luna per user preference. They share a checkout, preserve others' edits and do not commit. Serialize Maven; do not alter package manifests. Coverage percentages must be measured or marked unverified.

## Completion evidence

- RED: adapter approval routes returned 404 before implementation; standalone ordinary-transfer bypass test expected 409 and received 201.
- GREEN: all 82 backend tests passed with zero failures, errors or skips on dedicated PostgreSQL 16.15, using isolated schemas and Flyway V1–V9. Temporary database, role and local credential file were removed afterward.
- Approval tests cover no balance reservation, requester identity, self-decision rejection, replay conflicts, freeze/funds rechecks, global key collisions, and concurrent matching/opposite decisions. Matching decisions produce one completed transfer, two journal entries and one decision audit event.
- Frontend: 12 Node tests, lint, typecheck, production build, approval browser smoke and all four existing browser smokes passed. Browser tests mock API/authentication; backend tests use real PostgreSQL.
- Dependency audit: zero production findings; five high findings remain in the existing development lint dependency chain. Updated transitive sharp to 0.35.5.
- Unverified: default Docker PostgreSQL 17 execution (Docker unavailable), measured coverage percentage, production deployment and a browser flow against an actual running backend. No push or deployment performed.
