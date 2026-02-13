# FlowForge Integration

> FlowForge's role as project scaffolder and command center, plus the template composition system.

**Status:** v3.1 — composition system, settings, devcontainer, and hook scripts implemented
**Date:** 2026-02-13

---

## 1. FlowForge's Role

FlowForge is a React Native (Expo) mobile app that creates GitHub repositories pre-configured with CLAUDE.md templates and a full Claude Code (CC) automation layer.

**Current state:** FlowForge scaffolds fully operational CC environments via a three-layer template composition system (`flowforge-mobile/lib/templates/`). The user selects a workflow preset and stack, fills in a name and description, and FlowForge creates a GitHub repo with 30+ files via the Octokit Git Data API (blob → tree → commit → ref). The repo ships with hook scripts, `.claude/settings.json` (hook wiring + env vars), `.devcontainer/`, slash commands, reference library skeleton, and a fully assembled `CLAUDE.md`. Any CC instance that clones the repo inherits the full automation layer.

**Next:** FlowForge evolves into a project command center. Two remaining moves:

1. Build the **workflow/stack selection UI** (section 8 below) — screens for choosing workflow, stack, and project details.
2. Add a **project dashboard** (section 10 below) that reads project state from repos FlowForge has already created, turning the app into an ongoing control surface rather than a one-shot launcher.

---

## 2. Repo-as-Operating-Environment

The central architectural insight: the repository IS the CC operating environment. There is no external configuration server, no cloud-hosted rule engine, no platform-specific setup step. Everything CC needs to operate correctly lives in the repo's file tree.

**What lives in git:**

| Path | Purpose |
|------|---------|
| `CLAUDE.md` | Project instructions, `@`-imported references, workflow rules |
| `.claude/settings.json` | Hook wiring, permissions, model preferences |
| `.claude/hooks/` | Automation scripts (test loop, typecheck, format, protect) |
| `.claude/commands/` | Custom slash commands (`/session-handover`, `/tdd-plan`, etc.) |
| `.claude/scripts/` | Utility scripts (codebase mapper, test report formatter) |
| `.claude/references/` | Progressive-disclosure reference library with `_index.md` |
| `.devcontainer/` | Container spec for CC web / remote environments |
| `docs/handover/` | Session state externalisation for context continuity |
| `tests/reports/` | Structured JSON test output consumed by hooks |

**The contract:** Any CC instance -- local CLI, VS Code terminal, CC web in a remote container, or a future CC mobile client -- clones the repo, reads `CLAUDE.md`, loads `.claude/settings.json`, and gets identical behaviour. The hooks fire, the commands are available, the references are indexed. No "did you remember to configure X?" failure mode.

This is what makes the mobile-to-web handoff (section 9) possible: FlowForge creates the repo on mobile, the user launches CC web pointed at it, and everything works because the repo carries its own operating environment.

---

## 3. Template Composition System

The current MVP uses monolithic template functions (`getWebAppTemplate`, `getCliToolTemplate`) that return hardcoded `FileToCreate[]` arrays. The v3 system replaces this with a three-layer composition pipeline where platform, workflow, and stack each contribute files that are merged into the final output.

### Composition Pipeline

```
User selects:           workflow = 'research'
                        stack    = 'python'

                             |
                             v

    getPlatformFiles()  ──>  FileToCreate[]  (universal files)
    getWorkflowFiles()  ──>  FileToCreate[]  (workflow-specific files)
    getStackFiles()     ──>  FileToCreate[]  (stack-specific files)

                             |
                             v

    assembleCLAUDEmd()  ──>  ClaudeMdSection[] from all three layers
                             sorted by `order`, rendered to string

    mergeGitignore()    ──>  platform base + stack additions, deduplicated

    deduplicateFiles()  ──>  combined FileToCreate[] (later sources win on path conflicts)

                             |
                             v

    Final FileToCreate[] ──> GitHub Git Data API (blob → tree → commit → ref)
```

### Layer 1: `getPlatformFiles()`

Universal files present in every repo regardless of workflow or stack. These establish the CC operating environment described in `platform-architecture.md`.

**Implemented in:** `flowforge-mobile/lib/templates/platform.ts`

