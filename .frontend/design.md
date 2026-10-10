# Light financial workspace design

## Approved wallet direction A — 2026-10-09

User selected Bold everyday from the visual reference board and authorized two alternative home designs in Stitch, each mobile and desktop. See bold-everyday-brief.md and bold-everyday-prompts.json. Direction A supersedes the exploratory palette choices below for the future wallet redesign. User then selected A2 with a white card around the upper balance/actions area, separate from the cream activity backdrop. User approved the detailed A2 revision and requested implementation for both wallet and staff dashboard.

Latest revision — 2026-10-10: user requested modest details to make A2 less flat. Stitch mobile and desktop previews now add a curved two-dot flow motif with a small lime accent, gentle balance-card depth, inset action icons, and activity grouped by day along a fine timeline. These use existing wallet content and actions. Preview: http://127.0.0.1:3211/a2-character-preview.html. Sources: a2-character-screens.json; visual inspection: a2-character-review.md. This revision was approved and integrated on 2026-10-10; see the current implementation record below.

## V2 redesign from first principles — 2026-10-09

Current status: uncommitted exploratory draft, not the user's chosen final direction. User subsequently requested existing wallet UI previews first, then selection. Stop broad visual implementation until that choice; preserve the draft without pushing or committing it. Shortlist is in wallet-options.md.

This section supersedes the earlier blue Tabler direction below, retained as history. User delegated approach and selected wallet first, then the internal dashboard. Deliver working real-API wallet pages and existing operational routes, rather than an unconnected prototype.

1. Product: customer explores balances, topups, recipient confirmation and transfers; staff manages accounts, approvals, ledger, audit and reconciliation. No landing page is needed for this slice.
2. Approach: independently authored composition with the existing shadcn/Base UI primitives and Lucide icons. Public shadcn dashboard informs navigational clarity and quiet data surfaces; no donor application, generated graphics or dependencies imported.
3. Identity: warm off-white canvas #f6f7f3, forest action #24634b, dark green balance #193e31, ink #20352d and secondary text #5b6c63. Existing IBM Plex Sans and JetBrains Mono retained; tabular money. Spacing 8/12/16/24/32/48; wallet corners 10–24px, staff surfaces 10–16px. One consistent restrained system.
4. Wallet: desktop editorial introduction/form auth; compact stacked auth on phones. Wallet header links to overview, move funds and activity. Desktop balance/reference left, actionable forms right, full-width history below; stack on phone and two overview columns on tablet. IDs and extreme monetary amounts wrap. Explain simulated funds explicitly. Metadata identifies customer wallet.
5. Staff: same colors, white navigation, prominent product mark, clearly active route, spacious page heading with compact table/filter controls. Keep all routes, role gating, dialogs, approval/retry and demo/live boundaries intact.
6. Completion evidence: lint/typecheck/build, real wallet smoke, existing staff route/mobile navigation tests, inspected desktop/mobile/tablet screenshots and measured contrast. No production readiness or complete accessibility conformance claim.

User selected a light, tidy financial dashboard with clear tables. Implement after the user-management feature passes its checks.

Existing stack: Next.js App Router, React, Tailwind/CSS, local UI primitives, Geist and selected icons. Preserve routes: accounts, payment, approvals, ledger/transaction details, audit, reconciliation, status, users and authentication.

Design target: pale neutral canvas, white surfaces/sidebar, ink text, blue primary actions, restrained green/amber/red status treatments, consistent 8px spacing scale and comfortable form controls. Use tabular numbers for money. Strong page heading, short supporting copy, aligned primary actions, compact filter toolbars and readable table headers/rows. Keep demo/live indicator explicit; no fabricated live summaries or charts.

Responsive behavior: sidebar on desktop; accessible mobile navigation toggle and dismissal. Stack headings/actions and form columns on phones; tables scroll within a labeled container instead of widening the viewport. Long emails and references wrap appropriately. Dialogs/portals share theme tokens. Visible keyboard focus, contrast checks and reduced motion apply throughout.

Implementation scope: common shell and tokens first, then account/payment primary flows and data tables; align approvals/users/audit/ledger and auth states with the same system. Keep all loading, empty, error, success, permission and unknown-retry states usable.

## Customer wallet adaptation — 2026-10-09

Continue the approved light financial direction using frontend-workbench. Retain existing customer auth, ownership, money formatting and retry behavior. Adapt the existing Tabler-inspired rules for a consumer wallet: a two-column introduction/form at desktop login, a compact stacked introduction on phones, a balance and shareable wallet-reference overview, clear topup/transfer forms and readable personal activity. Use existing fonts, primitives and Lucide icons; no new UI runtime or external assets.

Use the existing semantic surface/text/action tokens rather than a second hardcoded palette. Dark blue is reserved for the auth introduction and balance surface, with white foreground text. Standard small copy uses the established muted foreground color; touch controls target 44px. Long wallet identifiers and large balances wrap without viewport overflow. Focus rings and reduced-motion behavior remain explicit. No fabricated balances, activity, fees, payment methods or third-party login.

## A2 implementation — 2026-10-10

Completed locally using frontend-workbench. Shared cream #F5F3E9, white surfaces, lime #D9F05B and ink #202B25; Space Grotesk headings, IBM Plex Sans body and JetBrains Mono financial metadata. An independently authored curved two-dot SVG connects wallet and staff branding. Wallet has a white balance card, inset action icons, Jakarta day-grouped activity, desktop columns and mobile bottom navigation. Staff uses the same tokens, rounded actions, lime active navigation and readable operational tables. Existing API, authorization, retries and simulation boundaries remain in place. Earlier palette sections are historical.

Review actual desktop/mobile captures at http://127.0.0.1:3211/a2-implementation-preview.html. The board is static evidence with links to the working app; separate browser profiles are needed for simultaneous customer/staff sessions. No commit, push or deployment.

## Onboarding and receipt A — 2026-10-10

User selected A; implemented the checklist, responsive detail dialog and simulation receipt print. Checklist follows stored funding/outgoing transactions and excludes correction transfers. Shared A2 tokens retained. Full spec and plan: docs/superpowers/{specs,plans}/2026-10-10-wallet-onboarding-receipt.md. Results: http://127.0.0.1:3211/onboarding-transaction-results.html.
