# Platform Architecture

> Universal layer — every project gets this regardless of workflow or stack.

**Status:** v3.0 — split from unified design doc
**Date:** 2026-02-12

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Memory Architecture](#2-memory-architecture)
3. [Token Conservation Stack](#3-token-conservation-stack)
4. [Error Correction Framework](#4-error-correction-framework)
5. [Automation Layer — Platform Hooks](#5-automation-layer--platform-hooks)
6. [Exploration Persistence](#6-exploration-persistence)
7. [Reference Library System](#7-reference-library-system)
8. [Universal Slash Commands](#8-universal-slash-commands)
9. [Global CLAUDE.md](#9-global-claudemd)
10. [Baseline Plugins & MCP Servers](#10-baseline-plugins--mcp-servers)
11. [Platform-Level Risks & Mitigations](#11-platform-level-risks--mitigations)

---

## 1. Design Principles

### Token Conservation

Every design decision is evaluated against token cost. Tokens mean energy and water. The system minimises token exchange through:

1. **Progressive disclosure** — CC reads indexes first, detail on demand
2. **AST-based codebase mapping** — replaces grep/glob exploration with indexed lookup
3. **RTK command compression** — 60-90% reduction on command output tokens
4. **Structured test reports** — JSON summaries, never raw output in conversation
5. **CC never executes tests** — human runs all tests and experiments
6. **Subagent isolation** — exploration work stays out of main context
7. **Lazy-loaded skills/tools** — trigger-based loading, not always-on

### Hooks Over Instructions

Agent teams (experimental) don't inherit CLAUDE.md. Therefore, enforcement of critical rules (no test execution, commit conventions, file protection) uses **hooks** rather than CLAUDE.md instructions. Hooks fire regardless of which agent is executing.

### Custom Agents and Tools as Deliverables

When the workflow requires specialised capability, the system should produce custom agents with custom tools — not just prompt wrappers. An agent without tools is just a prompt. The `/research-setup` phase evaluates whether custom agents/tools are needed and scopes them as implementation deliverables.

---

## 2. Memory Architecture

### Layer 1: CLAUDE.md (Project Instructions — Human-Curated, Git-Tracked)

**Location:** `./CLAUDE.md`
**Loaded:** Fully, every session start
**Contains:**
- Project description and architecture overview
- Build/run commands
- Coding conventions
- Workflow instructions (TDD process, handover triggers)
- `@` imports to `.claude/references/_index.md` (the codebase map)
- `@` imports to relevant reference library entries
- Pointers to error correction files (NOT the errors themselves)

**Key constraint:** Keep this lean. Anything that isn't universally needed every session should be a reference file loaded on demand.

### Layer 2: CLAUDE.local.md (Personal Preferences — Gitignored)

**Location:** `./CLAUDE.local.md`
**Contains:** Local environment specifics, personal tool preferences, machine-specific paths.

### Layer 3: MEMORY.md (Auto-Memory — Claude-Written, Local)

**Location:** `~/.claude/projects/<project>/memory/MEMORY.md` + topic files
**Loaded:** First 200 lines of MEMORY.md at session start; topic files on demand
**Contains:** Claude's own notes — patterns discovered, debugging notes, environment quirks.
**Managed via:** `/memory` command to browse, or CC reads/writes during session.

### Layer 4: Reference Library (Progressive Disclosure — Git-Tracked)

**Location:** `.claude/references/`
**Loaded:** Only `_index.md` is referenced from CLAUDE.md. Detail files loaded on demand.
**Contains:**
- `_index.md` — keyword index pointing to all reference files
- `codebase.md` — AST-generated codebase map (anchored sections)
- `error-corrections/` — language/framework-specific error patterns and fixes
- `scripts/` — utility scripts (codebase mapper, test report formatter)
- `agents/` — custom agent definitions
- `tools/` — custom tool definitions

### Layer 5: Handover Documents (Session State — Git-Tracked)

**Location:** `docs/handover/`
**Loaded:** On demand via `@` at start of new session
**Contains:** Implementation plan progress, decisions, test state, open issues.

### Relationship Diagram

```
Session Start (always loaded)
├── CLAUDE.md ──→ @.claude/references/_index.md (cheap keyword index)
├── CLAUDE.local.md
└── MEMORY.md (first 200 lines)

On Demand (loaded when CC identifies need from index)
├── .claude/references/codebase.md#specific-anchor
├── .claude/references/error-corrections/python-pytorch.md
├── docs/handover/handover-20260212-1.md
└── MEMORY.md topic files

Never in Conversation
├── Raw test output (stays in tests/reports/)
├── Full command output (compressed by RTK)
└── Grep/glob results (replaced by index lookup)
```

---

## 3. Token Conservation Stack

### Codebase Mapper (Discovery)

**Script:** `.claude/scripts/codebase-mapper.py`
**Function:** Uses tree-sitter (multi-language: Python, JS/TS, Rust, SQL) to parse AST, extract classes, functions, constants with docstrings. Generates:
- `.claude/references/codebase.md` — anchored module index with signatures
- `.claude/references/_index.md` — lightweight keyword index

**CLAUDE.md integration:** `@.claude/references/_index.md` is imported in CLAUDE.md. CC reads the keyword index, identifies the relevant anchor in `codebase.md`, reads only that section. Replaces grep/glob exploration.

**Regeneration:** Run after significant structural changes. Hook or custom command `/remap` to trigger.

### RTK (Command Output Compression)

**Tool:** [rtk-ai/rtk](https://github.com/rtk-ai/rtk) — Rust CLI proxy
**Function:** Intercepts bash commands via PreToolUse hook, rewrites them to `rtk` equivalents. Compresses command output 60-90% before it reaches context.
**Installation:** `rtk init --global` — installs hook + slim RTK.md (~10 lines)
**Covers:** git status/log/diff, ls, grep, find, test output, docker, kubectl, cargo.
**Analytics:** `rtk gain` shows savings stats; `rtk discover` identifies missed opportunities.

### Structured Test Reports (Test Output)

**Format:** JSON written to `tests/reports/latest.json` by test harness configuration (pytest conftest.py, jest config, etc.)

```json
{
  "phase": "2.1",
  "timestamp": "2026-02-12T14:30:00Z",
  "summary": { "total": 12, "passed": 10, "failed": 2, "skipped": 0 },
  "failures": [
    { "test": "test_data_pipeline", "error": "AssertionError: expected 42, got 41", "file": "tests/test_pipeline.py:38" }
  ]
}
```

CC reads the JSON summary. Only dives into `tests/reports/latest.log` on failure investigation.

### MCP Tool Lazy Loading

**Setting:** `ENABLE_TOOL_SEARCH=auto` (v2.1.7+)
**Function:** MCP tool schemas loaded on demand, not at session start. ~85% reduction in initial tool overhead.

---

## 4. Error Correction Framework

Errors and learnings are **not** accumulated in global or project CLAUDE.md. Instead, they follow the progressive disclosure pattern used by Skills.

### Structure

```
.claude/references/error-corrections/
├── _index.md              # Keyword index of all error patterns
├── python-general.md      # Python-specific gotchas
├── python-pytorch.md      # PyTorch-specific patterns
├── javascript-react.md    # React-specific patterns
├── docker-compose.md      # Docker/container patterns
└── project-specific.md    # This project's unique gotchas
```

### _index.md Format

```markdown
# Error Corrections Index

> CC: Read this when you encounter an error or before making changes to areas with known issues.

- `python-pytorch.md` — CUDA device mismatch, gradient accumulation, DataLoader workers
  - **Keywords**: CUDA, tensor, device, gradient, DataLoader, pin_memory
- `docker-compose.md` — Volume permissions, network resolution, build cache
  - **Keywords**: docker, volume, permission, network, build, cache
- `project-specific.md` — [generated per project]
  - **Keywords**: [generated per project]
```

### CLAUDE.md Reference

```markdown
## Error Patterns
When encountering errors or modifying code in areas with known issues, consult:
@.claude/references/error-corrections/_index.md
```

CC reads the index, identifies the relevant file, loads only that file. Errors accumulate in the appropriate category file without bloating CLAUDE.md.

### Update Mechanism

The `/session-handover` command and `/revise-claude-md` both check for new error patterns and propose additions to the appropriate error correction file.

---

## 5. Automation Layer — Platform Hooks

The "CC never runs tests" constraint becomes an architectural advantage: external processes handle all mechanical verification via hooks, and CC only sees structured, compressed results. This eliminates token waste from raw output while closing the feedback loop automatically.

### Design Pattern

```
CC writes code → CC's turn ends → Stop hook fires
  → Script detects what changed (git diff, file timestamps)
  → Runs external process (tests, build, lint, typecheck)
  → Writes structured results to known path
  → Returns decision:"block" + reason with summary
    → CC resumes, reads detailed results, iterates
```

The `stop_hook_active` field (sent in Stop hook input) prevents infinite loops. On subsequent blocks, a counter file caps iterations.

### 5.1 PreToolUse: Block Test Execution

**Scope:** Global (fires for agent teams too)
**Matcher:** `Bash`

Blocks CC from running test commands (pytest, jest, cargo test, npm test, etc.). Returns: "Tests must be run by the human — or by the Stop-hook test loop. Write the test files and provide execution instructions."

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/block-test-execution.sh"
          }
        ]
      }
    ]
  }
}
```

### 5.2 PreToolUse: RTK Auto-Wrapper

Installed by `rtk init --global`. Transparently rewrites bash commands to RTK equivalents. Also used by hook scripts to compress output before injecting into CC's context.

### 5.3 PreToolUse: File Protection

**Matcher:** `Edit|Write`

Blocks writes to critical files (database volumes, lock files, credentials):

```bash
#!/bin/bash
# .claude/hooks/protect-files.sh
FILE_PATH=$(echo "$(cat)" | jq -r '.tool_input.file_path // empty')
PROTECTED=(".env" ".git/" "package-lock.json" "*.sqlite" "*.db" "docker-compose.override.yml")

for pattern in "${PROTECTED[@]}"; do
  if [[ "$FILE_PATH" == *"$pattern"* ]]; then
    echo "Blocked: $FILE_PATH is a protected file" >&2
    exit 2
  fi
done
exit 0
```

### 5.4 PostToolUse: Auto-Format

**Matcher:** `Edit|Write`

Runs formatter after CC writes/edits files. Non-blocking — just formats in place.

```bash
#!/bin/bash
# .claude/hooks/auto-format.sh
FILE_PATH=$(echo "$(cat)" | jq -r '.tool_input.file_path // empty')
case "$FILE_PATH" in
  *.py) black "$FILE_PATH" --quiet 2>/dev/null ;;
  *.js|*.ts|*.tsx) npx prettier --write "$FILE_PATH" 2>/dev/null ;;
  *.rs) rustfmt "$FILE_PATH" 2>/dev/null ;;
esac
exit 0
```

### 5.5 PostToolUse: Typecheck After Edits

**Matcher:** `Edit|Write`
**Purpose:** Catch type errors immediately after each file edit, before the full test cycle.

```bash
#!/bin/bash
# .claude/hooks/post-typecheck.sh
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

case "$FILE_PATH" in
  *.ts|*.tsx)
    ERRORS=$(npx tsc --noEmit 2>&1 | head -20)
    ;;
  *.py)
    ERRORS=$(py -m mypy "$FILE_PATH" --no-error-summary 2>&1 | head -20)
    ;;
  *)
    exit 0
    ;;