```
.claude/hooks/block-test-execution.sh  # PreToolUse(Bash): prevent CC running tests
.claude/hooks/protect-files.sh         # PreToolUse(Edit|Write): block writes to .env, .db
.claude/hooks/auto-format.sh           # PostToolUse(Edit|Write): parameterised via FORMAT_CMD
.claude/hooks/auto-deps.sh            # PostToolUse(Edit|Write): install deps (async)
.claude/hooks/auto-remap.sh           # PostToolUse(Write): codebase mapper regen (async)
.claude/hooks/post-typecheck.sh       # PostToolUse(Edit|Write): parameterised via TYPE_CHECK_CMD
.claude/hooks/session-state.sh        # SessionStart: inject test status, handover, plan phase
.claude/hooks/pre-compact-handover.sh # PreCompact(auto): emergency state capture
.claude/hooks/stop-test-loop.sh       # Stop: TDD loop via TEST_RUNNER_CMD + LINT_CMD
.claude/hooks/post-explore-reminder.sh # PostToolUse(Task): persist exploration findings
.claude/commands/session-handover.md   # /session-handover slash command
.claude/commands/remap.md              # /remap slash command
.claude/commands/stack-check.md        # /stack-check slash command
.claude/commands/hook-check.md         # /hook-check — verify all hooks present + wired
.claude/references/_index.md           # Master reference index skeleton
.claude/references/error-corrections/_index.md  # Error corrections index
.claude/references/explorations/_index.md       # Exploration persistence index
.claude/references/explorations/synthesis/.gitkeep
docs/handover/.gitkeep                 # Session handover directory
tests/reports/.gitkeep                 # JSON test output directory
```

### Layer 2: `getWorkflowFiles(workflow)`

Files specific to the selected workflow preset. See `workflow-presets.md` for the full preset definitions. Hook scripts and `tests/reports/` are now in the platform layer; workflow layer provides only docs and slash commands.

**Implemented in:** `flowforge-mobile/lib/templates/workflows/{research,feature,greenfield,learning}.ts`

**Research workflow** adds:
```
.claude/commands/research-setup.md     # /research-setup
.claude/commands/tdd-plan.md           # /tdd-plan
docs/research-notes/.gitkeep           # Input from Obsidian/mobile
docs/research-output/.gitkeep          # Output from Claude.ai Research
docs/stack-recommendation.md           # From /research-setup (placeholder)
docs/implementation-plan.md            # Living TDD plan (placeholder)
```

**Feature workflow** adds:
```
.claude/commands/scope.md              # /scope
.claude/commands/implementation-plan.md # /implementation-plan
.claude/commands/pre-review.md         # /pre-review
docs/spec.md                           # Feature specification (placeholder)
docs/implementation-plan.md            # Implementation approach (placeholder)
```

**Greenfield workflow** adds:
```
.claude/commands/architect.md          # /architect
.claude/commands/build-plan.md         # /build-plan
.claude/commands/deploy-check.md       # /deploy-check
docs/brief.md                          # Project brief (placeholder)
docs/architecture.md                   # System architecture (placeholder)
docs/build-plan.md                     # Build sequence (placeholder)
```

**Learning workflow** adds:
```
.claude/commands/capture-learnings.md  # /capture-learnings
docs/goal.md                           # Learning goal (placeholder)
docs/learnings.md                      # Captured insights (placeholder)
docs/experiments/.gitkeep              # Scratch space for experiments
```

### Layer 3: `getStackFiles(stack)` + `getDevcontainerFiles(stack)` + `buildSettings(workflow, stack)`

Files specific to the selected tech stack. Contributes `README.md`, stack config files, stack-specific `.gitignore` additions, and CLAUDE.md sections. The devcontainer and settings are generated separately and added during composition.

**Implemented in:** `flowforge-mobile/lib/templates/stacks/{typescript-react,typescript-node,python,rust,custom}.ts`, `devcontainer.ts`, `settings.ts`

**TypeScript-React** adds:
```
README.md                              # React project README template
tsconfig.json                          # TypeScript strict config (jsx: react-jsx)
.devcontainer/devcontainer.json        # Node feature, VS Code eslint + prettier extensions
.devcontainer/post-create.sh           # npm install -g typescript eslint
.claude/settings.json                  # Hook wiring + env: jest, tsc, prettier, eslint
```

**TypeScript-Node** adds:
```
README.md                              # Node.js project README template
tsconfig.json                          # TypeScript strict config (module: NodeNext)
.devcontainer/devcontainer.json        # Node feature, VS Code eslint + prettier extensions
.devcontainer/post-create.sh           # npm install -g typescript eslint
.claude/settings.json                  # Hook wiring + env: jest, tsc, prettier, eslint
```

**Python** adds:
```
README.md                              # Python project README template
pyproject.toml                         # Project config with [dev] deps
tests/conftest.py                      # pytest configuration and markers
.devcontainer/devcontainer.json        # Python 3.12 feature, VS Code python + ruff extensions
.devcontainer/post-create.sh           # pip install black ruff mypy pytest pytest-json-report
.claude/settings.json                  # Hook wiring + env: pytest, mypy, black, ruff
```

