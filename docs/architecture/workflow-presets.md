# Workflow Presets & Stack Configurations

> Configurable layer — defines what kind of project you're doing and what stack you're using.

**Status:** v3.0
**Date:** 2026-02-12

---

## 1. Workflow/Stack Separation Model

The configurable layer operates on two orthogonal dimensions that combine independently.

### Workflow (How You Work)

A **workflow** defines the process structure of a project: what phases you move through, what commands you run at each phase, what documents you produce, and what triggers transitions. Workflows are about methodology — the sequence of human and CC activities that take a project from inception to completion.

Four workflow presets are provided:

| Preset | Purpose | Phases |
|--------|---------|--------|
| **Research** | Research-driven development — explore a problem space, then build | Capture, Setup, Research, Plan, Build, Handover, Complete |
| **Feature** | Add a feature to an existing codebase | Intake, Explore, Plan, Build, Review, Handover |
| **Greenfield** | Build something from scratch when the problem is already understood | Define, Architect, Plan, Build, Deploy, Handover |
| **Learning** | Exploration, experimentation, skill-building — lightweight process | Goal, Explore, Capture, Handover |

### Stack (What You Build With)

A **stack** defines the technology tooling: which formatter, linter, type checker, and test runner to use, what goes in `.gitignore`, what devcontainer features to install, and what environment variables to set for the hook pipeline.

Five stack configurations are provided:

| Stack | Language | Key Tools |
|-------|----------|-----------|
| **typescript-react** | TypeScript | prettier, eslint, tsc, jest/vitest |
| **typescript-node** | TypeScript | prettier, eslint, tsc, jest/vitest |
| **python** | Python | black/ruff, ruff, mypy, pytest |
| **rust** | Rust | rustfmt, clippy, compiler, cargo test |
| **custom** | Any | User-configured — no stack-specific tooling |

### Independence

These dimensions are independent: any workflow works with any stack. A research project can use Python or Rust. A learning session can use TypeScript or a custom stack. The composition model (section 2) explains how they combine.

---

## 2. Composition Model

```
platform + workflow + stack → scaffold
```

Three layers compose to produce a fully configured project scaffold:

### Platform (Universal Foundation)

The platform layer provides the infrastructure that every project needs regardless of workflow or stack. This is documented in `platform-architecture.md` and includes:

- Hook scripts (block-test-execution, protect-files, auto-format, auto-deps, auto-remap, session-state, context-monitor, pre-compact-handover)
- Memory architecture (CLAUDE.md, CLAUDE.local.md, MEMORY.md, reference library, handover docs)
- Token conservation stack (codebase mapper, RTK, structured test reports)
- Base `.claude/settings.json` with hook wiring
- `.devcontainer/` for CC web compatibility
- Base `.gitignore`

### Workflow (Process Structure)

The workflow layer adds process-specific structure on top of the platform:

- **Phases** — the sequence of stages the project moves through
- **Slash commands** — `.claude/commands/` files that implement phase-specific actions
- **Directory structure** — `docs/` subdirectories and placeholder files for phase outputs
- **CLAUDE.md sections** — workflow-specific instructions appended to the platform CLAUDE.md template
- **Hook activation overrides** — some workflows disable certain hooks (see section 3)

### Stack (Tooling Configuration)

The stack layer adds technology-specific configuration:

- **Formatter, linter, type checker, test runner** — specific tools and their commands
- **`.gitignore` additions** — stack-specific ignore patterns appended to the platform base
- **Devcontainer features** — language runtime features for CC web containers
- **Environment variables** — `TEST_RUNNER_CMD`, `TEST_REPORT_FORMAT`, `TYPE_CHECK_CMD`, `FORMAT_CMD`, `LINT_CMD` — consumed by hook scripts to stay stack-agnostic
- **Hook script configuration** — the auto-format, post-typecheck, and stop-test-loop hooks read environment variables to determine which tools to invoke

### Composition Example

```
platform (hooks, memory, token conservation)
  + research workflow (7 phases, /research-setup, /tdd-plan, research-notes dirs)
  + python stack (black, ruff, mypy, pytest, __pycache__/ in .gitignore)
  → fully scaffolded research-to-implementation project in Python
```

