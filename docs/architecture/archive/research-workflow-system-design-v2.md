# Research-to-Implementation Workflow System — Architecture v2

**Status:** Draft v2.1 — automation layer added
**Date:** 2026-02-12
**Changes from v2:** Hook-driven automation layer (Stop-hook test loop, PostToolUse type/lint/format gating, auto-commit on green, context budget monitor, pre-compaction handover, session state injection); RTK repositioned for hook pipeline compression; FlowForge mobile → CC web orchestration vision; repo-as-operating-environment concept; review questions resolved.
**Changes from v1:** FlowForge integration confirmed; MEMORY.md clarified; agent teams CLAUDE.md limitation addressed via hooks; AST codebase mapper integrated; RTK token compression added; reference library system added; error correction via progressive disclosure; `/research-setup` expanded to include language/framework recommendation; CC never runs tests; custom agents/tools as first-class workflow output.

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

## 2. Workflow Phases

### Phase 0: Ideation & Note Capture
**Actor:** Human  
**Tools:** Paper → Obsidian (synced via Obsidian Sync)  
**Output:** Markdown notes in Obsidian vault  
**Transfer:** Currently manual copy to project. (Future: automate via Obsidian Git or sync script.)

### Phase 1: Project Initialisation (via FlowForge)
**Actor:** Human + FlowForge + Claude Code  
**Steps:**
1. FlowForge scaffolds project from research template (see §8)
2. Copy markdown notes from Obsidian → `docs/research-notes/`
3. FlowForge initialises GitHub repo (private), pushes scaffold
4. Launch Claude Code in VS Code terminal
5. `/init` → generates initial `CLAUDE.md` (FlowForge has already placed a template)
6. Run codebase mapper: `python .claude/scripts/codebase-mapper.py .` → generates `.claude/references/codebase.md` + `_index.md`
7. `/research-setup` (custom command) → analyses notes, researches language/framework options, recommends tech stack + CC tooling
8. Human reviews and approves recommendations
9. Install recommended plugins/MCPs
10. Commit and push

### Phase 2: Deep Research
**Actor:** Human + Claude.ai (Research feature enabled)  
**Steps:**
1. Load markdown notes into Claude.ai conversation
2. Enable Research toggle — agentic multi-search
3. Iterate until research is validated
4. Export research output as markdown → `docs/research-output/`
5. Commit

Claude.ai Research is used here because its multi-search orchestration is more thorough than CC subagents for broad research synthesis.

### Phase 3: Implementation Planning
**Actor:** Human + Claude Code (Plan Mode)  
**Steps:**
1. Enter Plan Mode (`Shift+Tab` ×2 or `/plan`)
2. `@docs/research-output/` + `@.claude/references/_index.md`
3. CC proposes implementation plan, iterating with human
4. `/tdd-plan` (custom command) generates atomic phased plan:
   - TDD structure per phase
   - Tech stack and containerisation requirements
   - Test reporting format (JSON, written to files)
   - Human-execution markers for all tests
   - Handover checkpoints with context budget estimates
   - Assessment of whether custom agents/tools are needed
5. Plan saved to `.claude/plans/` and `docs/implementation-plan.md`
6. Exit Plan Mode → approve → execute

### Phase 4: TDD Implementation
**Actor:** Human + Claude Code  
**Per phase of implementation plan:**
1. CC generates test specifications and test code
2. **Human executes tests** → results written to `tests/reports/latest.json`
3. CC reads JSON summary only (see §5 for format)
4. CC iterates on implementation
5. Human re-runs tests
6. Refactor cycle
7. Git commit at each green state (via `commit-commands` plugin or hooks)
8. Re-run codebase mapper after significant structural changes

**CC never runs tests.** This is enforced by a PreToolUse hook that blocks test execution commands.

### Phase 5: Handover & Continuation
**Actor:** Human + Claude Code  
**Trigger:** Context >65%, natural phase boundary, or quality degradation  
**Steps:**
1. `/session-handover` (custom command):
   - Writes handover doc → `docs/handover/handover-YYYYMMDD-N.md`
   - Reflects on errors → proposes updates to appropriate error reference file (not global CLAUDE.md)
   - Updates MEMORY.md topic files with session notes
