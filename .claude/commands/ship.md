---
name: ship
description: Smart commit-test-push workflow that dynamically selects review depth based on change size, risk, and affected areas. Ensures cache busting, test coverage, and code quality.
user-invocable: true
---

# /ship — Smart Ship Workflow

You are performing the ship workflow for this PWA timesheet project. This command dynamically selects which review and verification steps to run based on what changed.

Follow every step in order. Do NOT skip steps. Do NOT claim success without evidence.

## Context

This is a single-file PWA served via service worker with cache-first strategy. Users will be stuck on stale code unless the service worker cache version is bumped on every deploy. All data lives in localStorage.

## Step 1: Analyze Changes

Run these commands to understand the scope:

```bash
git status
git diff --stat
git diff
```

Classify the change into one of three tiers by evaluating ALL of these signals:

### Tier Classification

<tier_criteria>

**TIER 1 — Light Ship** (quick fixes, copy changes, style tweaks)
All of these must be true:
- Lines changed: ~1-30
- Files changed: 1-2
- No new functions or modified function signatures
- No changes to: business logic, calculations, data flow, state management, localStorage, date handling, or export features
- No changes inside script tags beyond cosmetic (variable renames, string changes)
- Examples: CSS-only changes, text/label updates, comment fixes, i18n string additions

**TIER 2 — Standard Ship** (typical feature work, bug fixes)
Any of these triggers Tier 2:
- Lines changed: ~30-200
- Files changed: 2-5
- New or modified functions
- Changes to rendering, UI logic, or user interactions
- Changes to filtering, sorting, or display logic
- New event listeners or DOM manipulation
- Examples: new UI feature, bug fix with code changes, refactoring a function

**TIER 3 — Full Ship** (major features, risky changes, security-sensitive)
Any ONE of these triggers Tier 3:
- Lines changed: 200+
- Changes to the protected business logic (Total Due calculation)
- Changes to saveState(), loadState(), or localStorage schema
- New or modified data migrations
- Changes to parseLocalDate(), toLocalDateString(), or any date handling
- Changes to exportPDF(), exportPrintFallback(), or financial calculations
- New dependencies or CDN scripts
- Changes to service-worker.js fetch/cache strategy (beyond version bump)
- Security-sensitive changes (auth, input handling, dynamic code execution, raw HTML insertion)
- Changes affecting multiple major features simultaneously
- Examples: new export format, business logic change, data migration, architecture change

</tier_criteria>

**Announce your classification:**
```
SHIP TIER: [1/2/3] — [Light/Standard/Full]
REASON: [Why this tier — what signals triggered it]
FILES: [list]
LINES: [~count]
RISK AREAS: [any high-risk areas touched, or "none"]
```

## Step 2: Bump Service Worker Cache Version

**This is mandatory on every ship, all tiers.** Users cannot get new code without it.

1. Read `service-worker.js` and find the current `CACHE_NAME` version number.
2. Increment the version number by 1.
3. Edit `service-worker.js` to update the version.
4. Stage it alongside other changes.

## Step 3: Review (tier-dependent)

### Tier 1 — Quick Sanity Check
1. Re-read the diff one more time.
2. Confirm no unintended changes leaked in.
3. Verify no `new Date("YYYY-MM-DD")` patterns were introduced (must use `parseLocalDate()`).
4. Proceed to Step 4.

### Tier 2 — Standard Review
Everything in Tier 1, plus:
1. **Test coverage check**: Identify new/changed functionality. Check if existing tests cover it. If not, write tests.
2. **Invoke `coderabbit:review`** (if CodeRabbit CLI is installed — check with `coderabbit --version`). If not installed, skip and note it.
   - Run on uncommitted changes
   - Fix any Critical findings before proceeding.
   - Note Suggestions for the commit message.
3. **Pattern check**: Scan changes for these known project pitfalls:
   - `new Date("YYYY-MM-DD")` without `parseLocalDate()` — date will be wrong in western US timezones
   - Raw HTML insertion (innerHTML, etc.) in main app code — security risk, use DOM methods
   - `doc.open()` without writing an HTML skeleton first — blank page in new windows
   - `.toISOString().split('T')[0]` — UTC date, use `toLocalDateString()` instead