esac

if [ -n "$ERRORS" ] && echo "$ERRORS" | grep -qE 'error|Error'; then
  # RTK compress if available — tsc/mypy output is verbose
  COMPRESSED=$(echo "$ERRORS" | rtk compress 2>/dev/null || echo "$ERRORS")
  jq -n --arg ctx "Type errors after editing $FILE_PATH:\n$COMPRESSED" \
    '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":$ctx}}'
fi
exit 0
```

**RTK is valuable here** — tsc/mypy output flows directly into CC's context via `additionalContext`. Compression reduces token cost on every edit.

### 5.6 PostToolUse: Codebase Mapper Regen (Async)

**Matcher:** `Write` (new source files only)

```bash
#!/bin/bash
# .claude/hooks/auto-remap.sh
FILE_PATH=$(echo "$(cat)" | jq -r '.tool_input.file_path // empty')
if [[ "$FILE_PATH" =~ \.(py|ts|js|rs)$ ]]; then
  py "$CLAUDE_PROJECT_DIR/.claude/scripts/codebase-mapper.py" \
    "$CLAUDE_PROJECT_DIR" --quiet
fi
exit 0
```

Async — codebase map stays fresh without CC or human action.

### 5.7 PostToolUse: Dependency Auto-Install (Async)

**Matcher:** `Edit|Write`

When CC modifies dependency files, install in background. Dependencies are ready by the time the Stop-hook test loop fires.

```bash
#!/bin/bash
# .claude/hooks/auto-deps.sh
FILE_PATH=$(echo "$(cat)" | jq -r '.tool_input.file_path // empty')
case "$(basename "$FILE_PATH")" in
  package.json)     npm install --silent ;;
  requirements.txt) pip install -q -r "$FILE_PATH" ;;
  pyproject.toml)   pip install -q -e "$(dirname "$FILE_PATH")" ;;
  Cargo.toml)       cargo build --quiet ;;
  *) exit 0 ;;
