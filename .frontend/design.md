# Light financial workspace design

User selected a light, tidy financial dashboard with clear tables. Implement after the user-management feature passes its checks.

Existing stack: Next.js App Router, React, Tailwind/CSS, local UI primitives, Geist and selected icons. Preserve routes: accounts, payment, approvals, ledger/transaction details, audit, reconciliation, status, users and authentication.

Design target: pale neutral canvas, white surfaces/sidebar, ink text, blue primary actions, restrained green/amber/red status treatments, consistent 8px spacing scale and comfortable form controls. Use tabular numbers for money. Strong page heading, short supporting copy, aligned primary actions, compact filter toolbars and readable table headers/rows. Keep demo/live indicator explicit; no fabricated live summaries or charts.

Responsive behavior: sidebar on desktop; accessible mobile navigation toggle and dismissal. Stack headings/actions and form columns on phones; tables scroll within a labeled container instead of widening the viewport. Long emails and references wrap appropriately. Dialogs/portals share theme tokens. Visible keyboard focus, contrast checks and reduced motion apply throughout.

Implementation scope: common shell and tokens first, then account/payment primary flows and data tables; align approvals/users/audit/ledger and auth states with the same system. Keep all loading, empty, error, success, permission and unknown-retry states usable.

## Customer wallet adaptation — 2026-10-09

Continue the approved light financial direction using frontend-workbench. Retain existing customer auth, ownership, money formatting and retry behavior. Adapt the existing Tabler-inspired rules for a consumer wallet: a two-column introduction/form at desktop login, a compact stacked introduction on phones, a balance and shareable wallet-reference overview, clear topup/transfer forms and readable personal activity. Use existing fonts, primitives and Lucide icons; no new UI runtime or external assets.

Use the existing semantic surface/text/action tokens rather than a second hardcoded palette. Dark blue is reserved for the auth introduction and balance surface, with white foreground text. Standard small copy uses the established muted foreground color; touch controls target 44px. Long wallet identifiers and large balances wrap without viewport overflow. Focus rings and reduced-motion behavior remain explicit. No fabricated balances, activity, fees, payment methods or third-party login.