2. `/revise-claude-md` (from claude-md-management plugin) — structured audit
3. Re-run codebase mapper if structure changed
4. Git commit
5. `/clear`
6. New session: CLAUDE.md loads automatically, `@docs/handover/latest.md` for state

### Phase 6: Completion
Final test suite passes → documentation updated → `/revise-claude-md` final audit → final commit and push → archive handover docs.

---

## 3. Memory Architecture

### Layer 1: CLAUDE.md (Project Instructions — Human-Curated, Git-Tracked)
**Location:** `./CLAUDE.md`  
**Loaded:** Fully, every session start  
**Contains:**
- Project description and architecture overview
- Build/run commands
- Coding conventions
- Workflow instructions (TDD process, handover triggers)
- `@` imports to `.claude/references/_index.md` (the codebase map)
- `@` imports to relevant reference library entries (see §7)
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

## 4. Token Conservation Stack

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
**Installation:** `rtk init --global` → installs hook + slim RTK.md (~10 lines)  
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

### Hook: Block Test Execution
**Type:** PreToolUse (Bash)  
**Function:** Blocks CC from running test commands (pytest, jest, cargo test, npm test, etc.). Returns message: "Tests must be run by the human. Write the test files and provide execution instructions."  
**Rationale:** Agent teams don't read CLAUDE.md, so this rule must be enforced at the hook level.

### MCP Tool Lazy Loading
**Setting:** `ENABLE_TOOL_SEARCH=auto` (v2.1.7+)  
**Function:** MCP tool schemas loaded on demand, not at session start. ~85% reduction in initial tool overhead.

---

## 5. Error Correction via Progressive Disclosure

Errors and learnings are **not** accumulated in global or project CLAUDE.md. Instead, they follow the progressive disclosure pattern used by Skills:

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

## 6. Automation Layer

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

### Automation Map

```
Phase 1 (Init)
  └─ SessionStart → inject project state, test status, current phase

Phase 4 (TDD) — the dense automation layer
  ├─ PostToolUse(Edit|Write) → typecheck, inject errors immediately
  ├─ PostToolUse(Edit|Write) → auto-format (black, prettier)
  ├─ PostToolUse(Write) → codebase mapper regen (async)
  ├─ PostToolUse(Edit) on dep files → auto-install (async)
  ├─ Stop → lint check → test runner → parse JSON → block with results
  └─ Stop (on green) → auto-commit (optional, env-gated)

Phase 4→5 (Boundary)
  ├─ Stop → context budget monitor (prompt hook, small model)
  └─ PreCompact(auto) → emergency handover skeleton

Phase 5 (Handover)
  └─ SessionEnd → cleanup iteration counters, stale reports
```

### 6.1 PreToolUse: Block Test Execution

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

### 6.2 PreToolUse: RTK Auto-Wrapper

Installed by `rtk init --global`. Transparently rewrites bash commands to RTK equivalents. Also used by hook scripts (§6.4) to compress output before injecting into CC's context.

### 6.3 Stop Hook: TDD Test Loop (Flagship)

**Phase:** 4
**Purpose:** Automatically run tests when CC finishes writing code, parse results, and feed them back to CC so it can iterate without human intervention.

**Flow:**
1. CC writes/modifies test files and implementation → turn ends
2. Stop hook fires → script checks if source/test files changed (git diff)
3. If no relevant changes → exit 0 (CC stops normally)
4. Runs lint check first (ruff/eslint) — if lint errors, blocks with those before wasting a test cycle
5. Runs test suite → writes `tests/reports/latest.json`
6. If all pass → blocks with: "All N tests passed. Auto-committed (if enabled). Proceed to next phase."
7. If failures → blocks with: "N passed, M failed. Read tests/reports/latest.json for details."
8. CC continues, reads JSON, fixes code, turn ends again
9. Stop hook fires — `stop_hook_active: true` — increments iteration counter
10. If counter < max (default 3) → re-run tests → block if still failing
11. If counter >= max → exit 0, CC stops, human takes over

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