esac
```

**Config uses `async: true`** — runs in background, doesn't block CC:

```json
{
  "matcher": "Edit|Write",
  "hooks": [{ "type": "command", "command": "...auto-deps.sh", "async": true }]
}
```

### 5.8 SessionStart: State Injection

**Matcher:** `startup|resume`
**Purpose:** Inject current project state so CC doesn't waste tokens rediscovering it.

```bash
#!/bin/bash
# .claude/hooks/session-state.sh
cd "$CLAUDE_PROJECT_DIR"
CONTEXT=""

# Latest test state
if [ -f "tests/reports/latest.json" ]; then
  SUMMARY=$(jq -c '.summary' tests/reports/latest.json 2>/dev/null)
  CONTEXT+="Last test run: $SUMMARY. "
fi

# Latest handover
LATEST=$(ls -t docs/handover/handover-*.md 2>/dev/null | head -1)
if [ -n "$LATEST" ]; then
  CONTEXT+="Latest handover: $(basename "$LATEST"). "
fi

# Current plan phase (look for first unchecked item)
if [ -f "docs/implementation-plan.md" ]; then
  PHASE=$(grep -m1 '^\- \[ \]' docs/implementation-plan.md || echo "unknown")
  CONTEXT+="Next planned phase: $PHASE "
fi

jq -n --arg ctx "$CONTEXT" \
  '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":$ctx}}'
```

Zero exploration tokens — CC starts oriented.

### 5.9 Stop: Context Budget Monitor

**Purpose:** Warn before context degradation forces an emergency handover.

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Read the transcript at $ARGUMENTS. Estimate conversation context usage as a rough percentage based on message count and length. If above 60%, respond {\"ok\": false, \"reason\": \"Context estimated at ~N%. Run /session-handover soon.\"}. Otherwise respond {\"ok\": true}. Always check stop_hook_active — if true, respond {\"ok\": true} to avoid loops.",
            "timeout": 15
          }
        ]
      }
    ]
  }
}
```

Runs on a small fast model (not Opus). Cheap insurance against the expensive failure mode of degraded CC output at high context.

### 5.10 PreCompact: Emergency Handover

**Matcher:** `auto`
**Purpose:** Safety net — if auto-compaction fires before voluntary handover, capture state.

```bash
#!/bin/bash
# .claude/hooks/pre-compact-handover.sh
TIMESTAMP=$(date +%Y%m%d)
COUNT=$(ls "$CLAUDE_PROJECT_DIR/docs/handover/" 2>/dev/null | grep -c "$TIMESTAMP")
HANDOVER="$CLAUDE_PROJECT_DIR/docs/handover/handover-${TIMESTAMP}-$((COUNT+1))-AUTOCOMPACT.md"

TRANSCRIPT=$(echo "$(cat)" | jq -r '.transcript_path')

echo "# Auto-Compaction Handover (partial)" > "$HANDOVER"
echo "Generated: $(date -Iseconds)" >> "$HANDOVER"
echo "" >> "$HANDOVER"
echo "## Recent Context (last 20 assistant messages)" >> "$HANDOVER"

# Extract recent assistant content for state preservation
jq -r '[.[] | select(.role=="assistant")] | .[-20:] | .[].content[:300]' \
  "$TRANSCRIPT" >> "$HANDOVER" 2>/dev/null

jq -n --arg ctx "Auto-compaction imminent. Partial handover saved to $HANDOVER. After compaction, read this file to restore context." \
  '{"hookSpecificOutput":{"hookEventName":"PreCompact","additionalContext":$ctx}}'
```

