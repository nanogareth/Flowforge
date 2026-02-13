# Plan: Install Platform Hooks Globally + FlowForge TDD Config

## Context

The FlowForge template system generates 10 hook scripts and `.claude/settings.json` for scaffolded repos. The user wants the same automation layer on their own machine: global platform hooks for all projects, plus FlowForge-specific TDD hooks and TypeScript env vars.

**Prerequisite:** User will install `jq` separately (required by all hook scripts for JSON parsing from stdin).

---

## Step 1: Create global hook scripts

**Directory:** `~/.claude/hooks/` (create new directory)

Write all 10 hook scripts. Content is identical to what `platform.ts` generates — the same bash scripts that FlowForge scaffolds into new repos.

| Script | Event |
|--------|-------|
| `block-test-execution.sh` | PreToolUse(Bash) |
| `protect-files.sh` | PreToolUse(Edit\|Write) |
| `auto-format.sh` | PostToolUse(Edit\|Write) |
| `auto-deps.sh` | PostToolUse(Edit\|Write), async |
| `auto-remap.sh` | PostToolUse(Write), async |
| `post-typecheck.sh` | PostToolUse(Edit\|Write) |
| `session-state.sh` | SessionStart |
| `pre-compact-handover.sh` | PreCompact(auto) |
| `stop-test-loop.sh` | Stop |
| `post-explore-reminder.sh` | PostToolUse(Task) |

## Step 2: Update global `~/.claude/settings.json`

Merge platform hooks into existing config. Keep existing: Notification hook, env vars, permissions, plugins.

**Add platform hooks** (always-on, all projects, reference `"$HOME"/.claude/hooks/`):
- `PreToolUse[Bash]` → `block-test-execution.sh`
- `PreToolUse[Edit|Write]` → `protect-files.sh`
- `PostToolUse[Edit|Write]` → `auto-format.sh`
- `SessionStart[startup|resume|compact]` → `session-state.sh` (timeout: 10)
- `PreCompact[auto]` → `pre-compact-handover.sh` (timeout: 15)

TDD hooks are **NOT** wired globally — they go per-project (Step 3).

## Step 3: Update FlowForge project `settings.local.json`

**File:** `C:\GitHub\Flowforge\.claude\settings.local.json` (gitignored)

Merge TDD hooks + TypeScript env vars with existing permissions. Reference global scripts via `"$HOME"/.claude/hooks/`.

**TDD hooks:**
- `PostToolUse[Edit|Write]` → `post-typecheck.sh`, `auto-deps.sh` (async)
- `PostToolUse[Write]` → `auto-remap.sh` (async)
- `PostToolUse[Task]` → `post-explore-reminder.sh`
- `Stop` → `stop-test-loop.sh` (timeout: 300)

**Env vars** (adjusted for monorepo — `cd flowforge-mobile &&` prefix where needed):
```
TEST_RUNNER_CMD=cd flowforge-mobile && npx jest --no-coverage --json --outputFile=tests/reports/latest.json
TEST_REPORT_FORMAT=jest-json
TYPE_CHECK_CMD=cd flowforge-mobile && npx tsc --noEmit
FORMAT_CMD=npx prettier --write
LINT_CMD=cd flowforge-mobile && npx eslint
```

## Step 4: Create FlowForge tests/reports directory

**File:** `C:\GitHub\Flowforge\tests\reports\.gitkeep` (create)

Ensures the test report output directory exists for the stop-test-loop hook.

---

## File Manifest

| File | Action |
|------|--------|
| `~/.claude/hooks/*.sh` (10 files) | **Create** |
| `~/.claude/settings.json` | **Modify** — add platform hooks |
| `C:\GitHub\Flowforge\.claude\settings.local.json` | **Modify** — add TDD hooks + env vars |
| `C:\GitHub\Flowforge\tests\reports\.gitkeep` | **Create** |

## Verification

1. `ls ~/.claude/hooks/` — all 10 scripts present
2. Restart Claude Code session — SessionStart hook fires
3. Edit a file — auto-format hook fires
4. `jq --version` — confirms jq is installed (user prerequisite)