**Rust** adds:
```
README.md                              # Rust project README template
Cargo.toml                            # Minimal crate config (edition 2021)
.devcontainer/devcontainer.json        # Rust feature, VS Code rust-analyzer extension
.devcontainer/post-create.sh           # rustup component add rustfmt clippy
.claude/settings.json                  # Hook wiring + env: cargo test, cargo check, rustfmt, clippy
```

**Custom** adds:
```
README.md                              # Generic README template
.devcontainer/devcontainer.json        # Universal base image only
.devcontainer/post-create.sh           # Minimal setup (chmod hooks)
.claude/settings.json                  # Platform hooks only, no env vars
```

### File Deduplication

Files are combined into a single `FileToCreate[]` with deduplication by path. When multiple layers produce a file at the same path (e.g., `README.md` from both workflow and stack, or `.devcontainer/post-create.sh` from platform and stack), the **later source wins**:

```typescript
function composeTemplate(workflow: WorkflowPreset, stack: StackPreset, name: string, desc: string): FileToCreate[] {
  const platformFiles = getPlatformFiles(name, desc);
  const workflowFiles = getWorkflowFiles(workflow, name);
  const stackFiles = getStackFiles(stack, name, desc);

  const claudeMd = assembleCLAUDEmd(workflow, stack, name, desc);
  const gitignore = mergeGitignore(stack);

  const allFiles = [...platformFiles, ...workflowFiles, ...stackFiles];
  allFiles.push({ path: 'CLAUDE.md', content: claudeMd });
  allFiles.push({ path: '.gitignore', content: gitignore });

  // Deduplicate: later entries win on path conflicts
  const fileMap = new Map<string, FileToCreate>();
  for (const file of allFiles) {
    fileMap.set(file.path, file);
  }

  return Array.from(fileMap.values());
}
```

This means stack-specific `README.md` overrides the generic platform `README.md`, and stack-specific `post-create.sh` can extend or replace the platform base. The ordering (platform -> workflow -> stack) ensures that more specific layers override more generic ones.

---

## 4. CLAUDE.md Assembly

The most important generated file is `CLAUDE.md`. Rather than concatenating strings from multiple templates (fragile, hard to maintain, difficult to reorder), the system uses **section-based composition**.

### Interface

```typescript
interface ClaudeMdSection {
  heading: string;
  content: string;
  order: number;
  source: 'platform' | 'workflow' | 'stack';
}
```

Each layer contributes an array of `ClaudeMdSection` objects. The sections are collected, sorted by `order`, and rendered into a single markdown document. If two sections share the same heading, the later source wins (same deduplication rule as files).

### Section Ordering

| Order | Section | Source | Purpose |
|-------|---------|--------|---------|
| 0 | Project Header | platform | Project name, description, one-line summary |
| 10 | Tech Stack | stack | Language, framework, key dependencies |
| 20 | Getting Started | stack | Install and run commands for the stack |
| 30 | Workflow | workflow | Phase descriptions, key commands, workflow rules |
| 40 | Project Structure | stack | Directory layout with explanations |
| 50 | Development Guidelines | platform | Coding conventions, test rules, commit style |
| 60 | References | platform | `@`-imports to `_index.md`, error corrections index |
| 70 | Handover & Session Rules | platform | Context thresholds, handover triggers, session hygiene |

### Example: Research + Python

For a project named `spectral-analysis` with workflow `research` and stack `python`, the assembled `CLAUDE.md` would contain:

```markdown
# spectral-analysis

Spectral analysis toolkit for astronomical data.

## Tech Stack

- Language: Python 3.12+
- Test Framework: pytest with JSON reporting
- Type Checker: mypy
- Formatter: black
- Linter: ruff

## Getting Started

\```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows

# Install dependencies
pip install -e ".[dev]"

# Run tests (human only — CC must not execute tests)
pytest --json-report --json-report-file=tests/reports/latest.json
\```

## Workflow

This project follows the Research-to-Implementation workflow:
1. Research notes in `docs/research-notes/`
2. `/research-setup` — analyse notes, recommend stack and tooling
3. Deep research via Claude.ai Research → `docs/research-output/`
4. `/tdd-plan` — generate phased implementation plan
5. TDD implementation with Stop-hook test loop
6. `/session-handover` at context boundaries

Key commands: `/research-setup`, `/tdd-plan`, `/session-handover`, `/remap`, `/stack-check`

## Project Structure

\```
src/                    # Implementation code
tests/                  # Test files
  reports/              # JSON test output (read by hooks)
docs/
  research-notes/       # Input research (from Obsidian/mobile)
  research-output/      # Validated research (from Claude.ai)
  handover/             # Session state documents
  implementation-plan.md
.claude/
  commands/             # Custom slash commands
  hooks/                # Automation scripts
  references/           # Progressive-disclosure reference library
  scripts/              # Utility scripts
\```

## Development Guidelines

- Write clean, well-typed code with docstrings
- Follow existing patterns in the codebase
- Tests are executed by the human — write test files and provide execution instructions
- Commit atomically at each green test state
- Error patterns go in `.claude/references/error-corrections/`, not in CLAUDE.md
- Read `_index.md` first, then specific reference files — never grep/glob the whole codebase

## References

When looking for code structure, consult the codebase map:
@.claude/references/_index.md

When encountering errors or modifying code in areas with known issues:
@.claude/references/error-corrections/_index.md

## Handover & Session Rules

- Handover at ~65-70% context usage or natural phase boundaries
- Run `/session-handover` before `/clear`
- New sessions: load latest handover via `@docs/handover/latest.md`
- Emergency: PreCompact hook auto-captures partial state if auto-compaction fires
```

