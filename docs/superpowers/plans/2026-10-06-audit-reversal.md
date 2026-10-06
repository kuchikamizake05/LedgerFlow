# Audit and reversal implementation plan

**Goal:** Attribute committed operations and allow one admin-authorized compensating reversal.

**Architecture:** Append-only audit module joins existing transactions. A separate reversal service locks the original transfer and posts compensating entries; existing transfer execution remains intact. Next.js exposes audit read and reversal confirmation.

**Spec:** ../specs/2026-10-06-audit-reversal-design.md

## Tasks

- [x] Audit agent: new audit module, V6 migration, AccountService/TransferService recording; tests attribution, replay, filters and immutability.
- [x] Reversal agent: V7 migration, reversal service/controller, Transfer metadata/repository lock, admin security rule; tests one reversal, insufficient funds, duplicate keys and concurrent attempts.
- [x] Frontend agent: audit page, adapter allowlist, transaction detail/reversal form; tests mocked role and confirmation flows.
- [x] Parent: checkpoint RED tests, serialize Maven runs, inspect integration and error paths, update operations docs, run full backend/frontend/browser checks and checkpoint GREEN.

Money remains exact NUMERIC(19,2). Existing journals are never edited. Audit stores no bearer tokens or credentials. Parent owns commits; other agents preserve shared edits. Existing dependency audit findings and unmeasured repository-wide coverage remain known limitations.
