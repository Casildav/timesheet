---
name: feature
description: Start a new feature branch for timeclock app changes. Creates branch, sets up workspace, and guides implementation with proper git workflow.
user-invocable: true
---

# /feature — Start a Feature Branch

You are starting a new feature branch for the timeclock/timesheet app. This enforces proper git workflow: never develop directly on main.

**Announce:** "Starting a new feature branch."

## Step 1: Get Feature Description

If the user provided a description with the command (e.g., `/feature add dark mode toggle`), use it.

If no description was provided, ask:
```
What are you building? Give me a short description.
```

Wait for their response before proceeding.

## Step 2: Ensure Clean State

```bash
git status
git stash list
```

- If there are uncommitted changes: ask user whether to stash them or commit them first.
- If on a feature branch already: warn the user and ask if they want to finish that branch first (suggest `/ship` or `/superpowers:finishing-a-development-branch`).

## Step 3: Create Feature Branch

1. Pull latest main:
```bash
git checkout main
git pull origin main
```

2. Create and switch to feature branch:
```bash
git checkout -b feature/<slug>
```

Name the branch `feature/<slug>` where `<slug>` is a kebab-case summary of the feature (2-4 words max). Examples:
- "add dark mode toggle" → `feature/dark-mode-toggle`
- "fix expense calculation" → `feature/fix-expense-calc`
- "mobile delete buttons" → `feature/mobile-delete-buttons`

**Announce:**
```
Branch: feature/<slug>
Base: main @ <short-hash>
Ready to develop.
```

## Step 4: Scope the Work

Before writing any code:

1. **Identify affected files** — which files will this feature touch?
2. **Check for pitfalls** — scan the change area for these project-specific traps:
   - Date handling: must use `parseLocalDate()` for YYYY-MM-DD strings, `toLocalDateString()` for formatting
   - DOM manipulation: use `createElement`/`appendChild`/`textContent` only, no raw HTML insertion
   - Business logic: Total Due = Gross Earnings + Reimbursable - Deductions (protected, confirm before changing)
   - State changes: if modifying localStorage schema, plan a migration with a one-time flag
3. **Announce the plan:**
```
PLAN:
1. [step] — [why]
2. [step] — [why]
→ Executing unless you redirect.
```

## Step 5: Develop

Implement the feature. Follow existing patterns in the codebase:
- Vanilla JS, no build system
- DOM manipulation via createElement/appendChild
- State stored in `state` object, persisted via `saveState()` to localStorage
- i18n via `t()` function — add both English and Spanish translations
- CSS in the `<style>` block, mobile styles in the `@media (max-width: 600px)` section

**Commit incrementally** on the feature branch as you make progress. Use the noreply email:
- Author: `Casildav <Casildav@users.noreply.github.com>`
- Committer: `GIT_COMMITTER_EMAIL=Casildav@users.noreply.github.com`

## Step 6: When Done

When the feature is complete, tell the user:
```
Feature complete on branch feature/<slug>. Ready to ship.

Run /ship to: bump cache, run tests, merge to main, and push.
```

The `/ship` command will handle the rest — tests, cache bump, review, commit, push.

## Rules

- **Never develop on main.** That's what this command exists to prevent.
- **Commit early, commit often** on the feature branch. Small commits are easier to review and revert.
- **Don't mix features.** One branch = one feature. If a second idea comes up, finish this branch first.
- **Always pull main before branching.** Stale bases cause merge conflicts.
