# V5.3.2 Hotfix validation

- Main UI JavaScript bundled into `src/app.bundle.js`; no ES module imports remain.
- Import worker bundled into `src/workers/import.worker.bundle.js`; no worker module imports remain.
- `index.html` loads a normal `defer` script, not `type=module`.
- Main bundle passes `node --check`.
- Worker bundle passes `node --check`.
- App readiness marker is set after event listeners and initial reset complete.
- A delayed visible boot-failure diagnostic appears only if the app bundle never starts.
