# Account freeze implementation plan

**Goal:** Resolve actionable dependency findings and let admins freeze financial movement with attributable audit.

**Architecture:** Extend the locked account model and financial guards, add V8 migration and admin endpoints, then expose live account controls through the existing adapter.

- [ ] Dependency agent owns web package manifests: inspect audit chains, remove unused tooling or narrow upgrades, run audit and tests.
- [ ] Backend agent owns api: add RED integration coverage, parent checkpoint, implement state endpoints and locked movement guards, run focused/full PostgreSQL tests.
- [ ] Parent owns web source and browser tests: adapter RED tests, frozen badges and admin confirmation, mocked role/error/state flows; run lint/build and existing browser smoke.
- [ ] Parent reviews diffs, updates README/operations and validation, records GREEN commits.

Agents use GPT-6 Luna per user preference. No simultaneous Maven runs. Shared files must not be reverted. Coverage percentage must not be invented.