### 5.11 Stop: TDD Test Loop (Flagship)

**Purpose:** Automatically run tests when CC finishes writing code, parse results, and feed them back to CC so it can iterate without human intervention.

**Flow:**
1. CC writes/modifies test files and implementation, turn ends
2. Stop hook fires, script checks if source/test files changed (git diff)
3. If no relevant changes, exit 0 (CC stops normally)
4. Runs lint check first (ruff/eslint) — if lint errors, blocks with those before wasting a test cycle
5. Runs test suite, writes `tests/reports/latest.json`
6. If all pass, blocks with: "All N tests passed. Auto-committed (if enabled). Proceed to next phase."
7. If failures, blocks with: "N passed, M failed. Read tests/reports/latest.json for details."
8. CC continues, reads JSON, fixes code, turn ends again
9. Stop hook fires — `stop_hook_active: true` — increments iteration counter
10. If counter < max (default 3), re-run tests, block if still failing
11. If counter >= max, exit 0, CC stops, human takes over

**Script: `.claude/hooks/stop-test-loop.sh`**

```bash
#!/bin/bash
INPUT=$(cat)
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active')
COUNTER_FILE="$CLAUDE_PROJECT_DIR/tests/reports/.iteration-count"
MAX_ITERATIONS="${TEST_LOOP_MAX_ITERATIONS:-3}"

# Loop prevention
if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
  COUNT=$(cat "$COUNTER_FILE" 2>/dev/null || echo 0)
  COUNT=$((COUNT + 1))
  echo "$COUNT" > "$COUNTER_FILE"
  if [ "$COUNT" -ge "$MAX_ITERATIONS" ]; then
    echo "0" > "$COUNTER_FILE"
    exit 0  # Let CC stop — hand back to human
  fi
else
  echo "0" > "$COUNTER_FILE"
fi

# Check if test-relevant files changed since last test run
MARKER_FILE="$CLAUDE_PROJECT_DIR/tests/reports/.last-test-run"
CHANGED_FILES=$(find "$CLAUDE_PROJECT_DIR/src" "$CLAUDE_PROJECT_DIR/tests" \
  -newer "$MARKER_FILE" -name '*.py' -o -name '*.ts' -o -name '*.js' -o -name '*.rs' \
  2>/dev/null | head -5)

if [ -z "$CHANGED_FILES" ] && [ "$STOP_HOOK_ACTIVE" != "true" ]; then
  exit 0  # No code changes, skip tests
fi

cd "$CLAUDE_PROJECT_DIR"

# Lint gate (fail fast before running full test suite)
LINT_ERRORS=$(py -m ruff check src/ --output-format=concise 2>&1 | head -10)
if [ -n "$LINT_ERRORS" ] && [ "$(echo "$LINT_ERRORS" | grep -c 'error')" -gt 0 ]; then
  cat <<EOF
{"hookSpecificOutput":{"hookEventName":"Stop","decision":"block","reason":"Lint errors — fix before test run:\n$LINT_ERRORS"}}
EOF
  exit 0
fi

# Run tests (adapt per project — pytest shown here)
py -m pytest --tb=short -q \
  --json-report --json-report-file=tests/reports/latest.json \
  2>&1 | tail -20 > tests/reports/latest.log

touch "$MARKER_FILE"

# Parse results
PASSED=$(jq '.summary.passed // 0' tests/reports/latest.json)
FAILED=$(jq '.summary.failed // 0' tests/reports/latest.json)
TOTAL=$(jq '.summary.total // 0' tests/reports/latest.json)

# Auto-commit on green (env-gated)
COMMIT_MSG=""
if [ "$FAILED" -eq 0 ] && [ "${AUTO_COMMIT_ON_GREEN:-false}" = "true" ]; then
  git add -A && git commit -m "test: all $TOTAL tests passing" --quiet
  COMMIT_MSG=" Auto-committed."
fi

if [ "$FAILED" -eq 0 ]; then
  REASON="All $TOTAL tests passed.$COMMIT_MSG Ready to proceed to next phase."
else
  REASON="Tests: $PASSED/$TOTAL passed, $FAILED failed. Read tests/reports/latest.json for failure details and fix them."
fi

cat <<EOF
{"hookSpecificOutput":{"hookEventName":"Stop","decision":"block","reason":"$REASON"}}
EOF
```

