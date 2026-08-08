# CHANGELOG

All notable changes to WRITE Settlement Manager are recorded here.

## v6.5.4 — 2026-08-08

### Added
- Added a release-notes modal that appears once per new version in each browser.
- Added local read-state persistence so the same version does not show again after acknowledgement.
- Added `CHANGELOG.md` as a required release artifact.

### Improved
- Preserved automatic / light / dark theme modes with real-time system theme following.
- Unified version numbers across UI, README files, Git commit messages, Cloudflare deployment messages, and release metadata.
- Made the release-notes modal responsive for desktop, iPad, and iPhone.

### Release policy
- Every future release must update `CHANGELOG.md`, `README.md`, `README_CN.md`, `RELEASE.txt`, and deployment script version text.
- A new application version automatically triggers the release-notes modal once in the same browser.

## v6.5.2 — 2026-08-08

### Added
- Added three-state theme control: Auto, Light, Dark.
- Auto mode follows macOS / iPadOS / iOS color-scheme changes without refresh.
- Manual theme preference is stored locally in the browser.

## v6.5.1 — 2026-08-08

### Changed
- Replaced the top-left mark with the selected Version C minimalist panda head.
- Changed the top-center credit to `Designed by NEOVORA`.
- Simplified the hero description to focus on order recognition and accounting classification export.

## v6.5 — 2026-08-08

### Changed
- Removed the panda photo/head from the hero area.
- Rebuilt the hero visual as a monochrome accounting/report illustration.
- Continued the grayscale oMLX-inspired visual language.

## v6.1 — 2026-08-08

### Changed
- Rebuilt the UI into a strict black/white/gray workbench visual system.
- Removed colored accents from navigation, cards, buttons, badges, and dialogs.

## v6.0 — 2026-08-08

### Added
- Responsive layouts for desktop, iPad landscape/portrait, and iPhone Safari.
- Touch-friendly horizontal table scrolling and mobile-safe form sizing.

### Fixed
- Prevented KPI, amount, filename, product, and table text from overflowing containers.

## v5.3.3 — 2026-08-08

### Changed
- Rebuilt accounting export into one-purpose-per-sheet professional workbook structure.
- Centered accounting workbook typography and improved widths, freezes, filters, and monetary formats.

## v5.3.2 — 2026-08-08

### Fixed
- Removed fragile ES-module startup dependencies by bundling the main UI logic and worker logic.

## v5.3.1 — 2026-08-08

### Fixed
- Fixed a JavaScript parsing error that prevented the entire UI event layer from starting.

## v5.3.0 — 2026-08-08

### Added
- Made pending-review rows editable and saveable before final export.
- Rebuilt clear-data confirmation behavior.

### Changed
- Redesigned accounting summary to show sales, FACT cost, estimated gross profit, and gross margin first.

## v5.2 — 2026-08-08

### Added
- Added FACT-style category summary with Quantity, COGs, Shipping, unit cost, and Amount.
- Added country-level FACT detail sheets.

## v5.1 — 2026-08-08

### Fixed
- Fixed styled-empty-cell alignment issues in FACT parsing.
- Enabled reliable FACT cost extraction while still excluding FACT pages from real-order import.

## v5.0 — 2026-08-08

### Changed
- Introduced the hero-page export action and first major visual redesign.
- Reorganized accounting workbook output into summary, detail, review, audit, and import-log layers.

## v4.1 — 2026-08-08

### Added
- Established the stable local-browser import pipeline for real WRITE order workbooks.
- Added Cloudflare Pages deployment workflow and GitHub repository publishing scripts.