The platform hooks are stack-agnostic because they read `FORMAT_CMD`, `LINT_CMD`, `TYPE_CHECK_CMD`, and `TEST_RUNNER_CMD` from environment variables. The stack layer sets these variables; the hooks consume them. This means the same `auto-format.sh` works for Python (calls `black`) or TypeScript (calls `prettier`) without modification.

---

## 3. Hook Activation Matrix

The platform provides a full set of automation hooks (see `platform-architecture.md`). Most workflows enable all hooks. The Learning preset is the exception — it disables enforcement hooks to keep the process lightweight and exploratory.

| Hook | Type | Research | Feature | Greenfield | Learning |
|------|------|----------|---------|------------|----------|
| block-test-execution | PreToolUse | On | On | On | On |
| stop-test-loop | Stop | On | On | On | **Off** |
| post-typecheck | PostToolUse | On | On | On | **Off** |
| auto-format | PostToolUse | On | On | On | On |
| auto-deps | PostToolUse | On | On | On | On |
| auto-remap | PostToolUse | On | On | On | On |
| session-state | SessionStart | On | On | On | On |
| context-monitor | Stop | On | On | On | On |
| pre-compact-handover | PreCompact | On | On | On | On |
| protect-files | PreToolUse | On | On | On | On |

**Rationale for Learning overrides:**

- **stop-test-loop Off** — Learning sessions are exploratory. Forcing a TDD loop on every turn creates friction when the goal is to experiment, not to ship. The human can still run tests manually.
- **post-typecheck Off** — Type errors during exploration are informational, not blocking. Injecting type errors into CC's context on every edit disrupts the flow of experimentation.
- **block-test-execution stays On** — Even in learning mode, CC should not run tests. The human runs them. This is a resource and safety constraint, not a process constraint.

### Overriding Defaults

Hook activation is controlled by the `WORKFLOW_PRESET` environment variable and conditional logic in each hook script. To override a single hook for a specific project, set the corresponding environment variable in `.claude/settings.local.json` or `CLAUDE.local.md`:

```bash
# Force stop-test-loop on even in learning mode
STOP_TEST_LOOP_ENABLED=true

# Force post-typecheck off in a research project
POST_TYPECHECK_ENABLED=false
```

---

## 4. Workflow Presets

### 4.1 Research Preset

**Purpose:** Research-driven development — explore a problem space before building. The research phase uses Claude.ai's multi-search Research feature; implementation follows a strict TDD process.

**Phases:** Capture → Setup → Research → Plan → Build → Handover → Complete

**Key Commands:** `/research-setup`, `/tdd-plan`

**Signature Hook Config:** Full TDD automation — all hooks enabled. The stop-test-loop, post-typecheck, and auto-format hooks form a tight feedback cycle during the Build phase.

#### Directory Structure Additions

```
docs/
├── research-notes/.gitkeep          # Input: markdown notes from Obsidian or manual capture
├── research-output/.gitkeep         # Output: research results from Claude.ai Research
├── stack-recommendation.md          # Generated by /research-setup
└── implementation-plan.md           # Generated by /tdd-plan, living document
```

#### Slash Commands

| Command | File | Purpose |
|---------|------|---------|
| `/research-setup` | `.claude/commands/research-setup.md` | Analyse research notes, research language/framework options, recommend tech stack and CC tooling, output to `docs/stack-recommendation.md` |
| `/tdd-plan` | `.claude/commands/tdd-plan.md` | Generate atomic phased TDD implementation plan from research output, with test specs, human-execution markers, handover checkpoints, and context budget estimates |

#### CLAUDE.md Sections

The Research workflow appends the following sections to the platform CLAUDE.md template:

- **Workflow Phases** — describes the 7-phase research-to-implementation sequence
- **TDD Rules** — CC writes tests, human executes them, CC reads JSON results
- **Handover Triggers** — context >65%, natural phase boundary, or quality degradation

#### Phase Detail

**Phase 0: Capture**
- **Actor:** Human
- **Steps:** Capture ideas on paper or in Obsidian. Sync via Obsidian Sync.
- **Output:** Markdown notes in Obsidian vault.
- **Transition:** Human decides to start a project.

**Phase 1: Setup**
- **Actor:** Human + FlowForge + CC
- **Steps:**
  1. FlowForge scaffolds project from research template (see `flowforge-integration.md`)
  2. Copy markdown notes from Obsidian to `docs/research-notes/`
  3. FlowForge creates GitHub repo, pushes scaffold
  4. Launch CC in VS Code terminal
  5. `/init` — generates initial CLAUDE.md (FlowForge has already placed a template)
  6. Run codebase mapper — generates `.claude/references/codebase.md` + `_index.md`
  7. `/research-setup` — analyses notes, researches stack options, recommends tech stack + CC tooling
  8. Human reviews and approves recommendations
  9. Install recommended plugins/MCPs
  10. Commit and push
