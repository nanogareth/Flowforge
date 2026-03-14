---
description: "Bootstrap a new project with CLAUDE.md, hooks, settings, and CI"
argument-hint: "<project-name>"
allowed-tools: ["Bash", "Read", "Write", "Glob", "Grep", "Edit"]
---

# /flowforge-init — Project Bootstrapping

Set up a new project directory with everything Claude Code needs from the first session: CLAUDE.md, .gitignore, .claude/settings.json, and GitHub Actions CI.

## Inputs

**Required argument:** `$ARGUMENTS` — the project name (used as directory name and CLAUDE.md title).

If `$ARGUMENTS` is empty, ask the user for a project name before proceeding.

**Interactive prompts** — ask the user for each of these before generating files:

1. **Description** — one-line project description (can be empty)
2. **Workflow** — one of: `greenfield`, `feature`, `research`, `learning`
   - `greenfield` — new project from scratch, full scaffolding
   - `feature` — adding to an existing codebase, TDD focus
   - `research` — exploration/prototyping, lightweight structure
   - `learning` — educational/experimental, minimal tooling
3. **Stack** — one of: `typescript-react`, `typescript-node`, `python`, `rust`, `custom`
4. **GitHub repo** — create a GitHub repo? (yes/no, default: yes). If yes, ask public or private (default: private).
5. **Context** — any additional context or requirements to include? (can be empty)

## Execution

### Step 1: Create the project directory

Determine the projects root. Check for a `CLONE_DIR` env var; if not set, use `C:\GitHub` on Windows or `~/GitHub` elsewhere.

```bash
mkdir -p "$PROJECTS_ROOT/$PROJECT_NAME"
cd "$PROJECTS_ROOT/$PROJECT_NAME"
git init
```

### Step 2: Generate CLAUDE.md

Write `CLAUDE.md` to the project root. Structure:

```markdown
# {project name}

{description, if provided}

## Context

{user's context/requirements, if provided}

## Commands

{fill in the Commands section based on stack — leave as TODO placeholders that /init will complete:}

### typescript-react or typescript-node:
npm run dev            # Dev server
npm test               # Run tests
npm run lint           # Lint
npm run typecheck      # Type check
npm run format         # Format

### python:
py -m pytest           # Run tests
py -m mypy .           # Type check
ruff check .           # Lint
ruff format .          # Format

### rust:
cargo build            # Build
cargo test             # Run tests
cargo clippy           # Lint
cargo fmt              # Format

### custom:
(leave blank — /init will configure)

## Architecture

> Fill this section during /init after scaffolding the project.

## Setup

{stack hint from the table below}

{workflow instruction from the table below}

## GitHub Integration

The @claude bot is active on this repository via the Claude GitHub App.
{triggers based on workflow — see trigger table below}
```

**Stack hints:**

| Stack | Hint |
|-------|------|
| typescript-react | Stack: TypeScript + React. Configure appropriate meta-framework, testing, linting, and formatting during /init. |
| typescript-node | Stack: TypeScript + Node.js. Configure appropriate runtime, testing, linting, and formatting during /init. |
| python | Stack: Python. Configure appropriate virtual environment, testing, linting, and formatting during /init. |
| rust | Stack: Rust. Configure appropriate project structure, testing, and tooling during /init. |
| custom | Stack: Not specified. Choose and configure an appropriate tech stack during /init. |

**Workflow instructions:**

| Workflow | Instruction |
|----------|-------------|
| greenfield | During /init: design system architecture, set up the project with appropriate tooling, create an initial build plan, and scaffold the core structure with tests. |
| feature | During /init: explore the existing codebase, define the feature scope and acceptance criteria, then create an implementation plan with TDD structure. |
| research | During /init: analyze the research context, recommend a tech stack with rationale, then scaffold the project structure with an implementation plan. |
| learning | During /init: set up a lightweight exploration environment, and create an initial experiment based on the learning goals. |

**GitHub integration triggers by workflow:**

| Trigger | greenfield | feature | research | learning |
|---------|-----------|---------|----------|----------|
| `@claude` on PRs/issues | yes | yes | yes | yes |
| Auto-review new PRs | yes | yes | no | no |
| Respond to change requests | no | yes | no | no |
| Assign issue to `claude` | yes | no | yes | no |
| `claude` label on issues | yes | no | yes | no |

### Step 3: Generate .gitignore

Write `.gitignore` combining platform patterns and stack-specific patterns.

**Platform base (always included):**

```
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
npm-debug.log*

# Testing
coverage/

# Claude Code
.claude/settings.local.json
```

**Stack additions:**

