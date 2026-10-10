# Generated Stitch design system — proposed, awaiting review

---
name: LedgerFlow
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#464555'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#777587'
  outline-variant: '#c7c4d8'
  surface-tint: '#4f43e3'
  primary: '#3725cd'
  on-primary: '#ffffff'
  primary-container: '#5146e5'
  on-primary-container: '#dbd8ff'
  inverse-primary: '#c3c0ff'
  secondary: '#006c4a'
  on-secondary: '#ffffff'
  secondary-container: '#82f5c1'
  on-secondary-container: '#00714e'
  tertiary: '#950029'
  on-tertiary: '#ffffff'
  tertiary-container: '#c20038'
  on-tertiary-container: '#ffd0d2'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e3dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#100069'
  on-primary-fixed-variant: '#3522cb'
  secondary-fixed: '#85f8c4'
  secondary-fixed-dim: '#68dba9'
  on-secondary-fixed: '#002114'
  on-secondary-fixed-variant: '#005137'
  tertiary-fixed: '#ffdada'
  tertiary-fixed-dim: '#ffb3b6'
  on-tertiary-fixed: '#40000c'
  on-tertiary-fixed-variant: '#920028'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  display-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.005em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  currency-lg:
    fontFamily: IBM Plex Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  currency-md:
    fontFamily: IBM Plex Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0em
  currency-sm:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0em
  label-md:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: IBM Plex Sans
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system embodies high-precision Indonesian financial technology: authoritative, calm, and frictionless. Crafted for digital banking simulators, micro-transactions, and mobile wallet management, the design balances technical reliability with warmth and approachability.

The aesthetic is Modern Corporate mixed with purposeful Soft Minimalism:
- Flat layered surfaces resting against an ultra-soft cool/warm neutral background.
- Crisp container separation using hairline borders rather than heavy, dramatic drop shadows.
- Vibrant, disciplined indigo signals primary momentum, balanced by balanced emerald and slate-rose for credit and debit events.
- Utilitarian elegance engineered for absolute readability across variable screen densities, low-light outdoor contexts, and dense transaction ledgers.

## Colors

The palette emphasizes clean contrast, surgical hierarchy, and financial predictability. The primary canvas uses `#F8F9FC`, a cool-tinted off-white that eliminates screen glare while allowing pure white containers (`#FFFFFF`) to visually elevate naturally.

### Palette Architecture
- **Primary Canvas Background**: `#F8F9FC`
- **Surface & Cards**: `#FFFFFF`
- **Hairline Borders**: `#EEF2F6` (subtle inner elements) and `#E5E7EB` (structural containers)
- **Primary Indigo**: `#5146E5` (interactive main CTA), `#4338CA` (hover/pressed), `#3730A3` (focused state)
- **Indigo Tints**: `#EEF2FF` (badge fills, pill containers), `#E0E7FF` (active states, focus rings)
- **Positive Credit (Emerald)**: `#059669` (text/icons), `#ECFDF5` (tinted backgrounds/tags)
- **Negative Debit (Rose / Slate)**: `#E11D48` (negative values), `#FFF1F2` (debit tag fill), `#475569` (neutral deduction amounts)
- **Text & Ink Hierarchy**:
  - Primary Typography: `#0F172A` (deep ink slate, minimum 13:1 contrast against pure white)
  - Secondary Typography: `#475569` (slate metadata, subtitles)
  - Muted / Caption: `#64748B` (supporting dates, transaction IDs)
  - Disabled: `#94A3B8`

All interactive elements guarantee a minimum contrast ratio of 4.5:1 against their immediate backgrounds, satisfying WCAG 2.1 AA standards.

## Typography

The type scale pairs the warm, geometric legibility of Plus Jakarta Sans for UI structure with the disciplined tabular clarity of IBM Plex Sans for numbers and financial data.

### Numerical & Currency Formatting Guidelines
- Indonesian Rupiah must always implement `font-variant-numeric: tabular-nums` (e.g., `font-feature-settings: "tnum"`).
- Currency prefixes ("Rp") use a non-breaking space followed by period-separated thousands and comma-separated cents: `Rp 250.000,00`.
- The "Rp" identifier maintains medium weight (`500`) while integers use semibold (`600`) to highlight value changes instantly.
- In dense tables and transaction logs, negative indicators must use the true minus character (`−`) rather than a hyphen, aligned directly with numerals.

## Layout & Spacing

The layout is built around a mobile-first, strict 4px/8px mathematical rhythm with edge padding ensuring safety on notched devices and Android edge-to-edge displays.