- **Output:** Fully configured project with stack recommendation approved.

**Phase 2: Research**
- **Actor:** Human + Claude.ai (Research feature)
- **Steps:**
  1. Load markdown notes into Claude.ai conversation
  2. Enable Research toggle — agentic multi-search
  3. Iterate until research is validated
  4. Export research output as markdown to `docs/research-output/`
  5. Commit
- **Output:** Validated research artifacts in `docs/research-output/`.
- **Rationale:** Claude.ai's Research mode is used here because its multi-search orchestration is more thorough than CC subagents for broad research synthesis.

**Phase 3: Plan**
- **Actor:** Human + CC (Plan Mode)
- **Steps:**
  1. Enter Plan Mode (`Shift+Tab` x2 or `/plan`)
  2. Reference `@docs/research-output/` + `@.claude/references/_index.md`
  3. CC proposes implementation plan, iterating with human
  4. `/tdd-plan` generates atomic phased plan with TDD structure, test specs, human-execution markers, handover checkpoints, context budget estimates, and custom agent/tool requirements
  5. Plan saved to `.claude/plans/` and `docs/implementation-plan.md`
  6. Exit Plan Mode, approve, execute
- **Output:** `docs/implementation-plan.md` — living TDD plan.

**Phase 4: Build**
- **Actor:** Human + CC
- **Steps (per implementation phase):**
  1. CC generates test specifications and test code
  2. Human executes tests — results written to `tests/reports/latest.json`
  3. CC reads JSON summary only
  4. CC iterates on implementation
  5. Human re-runs tests (or stop-test-loop runs them automatically)
  6. Refactor cycle
  7. Git commit at each green state
  8. Re-run codebase mapper after significant structural changes
- **Output:** Working, tested implementation code.
- **Hook Activity:** This is the dense automation phase. The stop-test-loop, post-typecheck, auto-format, and auto-deps hooks are all active and firing on every turn.

**Phase 5: Handover**
- **Actor:** Human + CC
- **Trigger:** Context >65%, natural phase boundary, or quality degradation.
- **Steps:**
  1. `/session-handover` — writes handover doc, reflects on errors, updates MEMORY.md
  2. `/revise-claude-md` — structured audit
  3. Re-run codebase mapper if structure changed
  4. Git commit
  5. `/clear`
  6. New session: CLAUDE.md loads automatically, `@docs/handover/latest.md` for state
- **Output:** Handover document in `docs/handover/`.

**Phase 6: Complete**
- **Actor:** Human + CC
- **Steps:** Final test suite passes, documentation updated, `/revise-claude-md` final audit, final commit and push, archive handover docs.
- **Output:** Completed project.

---

### 4.2 Feature Preset

**Purpose:** Add a feature to an existing codebase. The codebase already exists, has conventions, and has a test suite. The workflow focuses on understanding the existing code, planning the change, building with TDD, and preparing for code review.

**Phases:** Intake → Explore → Plan → Build → Review → Handover

**Key Commands:** `/scope`, `/implementation-plan`, `/pre-review`

**Signature Hook Config:** Full TDD automation — all hooks enabled. Same as Research, but the workflow is shorter and review-oriented.

#### Directory Structure Additions

```
docs/
├── spec.md                          # Feature specification and acceptance criteria
└── implementation-plan.md           # Implementation approach and sequence
```

#### Slash Commands

| Command | File | Purpose |
|---------|------|---------|
| `/scope` | `.claude/commands/scope.md` | Define feature boundaries, acceptance criteria, and out-of-scope items. Output to `docs/spec.md` |
| `/implementation-plan` | `.claude/commands/implementation-plan.md` | Plan implementation approach: what to change, in what order, with what tests. Output to `docs/implementation-plan.md` |
| `/pre-review` | `.claude/commands/pre-review.md` | Self-review before submitting for code review: check for missed edge cases, test coverage gaps, naming consistency, and documentation updates |

#### CLAUDE.md Sections