**Hook config (project `.claude/settings.json`):**

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/stop-test-loop.sh",
            "timeout": 300,
            "statusMessage": "Running tests..."
          }
        ]
      }
    ]
  }
}
```

### 5.12 RTK in the Automation Pipeline

RTK is **not** needed for the structured JSON test results path — those are already token-efficient. RTK's value in this system is compressing verbose tool output that flows into CC's context via hook `additionalContext`:

| Output source | Enters CC via | RTK useful? |
|---------------|---------------|-------------|
| Test JSON results | Stop hook reason / file read | No — already structured |
| tsc/mypy errors | PostToolUse additionalContext | **Yes** — verbose |
| Build/compile errors | PostToolUse additionalContext | **Yes** — verbose |
| Docker build logs | PostToolUse additionalContext | **Yes** — extremely verbose |
| Lint output | Stop hook reason | Marginal — usually short |
| Git operations (CC-initiated) | Direct bash output | **Yes** — already covered by RTK global hook |

Configure RTK in hook scripts: pipe through `rtk compress` before constructing `additionalContext`.

### 5.13 Parameterised Hooks

Several platform hooks are universal in purpose but must adapt to the project's tech stack. Rather than hard-coding `pytest`, `tsc`, or `black` into each hook script, the platform defines a **parameterisation interface** via environment variables. Project-level configuration sets these variables; hook scripts read them with sensible defaults.

#### Parameterisation Interface

| Variable | Purpose | Default | Example overrides |
|----------|---------|---------|-------------------|
| `TEST_RUNNER_CMD` | Command to execute tests | `py -m pytest --tb=short -q --json-report --json-report-file=tests/reports/latest.json` | `npx jest --json --outputFile=tests/reports/latest.json`, `cargo test -- --format json` |
| `TEST_REPORT_FORMAT` | How to parse the test results file | `pytest-json` | `jest-json`, `cargo-json`, `custom` |
| `TYPE_CHECK_CMD` | Type checker invocation | (detected from file extension) | `npx tsc --noEmit`, `py -m mypy`, `py -m pyright` |
| `FORMAT_CMD` | Formatter invocation | (detected from file extension) | `black`, `npx prettier --write`, `rustfmt`, `ruff format` |
| `LINT_CMD` | Linter for the Stop-hook gate | `py -m ruff check src/ --output-format=concise` | `npx eslint src/`, `cargo clippy` |
| `TEST_LOOP_MAX_ITERATIONS` | Max Stop-hook re-runs before yielding to human | `3` | `5` (for fast test suites) |
| `AUTO_COMMIT_ON_GREEN` | Auto-commit when all tests pass | `false` | `true` |

#### Setting Variables

Variables are set in `.claude/settings.local.json` (gitignored, machine-specific) or `.claude/settings.json` (shared) via the hook environment:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/stop-test-loop.sh",
            "timeout": 300,
            "statusMessage": "Running tests..."
          }
        ]
      }
    ]
  },
  "env": {
    "TEST_RUNNER_CMD": "npx jest --json --outputFile=tests/reports/latest.json",
    "TEST_REPORT_FORMAT": "jest-json",
    "LINT_CMD": "npx eslint src/",
    "FORMAT_CMD": "npx prettier --write",
    "TYPE_CHECK_CMD": "npx tsc --noEmit"
  }
}
```

#### Hook Script Pattern

Hook scripts consume these variables with fallback defaults:

```bash
#!/bin/bash
# Pattern used in stop-test-loop.sh, post-typecheck.sh, auto-format.sh
# All parameterised hooks follow this structure:

# 1. Read from env, fall back to detection or default
TEST_CMD="${TEST_RUNNER_CMD:-py -m pytest --tb=short -q --json-report --json-report-file=tests/reports/latest.json}"

# 2. Execute
eval "$TEST_CMD" 2>&1 | tail -20 > tests/reports/latest.log

# 3. Parse results (format-aware)
case "${TEST_REPORT_FORMAT:-pytest-json}" in
  pytest-json)
    PASSED=$(jq '.summary.passed // 0' tests/reports/latest.json)
    FAILED=$(jq '.summary.failed // 0' tests/reports/latest.json)
    TOTAL=$(jq '.summary.total // 0' tests/reports/latest.json)
    ;;
  jest-json)
    PASSED=$(jq '.numPassedTests // 0' tests/reports/latest.json)
    FAILED=$(jq '.numFailedTests // 0' tests/reports/latest.json)
    TOTAL=$(jq '.numTotalTests // 0' tests/reports/latest.json)
    ;;
  cargo-json)
    # cargo test JSON parsing
    PASSED=$(jq '[.[] | select(.type=="test" and .event=="ok")] | length' tests/reports/latest.json)
    FAILED=$(jq '[.[] | select(.type=="test" and .event=="failed")] | length' tests/reports/latest.json)
    TOTAL=$((PASSED + FAILED))
    ;;
esac
```

#### Which Hooks Are Parameterised

| Hook | Script | Variables used |
|------|--------|---------------|
| Stop: TDD test loop | `stop-test-loop.sh` | `TEST_RUNNER_CMD`, `TEST_REPORT_FORMAT`, `LINT_CMD`, `TEST_LOOP_MAX_ITERATIONS`, `AUTO_COMMIT_ON_GREEN` |
| PostToolUse: Typecheck | `post-typecheck.sh` | `TYPE_CHECK_CMD` |
| PostToolUse: Auto-format | `auto-format.sh` | `FORMAT_CMD` |
| PostToolUse: Auto-deps | `auto-deps.sh` | (detects from filename — no parameterisation needed) |

Non-parameterised hooks (block-test-execution, protect-files, session-state, pre-compact-handover, auto-remap, context-budget-monitor) are truly universal and need no stack-specific configuration.

---

## 6. Exploration Persistence

### Problem Statement

