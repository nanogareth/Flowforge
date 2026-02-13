import type { FileToCreate } from '../types';
import type { ClaudeMdSection } from './claude-md';

export function getPlatformFiles(): FileToCreate[] {
  return [
    // --- Hook scripts (universal, always included) ---
    {
      path: '.claude/hooks/block-test-execution.sh',
      content: `#!/bin/bash
# PreToolUse(Bash): Block CC from directly running test suites.
# Tests are executed by humans or the Stop hook automation.
set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Match common test runner commands
if echo "$COMMAND" | grep -qE '(pytest|py -m pytest|jest|npx jest|vitest|cargo test|npm test|npm run test)'; then
  echo "Blocked: Test execution must go through the automation hook or be run manually." >&2
  exit 2
fi

exit 0
`,
    },
    {
      path: '.claude/hooks/protect-files.sh',
      content: `#!/bin/bash
# PreToolUse(Edit|Write): Block writes to sensitive/protected files.
set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

PROTECTED_PATTERNS=(".env" ".git/" ".sqlite" ".db")

for pattern in "\${PROTECTED_PATTERNS[@]}"; do
  case "$FILE_PATH" in
    *"$pattern"*)
      echo "Blocked: $FILE_PATH matches protected pattern '$pattern'" >&2
      exit 2
      ;;
  esac
done

exit 0
`,
    },
    {
      path: '.claude/hooks/auto-format.sh',
      content: `#!/bin/bash
# PostToolUse(Edit|Write): Auto-format the changed file.
# Uses FORMAT_CMD env var if set, otherwise falls back to extension detection.
set -uo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[ -z "$FILE_PATH" ] && exit 0
[ -f "$FILE_PATH" ] || exit 0

if [ -n "\${FORMAT_CMD:-}" ]; then
  $FORMAT_CMD "$FILE_PATH" 2>/dev/null || true
  exit 0
fi

# Fallback: detect by extension
case "$FILE_PATH" in
  *.py)       black "$FILE_PATH" 2>/dev/null || true ;;
  *.js|*.ts|*.jsx|*.tsx|*.json|*.css|*.md)
              npx prettier --write "$FILE_PATH" 2>/dev/null || true ;;
  *.rs)       rustfmt "$FILE_PATH" 2>/dev/null || true ;;
esac

exit 0
`,
    },
    {
      path: '.claude/hooks/auto-deps.sh',
      content: `#!/bin/bash
# PostToolUse(Edit|Write) [async]: Detect dependency file changes and install.
set -uo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[ -z "$FILE_PATH" ] && exit 0

case "$(basename "$FILE_PATH")" in
  package.json)
    npm install 2>/dev/null || true ;;
  requirements.txt)
    pip install -r "$FILE_PATH" 2>/dev/null || true ;;
  pyproject.toml)
    pip install -e ".[dev]" 2>/dev/null || true ;;
  Cargo.toml)
    cargo fetch 2>/dev/null || true ;;
  *)
    exit 0 ;;
esac

exit 0
`,
    },
    {
      path: '.claude/hooks/auto-remap.sh',
      content: `#!/bin/bash
# PostToolUse(Write) [async]: Re-run codebase mapper when new source files are created.
set -uo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[ -z "$FILE_PATH" ] && exit 0

# Only trigger for source files, not config/docs
case "$FILE_PATH" in
  src/*|lib/*|app/*|*.py|*.ts|*.js|*.rs)
    if [ -f ".claude/scripts/codebase-mapper.py" ]; then
      py .claude/scripts/codebase-mapper.py . 2>/dev/null || true
    fi
    ;;
esac

exit 0
`,
    },
    {
      path: '.claude/hooks/post-typecheck.sh',
      content: `#!/bin/bash
# PostToolUse(Edit|Write): Run type checker after file changes.
# Uses TYPE_CHECK_CMD env var.
set -uo pipefail

[ -z "\${TYPE_CHECK_CMD:-}" ] && exit 0

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[ -z "$FILE_PATH" ] && exit 0

OUTPUT=$($TYPE_CHECK_CMD 2>&1) || true
ERROR_COUNT=$(echo "$OUTPUT" | grep -cE '(error|Error)' || true)

if [ "$ERROR_COUNT" -gt 0 ]; then
  cat <<EOJSON
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "Type checker found $ERROR_COUNT error(s):\\n$OUTPUT"
  }
}
EOJSON
fi

exit 0
`,
    },
    {
      path: '.claude/hooks/session-state.sh',
      content: `#!/bin/bash
# SessionStart: Inject test status, latest handover, and current plan phase.
set -uo pipefail

CONTEXT=""

# Latest test report
if [ -f "tests/reports/latest.json" ]; then
  PASS=$(jq -r '.numPassedTests // .summary.passed // "?" ' tests/reports/latest.json 2>/dev/null || echo "?")
  FAIL=$(jq -r '.numFailedTests // .summary.failed // "?" ' tests/reports/latest.json 2>/dev/null || echo "?")
  CONTEXT+="Last test run: $PASS passed, $FAIL failed.\\n"
fi

# Latest handover
LATEST_HANDOVER=$(ls -t docs/handover/handover-*.md 2>/dev/null | head -1)
if [ -n "\${LATEST_HANDOVER:-}" ]; then
  CONTEXT+="Latest handover: $LATEST_HANDOVER\\n"
fi

# Current plan phase (look for active plan files)
if [ -d ".claude/plans" ]; then
  ACTIVE_PLAN=$(ls -t .claude/plans/*.md 2>/dev/null | head -1)
  if [ -n "\${ACTIVE_PLAN:-}" ]; then
    CONTEXT+="Active plan: $ACTIVE_PLAN\\n"
  fi
fi

if [ -n "$CONTEXT" ]; then
  cat <<EOJSON
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "$CONTEXT"
  }
}
EOJSON
fi

exit 0
`,
    },
    {
      path: '.claude/hooks/pre-compact-handover.sh',
      content: `#!/bin/bash
# PreCompact(auto): Capture partial session state before auto-compaction.
set -uo pipefail

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
HANDOVER_FILE="docs/handover/auto-compact-$TIMESTAMP.md"

mkdir -p docs/handover

cat > "$HANDOVER_FILE" <<EOF
# Auto-Compact Handover — $TIMESTAMP

> Automatically captured before context compaction.

## Session State

- **Git branch:** $(git branch --show-current 2>/dev/null || echo "unknown")
- **Uncommitted changes:** $(git status --porcelain 2>/dev/null | wc -l | tr -d ' ') files
- **Last commit:** $(git log --oneline -1 2>/dev/null || echo "none")

## Recent Test Status

$(if [ -f "tests/reports/latest.json" ]; then
  echo "Test report exists at tests/reports/latest.json"
else
  echo "No test report found."
fi)

## Notes

(Auto-generated — review and supplement in next session turn.)
EOF

echo "Saved compaction handover to $HANDOVER_FILE" >&2
exit 0
`,
    },
    {
      path: '.claude/hooks/stop-test-loop.sh',
      content: `#!/bin/bash
# Stop: TDD loop — run tests and lint, report results.
# Uses TEST_RUNNER_CMD, LINT_CMD env vars.
set -uo pipefail

INPUT=$(cat)

# Prevent infinite loops
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
  exit 0
fi

[ -z "\${TEST_RUNNER_CMD:-}" ] && exit 0

mkdir -p tests/reports

# Run tests
TEST_OUTPUT=$($TEST_RUNNER_CMD 2>&1) || true
TEST_EXIT=$?

# Run lint if configured
LINT_OUTPUT=""
LINT_EXIT=0
if [ -n "\${LINT_CMD:-}" ]; then
  LINT_OUTPUT=$($LINT_CMD 2>&1) || true
  LINT_EXIT=$?
fi

# Determine if we should block stop (force continue on failures)
if [ $TEST_EXIT -ne 0 ] || [ $LINT_EXIT -ne 0 ]; then
  REASON="Tests or lint failed."
  [ $TEST_EXIT -ne 0 ] && REASON="$REASON Test exit code: $TEST_EXIT."
  [ $LINT_EXIT -ne 0 ] && REASON="$REASON Lint exit code: $LINT_EXIT."
  REASON="$REASON Fix the issues and try again. Test output: $(echo "$TEST_OUTPUT" | tail -20 | tr '\\n"' '  ')"

  cat <<EOJSON
{
  "hookSpecificOutput": {
    "hookEventName": "Stop",
    "decision": "block",
    "reason": "$REASON"
  }
}
EOJSON
else
  # Tests passed — allow stop, but add context
  cat <<EOJSON
{
  "hookSpecificOutput": {
    "hookEventName": "Stop",
    "additionalContext": "All tests passed. Lint clean."
  }
}
EOJSON
fi

exit 0
`,
    },
    {
      path: '.claude/hooks/post-explore-reminder.sh',
      content: `#!/bin/bash
# PostToolUse(Task): Remind CC to persist exploration findings.
set -uo pipefail

cat <<'EOJSON'
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "Reminder: If this subagent explored the codebase, persist key findings to .claude/references/explorations/ and update the explorations index."
  }
}
EOJSON

exit 0
`,
    },
    // --- Commands ---
    {
      path: '.claude/commands/hook-check.md',
      content: `# Hook Check

Verify all automation hooks are present and functional:

1. Check that all 10 hook scripts exist in \`.claude/hooks/\`:
   - block-test-execution.sh
   - protect-files.sh
   - auto-format.sh
   - auto-deps.sh
   - auto-remap.sh
   - post-typecheck.sh
   - session-state.sh
   - pre-compact-handover.sh
   - stop-test-loop.sh
   - post-explore-reminder.sh

2. Verify each script is executable (\`chmod +x\`)

3. Verify \`.claude/settings.json\` wires all hooks to correct events

4. Check that environment variables (TEST_RUNNER_CMD, FORMAT_CMD, etc.) are set in settings

5. Report any missing or misconfigured hooks
`,
    },
    // --- Test reports directory ---
    {
      path: 'tests/reports/.gitkeep',
      content: '',
    },
    // --- Reference files ---
    {
      path: '.claude/references/_index.md',
      content: `# Reference Index

> CC: Read this first to find relevant reference files by keyword.

## Codebase
- \`codebase.md\` — AST-generated codebase map (generated after /init)
  - **Keywords**: module, class, function, import, structure

## Error Corrections
- \`error-corrections/_index.md\` — Language/framework-specific error patterns
  - **Keywords**: error, bug, fix, workaround, gotcha

## Explorations
- \`explorations/_index.md\` — Cached exploration results from CC subagents
  - **Keywords**: exploration, analysis, architecture, pattern

## Installed Tooling

### Plugins
| Plugin | Trigger Keywords | Purpose |
|--------|-----------------|---------|
| (configured per project) | | |

### MCP Servers
| Server | Trigger Keywords | Purpose |
|--------|-----------------|---------|
| (configured per project) | | |
`,
    },
    {
      path: '.claude/references/error-corrections/_index.md',
      content: `# Error Corrections Index

> CC: Read this when you encounter an error or before making changes to areas with known issues.

- \`project-specific.md\` — This project's unique gotchas
  - **Keywords**: (populated during development)
`,
    },
    {
      path: '.claude/references/explorations/_index.md',
      content: `# Explorations Index

> CC: Before launching an Explore subagent, check this index. If the target
> area was explored recently and source files haven't changed, read the
> exploration file instead of re-exploring.

(No explorations yet — entries will be added as CC explores the codebase.)

## Syntheses

(No syntheses yet.)
`,
    },
    {
      path: '.claude/references/explorations/synthesis/.gitkeep',
      content: '',
    },
    {
      path: 'docs/handover/.gitkeep',
      content: '',
    },
    {
      path: '.claude/commands/session-handover.md',
      content: `# Session Handover

Perform a structured session handover:

1. Write a handover document to \`docs/handover/handover-YYYYMMDD-N.md\` containing:
   - Current implementation status and progress
   - Decisions made and their rationale
   - Open issues and blockers
   - Next steps for the incoming session

2. Reflect on errors encountered — propose additions to \`.claude/references/error-corrections/\`

3. Update MEMORY.md topic files with session notes

4. Update \`.claude/references/_index.md\` if new reference assets were created

5. Ask: "Run /revise-claude-md for a full CLAUDE.md audit?"

6. Ask: "Ready to commit and /clear?"
`,
    },
    {
      path: '.claude/commands/remap.md',
      content: `# Remap Codebase

Re-run the codebase mapper to update the AST-generated codebase index.

1. Run: \`py .claude/scripts/codebase-mapper.py .\`
2. Verify \`.claude/references/codebase.md\` was updated
3. Verify \`.claude/references/_index.md\` codebase section is current
4. Report what changed (new modules, removed modules, renamed items)
`,
    },
    {
      path: '.claude/commands/stack-check.md',
      content: `# Stack Check

Re-evaluate the project's tooling setup:

1. Review recent challenges and pain points in the session
2. Search for helpful plugins/MCPs that could address them
3. Check if any installed tools have updates
4. Verify all hooks are present and functional
5. Report findings and recommendations
`,
    },
  ];
}