- **Feature Dev Workflow** — describes the 6-phase intake-to-handover sequence
- **PR Prep** — checklist for preparing a clean pull request (tests pass, types check, lint clean, docs updated, commit history clean)

#### Phase Detail

**Phase 1: Intake**
- **Actor:** Human + CC
- **Steps:**
  1. Human describes the feature (issue, conversation, or inline description)
  2. `/scope` — CC drafts feature spec with acceptance criteria
  3. Human reviews and refines scope
  4. Commit spec to `docs/spec.md`
- **Output:** `docs/spec.md` — feature specification with clear acceptance criteria and out-of-scope boundaries.

**Phase 2: Explore**
- **Actor:** CC (with human guidance)
- **Steps:**
  1. CC reads codebase map (`@.claude/references/_index.md`) to orient
  2. CC explores relevant modules, identifies touch points
  3. CC documents existing patterns, conventions, and constraints
  4. CC identifies potential risks or complications
- **Output:** CC has working knowledge of the codebase areas affected by the feature.

**Phase 3: Plan**
- **Actor:** Human + CC (Plan Mode)
- **Steps:**
  1. Enter Plan Mode
  2. `/implementation-plan` — CC proposes implementation approach
  3. Plan includes: files to modify, new files to create, test strategy, change sequence
  4. Human reviews and approves plan
  5. Exit Plan Mode
- **Output:** `docs/implementation-plan.md` — ordered list of changes with test strategy.

**Phase 4: Build**
- **Actor:** Human + CC
- **Steps:**
  1. Follow implementation plan phase by phase
  2. TDD cycle: write test, implement, verify, refactor
  3. Stop-test-loop provides automated feedback
  4. Commit at each green state
- **Output:** Feature implementation with test coverage.

**Phase 5: Review**
- **Actor:** Human + CC
- **Steps:**
  1. `/pre-review` — CC self-reviews the changes
  2. CC checks: test coverage, type safety, lint cleanliness, naming consistency, documentation updates
  3. CC prepares PR description (summary, test plan, migration notes if applicable)
  4. Human reviews CC's self-review, requests adjustments
  5. Submit PR
- **Output:** Clean PR ready for team review.

**Phase 6: Handover**
- **Actor:** Human + CC
- **Steps:**
  1. `/session-handover` if context is high or session is ending
  2. Update MEMORY.md with patterns learned from this codebase
  3. Update error corrections if new gotchas were discovered
- **Output:** Handover document (if needed) and updated project memory.

---

### 4.3 Greenfield Preset

**Purpose:** Build something from scratch when the problem is already understood. Unlike Research, there is no research phase — the requirements and technology choices are already known. The workflow emphasizes architecture-first design, systematic build planning, and deployment readiness.

**Phases:** Define → Architect → Plan → Build → Deploy → Handover

**Key Commands:** `/architect`, `/build-plan`, `/deploy-check`

**Signature Hook Config:** Full TDD automation — all hooks enabled.

#### Directory Structure Additions

```
docs/
├── brief.md                         # Project brief: goals, constraints, requirements
├── architecture.md                  # System architecture: components, data flow, APIs
└── build-plan.md                    # Ordered build sequence with dependencies
```

#### Slash Commands

| Command | File | Purpose |
|---------|------|---------|
| `/architect` | `.claude/commands/architect.md` | Design system architecture: component breakdown, data model, API contracts, infrastructure. Output to `docs/architecture.md` |
| `/build-plan` | `.claude/commands/build-plan.md` | Plan build sequence: what to build first, dependency order, TDD phases, integration points. Output to `docs/build-plan.md` |
| `/deploy-check` | `.claude/commands/deploy-check.md` | Pre-deployment verification: environment config, secrets management, CI/CD readiness, health checks, rollback strategy |

#### CLAUDE.md Sections

- **Greenfield Workflow** — describes the 6-phase define-to-handover sequence
- **Architecture-First Approach** — architecture document must exist before any implementation begins; all implementation decisions trace back to architecture

#### Phase Detail

**Phase 1: Define**
- **Actor:** Human + CC
- **Steps:**
  1. Human describes the project goals, constraints, and requirements
  2. CC drafts project brief
  3. Human reviews and refines
  4. Commit to `docs/brief.md`
- **Output:** `docs/brief.md` — clear project definition with goals, constraints, and requirements.

