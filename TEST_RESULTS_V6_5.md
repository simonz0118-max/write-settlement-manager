# WRITE Settlement Manager V6.5 — Release Verification

## Visual changes
- Sidebar uses Version C panda side-profile line-art logo.
- Hero contains no panda photograph/head and no `WRITE · SETTLEMENT MANAGER` eyebrow.
- Hero illustration is a monochrome accounting/report SVG.
- Existing black/white/gray oMLX-like visual language is preserved.

## Responsive behavior
- Desktop: two-column hero with bounded accounting illustration.
- Tablet/iPad: hero stacks vertically and keeps the accounting illustration.
- iPhone: hero illustration is hidden to prioritize actions/content; bottom navigation behavior from V6 remains.

## Runtime checks
- `app.bundle.js`: syntax check passed.
- `import.worker.bundle.js`: syntax check passed.
- Brand panda/photo image tags in hero: 0.
- Accounting hero visuals: 2 (empty/imported states).
- Release marker: 6.5.