### 6.4 PostToolUse: Typecheck After Edits

**Phase:** 4
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

### 6.5 PostToolUse: Auto-Format

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

### 6.6 PostToolUse: Dependency Auto-Install (Async)

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

### 6.7 PostToolUse: Codebase Mapper Regen (Async)

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

### 6.8 SessionStart: State Injection

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

### 6.9 Stop Hook: Context Budget Monitor

**Phase:** 4→5 boundary
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

### 6.10 PreCompact: Emergency Handover

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

### 6.11 PreToolUse: File Protection

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

### 6.12 RTK in the Automation Pipeline

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

---

## 7. Reference Library & Management System

Beyond the codebase map and error corrections, the project needs an indexed library of reusable assets.

### Structure
```
.claude/references/
├── _index.md                    # Master keyword index (all sections)
├── codebase.md                  # AST-generated codebase map
├── error-corrections/           # Error patterns (see §5)
│   └── _index.md
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
- **API docs:** Cached summaries from Context7 MCP or manual curation

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

## 8. FlowForge Integration

FlowForge scaffolds new research-to-implementation projects with the full system pre-configured.

### Template: `research-project`

```
project-root/
├── CLAUDE.md                              # Template with @imports, workflow rules
├── CLAUDE.local.md                        # Placeholder (gitignored)
├── .gitignore
├── .devcontainer/                         # Remote/web CC environment (see §8.1)
│   ├── devcontainer.json
│   └── post-create.sh                     # Install deps, RTK, formatters
├── .claude/
│   ├── settings.json                      # Project CC settings (hooks config)
│   ├── settings.local.json                # Personal CC settings (gitignored)
│   ├── commands/                          # Custom slash commands
│   │   ├── research-setup.md
│   │   ├── session-handover.md
│   │   ├── tdd-plan.md
│   │   ├── stack-check.md
│   │   └── remap.md
│   ├── hooks/                             # Automation layer (see §6)
│   │   ├── block-test-execution.sh        # PreToolUse: prevent CC running tests
│   │   ├── stop-test-loop.sh              # Stop: TDD feedback loop
│   │   ├── post-typecheck.sh              # PostToolUse: type errors after edits
│   │   ├── auto-format.sh                 # PostToolUse: black/prettier/rustfmt
│   │   ├── auto-deps.sh                   # PostToolUse: install deps (async)
│   │   ├── auto-remap.sh                  # PostToolUse: codebase mapper (async)
│   │   ├── session-state.sh               # SessionStart: inject project state
│   │   ├── pre-compact-handover.sh        # PreCompact: emergency state capture
│   │   └── protect-files.sh               # PreToolUse: block writes to .env, .db
│   ├── plans/                             # CC-generated plans
│   ├── scripts/
│   │   ├── codebase-mapper.py
│   │   └── test-report-formatter.py
│   └── references/
│       ├── _index.md                      # Master reference index
│       ├── codebase.md                    # Generated after /init
│       └── error-corrections/
│           └── _index.md
├── docs/
│   ├── research-notes/                    # Input from Obsidian
│   ├── research-output/                   # Output from Claude.ai Research
│   ├── handover/                          # Session handover docs
│   ├── implementation-plan.md             # Living TDD plan
│   └── stack-recommendation.md            # From /research-setup
├── tests/
│   ├── reports/                           # JSON + log test output
│   │   ├── .iteration-count               # Stop-hook loop counter (gitignored)
│   │   └── .last-test-run                 # Timestamp marker (gitignored)
│   ├── conftest.py                        # pytest: JSON reporter config
│   └── ...
├── src/                                   # Implementation (generated during TDD)
├── docker-compose.yml                     # If recommended by /research-setup
└── README.md
```

### FlowForge Responsibilities
1. Create GitHub repo (private) with this structure
2. Install baseline plugins (see §9)
3. Copy automation hooks and scripts from template
4. Generate initial CLAUDE.md from template with project name
5. Configure `.claude/settings.json` with hook wiring (all §6 hooks)
6. Generate `.devcontainer/` for CC web compatibility
7. Push to remote
8. Provide launch options: VS Code (local) or CC web (remote)

### 8.1 FlowForge as Project Command Center (Mobile → CC Web)

The repo FlowForge creates is a **deployable CC operating environment**. The hooks, scripts, slash commands, and reference library ARE the system — they live in git, so any CC instance that clones the repo inherits the full automation layer. This enables a mobile-first workflow:

**Mobile → CC Web Flow:**
1. User captures research notes on mobile (Obsidian, or in-app note capture)
2. FlowForge mobile creates GitHub repo with full scaffold
3. User launches CC web session pointed at the repo (via deep link or dashboard)
4. CC web clones the repo → hooks fire → automation layer is active
5. User directs work from mobile: approves plans, reviews handovers, reads test reports
6. CC web does the coding, hooks handle the mechanical verification

**The repo is the contract.** CC web doesn't need special configuration — it reads `CLAUDE.md`, `.claude/settings.json` wires the hooks, and the hook scripts are in `.claude/hooks/`. Any CC instance — local, web, or remote — gets the same behaviour.

**`.devcontainer/` for CC Web:**
CC web runs in a remote container. The devcontainer spec ensures the automation layer has its dependencies:

```json
{
  "image": "mcr.microsoft.com/devcontainers/universal:2",
  "postCreateCommand": ".devcontainer/post-create.sh",
  "features": {
    "ghcr.io/devcontainers/features/node:1": {},
    "ghcr.io/devcontainers/features/python:1": {},
    "ghcr.io/devcontainers/features/rust:1": {}
  }
}
```

`post-create.sh` installs RTK, formatters (black, prettier), linters (ruff, eslint), and type checkers (mypy) so the hook scripts can call them. Project-specific deps (pytest plugins, frameworks) are installed by the dependency auto-install hook (§6.6) when CC first touches the project.

**FlowForge Mobile Dashboard:**
FlowForge evolves from "create and forget" to an ongoing project dashboard:

| Feature | Data source | Mechanism |
|---------|-------------|-----------|
| Project status | `tests/reports/latest.json` | GitHub API → parse JSON from repo |
| Current phase | `docs/implementation-plan.md` | GitHub API → parse markdown |
| Latest handover | `docs/handover/` | GitHub API → list files, show latest |
| Test health | `tests/reports/latest.json` | GitHub API → summary card (pass/fail) |
| Launch CC web | CC web deep link | Open browser / in-app webview |
| Push research notes | Obsidian sync or in-app | Git commit via Octokit to `docs/research-notes/` |

This is Phase 2 of FlowForge — the current MVP handles repo creation; the dashboard reads from repos FlowForge has already created.

---

## 9. Plugin & Tooling Configuration

### Baseline (All Projects via Global Settings)

**Plugins:**
| Plugin | Source | Purpose |
|--------|--------|---------|
| `claude-md-management` | Anthropic official | Audit CLAUDE.md, capture learnings |
| `commit-commands` | Anthropic official | Git commit/push/PR workflows |
| `code-review` | Anthropic official | Multi-agent code review |
| `plugin-dev` | Anthropic official | Meta: create new plugins when needed |
| `test-driven-development` | obra/superpowers | TDD methodology skill |

**MCP Servers:**
| Server | Purpose |
|--------|---------|
| GitHub MCP | Repo/PR/issue management |
| Context7 | Live docs lookup for version-specific documentation |

**Tools:**
| Tool | Purpose |
|------|---------|
| RTK | Command output compression (global hook) |
| Codebase mapper | AST-based progressive disclosure |

**Settings:**
| Setting | Value |
|---------|-------|
| Agent teams | Enabled (experimental) |
| Opus Plan Mode | Enabled (option 4: Opus plans, Sonnet executes) |
| ENABLE_TOOL_SEARCH | auto (lazy MCP loading) |

### Per-Project Evaluation (by `/research-setup`)

The `/research-setup` command:
1. Reads `docs/research-notes/`
2. Researches candidate languages/frameworks for execution speed
3. Recommends core language and framework
4. Searches plugin marketplaces for relevant CC tooling
5. Evaluates life-sciences marketplace if pharma/bio content detected
6. Assesses whether custom agents/tools are needed
7. Vets recommendations against quality criteria:
   - Does the agent/plugin have actual tools, or is it just a prompt?
   - Recent commits? Active maintenance?
   - Working installation? Dependencies reasonable?
   - Trusted source? Code reviewable?
8. Outputs recommendation to `docs/stack-recommendation.md`
9. Waits for human approval

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

## 10. Custom Slash Commands

### `/research-setup`
**Phase:** 1  
**Purpose:** Analyse research notes → recommend full tech stack + CC tooling  
**Stages:**
1. Read `docs/research-notes/`
2. Identify requirements: compute needs, data types, external services, deployment targets
3. Research candidate languages and frameworks, focusing on execution speed
4. Recommend core stack (language, framework, database)
5. Search plugin marketplaces (using find-new-skills-mcps-plugins skill)
6. Evaluate life-sciences marketplace if relevant
7. Assess need for custom agents/tools
8. Vet all recommendations (tools check, maintenance check)
9. Output to `docs/stack-recommendation.md`
10. Database default: SQLite unless requirements demand otherwise

### `/session-handover`
**Phase:** 5  
**Purpose:** Structured session state externalisation  
**Steps:**
1. Write handover doc → `docs/handover/handover-YYYYMMDD-N.md`
2. Reflect on errors → propose additions to `.claude/references/error-corrections/` (appropriate category file)
3. Update MEMORY.md topic files with session notes
4. Update reference library `_index.md` if new assets were created
5. Prompt: "Run `/revise-claude-md` for full audit?"
6. Prompt: "Ready to commit and `/clear`?"

### `/tdd-plan`
**Phase:** 3  
**Purpose:** Generate atomic phased TDD implementation plan from research output  
**Outputs:** Plan with phases, test specs, human-execution markers, handover checkpoints, context budget estimates, custom agent/tool requirements.

### `/stack-check`
**Phase:** Any  
**Purpose:** Re-evaluate tooling mid-project. Search for helpful plugins/MCPs based on recent challenges.

### `/remap`
**Phase:** Any  
**Purpose:** Re-run codebase mapper. Updates `.claude/references/codebase.md` and `_index.md`.

---

## 11. Global CLAUDE.md

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

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Claude.ai → CC bridge is manual | Fidelity loss in research transfer | Future: MCP server to bridge; current: careful markdown export |
| MEMORY.md 200-line limit | Complex projects exceed index | Disciplined use of topic files; audit via claude-md-management |
| Plugin ecosystem quality varies | Broken or prompt-only agents | Vetting criteria in `/research-setup`; quality checks before install |
| Agent teams don't read CLAUDE.md | Critical rules ignored by sub-agents | Hooks enforce all critical rules |
| Auto-compact fires unexpectedly | State loss mid-session | PreCompact hook captures state (§6.10); handover docs; `/context` checks |
| Reference library grows large | Index becomes unwieldy | Periodic audit; remove stale entries; keep indexes keyword-focused |
| RTK not available for all commands | Incomplete coverage | `rtk discover` identifies gaps; fallback is manual output trimming |
| Codebase mapper needs re-running | Stale index after refactoring | Async PostToolUse hook auto-regenerates (§6.7); `/remap` command |
| Stop-hook infinite loop | CC never stops, burns tokens | `stop_hook_active` check + iteration counter file + max cap (default 3) |
| Hook scripts fail silently | Automation degrades without notice | `/hook-check` command verifies all hooks present, executable, and functional |
| CC web container missing deps | Hook scripts error (pytest/tsc not found) | `.devcontainer/post-create.sh` installs all hook dependencies |
| Async hook delivery timing | Results arrive too late or on wrong turn | Async only for non-critical paths (deps, remap); critical paths (tests, typecheck) are sync |
| Stop-hook test timeout | Long test suites exceed 300s hook timeout | Configurable timeout per project; split large suites into tagged subsets |
| Hook fragility across CC versions | Hook API changes break automation | Pin to stable hook fields; monitor CC changelog; version-gate scripts |

---

## 13. Implementation Sequence

### Sprint 1: Infrastructure Foundation
1. **RTK installation** — global hook, immediate token savings on all projects
2. **Global CLAUDE.md** — establish baseline communication and workflow rules
3. **Codebase mapper** — productionise the existing script, add to global scripts
4. **Core hooks** — block-test-execution, protect-files, RTK auto-wrapper

### Sprint 2: Automation Layer
5. **Stop-hook test loop** — the flagship TDD automation (§6.3)
6. **PostToolUse hooks** — typecheck, auto-format, auto-deps, auto-remap (§6.4–6.7)
7. **Session/lifecycle hooks** — session-state injection, context monitor, pre-compact handover (§6.8–6.10)
8. **Hook-check command** — `/hook-check` to verify all hooks are present and working

### Sprint 3: Workflow Layer
9. **Custom slash commands** — `/session-handover`, `/research-setup`, `/tdd-plan`, `/stack-check`, `/remap`
10. **Baseline plugin installation** — install and configure standard plugins
11. **Reference library structure** — create the `_index.md` hierarchy template
12. **Error correction framework** — create the progressive disclosure structure

### Sprint 4: FlowForge Integration
13. **FlowForge template** — `research-project` template with all of the above
14. **Devcontainer config** — CC web compatibility for all hook scripts
15. **FlowForge mobile dashboard** — read project state from GitHub repos (Phase 2 of FlowForge)
16. **Deep link / launch flow** — mobile → CC web session on a scaffolded repo

### Sprint 5: Validation & Refinement
17. **SOP document** — human-readable workflow reference derived from this architecture
18. **End-to-end test (local)** — run through one real project with VS Code + CC
19. **End-to-end test (remote)** — run through same project via CC web + devcontainer
20. **Iterate** — refine based on actual usage, update reference library

---

## 14. Review Questions (Resolved)

1. **Codebase mapper improvements:** ✅ Flat keyword index + per-module imports list. No separate dependency graph file — the mapper already has the AST, extracting direct imports is cheap. Skip reverse-dependency graphs; CC can grep for those on demand.

2. **RTK and test output:** ✅ RTK is useful, but repositioned. Not for the JSON test results path (already structured). RTK compresses **hook pipeline output** — tsc/mypy errors, build output, and docker logs that flow into CC's context via `additionalContext` (see §6.12). Human terminal compression is a personal dotfile choice, not part of this system.

3. **Reference library API docs:** ✅ Hybrid. Context7 as primary for on-demand, version-specific lookups. Cache stable patterns via `reference-distiller.py` when repeat lookups are detected. Trigger: if `/session-handover` observes 2+ Context7 calls for the same library, flag it as a caching candidate.

4. **Custom agent scope:** ✅ Scaffold the definition + tool stubs during `/research-setup` (context is fresh, cheapest moment). Implementation of tool logic happens during Phase 4 TDD with proper test coverage. Agent definition → `.claude/agents/`, entry in `_index.md`, TODO in implementation plan.

5. **FlowForge template variants:** ✅ Single `research-project` template. `/research-setup` handles per-project variance at runtime. If the same customisations recur across 3+ projects, extract a variant then — let the pattern emerge from use.

## 15. Open Questions (v2.1)

1. **CC web hook support maturity:** Do all hook types (Stop with `decision:"block"`, async PostToolUse, PreCompact) work reliably in CC web's remote container? Needs testing in Sprint 5.
2. **FlowForge dashboard polling vs webhooks:** Should the mobile dashboard poll GitHub API for project state, or use GitHub webhooks for push notifications when test results change?
3. **Stop-hook test loop for non-pytest projects:** The flagship script (§6.3) assumes pytest. Need a strategy for multi-language projects — detect test runner from project config, or require explicit config in `CLAUDE.local.md`?
4. **Obsidian → repo sync:** Phase 0→1 transfer is still manual copy. Worth building an Obsidian plugin or GitHub Action that syncs a tagged folder to `docs/research-notes/`?