### Rendering Logic

```typescript
function assembleCLAUDEmd(
  workflow: WorkflowPreset,
  stack: StackPreset,
  name: string,
  description: string
): string {
  const sections: ClaudeMdSection[] = [
    ...getPlatformSections(name, description),
    ...getWorkflowSections(workflow),
    ...getStackSections(stack),
  ];

  // Deduplicate by heading (later source wins)
  const sectionMap = new Map<string, ClaudeMdSection>();
  for (const section of sections) {
    sectionMap.set(section.heading, section);
  }

  // Sort by order, render
  const ordered = Array.from(sectionMap.values()).sort((a, b) => a.order - b.order);

  const parts = ordered.map((s) =>
    s.order === 0 ? s.content : `## ${s.heading}\n\n${s.content}`
  );

  return parts.join('\n\n');
}
```

The `order: 0` special case allows the project header to render without a `##` prefix, since it uses `# ProjectName` as the document title.

---

## 5. `.claude/settings.json` Generation

**Implemented in:** `flowforge-mobile/lib/templates/settings.ts`

The `buildSettings(workflow, stack)` function generates `.claude/settings.json`, which wires hooks to CC lifecycle events and sets per-stack environment variables. Different workflows require different hook configurations because not every workflow uses the TDD test loop or typecheck gating.

### Generation Strategy

Platform hooks (block-test-execution, protect-files, auto-format, session-state, pre-compact-handover) are always included. TDD hooks (stop-test-loop, post-typecheck, auto-deps, auto-remap, post-explore-reminder) are included only when the workflow is research, feature, or greenfield (i.e., not learning). Stack-specific environment variables (`TEST_RUNNER_CMD`, `FORMAT_CMD`, `TYPE_CHECK_CMD`, `LINT_CMD`, `TEST_REPORT_FORMAT`) are included only when both TDD is enabled and the stack is not custom.

### Example: Research + Python

A research workflow includes the full TDD automation layer:

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
      },
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/protect-files.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/post-typecheck.sh"
          }
        ]
      },
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/auto-format.sh"
          }
        ]
      },
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/auto-deps.sh",
            "async": true
          }
        ]
      },
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/auto-remap.sh",
            "async": true
          }
        ]
      }
    ],
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
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/session-state.sh"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "matcher": "auto",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/pre-compact-handover.sh"
          }
        ]
      }
    ]
  }
}
```

### Example: Learning + Custom

A learning workflow omits the TDD test loop and typecheck gating, since learning projects do not follow the strict TDD cycle:

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
      },
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/protect-files.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/auto-format.sh"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/session-state.sh"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "matcher": "auto",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/pre-compact-handover.sh"
          }
        ]
      }
    ]
  }
}
```

Note the absence of `Stop` (no test loop), the absence of `post-typecheck.sh` (no type gating), and the absence of async hooks (`auto-deps.sh`, `auto-remap.sh`). The learning workflow keeps block-test-execution because even in learning mode, CC should not execute tests directly.

---

## 6. `.devcontainer/` Composition

**Implemented in:** `flowforge-mobile/lib/templates/devcontainer.ts`

The `getDevcontainerFiles(stack, name)` function generates `devcontainer.json` and `post-create.sh`. The devcontainer configuration ensures CC web (and any remote container environment) can run the hook scripts. Without it, hook scripts fail because tools like `pytest`, `ruff`, `black`, `tsc`, `mypy` are not installed in the base container.

### Base Image

All stacks use the same base:

```
mcr.microsoft.com/devcontainers/universal:2
```

This image includes git, Node.js, Python, and common build tools. Stack-specific features are added on top.

### Feature Selection per Stack