### Layout Principles
- **Mobile Grid**: 4 columns, `margin-mobile: 1rem` (16px), `gutter-mobile: 0.75rem` (12px).
- **Tablet / Responsive Drawer**: 8 columns, `margin: 1.5rem` (24px), `gutter: 1rem` (16px), max container width capped at 540px for single-hand mobile banking ergonomics.
- **Vertical Rhythm**: Micro-distances (chips, input icons) use `space-xs` (4px) and `space-sm` (8px). Structural padding within cards and sections strictly leverages `space-md` (16px) and `space-lg` (24px).
- **Touch Target Integrity**: Any touch interaction (chips, quick transfer shortcuts, toggles) maintains a minimum bounding box of 44×44px, even when the visible container is compact.

## Elevation & Depth

This design system avoids dark skeuomorphic drops and muddy blurs in favor of crisp, layered clarity through subtle outlines and micro-ambient diffusion:

- **Flat Surface Tier**: Pure white cards (`#FFFFFF`) overlaying `#F8F9FC` with a hairline stroke: `border: 1px solid #EEF2F6`.
- **Level 1 (Default Cards & Tiles)**: `box-shadow: 0 1px 2px 0 rgba(15, 23, 42, 0.04)`, combined with `border: 1px solid #E5E7EB`.
- **Level 2 (Floating Action Bars / Bottom Navigation / Modals)**: `box-shadow: 0 4px 12px -2px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.03)`, backed by `border: 1px solid #E2E8F0`.
- **Overlay & Sheets**: Modal bottom sheets use an ultra-light tint backdrop (`rgba(15, 23, 42, 0.32)`) with non-blur solid white container surfaces for rapid GPU rendering on budget mobile processors.

## Shapes

The interface utilizes a roundedness factor of `2` (medium-soft), establishing a friendly yet controlled financial posture:
- **Default Elements (Inputs, Buttons, Cards)**: 12px (`0.75rem`) to 16px (`1rem`).
- **Feature Cards & Balance Overviews**: 16px (`1rem`).
- **Pills, Transaction Tags, and Status Badges**: Fully rounded (`9999px`) to immediately signal non-editable, categorical metadata.
- **Sheet Headers & Dialogs**: Top corners rounded to 20px (`1.25rem`), bottom corners flush.

## Components

### Buttons
- **Primary CTA**: Height 48px (full-bleed or card-inset). Background `#5146E5`, text `#FFFFFF`, font-weight 600, border radius 12px. Active/pressed state drops to `#4338CA`.
- **Secondary Action**: Height 48px. Background `#EEF2FF`, text `#5146E5`, border none. Pressed state `#E0E7FF`.
- **Outlined / Tertiary**: Height 44px+. Background transparent, border `1px solid #E5E7EB`, text `#0F172A`.

### Input Fields & Amount Editors
- **Standard Input**: Height 48px. Background `#FFFFFF`, border `1px solid #E5E7EB`, text `#0F172A`, placeholder `#94A3B8`. Focus state shifts border to `#5146E5` with a 2px outer glow (`#EEF2FF`).
- **Rupiah Currency Field**: Large format display. Integrated prefix ("Rp") fixed in secondary slate (`#64748B`), input numeric font sized at 28px using IBM Plex Sans Tabular.

### Cards & Ledger Tiles
- **Main Balance Card**: White `#FFFFFF`, border `1px solid #E5E7EB`, 16px padding, 16px radius. Displays primary account number, copy action button, hidden eye-toggle, and headline balance.
- **Transaction Item (List Row)**: Flat row with 48px circular or 12px rounded-square avatar icon indicating merchant/type. Left side displays transaction name and timestamp; right side displays formatted Rupiah amount.
  - Credit rows: Amount formatted in `#059669` prefixed with `+`.
  - Debit rows: Amount formatted in `#0F172A` (or `#E11D48` for overdraft warnings) prefixed with `−`.

### Chips & Quick-Select Selectors
- **Nominal Quick Chips** (e.g., `Rp 50.000`, `Rp 100.000`): Height 36px (within 44px hit bounds), background `#F8F9FC`, border `1px solid #E5E7EB`, text `#475569`. Selected state flips to background `#EEF2FF`, border `#5146E5`, text `#5146E5`.
- **Status Badges**: Padding 4px 8px, border radius 9999px, font size 11px, IBM Plex Sans 600.
  - Success/Settled: Background `#ECFDF5`, text `#059669`.
  - Pending/Escrow: Background `#FEF3C7`, text `#D97706`.
  - Rejected: Background `#FFF1F2`, text `#E11D48`.

### Checkboxes & Toggle Switches
- **Toggle Switch**: 28px height, 48px width track. Inactive track `#E2E8F0`, active track `#5146E5`. Pure white thumb 24px diameter with subtle elevation.
- **Checkboxes**: 20×20px container, 4px border radius. Border `1.5px solid #CBD5E1`. Checked state background `#5146E5`, white checkmark.
