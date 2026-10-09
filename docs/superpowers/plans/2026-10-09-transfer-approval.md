# Transfer approval implementation plan

**Goal:** Require a second authenticated administrator to authorize ordinary money movements.

**Architecture:** Separate request aggregate with immutable payload and locked decisions; use existing transactional movement service to create completed journals. Adapt live payment submission and add paginated approval browsing.

- [ ] Backend worker owns api/**: RED tests, request migration/model/controller/service, actor enforcement, global key namespace, decision lock and audit; migrate previous direct-POST tests to approved workflows or explicit internal ledger tests; full PostgreSQL suite.
- [ ] Frontend worker owns web/src/** and web/tests/**: adapter RED, pending submission receipt, queue/details/role controls and required decision reason, unknown retry continuity; lint/build/browser tests.
- [ ] Parent owns docs and commits: review actor/lock/atomicity and bypass paths, record RED/GREEN evidence, dependency audit, final validation and clean tree.

Workers use GPT-6 Luna per user preference. They share a checkout, preserve others' edits and do not commit. Serialize Maven; do not alter package manifests. Coverage percentages must be measured or marked unverified.
