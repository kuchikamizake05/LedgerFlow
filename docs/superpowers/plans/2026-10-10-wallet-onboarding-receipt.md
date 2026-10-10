# Wallet Onboarding and Receipt Implementation Plan

**Goal:** Implement user-approved A checklist and transaction receipt.
**Architecture:** Extend wallet read DTOs and existing authenticated proxy. Separate checklist/detail components from mutation handlers; retain Base UI modal behavior and A2 tokens.
**Tech Stack:** Existing Spring/JPA/PostgreSQL, Next/React/CSS/Base UI. No dependencies.
**Spec:** ../specs/2026-10-10-wallet-onboarding-receipt.md

- [x] Write backend tests first for progress and ownership-scoped receipt; witness RED, add read DTOs/repository predicates/routes, run GREEN on isolated local PostgreSQL schema.
- [x] Add typed frontend read contracts and tested labels/date/progress helper, witness RED/GREEN. Compose checklist and detail dialog, integrate history and confirmed mutations; proxy only new read endpoints.
- [x] Extend real fullstack smoke for persistence, receipt/status/print/focus, denial and phone overflow. Run lint/typecheck/unit/build and relevant backend/fullstack checks. Browser inspect desktop/mobile; document evidence and preview. Review diff, no commits or external writes.
