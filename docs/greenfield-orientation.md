# Greenfield Project Orientation

> How this Claude Code environment works, what it automates, and why.

This document explains the automation layer that surrounds every Claude Code session in a FlowForge-scaffolded project. If you're Claude Code reading this at session start, treat it as your operating manual. If you're a human, it explains what's happening behind the scenes when Claude builds your project.

---

## Design Objectives

This configuration pursues five goals:

1. **Autonomous TDD** — Claude writes code, tests run automatically, failures loop back for fixing. No human needed until iteration limits are reached or all tests pass.
2. **Immediate feedback** — Type errors surface seconds after a file is saved, not minutes later when the full test suite runs. Claude sees problems while the context is fresh.
3. **Zero-friction maintenance** — Dependencies install themselves when package files change. The codebase map regenerates when source files are created. Nothing manual stays manual.
4. **Context preservation** — Session state (test status, active plans, handover notes) injects into every new session. Auto-compaction captures a snapshot before context is lost. Claude never starts cold.
5. **Layered safety** — Universal protections (no writing to `.env`, no direct test execution) apply to every project. Workflow-specific automation (TDD loop, type checking) activates per-project based on intent.

---

## The Two-Layer Model

Configuration splits into a **global layer** (all projects, always active) and a **project layer** (workflow-specific, per-repo).

### Global Layer (`~/.claude/settings.json`)

Provides universal safety and session lifecycle management. These hooks fire in every project, every session, with no opt-in required.

| Hook                   | Event                     | What It Does                                                                                                                           |
| ---------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `block-test-execution` | PreToolUse (Bash)         | Blocks direct `jest`, `pytest`, `cargo test` commands. Tests must run through the Stop hook, which captures structured output.         |
| `protect-files`        | PreToolUse (Edit\|Write)  | Blocks writes to `.env`, `.git/`, `.sqlite`, `.db`. Prevents accidental credential or database corruption.                             |
| `auto-format`          | PostToolUse (Edit\|Write) | Formats the changed file using `$FORMAT_CMD` or extension-based detection (Prettier for JS/TS, Black for Python, rustfmt for Rust).    |
| `session-state`        | SessionStart              | Injects last test results, latest handover doc, and active plan into Claude's context at session start.                                |
| `pre-compact-handover` | PreCompact (auto)         | Captures git branch, uncommitted file count, last commit, and test status into `docs/handover/` before auto-compaction erases context. |

**What the global layer does NOT do:** It does not run tests, enforce type checking, install dependencies, or block Claude from stopping. Those are workflow concerns delegated to the project layer.

### Project Layer (`.claude/settings.local.json`)

Activates TDD automation for this specific project. These hooks only fire when explicitly wired in the project's settings.

| Hook                    | Event                     | What It Does                                                                                                                                    | Async   |
| ----------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `post-typecheck`        | PostToolUse (Edit\|Write) | Runs `$TYPE_CHECK_CMD` after file changes. Injects type errors (first 500 chars) into Claude's context immediately.                             | No      |
| `auto-deps`             | PostToolUse (Edit\|Write) | Detects changes to `package.json`, `pyproject.toml`, `Cargo.toml`. Runs the appropriate install command in the background.                      | **Yes** |
| `auto-remap`            | PostToolUse (Write)       | Detects new source files. Regenerates `.claude/references/codebase.md` so the index stays current.                                              | **Yes** |
| `post-explore-reminder` | PostToolUse (Task)        | After subagents return, reminds Claude to persist exploration findings to `.claude/references/explorations/`.                                   | No      |
| `stop-test-loop`        | Stop (300s timeout)       | Runs `$TEST_RUNNER_CMD` and `$LINT_CMD`. If anything fails, blocks Claude from stopping and provides failure output. Claude fixes, tries again. | No      |

---

## How a Single Edit Flows Through the System

When Claude edits a TypeScript file, here's the full hook chain:

```
1. Claude calls Edit on src/lib/foo.ts
       │
       ▼
2. PreToolUse fires
   ├─ protect-files.ps1 checks path
   │  └─ Not a protected file → ALLOW
       │
       ▼
3. Edit executes (file is modified)
       │
       ▼
4. PostToolUse fires (all matching hooks run)
   ├─ auto-format.ps1 → runs Prettier on foo.ts (sync)
   ├─ post-typecheck.ps1 → runs tsc --noEmit (sync)
   │  └─ If errors: injects "Type checker found N error(s): ..." into context
   ├─ auto-deps.ps1 → checks if foo.ts is a package file (async, background)
   │  └─ Not a package file → no action
   └─ auto-remap.ps1 → not a Write, only Edit → does not fire
       │
       ▼
5. Claude sees type errors (if any) and continues working
```

When Claude writes a **new** file (Write tool instead of Edit), `auto-remap` also fires asynchronously to update the codebase map.

---

## How the TDD Stop-Loop Works

This is the flagship automation. When Claude believes its work is done:

```
1. Claude signals "stop" (turn ends)
       │
       ▼
2. stop-test-loop.ps1 fires
   ├─ Sets stop_hook_active flag (prevents infinite re-entry)
   ├─ Runs: cd flowforge-mobile && npx jest --no-coverage --json --outputFile=../tests/reports/latest.json
   ├─ Runs: cd flowforge-mobile && npx eslint . --ext .ts,.tsx
       │
       ├─ All pass → exit 0 → Claude stops normally
       │
       └─ Any failure → exit 2 with JSON:
          { "decision": "block",
            "reason": "Tests/lint failed — last 20 lines of output (truncated to 500 chars)" }
              │
              ▼
3. Claude receives failure output, fixes the code
       │
       ▼
4. Claude signals "stop" again → loop repeats (max 3 iterations)
```

**Why block direct test execution?** The `block-test-execution` hook prevents Claude from running `npx jest` or `pytest` in Bash. This forces all test runs through the Stop hook, which:

- Captures structured JSON output to `tests/reports/latest.json`
- Feeds results back to `session-state` for next-session context injection
- Keeps token usage predictable (structured summaries, not raw console output)

---

## Environment Variables Drive Behavior

Hooks are generic scripts. **Environment variables make them project-specific.** The project layer sets these in `settings.local.json` under the `env` key:

| Variable             | Purpose                                                  | Example (this project)                                                                           |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `TEST_RUNNER_CMD`    | Command the Stop hook runs for tests                     | `cd flowforge-mobile && npx jest --no-coverage --json --outputFile=../tests/reports/latest.json` |
| `TEST_REPORT_FORMAT` | How to parse the JSON output                             | `jest-json`                                                                                      |
| `TYPE_CHECK_CMD`     | Command the typecheck hook runs                          | `cd flowforge-mobile && npx tsc --noEmit`                                                        |
| `FORMAT_CMD`         | Override for auto-format (fallback: extension detection) | `npx prettier --write`                                                                           |
| `LINT_CMD`           | Command the Stop hook runs for linting                   | `cd flowforge-mobile && npx eslint . --ext .ts,.tsx`                                             |

**Monorepo note:** This project has two packages (`flowforge-mobile/` and `flowforge-api/`). All commands prefix with `cd flowforge-mobile &&` because that's where the template system and tests live. The `--outputFile=../tests/reports/latest.json` writes to the project root where hooks expect it.

### How Different Stacks Change These Variables

The same hooks work for any technology. Only the env vars change:

| Stack                   | TEST_RUNNER_CMD                                                   | TYPE_CHECK_CMD     | FORMAT_CMD             |
| ----------------------- | ----------------------------------------------------------------- | ------------------ | ---------------------- |
| TypeScript (React/Node) | `npx jest --json --outputFile=...`                                | `npx tsc --noEmit` | `npx prettier --write` |
| Python                  | `py -m pytest --tb=short -q --json-report --json-report-file=...` | `py -m mypy`       | `black`                |
| Rust                    | `cargo test -- --format json`                                     | `cargo check`      | `rustfmt`              |
| Custom                  | _(not set — hooks skip gracefully)_                               | _(not set)_        | _(not set)_            |

---

## Session Lifecycle

### Starting a Session

`session-state.ps1` fires on `SessionStart` (startup, resume, or compact recovery):

1. Reads `tests/reports/latest.json` — extracts pass/fail counts
2. Finds newest `docs/handover/handover-*.md` — provides previous session context
3. Finds newest `.claude/plans/*.md` — shows active implementation plan

Claude sees this as `additionalContext` in the startup hook output:

```
Last test run: 136 passed, 0 failed.
```

### Before Auto-Compaction

When the conversation grows too long, Claude Code auto-compacts. `pre-compact-handover.ps1` fires first:

1. Captures current git branch and uncommitted file count
2. Records last commit message
3. Checks if test reports exist
4. Writes to `docs/handover/auto-compact-YYYYMMDD-HHmmss.md`

This file is discovered by `session-state` on the next session start, closing the loop.

### Handover Chain

```
Session A: work happens → auto-compact triggers
  → pre-compact-handover writes docs/handover/auto-compact-20260213-143022.md
  → context compacts

Session A (resumed) or Session B:
  → session-state reads docs/handover/auto-compact-20260213-143022.md
  → Claude starts with awareness of where Session A left off
```

---

## The Three-Layer Template Model

FlowForge scaffolds new projects using a composition system that mirrors this two-layer configuration:

```
Platform Layer (universal)
  ├─ 10 hook scripts
  ├─ Slash commands (/hook-check, /session-handover, /remap, /stack-check)
  ├─ Reference framework skeleton
  └─ .gitignore base, tests/reports/.gitkeep

Workflow Layer (process-specific)
  ├─ greenfield: /architect → /build-plan → TDD phases
  ├─ research: exploration persistence, knowledge synthesis
  ├─ feature: task decomposition, integration testing
  └─ learning: guided exercises (TDD hooks disabled)

Stack Layer (technology-specific)
  ├─ README, config files (tsconfig.json, pyproject.toml, Cargo.toml)
  ├─ .gitignore additions
  ├─ CLAUDE.md sections (tech stack, getting started, project structure)
  └─ Devcontainer with stack-appropriate tooling
```

