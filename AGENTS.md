## Cursor Cloud specific instructions

### Project overview

Timesheet PWA — a client-side-only progressive web app with two pages:
- `index.html` — Time Clock (PIN-based employee clock in/out, admin panel at PIN `0000`, demo employee PIN `1234`)
- `timesheet.html` — Personal Timesheet (clock in/out, manual time entries, expenses, PDF export, EN/ES i18n)

No backend, no database, no build step. All data lives in `localStorage`. Static HTML/CSS/JS served as-is.

### Running tests

```
npm test                  # runs all 105 Playwright tests (WebKit only)
npm run test:headed       # headed mode for debugging
npm run test:debug        # Playwright inspector
```

Tests use `file://` protocol — no HTTP server needed.

### Serving the app locally

```
npx serve . -l 3000
```

Then visit `http://localhost:3000/` (time clock) or `http://localhost:3000/timesheet.html` (timesheet). An HTTP server is needed for PWA features (service worker, install prompt).

### Notes

- No linter or TypeScript is configured.
- The only dev dependency is `@playwright/test`. Playwright requires the WebKit browser binary installed via `npx playwright install --with-deps webkit`.
- See `CLAUDE.md` for the protected business rule on Total Due calculation.