**Phase 2: Architect**
- **Actor:** Human + CC (Plan Mode)
- **Steps:**
  1. Enter Plan Mode
  2. `/architect` — CC designs system architecture based on the brief
  3. Architecture includes: component breakdown, data model, API contracts, infrastructure requirements, technology justifications
  4. Human reviews, challenges assumptions, iterates
  5. Exit Plan Mode
- **Output:** `docs/architecture.md` — system architecture document.

**Phase 3: Plan**
- **Actor:** Human + CC (Plan Mode)
- **Steps:**
  1. `/build-plan` — CC proposes build sequence based on architecture
  2. Plan includes: build order (foundations first), dependency graph, TDD phases per component, integration test points, handover checkpoints
  3. Human reviews and approves
- **Output:** `docs/build-plan.md` — ordered build sequence with TDD structure.

**Phase 4: Build**
- **Actor:** Human + CC
- **Steps:**
  1. Follow build plan phase by phase
  2. TDD cycle: write test, implement, verify, refactor
  3. Stop-test-loop provides automated feedback
  4. Integration tests at component boundaries
  5. Commit at each green state
  6. Re-run codebase mapper after significant structural changes
- **Output:** Working system with test coverage.

**Phase 5: Deploy**
- **Actor:** Human + CC
- **Steps:**
  1. `/deploy-check` — CC verifies deployment readiness
  2. Check: environment configuration, secrets management, CI/CD pipeline, health checks, monitoring, rollback strategy
  3. CC prepares deployment documentation
  4. Human executes deployment (CC does not deploy)
  5. Verify production health
- **Output:** Deployed system with deployment documentation.

**Phase 6: Handover**
- **Actor:** Human + CC
- **Steps:**
  1. `/session-handover` — write handover doc
  2. Final documentation updates
  3. Update MEMORY.md and error corrections
  4. Archive handover docs
- **Output:** Completed project with full documentation.

---

### 4.4 Learning Preset

**Purpose:** Exploration, experimentation, and skill-building. This is the lightest workflow — minimal process, maximum freedom. The goal is to learn something, not to ship something. The hook configuration reflects this: the test loop and typecheck hooks are disabled to avoid creating friction during experimentation.

**Phases:** Goal → Explore → Capture → Handover

**Key Commands:** `/capture-learnings`

**Signature Hook Config:** Lightweight — stop-test-loop and post-typecheck are disabled. Auto-format, auto-deps, and auto-remap remain active (they help without getting in the way). Block-test-execution remains active (resource constraint, not process constraint).

#### Directory Structure Additions

```
docs/
├── goal.md                          # What you're trying to learn
├── learnings.md                     # What you actually learned
└── experiments/.gitkeep             # Scratch space for experiments
```

#### Slash Commands

| Command | File | Purpose |
|---------|------|---------|
| `/capture-learnings` | `.claude/commands/capture-learnings.md` | Document what you learned: key insights, surprises, patterns discovered, resources found, next questions. Output to `docs/learnings.md` |

#### CLAUDE.md Sections

- **Exploration Workflow** — describes the 4-phase goal-to-handover sequence
- **Lightweight Process** — no TDD enforcement, no type checking enforcement, freedom to experiment and break things

#### Phase Detail

**Phase 1: Goal**
- **Actor:** Human
- **Steps:**
  1. Human writes down what they want to learn or explore
  2. Commit to `docs/goal.md` (even a single sentence is fine)
- **Output:** `docs/goal.md` — learning objective. This can be vague ("understand how transformers work") or specific ("benchmark SQLite vs DuckDB for analytical queries").

**Phase 2: Explore**
- **Actor:** Human + CC
- **Steps:**
  1. Experiment freely — write code, break things, try approaches
  2. Use `docs/experiments/` as scratch space for throwaway code
  3. CC helps with explanations, examples, and debugging
  4. No TDD enforcement — write tests only when they help understanding
  5. No type checking enforcement — speed of iteration matters more than correctness
  6. Take notes along the way (or let CC track insights)
- **Output:** Working experiments and accumulated understanding.

**Phase 3: Capture**
- **Actor:** Human + CC
- **Steps:**
  1. `/capture-learnings` — CC summarises what was learned
  2. Document: key insights, surprises, patterns discovered, useful resources, follow-up questions
  3. Decide: does this learning feed into a real project? If so, which workflow?
- **Output:** `docs/learnings.md` — structured summary of learnings.