### Tier 3 — Full Review
Everything in Tier 2, plus:
1. **Invoke `superpowers:requesting-code-review`** — dispatch the code-reviewer subagent against the diff. This catches architectural issues, logic errors, and missed edge cases.
2. **Invoke `pr-review-toolkit:silent-failure-hunter`** — specifically hunt for swallowed errors, silent failures, and missing error handling. This catches issues like the blank PDF page (null doc.body with silent appendChild failure).
3. **Business logic audit**: If the Total Due calculation or any financial math was touched:
   - Verify formula: Total Due = Gross Earnings + Reimbursable - Deductions
   - Trace the data flow from input to display
   - Confirm reimbursable is ADDED, deductions are SUBTRACTED
4. **Data migration audit**: If localStorage schema or migrations were touched:
   - Verify migration has a one-time flag
   - Verify migration preserves existing data
   - Verify migration handles missing/malformed data gracefully
5. Fix all Critical and Important findings before proceeding.

## Step 4: Run Full Regression Suite

**Mandatory for ALL tiers.** No exceptions.

```bash
npx playwright test
```

**Requirements:**
- ALL tests must pass (flaky timeclock persistence test excluded — known Playwright reload timing issue).
- Read the FULL output. Count passed vs failed.
- If any test fails (other than the known flaky one): STOP, investigate, fix, and re-run.

**State the result with evidence:** "X/Y tests passed" with the actual output.

## Step 5: Verification Gate

Before committing, explicitly confirm each item. This is the `superpowers:verification-before-completion` discipline — no claims without fresh evidence.

```
VERIFICATION:
- [ ] Service worker cache bumped: vN → vN+1
- [ ] Tests run THIS session: X/Y passed (evidence: [paste last line of output])
- [ ] No new `new Date("YYYY-MM-DD")` patterns (checked diff)
- [ ] Review completed at appropriate tier
- [ ] No unintended files in staging area
```

**If ANY box cannot be checked with evidence, STOP. Do not proceed.**

## Step 6: Commit

1. Stage all relevant changed files. Do NOT stage `firebase-debug.log` or other artifacts.
2. Commit with:
   - **Author:** `Casildav <Casildav@users.noreply.github.com>`
   - **Committer email:** `Casildav@users.noreply.github.com` (via `GIT_COMMITTER_EMAIL`)
   - A descriptive commit message explaining WHAT changed and WHY.
   - Include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>` in the message.
   - Use HEREDOC format for the commit message.

## Step 7: Merge and Push

Check which branch you're on:

```bash
git branch --show-current
```

**If on a feature branch** (e.g., `feature/something`):
1. Commit any remaining changes on the feature branch.
2. Switch to main and pull latest:
   ```bash
   git checkout main
   git pull origin main
   ```
3. Merge the feature branch:
   ```bash
   git merge feature/<name>
   ```
4. If merge conflicts occur: resolve them, run tests again, then continue.
5. Delete the feature branch locally:
   ```bash
   git branch -d feature/<name>
   ```
6. Push main:
   ```bash
   git push origin main
   ```

**If on main** (direct commit):
```bash
git push origin main
```

If push fails due to email privacy, ensure both author and committer use the noreply email.

## Step 8: Report

```
SHIPPED: [commit hash]
TIER: [1/2/3] — [Light/Standard/Full]
BRANCH: [feature/<name> → main, or direct to main]
CACHE: v[old] → v[new]
TESTS: [X passed, Y failed]
REVIEWS RUN: [list of review skills invoked, or "quick sanity check"]
NEW TESTS: [list, or "none needed"]
CHANGES: [bullet summary]
```

## Project Rules (enforced on all tiers)

- **Never skip the cache bump.** Users get stuck on stale cached code.
- **Never skip tests.** Shipping untested code caused every bug in this project.
- **Never claim tests pass without running them in THIS session.**
- **Parse all date-only strings (YYYY-MM-DD) with `parseLocalDate()`, never `new Date()`.** Project-wide invariant.
- **If adding data migrations, set a one-time flag** (like `_dateMigrated`).
- **No raw HTML insertion in main app code.** Use createElement/appendChild/textContent only.
- **Reimbursable expenses are ADDED, deductions are SUBTRACTED.** Protected business logic.
