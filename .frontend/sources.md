# Frontend sources and scope

V2, 2026-10-09: the user delegated a new direction, wallet first and internal dashboard second. Original composition and forest/sage tokens supersede the earlier Tabler styling. Public reference https://ui.shadcn.com/examples/dashboard inspected visually in the in-app browser; source https://github.com/shadcn-ui/ui and MIT license https://raw.githubusercontent.com/shadcn-ui/ui/main/LICENSE.md rechecked. Existing local primitives retained, no new source copied or runtime installed. Existing icon package rights rechecked at https://lucide.dev/license (ISC, inherited Feather MIT). IBM Plex Sans and JetBrains Mono remain the application's actual existing fonts. No graphics, photography, external branding, paid source or remote services added.

Direction selected by user: light financial dashboard, tidy layout and clear tables. Verified 2026-10-09.

| Reference | Preview | Pinned source | Permission and scope |
| --- | --- | --- | --- |
| Tabler open-source core | https://preview.tabler.io/ | https://github.com/tabler/tabler/tree/c2a7cbf0262d201d97d7b5f9e7cc9ed5a346108e | MIT license read at pinned LICENSE. Public preview visually inspected. Inspiration for white panels, neutral canvas, typography hierarchy, blue actions and readable data tables; no Bootstrap runtime, copied imagery, Pro assets or sample charts. |
| Existing shadcn/ui primitives | https://ui.shadcn.com/blocks/sidebar | https://github.com/shadcn-ui/ui/tree/c003e96852fa9534aee40b2cb85a96d8bd38732d | MIT license read at pinned LICENSE.md. Existing local primitives retained. Preview text fetch exceeded size limit; no claim of fresh visual inspection. No CLI/dependency installation. |

Chosen route: reference-inspired original implementation on existing Next.js/React/CSS and primitives. Existing LedgerFlow product logic, authentication, decimal handling, approval retry state and simulated data boundaries remain authoritative. Tabler commercial bundle is excluded. No donor executable code or remote tracking integrations are needed.

Wallet follow-up, 2026-10-09: reuse the selected reference and existing primitives. Inspected the exact public sign-in page https://preview.tabler.io/sign-in.html and rechecked https://raw.githubusercontent.com/tabler/tabler/c2a7cbf0262d201d97d7b5f9e7cc9ed5a346108e/LICENSE (MIT). Independently implement auth composition and wallet hierarchy; no donor code, paid assets, imagery, font or package imports added. This source informs spacing/surfaces/forms rather than exact reconstruction.

## Approved A2 implementation — 2026-10-10

A2 Stitch images are visual references only; generated HTML was not executed or copied into application code. Layout and curved two-dot FlowMark SVG are independently authored using the existing React/CSS/Base UI/Lucide stack. No UI dependency added. Space Grotesk is loaded through existing next/font; official SIL OFL 1.1 license verified at https://raw.githubusercontent.com/google/fonts/main/ofl/spacegrotesk/OFL.txt and retained at web/src/styles/vendor/space-grotesk-OFL.txt. Existing IBM Plex Sans, JetBrains Mono and Lucide source/license records still apply.

Implementation review source: .frontend/a2-implementation-preview.html, copied into the local reference server directory. Its four images come from ignored local QA outputs: a2-wallet-desktop.png, wallet-mobile.png, a2-dashboard-desktop.png and accounts-mobile.png under web/tests/artifacts. Copy them into the server a2-implementation directory as wallet-desktop.png, wallet-mobile.png, dashboard-desktop.png and dashboard-mobile.png respectively. They contain disposable simulated data.