export function getPlatformClaudeMdSections(): ClaudeMdSection[] {
  return [
    {
      heading: '## Development Guidelines',
      content: `- Write clean, maintainable code following established patterns
- Add tests for new functionality
- Follow the workflow phases defined below
- Commit atomically at each green test state
- Error patterns go in \`.claude/references/error-corrections/\`, not in CLAUDE.md`,
      order: 50,
      source: 'platform',
    },
    {
      heading: '## References',
      content: `For the full reference index: @.claude/references/_index.md

### Error Patterns
When encountering errors or modifying code in areas with known issues, consult:
@.claude/references/error-corrections/_index.md

### Exploration Persistence
Before exploring the codebase, check @.claude/references/explorations/_index.md
for recent, non-stale explorations of the same area. After exploring, persist
findings per the exploration file format. Syntheses of multiple explorations
go in the \`synthesis/\` subdirectory.`,
      order: 60,
      source: 'platform',
    },
    {
      heading: '## Handover & Session Rules',
      content: `- Handover at ~65-70% context usage or natural phase boundaries
- Use \`/session-handover\` to externalise session state
- New sessions: load CLAUDE.md + latest handover doc via \`@docs/handover/latest.md\`
- Tests are executed by the human or by automation hooks — CC writes test files and provides instructions`,
      order: 70,
      source: 'platform',
    },
  ];
}

export function getPlatformGitignore(): string {
  return `# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local
.env.*.local

# Logs
*.log
npm-debug.log*

# Testing
coverage/

# Claude Code
.claude/settings.local.json
tests/reports/.iteration-count
tests/reports/.last-test-run
`;
}