| Stack | Features Added |
|-------|---------------|
| TypeScript-React | `ghcr.io/devcontainers/features/node:1` |
| TypeScript-Node | `ghcr.io/devcontainers/features/node:1` |
| Python | `ghcr.io/devcontainers/features/python:1` |
| Rust | `ghcr.io/devcontainers/features/rust:1` |
| Custom | None (base image only) |

### Example: `devcontainer.json` for Python Stack

```json
{
  "name": "spectral-analysis",
  "image": "mcr.microsoft.com/devcontainers/universal:2",
  "postCreateCommand": ".devcontainer/post-create.sh",
  "features": {
    "ghcr.io/devcontainers/features/python:1": {
      "version": "3.12"
    }
  },
  "customizations": {
    "vscode": {
      "extensions": [
        "ms-python.python",
        "ms-python.mypy-type-checker",
        "charliermarsh.ruff"
      ]
    }
  }
}
```

### `post-create.sh`

The post-create script installs everything the hook scripts need. It is composed from platform requirements (RTK, common tools) plus stack requirements (language-specific formatters, linters, type checkers).

**Platform base (always included):**

```bash
#!/bin/bash
set -e

# RTK — command output compression for hooks
curl -fsSL https://rtk.sh | bash

# Common tools
npm install -g prettier
```

**Python stack additions:**

```bash
# Python tooling for hook scripts
pip install --user black ruff mypy
pip install --user pytest pytest-json-report

# Project dependencies
if [ -f "pyproject.toml" ]; then
  pip install -e ".[dev]" 2>/dev/null || pip install -e .
elif [ -f "requirements.txt" ]; then
  pip install -r requirements.txt
fi
```

**TypeScript stack additions:**

```bash
# TypeScript tooling for hook scripts
npm install -g typescript eslint

# Project dependencies
if [ -f "package.json" ]; then
  npm install
fi
```

**Rust stack additions:**

```bash
# Rust tooling for hook scripts
rustup component add rustfmt clippy
```

The composed `post-create.sh` concatenates the platform base with the stack-specific additions, ensuring that when the container starts, every tool referenced by a hook script is available.

---

## 7. `.gitignore` Merge

The `.gitignore` is assembled from a platform base (common to all projects) and stack-specific additions, then deduplicated.

### Platform Base

Present in every repo regardless of stack:

```gitignore
# IDE
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

# Claude Code local files
CLAUDE.local.md
.claude/settings.local.json

# Test loop internal files
tests/reports/.iteration-count
tests/reports/.last-test-run
```

### Stack Additions

**TypeScript-React:**
```gitignore
node_modules/
dist/
build/
.next/
out/
coverage/
*.tsbuildinfo
npm-debug.log*
.pnp
.pnp.js
```

**TypeScript-Node:**
```gitignore
node_modules/
dist/
coverage/
*.tsbuildinfo
npm-debug.log*
```

**Python:**
```gitignore
__pycache__/
*.py[cod]
*$py.class
*.egg-info/
.eggs/
dist/
build/
.venv/
venv/
.mypy_cache/
.ruff_cache/
.pytest_cache/
htmlcov/
.coverage
```

**Rust:**
```gitignore
target/
Cargo.lock
**/*.rs.bk
```

**Custom:** (no additions beyond platform base)

### Merge Logic

```typescript
function mergeGitignore(stack: StackPreset): string {
  const platformBase = getPlatformGitignore();
  const stackAdditions = getStackGitignore(stack);

  const allLines = [...platformBase.split('\n'), ...stackAdditions.split('\n')];

  // Deduplicate non-empty, non-comment lines while preserving order and comments
  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of allLines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      result.push(line);  // Preserve blank lines and comments
    } else if (!seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(line);
    }
  }

  return result.join('\n');
}
```

---

## 8. Mobile UX Flow

The following flow describes the template creation experience in FlowForge mobile. This is designed but not yet built -- the current MVP uses the simpler `web-app` / `cli-tool` template selection.

### Screen Sequence

**Screen 1: Select Workflow**

Four cards, each with an icon, title, and one-line description:

| Workflow | Description |
|----------|-------------|
| Research | Start from research notes, discover the right stack, build with TDD |
| Feature | Add a feature to an existing project pattern with spec-driven TDD |
| Greenfield | Start from a brief, architect the system, build from scratch |
| Learning | Explore a topic with guided exercises and explanations |

**Screen 2: Select Stack**

Five cards:

| Stack | Description |
|-------|-------------|
| TypeScript-React | React/Next.js web application |
| TypeScript-Node | Node.js backend or CLI tool |
| Python | Python application or library |
| Rust | Rust application or library |
| Custom | No stack preset -- configure manually after creation |

**Screen 3: Project Details**