**Phase 4: Handover**
- **Actor:** Human + CC
- **Steps:**
  1. `/session-handover` if continuing later
  2. Update MEMORY.md with patterns and insights
  3. If transitioning to a real project, create a new project with the appropriate workflow preset and carry forward relevant learnings
- **Output:** Captured knowledge, ready for future use.

---

## 5. Stack Configurations

Each stack configuration defines the tooling that the platform hooks consume. Hook scripts are stack-agnostic — they read environment variables to determine which tools to invoke. The stack layer sets these variables.

### Environment Variables

All hook scripts that invoke stack-specific tools read these environment variables:

| Variable | Purpose | Consumed By |
|----------|---------|-------------|
| `FORMAT_CMD` | Command to format a single file (receives file path as argument) | `auto-format.sh` |
| `LINT_CMD` | Command to lint the source directory | `stop-test-loop.sh` |
| `TYPE_CHECK_CMD` | Command to type-check a single file or the project | `post-typecheck.sh` |
| `TEST_RUNNER_CMD` | Command to run the test suite with JSON output | `stop-test-loop.sh` |
| `TEST_REPORT_FORMAT` | Format of test output (`pytest-json`, `jest-json`, `cargo-json`) | `stop-test-loop.sh` |

These variables are set in `.claude/settings.json` (under `env`) or in the devcontainer environment.

---

### 5.1 typescript-react

**Use for:** React, Next.js, Remix, or any TypeScript frontend project.

| Tool | Value |
|------|-------|
| **Formatter** | prettier |
| **Linter** | eslint |
| **Type Checker** | tsc (`npx tsc --noEmit`) |
| **Test Runner** | jest or vitest (project choice) |

**`.gitignore` additions:**
```
.next/
out/
build/
dist/
node_modules/
*.tsbuildinfo
.eslintcache
```

**Devcontainer features:**
```json
{
  "ghcr.io/devcontainers/features/node:1": {}
}
```

**`post-create.sh` additions:**
```bash
npm install -g prettier eslint typescript
```

**Environment variables:**
```bash
FORMAT_CMD="npx prettier --write"
LINT_CMD="npx eslint src/"
TYPE_CHECK_CMD="npx tsc --noEmit"
TEST_RUNNER_CMD="npx jest --json --outputFile=tests/reports/latest.json"
TEST_REPORT_FORMAT="jest-json"
```

---

### 5.2 typescript-node

**Use for:** Node.js backends, CLI tools, libraries, or any TypeScript project without a frontend framework.

| Tool | Value |
|------|-------|
| **Formatter** | prettier |
| **Linter** | eslint |
| **Type Checker** | tsc (`npx tsc --noEmit`) |
| **Test Runner** | jest or vitest (project choice) |

**`.gitignore` additions:**
```
dist/
node_modules/
*.tsbuildinfo
.eslintcache
```

Note: No `.next/`, `out/`, or `build/` — those are frontend-specific.

**Devcontainer features:**
```json
{
  "ghcr.io/devcontainers/features/node:1": {}
}
```

**`post-create.sh` additions:**
```bash
npm install -g prettier eslint typescript
```

**Environment variables:**
```bash
FORMAT_CMD="npx prettier --write"
LINT_CMD="npx eslint src/"
TYPE_CHECK_CMD="npx tsc --noEmit"
TEST_RUNNER_CMD="npx jest --json --outputFile=tests/reports/latest.json"
TEST_REPORT_FORMAT="jest-json"
```

---

### 5.3 python

**Use for:** Python projects — data science, APIs, CLI tools, automation, ML/AI.

| Tool | Value |
|------|-------|
| **Formatter** | black or ruff format (project choice; ruff recommended for speed) |
| **Linter** | ruff |
| **Type Checker** | mypy |
| **Test Runner** | pytest with `pytest-json-report` |

**`.gitignore` additions:**
```
__pycache__/
.venv/
*.pyc
*.pyo
.mypy_cache/
.ruff_cache/
.pytest_cache/
*.egg-info/
dist/
build/
```

**Devcontainer features:**
```json
{
  "ghcr.io/devcontainers/features/python:1": {}
}
```

**`post-create.sh` additions:**
```bash
pip install black ruff mypy pytest pytest-json-report
```

**Environment variables:**
```bash
FORMAT_CMD="black"
LINT_CMD="ruff check src/"
TYPE_CHECK_CMD="mypy"
TEST_RUNNER_CMD="py -m pytest --json-report --json-report-file=tests/reports/latest.json"
TEST_REPORT_FORMAT="pytest-json"
```