1. **Subagent output is lossy** — an Explore agent reads 40 files (70K tokens), returns a 3K summary. ~95% of observations are discarded.
2. **Reading is goal-biased** — agents extract only what matches their prompt. Incidental observations about patterns, conventions, and architecture are lost.
3. **Terminal analysis is ephemeral** — the parent's synthesis exists only in the session context. When the session ends or compacts, all understanding evaporates.

### Design: Two-Layer Capture

#### Layer 1: Subagent Exploration Files

Detailed, structured findings from Explore agents.

**Location:** `.claude/references/explorations/`

**File format:** YAML frontmatter (metadata) + structured markdown body.

**Naming convention:** `{topic}-{YYYYMMDD}.md`

**Example: `.claude/references/explorations/auth-flow-20260212.md`**

```markdown
---
date: 2026-02-12
query: "How does the authentication flow work end-to-end?"
files_read:
  - src/auth/oauth.ts
  - src/auth/token-store.ts
  - src/auth/middleware.ts
  - src/api/routes/login.ts
  - src/api/routes/callback.ts
  - tests/auth/test_oauth.py
  - lib/github.ts
  - .env.example
stale_if_changed:
  - src/auth/oauth.ts
  - src/auth/middleware.ts
  - src/api/routes/login.ts
---

# Auth Flow Exploration

## Primary Findings

### OAuth Flow
- Uses expo-auth-session for the mobile-side OAuth initiation
- Auth code is exchanged server-side via `flowforge-api/api/auth/token.ts`
- Token stored in expo-secure-store, never persisted to disk or AsyncStorage
- Refresh token rotation is NOT implemented — tokens are long-lived

### Middleware
- `requireAuth` middleware checks for valid token on every API route
- Token validation is done via GitHub API call (not JWT verification)
- Rate limiting: none currently implemented

### Error Handling
- OAuth failures return generic 401 — no distinction between expired, revoked, or invalid
- No retry logic on token exchange failure

## Incidental Findings

- The `lib/github.ts` file also contains all template generation logic — should be split
- Test coverage for auth is minimal: only happy path tested
- `.env.example` lists `EXPO_PUBLIC_SENTRY_DSN` but Sentry is not initialised anywhere
- The callback URL is hardcoded in two places: `oauth.ts` and `app.json`

## Dependency Map

```
expo-auth-session → oauth.ts → token.ts (API) → token-store.ts
                                    ↓
                              GitHub API (/user)
                                    ↓
                              middleware.ts (requireAuth)
```
```

#### Layer 2: Parent Synthesis Files

Distilled conclusions from combining multiple explorations.

**Location:** `.claude/references/explorations/synthesis/`

**File format:** YAML frontmatter (metadata) + conclusions + decisions + open questions.

**Naming convention:** `{topic}-{YYYYMMDD}.md`

**Example: `.claude/references/explorations/synthesis/security-posture-20260212.md`**

```markdown
---
date: 2026-02-12
context: "Assessing overall security posture before adding payment features"
based_on:
  - explorations/auth-flow-20260212.md
  - explorations/api-surface-20260212.md
  - explorations/data-storage-20260212.md
---

# Security Posture Synthesis

## Key Conclusions

1. **Auth is functional but brittle** — no refresh token rotation, no retry logic, token validation hits GitHub API on every request (rate limit risk)
2. **No input validation layer** — API routes trust client input; need zod or similar schema validation before adding payment endpoints
3. **Secrets management is sound** — expo-secure-store for mobile, Vercel env vars for backend, no secrets in git history

## Decisions

- [ ] Add token refresh rotation before payment feature work
- [ ] Implement zod validation middleware for all API routes
- [ ] Add rate limiting (express-rate-limit or equivalent)
- [x] Secrets management is adequate — no changes needed

## Open Questions

- Should we move to JWT-based token validation to avoid GitHub API rate limits?
- Is expo-secure-store sufficient for PCI-adjacent data, or do we need a keychain abstraction?
```

### Exploration Index

**Location:** `.claude/references/explorations/_index.md`

CC checks this index before launching Explore subagents to avoid re-exploring known territory.

```markdown
# Exploration Index

> CC: Check this before launching Explore subagents. If a recent, non-stale exploration
> covers the topic, read the persisted file instead of re-exploring.

## Explorations

- `auth-flow-20260212.md` — OAuth flow, token storage, middleware, error handling
  - **Keywords**: auth, OAuth, token, login, session, middleware
  - **Stale if changed**: src/auth/oauth.ts, src/auth/middleware.ts
- `api-surface-20260212.md` — All API routes, request/response shapes, error codes
  - **Keywords**: API, routes, endpoints, REST, request, response
  - **Stale if changed**: src/api/routes/

## Syntheses

- `synthesis/security-posture-20260212.md` — Overall security assessment
  - **Keywords**: security, auth, validation, secrets, rate limiting
  - **Based on**: auth-flow-20260212, api-surface-20260212, data-storage-20260212
```

### Staleness Detection

Each exploration file lists `stale_if_changed` files in its YAML frontmatter. Before re-exploring a topic:

1. Read the exploration index
2. Find the matching exploration file
3. Check modification dates of `stale_if_changed` files against the exploration's `date`
4. If any listed file has been modified after the exploration date, the exploration is stale — re-explore
5. If none have changed, read the persisted exploration file instead (~2K tokens vs ~70K tokens)

### Subagent Prompt Convention

All Explore agents are instructed to write findings to `.claude/references/explorations/{topic}-{date}.md` using the Layer 1 format. The subagent prompt template includes:

```
After completing your exploration, write your findings to:
  .claude/references/explorations/{topic}-{date}.md

Use this format:
- YAML frontmatter: date, query, files_read (list all files you examined), stale_if_changed (list files that would invalidate these findings)
- ## Primary Findings — direct answers to the exploration query
- ## Incidental Findings — patterns, conventions, issues, or architecture observations not directly related to the query but worth preserving
- ## Dependency Map — if applicable, show how the explored components relate
```

### Parent Synthesis Convention

After receiving results from one or more Explore subagents, the parent writes a synthesis to `.claude/references/explorations/synthesis/{topic}-{date}.md` using the Layer 2 format when the exploration involved combining insights from multiple explorations or reaching conclusions that should persist.

### Automation Hooks

**PostToolUse on Task (subagent return):** When an Explore-type subagent returns, inject a reminder to persist findings.

```bash
#!/bin/bash
# .claude/hooks/exploration-persist-reminder.sh
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

# Only fire for Task tool (subagent returns)
if [ "$TOOL_NAME" != "Task" ]; then
  exit 0
fi

# Check if the subagent output mentions exploration/research patterns
OUTPUT=$(echo "$INPUT" | jq -r '.tool_output // empty' | head -50)
if echo "$OUTPUT" | grep -qiE 'explored|investigated|found that|examined|reviewed.*files'; then
  jq -n '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"Exploration subagent returned. If findings are significant, persist them to .claude/references/explorations/{topic}-{date}.md and update explorations/_index.md."}}'
fi
exit 0
```

**Stop hook (prompt type) for parent synthesis:** Check if significant exploration occurred during the session and remind to synthesise.

```json
{
  "type": "prompt",
  "prompt": "Check if the session involved significant exploration (multiple file reads, subagent dispatches, or architecture investigation). If yes, respond {\"ok\": false, \"reason\": \"Significant exploration detected. Consider writing a synthesis to .claude/references/explorations/synthesis/ before ending.\"}. If no exploration occurred, respond {\"ok\": true}. If stop_hook_active is true, respond {\"ok\": true} to avoid loops.",
  "timeout": 15
}
```

### CLAUDE.md Integration

Add the following section to project CLAUDE.md to enable exploration persistence:

```markdown
## Exploration Persistence
Before launching Explore subagents, check the exploration index:
@.claude/references/explorations/_index.md

Persist significant exploration findings. See docs/architecture/platform-architecture.md §6 for format.
```

### Token Savings Model

| Scenario | Without persistence | With persistence | Savings |
|----------|-------------------|-----------------|---------|
| Single exploration (session 1) | ~70K input tokens | ~70K + ~1K write | ~0 (initial cost) |
| Same topic (session 2) | ~70K input tokens | ~2K read | ~68K tokens |
| Same topic (session 3) | ~70K input tokens | ~2K read | ~68K tokens |
| Same topic (session 5) | ~70K input tokens | ~2K read | ~68K tokens |
| **Cumulative over 5 sessions** | **~350K tokens** | **~76K tokens** | **~274K tokens (78%)** |

For projects with 3+ exploration topics revisited across sessions, savings exceed 300K tokens. The write cost (~1K tokens per exploration file) is amortised across all future reads.

---

## 7. Reference Library System

Beyond the codebase map and error corrections, the project needs an indexed library of reusable assets.

### Structure

```
.claude/references/
├── _index.md                    # Master keyword index (all sections)
├── codebase.md                  # AST-generated codebase map
├── error-corrections/           # Error patterns (see §4)
│   └── _index.md
├── explorations/                # Exploration persistence (see §6)
│   ├── _index.md
│   └── synthesis/
├── scripts/                     # Utility scripts
│   ├── codebase-mapper.py
│   ├── test-report-formatter.py
│   └── _index.md               # Script descriptions and usage
├── agents/                      # Custom agent definitions
│   └── _index.md
├── tools/                       # Custom tool definitions
│   └── _index.md
├── api-docs/                    # Cached/summarised API documentation
│   └── _index.md
└── stack/                       # Language/framework reference summaries
    └── _index.md
```

### Master _index.md

The top-level `_index.md` aggregates all sub-indexes and is the single entry point referenced from CLAUDE.md. CC reads this, identifies which sub-index is relevant, then navigates to the specific reference file.

### Management

- **Adding entries:** `/session-handover` proposes additions based on session learnings
- **Auditing:** `claude-md-management` plugin's audit skill checks reference quality
- **Updating the codebase map:** `/remap` command or post-edit hook
- **API docs:** Cached summaries from Context7 MCP or manual curation. Trigger: if `/session-handover` observes 2+ Context7 calls for the same library, flag it as a caching candidate.

### Plugin/MCP/Skill Inventory

The reference library includes an inventory of installed plugins, MCP servers, skills, and their trigger conditions. This prevents CC from searching for tools it already has, and helps it know when to use which tool.

```markdown
## Installed Tooling

### Plugins
| Plugin | Trigger Keywords | Purpose |
|--------|-----------------|---------|
| claude-md-management | audit, revise, CLAUDE.md | Maintain project memory files |
| commit-commands | commit, push, PR | Git workflow automation |
| code-review | review, PR | Multi-agent code review |

### MCP Servers
| Server | Trigger Keywords | Purpose |
|--------|-----------------|---------|
| GitHub | repo, issue, PR, branch | Repository management |
| Context7 | docs, API, library, version | Live documentation lookup |

### Custom Agents
| Agent | Trigger Keywords | Tools Available |
|-------|-----------------|----------------|
| [populated per project] | | |
```

---

## 8. Universal Slash Commands