Form fields:
- **Name** (required) -- validated against GitHub repo name rules via `isValidRepoName()`
- **Description** (optional) -- one-line project summary
- **Private** (toggle, default: on) -- repository visibility

**Screen 4: Create**

Single "Create Project" button. On press:

```typescript
async function handleCreate() {
  setLoading(true);
  const files = composeTemplate(workflow, stack, name, description);
  const settings = buildSettings(workflow);
  files.push({ path: '.claude/settings.json', content: JSON.stringify(settings, null, 2) });

  const result = await createRepository(token, {
    name,
    description,
    isPrivate,
    files,  // Replaces the old `template` parameter
  });
  // Navigate to success screen
}
```

The `createRepository` function in `flowforge-mobile/lib/github.ts` is updated to accept a `FileToCreate[]` directly instead of a template name, using the same blob -> tree -> commit -> ref pipeline.

**Screen 5: Success (see section 11 for per-workflow variations)**

---

## 9. Mobile to CC Web Deep Link Flow

This flow connects FlowForge's mobile scaffolding with CC web's remote coding environment, enabling a workflow where the user captures ideas on mobile and directs implementation from the phone while CC does the coding on a full development machine.

### Step-by-Step

1. **User captures notes on mobile.** Research notes in Obsidian (synced via Obsidian Sync) or directly in FlowForge's note capture UI.

2. **FlowForge creates GitHub repo with full scaffold.** The template composition system (sections 3-7) produces a repo containing `CLAUDE.md`, `.claude/settings.json`, all hook scripts, slash commands, reference skeleton, and devcontainer config. The repo is pushed to GitHub via Octokit.

3. **User launches CC web session.** Two mechanisms:
   - **Deep link:** FlowForge opens a URL pointing CC web at the repo (format TBD -- see open questions, section 13).
   - **Dashboard:** User navigates to CC web manually and selects the repo from their GitHub repos.

4. **CC web clones repo.** The remote container is built from `.devcontainer/devcontainer.json`. `post-create.sh` installs RTK, formatters, linters, and type checkers. CC reads `CLAUDE.md`, `.claude/settings.json` wires the hooks.

5. **Automation layer activates.** Hooks fire on CC web exactly as they would locally: `block-test-execution` prevents CC from running tests, `session-state` injects project status, `stop-test-loop` runs tests after each coding turn, `post-typecheck` catches type errors after edits.

6. **User directs work from mobile.** The user can:
   - Read test results via the dashboard (section 10)
   - Read handover documents via GitHub API
   - Push additional research notes to `docs/research-notes/` via Octokit
   - Approve plans by reading `docs/implementation-plan.md`
   - Launch a new CC web session if context runs out

### Why This Works

The repo-as-operating-environment pattern (section 2) means there is no setup step between "repo exists" and "CC is fully configured." The devcontainer ensures tool dependencies are met. The hooks ensure behavioural rules are enforced. The slash commands ensure workflow guidance is available. FlowForge's job is done once the repo is pushed -- everything else is between CC web and the repo.

---

## 10. Phase 2 Dashboard Vision

FlowForge evolves from "create and forget" to an ongoing project dashboard. The mobile app reads project state from GitHub repos that FlowForge has already created, presenting a summary view that lets the user monitor CC's work without opening a terminal.

### Data Sources

All data is read from the repo via GitHub's REST API (Octokit). No additional backend is required -- the repo IS the database.

| Feature | Data Source | Mechanism |
|---------|------------|-----------|
| Project status | `tests/reports/latest.json` | GitHub API: get file contents, parse JSON, display pass/fail counts |
| Current phase | `docs/implementation-plan.md` | GitHub API: get file contents, parse markdown, find first unchecked `- [ ]` item |
| Latest handover | `docs/handover/` | GitHub API: list directory, sort by name (date-stamped), show latest filename and summary |
| Test health | `tests/reports/latest.json` | Summary card: green/red indicator, pass rate percentage, failure count |
| Launch CC web | CC web deep link | Open system browser or in-app webview with repo URL |
| Push research notes | In-app editor or Obsidian sync | Git commit via Octokit: create blob, create tree (single file), create commit, update ref |

### Dashboard Cards

The project list screen shows one card per FlowForge-created repo:

```
+------------------------------------------+
|  spectral-analysis              [PRIVATE] |
|  Research / Python                        |
|                                           |
|  Tests: 42/45 passed (93%)      [AMBER]  |
|  Phase: 2.3 — Data Pipeline              |
|  Last handover: 2h ago                   |
|                                           |
|  [Launch CC Web]  [View Handover]        |
+------------------------------------------+
```

Tapping the card opens a detail view with full test failure list, implementation plan progress, and handover history.

