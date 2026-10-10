# LedgerFlow wallet — Stitch design review

## Superseding direction

The user rejected the generic first preview, requested broad visual research, chose A (Bold everyday), and authorized A1/A2 mobile and desktop home exploration. See bold-everyday-brief.md. The original indigo preview below is history, not the selected design. New design system: assets/13539669419598906348.

User chose custom Google Stitch generation informed by the shortlisted references. Generate design previews first, then review before adapting the actual frontend. Prior uncommitted green v2 is exploratory, not final.

Private Stitch project: `projects/6687612485050811218` — LedgerFlow — Wallet design exploration.

Direction: light consumer wallet, warm white surfaces, ink typography, restrained indigo actions and lavender accents. Original artwork/layout; broad reference patterns only. Existing IBM Plex Sans and tabular rupiah typography guide implementation.

First slice: mobile overview establishes a design system. Then generate a matching desktop overview, send-money flow and login screen, reusing that system. Clearly fictional mockup balances/activities do not imply live integration.

Real scope: customer auth, zero initial balance, simulated topup, wallet-ID sharing, recipient lookup, recipient confirmation, amount entry, immediate transfer, retry-safe pending requests, paginated activity, frozen/loading/error/empty states and logout. Home navigation maps to overview, move-funds and activity sections.

Exclude unsupported bank cards, QR pay, investments, KYC, notifications, budgets and external bank linking. Do not upload source code, user data, credentials or private ledger records. Only an original product brief and fictional sample amounts are sent to Stitch.

Status: mobile overview generated and its screenshot visually inspected. Awaiting user review before further generation or frontend integration. Design system: `assets/6a3b9a800386485ca206ca95fef96003`. Screen: `projects/6687612485050811218/screens/d1ba15156bfa4d86a3a58c6c12663668`.

Preview: https://lh3.googleusercontent.com/aida/AEtjO1UEHJrpw-17ZMFQiNiiUDguio0oP7tFxPh2he5BHGgLNR3B11qePvUwR4wTS_vzuMEZ0ZwrGAhhOBcpYWsR8rtDX69bwIYH8YUBHUiUVHTA-ZeXkP-NUf5B-7LzMWrgoc8vCwv9vHzXNiDPKuNptgD0ejVs4mHA4el4Kls_oMR2PqRTKP1ZW07C2Tz2wh9kFmoDI6cV8EGNrbAEHm3h6FazaSlC1CLIqXfxdh-4FOJCyPjw22rOth6hQiM=s0

Review notes: the mockup uses sample identity, a non-UUID wallet ID and a merchant activity label; implementation must use actual user identity/valid UUIDs and existing debit/credit labels, with no unsupported merchant-payment feature or fabricated account tier. Screenshot appearance is inspected; generated accessibility claims and interactive behavior are not verified.
