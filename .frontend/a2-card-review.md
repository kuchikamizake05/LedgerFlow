# A2 — card revision review

User selected A2 and requested a separate card for the upper balance/actions section. Both mobile and desktop were revised using Stitch. Mobile then polished to prevent the Send label wrapping and remove redundant account-type/badge copy.

Preview: http://127.0.0.1:3211/a2-card-preview.html

Project: projects/6687612485050811218. Design system: assets/13539669419598906348.

## Final selected revisions

### A2 — Balance card / Desktop

Screen: projects/6687612485050811218/screens/df762620a0f641b0a5b2c255954b42c1

[Original image](https://lh3.googleusercontent.com/aida/AEtjO1WPk-sHESPDvO9i9Nkip8BuBtHf4hhdOIa0EoyT4vFgIp9LgW2z6MaaTdRaSOPtK85VrzYhzeuZyC_aFB80HiRyp9sXMgxFzRY8Rr-3g8gv7bwOrD4ngOgHmICisvZHHBwlk2rhkCD2x3yzubHkjYkRzz39xq2DiH_3ovSAn1mztr3C6tOpiX3o8aDfwPxGAgL-QoSlBkKajv1CrF2euRgoCW2iBTnu6LIWo8OXC6RzOkB8gPStdJ2hubc=s0)

### A2 — Balance card / Mobile refined

Screen: projects/6687612485050811218/screens/14c14ecbe517497d8542185a7f5ba978

[Original image](https://lh3.googleusercontent.com/aida/AEtjO1WlwgvLT7IUh6r8-VYP_Rt_Uazcix10hmOctUTOX6RNbiv5613-pt6qPc1DeL-BLgiIfTPEseUAMr14xUX72n-tbPyT07qpzZ-se9mqj3gD_hlu285_6J7Ign62EfNvNuNkimQly2uhrqesKejrA7v6PUab-jGyKt8D7Cijc6ERTkjhBzWd_Re3pMQMnKJPG_n9xx_i8z5tb7XakaDSbmm_rtOLjZ0oCYNnnI7sXvF4Gkc-Plm0N98fa2w=s0)

## Scope and review

The upper balance area is now one white rounded panel on cream, with the large ink amount and primary action inside. Activity remains a flat feed. Desktop preserves left balance / right activity composition. Mobile primary action shortened to Kirim for a readable single-line rail. Existing product functions remain the design scope; images use fictional fixtures and imply no API integration.

Original edit prompt: a2-card-revision-prompt.md. Original generation and polish screenshots: a2-card-screens.json and a2-card-final-screens.json.

## Mobile polish prompt

Polish ONLY the selected A2 Balance card MOBILE design. Preserve the white rounded top balance card, cream flat activity area below, the compact header, very large ink Rp 1.250.000 and small lime accents. The current primary button wraps "Kirim uang" onto two lines. Fix the three-button rail inside the card so all three labels fit on one line: primary label "Kirim" (same transfer action), secondary "Isi saldo" and "Terima"; compact tasteful icons and modest 8–10px gaps. All buttons 44–48px tall with readable 14px labels, no clipped content. Do not shrink the balance into small text.
Remove the redundant "Akun Personal · Simulasi Tunggal" line and IDR Aktif badge; keep just header Simulasi plus one "Dana latihan, bukan uang nyata." line. Do not add account categories, new actions or extra cards. Keep the 3 existing activity rows and navigation. Output one revised mobile design titled "A2 — Balance card / Mobile refined", preferably preserving the current centered narrow mobile canvas presentation.

## Verification

Initial mobile, final refined mobile and revised desktop screenshots inspected. White upper balance card visibly separates from cream activity. Refined mobile labels fit on one line and redundant account-type/badge copy is removed. All four before/after images load; Mobile/Desktop selector switches the correct image pair. Evidence: C:/Users/ASUS/.codex/tmp/ledgerflow-wallet-options/a2-card-compare-mobile.png. This verifies static previews and their comparison page, not generated app behavior, measured contrast or accessibility compliance.