---

### 5.4 rust

**Use for:** Rust projects — systems programming, CLI tools, libraries, web services.

| Tool | Value |
|------|-------|
| **Formatter** | rustfmt |
| **Linter** | clippy |
| **Type Checker** | Rust compiler (type checking is part of compilation) |
| **Test Runner** | cargo test with JSON output |

**`.gitignore` additions:**
```
target/
Cargo.lock          # For libraries only — remove this line for binaries
```

**Devcontainer features:**
```json
{
  "ghcr.io/devcontainers/features/rust:1": {}
}
```

**`post-create.sh` additions:**
```bash
rustup component add rustfmt clippy
```

**Environment variables:**
```bash
FORMAT_CMD="rustfmt"
LINT_CMD="cargo clippy -- -D warnings"
TYPE_CHECK_CMD="cargo check"
TEST_RUNNER_CMD="cargo test --message-format=json 2>&1 | tee tests/reports/latest.json"
TEST_REPORT_FORMAT="cargo-json"
```

**Note:** Rust's type checking is part of compilation. The `TYPE_CHECK_CMD` uses `cargo check` which performs full type checking without producing a binary. The `post-typecheck.sh` hook uses this for immediate feedback after edits.

---

### 5.5 custom

**Use for:** Projects with non-standard tooling, polyglot projects, or situations where the user wants full manual control.

| Tool | Value |
|------|-------|
| **Formatter** | User-configured |
| **Linter** | User-configured |
| **Type Checker** | User-configured |
| **Test Runner** | User-configured |

**`.gitignore` additions:**
```
# Platform base only — no stack-specific entries
```

**Devcontainer features:**
```json
{}
```
No stack-specific features. The user adds what they need to `devcontainer.json`.

**`post-create.sh` additions:**
None. The user installs their own tools.

**Environment variables:**
```bash
FORMAT_CMD=""
LINT_CMD=""
TYPE_CHECK_CMD=""
TEST_RUNNER_CMD=""
TEST_REPORT_FORMAT=""
```

All empty. Hook scripts check for empty values and skip gracefully. The user populates these in `.claude/settings.local.json` or `CLAUDE.local.md` once they decide on their tooling.

**Guidance:** The custom stack is a starting point. After choosing tools, the user should set the environment variables so that the platform hooks can invoke them. The hook scripts are designed to be stack-agnostic — they work with any tool that accepts a file path or source directory argument.

---

### Summary Table

| Stack | Formatter | Linter | Type Checker | Test Runner | `FORMAT_CMD` | `LINT_CMD` | `TYPE_CHECK_CMD` | `TEST_RUNNER_CMD` |
|-------|-----------|--------|--------------|-------------|--------------|------------|------------------|-------------------|
| typescript-react | prettier | eslint | tsc | jest/vitest | `npx prettier --write` | `npx eslint src/` | `npx tsc --noEmit` | `npx jest --json --outputFile=tests/reports/latest.json` |
| typescript-node | prettier | eslint | tsc | jest/vitest | `npx prettier --write` | `npx eslint src/` | `npx tsc --noEmit` | `npx jest --json --outputFile=tests/reports/latest.json` |
| python | black/ruff | ruff | mypy | pytest | `black` | `ruff check src/` | `mypy` | `py -m pytest --json-report --json-report-file=tests/reports/latest.json` |
| rust | rustfmt | clippy | cargo check | cargo test | `rustfmt` | `cargo clippy -- -D warnings` | `cargo check` | `cargo test --message-format=json` |
| custom | (none) | (none) | (none) | (none) | `""` | `""` | `""` | `""` |

---

## Cross-References

- **Platform layer** — `platform-architecture.md` documents the universal foundation (hooks, memory, token conservation) that all workflow+stack combinations build on.
- **FlowForge integration** — `flowforge-integration.md` documents how FlowForge scaffolds projects by composing platform + workflow + stack into a ready-to-use repo.
- **Hook implementation details** — Individual hook scripts are documented in the research workflow system design (sections 6.1-6.12) and will be extracted into `platform-architecture.md` as the architecture documents are finalised.
- **Research workflow origin** — The Research preset (section 4.1) is extracted from the research-to-implementation workflow system design v2, which provides the full context for why each phase exists.