### Polling Strategy

The initial implementation uses polling (GitHub API requests on a timer or pull-to-refresh). This is acceptable for the expected usage pattern (checking on a project a few times per day), and avoids the complexity of webhook infrastructure.

If polling proves insufficient (see open questions, section 13), a future version could use GitHub webhooks delivered to a FlowForge API endpoint, which pushes notifications to the mobile app via push notifications.

---

## 11. Success Screen Next-Steps per Workflow

After repo creation, the success screen shows workflow-specific quick-start instructions. These tell the user what to do first with their newly scaffolded project.

### Research

```
Project created successfully!

Next steps:
1. Copy your research notes to docs/research-notes/
2. Open the project in Claude Code (or launch CC web)
3. Run /research-setup to analyse notes and get stack recommendations
4. Use Claude.ai Research for deep research validation
5. Run /tdd-plan to generate your implementation plan
```

### Feature

```
Project created successfully!

Next steps:
1. Write your feature specification in docs/spec.md
2. Open the project in Claude Code
3. Run /scope to break the spec into implementation phases
4. Begin TDD implementation -- the test loop will run automatically
```

### Greenfield

```
Project created successfully!

Next steps:
1. Write your project brief in docs/brief.md
2. Open the project in Claude Code
3. Run /architect to design the system architecture
4. Run /tdd-plan to generate your implementation plan
5. Begin TDD implementation -- the test loop will run automatically
```

### Learning

```
Project created successfully!

Next steps:
1. Write your learning goal in docs/goal.md
2. Open the project in Claude Code
3. Ask questions, request explanations, and explore
4. Your explorations will be saved in docs/explorations/
```

---

## 12. Implementation Sequence

The sprints below are adapted from the research document's implementation sequence (research-workflow-system-design-v2.md, section 13), with FlowForge-specific integration points called out.

### Sprint 1: Infrastructure Foundation

1. **RTK installation** -- global hook, immediate token savings on all projects.
2. **Global CLAUDE.md** -- establish baseline communication and workflow rules.
3. **Codebase mapper** -- productionise the existing AST mapper script, add to global tools.
4. **Core hooks** -- `block-test-execution.sh`, `protect-files.sh`, RTK auto-wrapper.

*FlowForge impact: None yet. This sprint builds the components that FlowForge will later bundle into templates.*

### Sprint 2: Automation Layer

5. **Stop-hook test loop** -- the flagship TDD automation (the `stop-test-loop.sh` script and its settings.json wiring).
6. **PostToolUse hooks** -- `post-typecheck.sh`, `auto-format.sh`, `auto-deps.sh`, `auto-remap.sh`.
7. **Session/lifecycle hooks** -- `session-state.sh`, context budget monitor (prompt hook), `pre-compact-handover.sh`.
8. **Hook-check command** -- `/hook-check` slash command to verify all hooks are present and functional.

*FlowForge impact: These scripts become the hook files that FlowForge bundles into repos. Each script must be self-contained (no external dependencies beyond what post-create.sh installs).*

### Sprint 3: Workflow Layer

9. **Custom slash commands** -- `/session-handover`, `/research-setup`, `/tdd-plan`, `/scope`, `/architect`, `/explain`, `/stack-check`, `/remap`.
10. **Baseline plugin installation** -- install and configure standard plugins globally.
11. **Reference library structure** -- create the `_index.md` hierarchy template with empty category indexes.
12. **Error correction framework** -- create the progressive disclosure structure with empty category files.

*FlowForge impact: Slash commands and reference structure templates are now ready to be included in the composition system.*

### Sprint 4: FlowForge Integration

13. **Template composition system** -- implement `composeTemplate()`, `assembleCLAUDEmd()`, `mergeGitignore()`, `buildSettings()` in `flowforge-mobile/lib/github.ts`. Replace the current `getWebAppTemplate`/`getCliToolTemplate` with the three-layer pipeline.
14. **Workflow and stack selection UI** -- new screens for workflow selection, stack selection, and project details (section 8).
15. **Devcontainer composition** -- implement `getDevcontainerFiles()` per stack, compose `post-create.sh` from platform + stack requirements.
16. **Success screen per workflow** -- implement workflow-specific next-steps instructions (section 11).
17. **FlowForge mobile dashboard** -- read project state from GitHub repos via Octokit, display summary cards (section 10).
18. **Deep link / launch flow** -- mobile to CC web session launch on a scaffolded repo (section 9).

### Sprint 5: Validation and Refinement