- **typescript-react:** `node_modules/`, `.pnp`, `.pnp.js`, `dist/`, `build/`, `.next/`, `out/`, `*.tsbuildinfo`, `coverage/`
- **typescript-node:** `node_modules/`, `dist/`, `*.tsbuildinfo`, `coverage/`
- **python:** `__pycache__/`, `*.py[cod]`, `*$py.class`, `*.egg-info/`, `.eggs/`, `.venv/`, `venv/`, `.mypy_cache/`, `.pytest_cache/`, `htmlcov/`, `dist/`, `build/`
- **rust:** `target/`, `Cargo.lock`
- **custom:** (none)

Deduplicate patterns that appear in both platform and stack sections.

### Step 4: Generate .claude/settings.json

Write `.claude/settings.json` with stack-appropriate environment variables:

```json
{
  "env": {
    "TEST_RUNNER_CMD": "<per stack>",
    "LINT_CMD": "<per stack>",
    "FORMAT_CMD": "<per stack>",
    "TYPE_CHECK_CMD": "<per stack>"
  }
}
```

**Stack env values:**

| Stack | TEST_RUNNER_CMD | LINT_CMD | FORMAT_CMD | TYPE_CHECK_CMD |
|-------|----------------|----------|------------|----------------|
| typescript-react | `npm test` | `npm run lint` | `npm run format` | `npm run typecheck` |
| typescript-node | `npm test` | `npm run lint` | `npm run format` | `npm run typecheck` |
| python | `py -m pytest` | `ruff check .` | `ruff format .` | `py -m mypy .` |
| rust | `cargo test` | `cargo clippy` | `cargo fmt` | (omit) |
| custom | (omit all — /init will configure) |

### Step 5: Generate .github/workflows/claude.yml

Write the GitHub Actions workflow for the Claude GitHub App. The trigger configuration depends on workflow type.

**Base structure:**

```yaml
name: Claude

on:
  {triggers based on workflow — see trigger table in Step 2}

jobs:
  claude:
    if: |
      {conditions based on active triggers}
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      issues: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 1
      - uses: anthropics/claude-code-action@v1
        with:
          trigger_phrase: "@claude"
          use_sticky_comment: true
          {extra 'with' keys based on workflow}
```

**Extra `with` keys by workflow:**
- greenfield/research: add `assignee_trigger: "claude"` and `label_trigger: "claude"`
- feature: add `include_fix_links: true`
- learning: (none)

**Trigger `on:` blocks by workflow:**

All workflows include:
```yaml
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
```

Additionally:
- greenfield: `pull_request: types: [opened, synchronize]`, `issues: types: [assigned]`
- feature: `pull_request: types: [opened, synchronize]`, `pull_request_review: types: [submitted]`
- research: `issues: types: [assigned]`
- learning: (no additional triggers)

**`if` conditions** — build from active triggers:
- `issue_comment` → `(github.event_name == 'issue_comment' && contains(github.event.comment.body, '@claude'))`
- `pull_request_review_comment` → `(github.event_name == 'pull_request_review_comment' && contains(github.event.comment.body, '@claude'))`
- `pull_request` → `github.event_name == 'pull_request'`
- `pull_request_review` → `(github.event_name == 'pull_request_review' && github.event.review.state == 'changes_requested')`
- `issues` → `(github.event_name == 'issues' && github.event.action == 'assigned')`

Join active conditions with ` ||`.

### Step 6: Create GitHub repo (if requested)

If the user said yes to GitHub repo creation:

```bash
gh repo create "$PROJECT_NAME" --private --source=. --push
# or --public if they chose public
```

If `gh` is not installed or not authenticated, print the manual steps instead.

### Step 7: Initial commit

```bash
git add -A
git commit -m "chore: bootstrap project with FlowForge"
```

If a GitHub repo was created, push:

```bash
git push -u origin main
```

### Step 8: Summary

Print a summary of what was created:

```
Project initialized: {project name}
Location: {full path}
Workflow: {workflow}
Stack: {stack}
GitHub: {repo URL or "not created"}

Files created:
  CLAUDE.md
  .gitignore
  .claude/settings.json
  .github/workflows/claude.yml

Next steps:
  cd {path}
  claude
  /init
```

## Important Notes

- Always use `py` (not `python` or `python3`) when the stack is Python — this is Windows-compatible.
- Do not invent dependency versions. If the project needs a package.json or pyproject.toml, use the package manager to create it (`npm init -y`, `py -m pip init`, etc.) — never hand-write version numbers.
- The generated files are starting points. `/init` is expected to refine them based on the actual project needs.
- If any step fails, continue with remaining steps and report what failed at the end.