These three layers compose into a single coherent output:

- **CLAUDE.md** — sections sorted by order (stack 10-40, workflow 30, platform 50-70)
- **settings.json** — hook wiring + env vars (platform hooks always, TDD hooks for non-learning workflows)
- **.gitignore** — platform base merged with stack-specific entries
- **devcontainer** — universal base image + stack-specific language features

### Greenfield Workflow Specifically

The greenfield preset enforces an architecture-first sequence:

1. **Define** — Write `docs/brief.md` (project vision and constraints)
2. **Architect** — Run `/architect` to generate `docs/architecture.md`
3. **Plan** — Run `/build-plan` to create phased, TDD-structured build sequence
4. **Build** — Implement phase-by-phase with autonomous test loops
5. **Deploy** — Run `/deploy-check` for pre-deployment verification
6. **Handover** — Context management between sessions

All TDD hooks are active. The Stop hook enforces test passage before Claude can finish a turn. Type checking provides immediate feedback. The full automation stack runs.

---

## Windows Implementation Details

All hooks are PowerShell scripts (`.ps1`), not bash. This is required because Claude Code invokes hook commands through `cmd.exe` on Windows.

**Key patterns in every hook:**

- `[Console]::In.ReadToEnd()` reads JSON from stdin (not `$input`, which corrupts JSON)
- `ConvertTo-Json -Depth 3 -Compress` builds output (never here-strings with interpolation)
- `[Console]::Error.WriteLine()` writes to stderr for debugging
- `cmd /c "$cmd"` runs env var commands that use bash syntax (`&&`)
- `-NoProfile` flag prevents PowerShell profiles from corrupting JSON stdout
- `exit 2` blocks tool execution; `exit 0` with JSON provides context

**Important distinction:** The Bash tool in Claude Code runs Git Bash (`/usr/bin/bash`), not PowerShell. Unix commands (`ls`, `grep`, `find`) work. PowerShell cmdlets (`Get-ChildItem`, `Select-Object`) will fail with exit code 127. Hooks run in PowerShell; Bash tool runs in Git Bash. These are separate execution contexts.

---

## Reference Framework

The `~/.claude/references/` directory provides on-demand knowledge:

```
references/
├── _index.md              ← keyword-searchable index (read this first)
├── meta/
│   ├── claude-code-hooks.md       ← hook event reference
│   ├── claude-code-settings.md    ← settings hierarchy
│   ├── hook-patterns.md           ← working JSON examples
│   └── skill-reliability.md       ← skill activation guidance
├── tools/
│   ├── neo4j-cypher.md            ← Cypher query patterns
│   └── claude-code-workflows-plugins.md
└── projects/
    └── _registry.md               ← cross-project reusable components
```

**Rules:** Read `_index.md` first. Only load references relevant to the current task. Never bulk-read all references.

Project-level references live in `.claude/references/` within the repo and include:

- `codebase.md` — auto-generated module/class/function index
- `explorations/` — persisted findings from subagent research

---

## Maintenance Tools

Three Python scripts in `~/.claude/tools/` support the reference framework:

| Tool                     | When to Run                                    | What It Does                                                                                |
| ------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `codebase-mapper.py`     | After creating/deleting/renaming source files  | Scans source code (Python, JS/TS, Rust, SQL) and generates `.claude/references/codebase.md` |
| `reference-adder.py`     | When adding a new reference doc                | Copies file to references tree and updates `_index.md` with section-aware insertion         |
| `reference-distiller.py` | When distilling external docs into a reference | Fetches URL/file, sends to Gemini, outputs concise reference markdown                       |

The `auto-remap` hook automates `codebase-mapper.py` by running it in the background whenever new source files are written.

---

## Summary: What's Automated vs. What's Manual

| Concern                   | Automated By                 | Manual?             |
| ------------------------- | ---------------------------- | ------------------- |
| File formatting           | `auto-format` hook           | No                  |
| Type checking             | `post-typecheck` hook        | No                  |
| Test execution            | `stop-test-loop` hook        | No                  |
| Dependency installation   | `auto-deps` hook             | No                  |
| Codebase map updates      | `auto-remap` hook            | No                  |
| Session context injection | `session-state` hook         | No                  |
| Pre-compaction snapshots  | `pre-compact-handover` hook  | No                  |
| Protected file writes     | `protect-files` hook         | No                  |
| Direct test blocking      | `block-test-execution` hook  | No                  |
| Exploration reminders     | `post-explore-reminder` hook | No                  |
| Architecture design       | `/architect` command         | Yes (user invokes)  |
| Build planning            | `/build-plan` command        | Yes (user invokes)  |
| Reference distillation    | `reference-distiller.py`     | Yes (user invokes)  |
| Adding references         | `reference-adder.py`         | Yes (user invokes)  |
| Pushing to remote         | `git push`                   | Yes (user approves) |

The configuration objective: **automate everything that can be automated without human judgment, leave everything else as explicit user-invoked commands.**
