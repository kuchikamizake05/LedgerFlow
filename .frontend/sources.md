# Frontend sources and scope

Direction selected by user: light financial dashboard, tidy layout and clear tables. Verified 2026-10-09.

| Reference | Preview | Pinned source | Permission and scope |
| --- | --- | --- | --- |
| Tabler open-source core | https://preview.tabler.io/ | https://github.com/tabler/tabler/tree/c2a7cbf0262d201d97d7b5f9e7cc9ed5a346108e | MIT license read at pinned LICENSE. Public preview visually inspected. Inspiration for white panels, neutral canvas, typography hierarchy, blue actions and readable data tables; no Bootstrap runtime, copied imagery, Pro assets or sample charts. |
| Existing shadcn/ui primitives | https://ui.shadcn.com/blocks/sidebar | https://github.com/shadcn-ui/ui/tree/c003e96852fa9534aee40b2cb85a96d8bd38732d | MIT license read at pinned LICENSE.md. Existing local primitives retained. Preview text fetch exceeded size limit; no claim of fresh visual inspection. No CLI/dependency installation. |

Chosen route: reference-inspired original implementation on existing Next.js/React/CSS and primitives. Existing LedgerFlow product logic, authentication, decimal handling, approval retry state and simulated data boundaries remain authoritative. Tabler commercial bundle is excluded. No donor executable code or remote tracking integrations are needed.