19. **SOP document** -- human-readable workflow reference derived from the architecture documents.
20. **End-to-end test (local)** -- scaffold a project via FlowForge, open in VS Code + CC, run through a full research-to-implementation cycle. Verify all hooks fire correctly, slash commands work, handover round-trips cleanly.
21. **End-to-end test (remote)** -- same project via CC web + devcontainer. Verify `post-create.sh` installs all dependencies, hooks work in the container, dashboard reads project state correctly.
22. **Iterate** -- refine templates, hook scripts, and dashboard based on real usage. Update reference library. Add new stacks or workflows if patterns emerge.

---

## 13. Open Questions

Carried forward from the research document (section 15) plus new questions specific to the FlowForge integration.

### From the Research Document

1. **CC web hook support maturity.** Do all hook types (`Stop` with `decision:"block"`, async `PostToolUse`, `PreCompact`) work reliably in CC web's remote container? The stop-test-loop is the flagship automation -- if `Stop` hooks cannot block and re-enter in CC web, the entire TDD automation layer degrades to manual test execution. Needs testing in Sprint 5.

2. **Dashboard polling vs webhooks.** Should the mobile dashboard poll GitHub API for project state, or use GitHub webhooks for push notifications when test results change? Polling is simpler but introduces latency and rate-limit concerns. Webhooks require a FlowForge API endpoint (the existing `flowforge-api/` Vercel backend could host this) and push notification infrastructure. Start with polling; add webhooks if users need real-time updates.

3. **Stop-hook test loop for non-pytest projects.** The `stop-test-loop.sh` script assumes pytest with `--json-report`. Strategy for multi-language support:
   - Detect test runner from project config (`package.json` scripts, `Cargo.toml`, `pyproject.toml`)
   - Or require explicit test command in `.claude/settings.local.json` or an environment variable
   - Or generate a stack-specific `stop-test-loop.sh` per stack preset (simplest for FlowForge)

4. **Obsidian to repo sync.** Phase 0 to Phase 1 transfer is still manual copy. Options: Obsidian Git plugin, GitHub Action watching a tagged folder, or a FlowForge in-app note editor that commits directly. The in-app editor avoids external dependencies but duplicates Obsidian's functionality.

### New Questions (FlowForge-Specific)

5. **CC web deep link format and stability.** What is the URL format for launching CC web pointed at a specific GitHub repo? Is this format stable and documented, or is it an internal/experimental API? If the format changes, FlowForge's launch flow breaks. Consider a fallback that simply opens the repo on GitHub with instructions to "open in CC web."

6. **Mobile to CC web auth handoff.** The user is authenticated to GitHub via FlowForge's OAuth flow (token stored in expo-secure-store). CC web uses its own authentication. Can FlowForge pass any auth context to CC web via the deep link, or does the user need to authenticate separately in CC web? If separate auth is required, the deep link flow is slightly less seamless but still functional.

7. **Template file size limits.** The composition system may produce 20-30 files in a single commit via the Git Data API. Are there practical limits on the number of blobs per tree, or total payload size, that could cause creation failures? The current MVP creates 3 files without issues. Testing needed with the full scaffold.

8. **Stack preset extensibility.** The initial five stack presets (TypeScript-React, TypeScript-Node, Python, Rust, Custom) cover common cases. Should users be able to define custom stack presets (e.g., Go, Java, C++), or should FlowForge only add presets when demand is clear? The "Custom" preset is the escape hatch, but it produces a minimal scaffold. A middle ground: let "Custom" accept a list of devcontainer features and gitignore patterns as form inputs.

9. **Devcontainer feature versioning.** Devcontainer features (e.g., `ghcr.io/devcontainers/features/python:1`) are versioned. Should FlowForge pin to specific versions for reproducibility, or use latest-major (`python:1`) for automatic updates? Pinning avoids breakage but requires maintenance. Latest-major is simpler but could introduce incompatibilities.

---

## Cross-References

- **Platform-level architecture** (hooks, automation, memory layers, token conservation): see `platform-architecture.md`
- **Workflow preset definitions** (phase sequences, slash commands per workflow, workflow-specific rules): see `workflow-presets.md`
- **Research document** (full system design with implementation details): see `archive/research-workflow-system-design-v2.md`
- **Template implementation**: `flowforge-mobile/lib/templates/` — `compose.ts` (orchestrator), `platform.ts` (hooks + universal files), `settings.ts` (settings.json), `devcontainer.ts` (devcontainer), `claude-md.ts` (CLAUDE.md assembly), `workflows/` (4 presets), `stacks/` (5 configs)
- **Types**: `flowforge-mobile/lib/types.ts` — `WorkflowPreset`, `StackPreset`, `FileToCreate`, etc.
- **GitHub API integration**: `flowforge-mobile/lib/github.ts` — `createRepository()`, `deleteRepository()`, `isValidRepoName()`