These commands are available in every project via `.claude/commands/`.

### `/session-handover`

**Purpose:** Structured session state externalisation
**Steps:**
1. Write handover doc to `docs/handover/handover-YYYYMMDD-N.md`
2. Reflect on errors, propose additions to `.claude/references/error-corrections/` (appropriate category file)
3. Update MEMORY.md topic files with session notes
4. Update reference library `_index.md` if new assets were created
5. Prompt: "Run `/revise-claude-md` for full audit?"
6. Prompt: "Ready to commit and `/clear`?"

### `/remap`

**Purpose:** Re-run codebase mapper. Updates `.claude/references/codebase.md` and `_index.md`.

### `/stack-check`

**Purpose:** Re-evaluate tooling mid-project. Search for helpful plugins/MCPs based on recent challenges.

### `/hook-check`

**Purpose:** Verify all hooks are present, executable, and functional. Checks:
- All expected hook scripts exist in `.claude/hooks/`
- Scripts are executable (`chmod +x`)
- Hook wiring in `.claude/settings.json` matches scripts on disk
- Dependencies required by hooks (jq, ruff, tsc, etc.) are installed

---

## 9. Global CLAUDE.md

`~/.claude/CLAUDE.md` — applies to all projects:

```markdown
# Global Preferences

## Communication
- Peer-level collaborative interaction
- Concise, direct communication
- Redirections mean a new thought was sparked, not criticism
- Misunderstandings are symmetric, no value judgment
- Don't default to self-criticism

## Token Conservation
- Never dump raw command output into conversation when RTK is available
- Read _index.md first, then specific reference files — never grep/glob the whole codebase
- Prefer subagents for exploration (they have isolated context)
- When reading test results, read JSON summary only; dive into logs only on failure investigation

## Workflow
- Plan Mode for new features or multi-file changes
- Commit atomically at each green test state
- Tests are executed by the human. Write test files and provide execution instructions.
- Handover at ~65-70% context or natural phase boundaries
- Error patterns go in .claude/references/error-corrections/, not in CLAUDE.md

## References
For installed tooling inventory, see project-level @.claude/references/_index.md
```

---

## 10. Baseline Plugins & MCP Servers

Every project gets these via global settings. Per-project additions are evaluated by `/research-setup` or `/stack-check`.

### Plugins

| Plugin | Source | Purpose |
|--------|--------|---------|
| `claude-md-management` | Anthropic official | Audit CLAUDE.md, capture learnings |
| `commit-commands` | Anthropic official | Git commit/push/PR workflows |
| `code-review` | Anthropic official | Multi-agent code review |
| `plugin-dev` | Anthropic official | Meta: create new plugins when needed |
| `test-driven-development` | obra/superpowers | TDD methodology skill |

### MCP Servers

| Server | Purpose |
|--------|---------|
| GitHub MCP | Repo/PR/issue management |
| Context7 | Live docs lookup for version-specific documentation |

### Tools

| Tool | Purpose |
|------|---------|
| RTK | Command output compression (global hook) |
| Codebase mapper | AST-based progressive disclosure |

### Settings

| Setting | Value |
|---------|-------|
| Agent teams | Enabled (experimental) |
| Opus Plan Mode | Enabled (option 4: Opus plans, Sonnet executes) |
| ENABLE_TOOL_SEARCH | auto (lazy MCP loading) |

### Marketplace Sources (Registered Globally)

```bash
# Official (auto-available)
# Demo plugins
/plugin marketplace add anthropics/claude-code-plugins
# Community aggregator (87 plugins, 10+ sources)
/plugin marketplace add kivilaid/plugin-marketplace
# Life sciences (evaluated per-project)
# /plugin marketplace add anthropics/life-sciences
```

---

## 11. Platform-Level Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Agent teams don't read CLAUDE.md | Critical rules ignored by sub-agents | Hooks enforce all critical rules |
| Auto-compact fires unexpectedly | State loss mid-session | PreCompact hook captures state; handover docs; `/context` checks |
| Reference library grows large | Index becomes unwieldy | Periodic audit; remove stale entries; keep indexes keyword-focused |
| RTK not available for all commands | Incomplete coverage | `rtk discover` identifies gaps; fallback is manual output trimming |
| Codebase mapper needs re-running | Stale index after refactoring | Async PostToolUse hook auto-regenerates; `/remap` command |
| Stop-hook infinite loop | CC never stops, burns tokens | `stop_hook_active` check + iteration counter file + max cap (default 3) |
| Hook scripts fail silently | Automation degrades without notice | `/hook-check` command verifies all hooks present, executable, and functional |
| Async hook delivery timing | Results arrive too late or on wrong turn | Async only for non-critical paths (deps, remap); critical paths (tests, typecheck) are sync |
| Stop-hook test timeout | Long test suites exceed 300s hook timeout | Configurable timeout per project; split large suites into tagged subsets |
| Hook fragility across CC versions | Hook API changes break automation | Pin to stable hook fields; monitor CC changelog; version-gate scripts |
| MEMORY.md 200-line limit | Complex projects exceed index | Disciplined use of topic files; audit via claude-md-management |
| Plugin ecosystem quality varies | Broken or prompt-only agents | Vetting criteria in `/research-setup`; quality checks before install |
| Exploration persistence staleness | Stale exploration files mislead CC | `stale_if_changed` frontmatter + modification date checking before reuse |
| Exploration files accumulate | Reference directory bloats over time | Periodic audit during `/session-handover`; archive old explorations |
