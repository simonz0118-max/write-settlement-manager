# WRITE Settlement Manager V6.0 — UI / Responsive Validation

## V6 goals
- Prevent text and monetary KPI values from overflowing cards.
- Support desktop, iPad landscape/portrait, and iPhone Safari layouts.

## Static validation
- `src/app.bundle.js`: JavaScript syntax check passed.
- `src/workers/import.worker.bundle.js`: JavaScript syntax check passed.
- CSS brace balance passed.
- `index.html`, `src/styles.css?v=6.0`, and `src/app.bundle.js?v=6.0` returned HTTP 200 from local static server.

## Responsive rules
- Desktop 1101–1450 px: compact 6-card dashboard with responsive monetary typography.
- iPad landscape <=1100 px: 3-column KPI layout and narrower navigation.
- iPad portrait <=900 px: sidebar changes to horizontal top navigation; dashboard becomes single column.
- iPhone <=600 px: bottom navigation, 2-column KPI layout, single-column hero/actions, touch-scroll tables.
- iPhone SE <=390 px: 1-column KPI fallback.
- Safe-area support for iPhone notch/home indicator via `env(safe-area-inset-*)`.
- Form controls are >=16 px on iPhone to prevent Safari input auto-zoom.
- Long values use `overflow-wrap:anywhere` / `word-break` and grid children use `min-width:0`.
