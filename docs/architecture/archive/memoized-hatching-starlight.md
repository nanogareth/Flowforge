# Plan: Generalize Research Workflow System + FlowForge Data Model

## Context

The `research-workflow-system-design-v2.md` design doc describes a powerful CC automation system — but it's locked to a research-to-implementation workflow. The automation layer (hooks), memory architecture, token conservation, and error correction are all universal. What's research-specific is the workflow phases, slash commands, and template directory structure. The user wants to generalize this so the same platform powers feature development, greenfield projects, learning/experimentation, and research — and FlowForge becomes the entry point for all of them.

Additionally, CC's own exploration work is currently ephemeral — subagents read dozens of files and produce compressed summaries, the parent agent writes analysis to the terminal, and all of it evaporates after the session. Exploration persistence makes this durable: subagents write detailed findings to reference files, parent synthesis is captured alongside them, and an index tracks what's been explored so future sessions skip redundant work.

This plan covers: (a) splitting the design doc into 3 focused documents, (b) refactoring the FlowForge mobile data model and template composition system to support workflow + stack as orthogonal dimensions, and (c) defining the exploration persistence system as a platform component. No new screens are built — just the data layer and design docs.

---

## Part 1: Design Doc Split

Split `research-workflow-system-design-v2.md` into 3 documents in a new `docs/architecture/` directory.

### 1.1 Create `docs/architecture/platform-architecture.md`

Universal layer — every project gets this regardless of workflow or stack.

**Contents extracted/rewritten from current doc:**
- Design principles (§1): token conservation, hooks over instructions, custom agents as deliverables
- Memory architecture (§3): all 5 layers, relationship diagram
- Token conservation stack (§4): codebase mapper, RTK, structured test reports, MCP lazy loading
- Error correction framework (§5): progressive disclosure, `_index.md` pattern, update mechanism
- Automation layer — platform hooks (§6): all universal hooks:
  - PreToolUse: block test execution, RTK auto-wrapper, file protection
  - PostToolUse: auto-format, codebase mapper regen (async)
  - SessionStart: state injection
  - Stop: context budget monitor
  - PreCompact: emergency handover
  - RTK pipeline role table
- **New: parameterised hooks** — typecheck, auto-deps, stop-test-loop are platform hooks but parameterised by stack config (which type checker, which test runner). Document the parameterisation interface.
- **New: Exploration persistence** — full section, see §1.1a below
- Reference library system (§7): structure, master `_index.md`, management, plugin/MCP inventory
- Universal slash commands: `/session-handover`, `/remap`, `/stack-check`, `/hook-check`
- Global CLAUDE.md (§11)
- Baseline plugins & MCP servers (§9, universal portion)
- Platform-level risks & mitigations (from §12)

### 1.1a Exploration Persistence (new platform section in `platform-architecture.md`)

This is a new component that doesn't exist in the current design doc. It addresses the problem that CC's exploration work is ephemeral — subagents read files and produce compressed summaries, parent agents write analysis to the terminal, and all of it disappears after the session.

**Problem statement:**
1. **Subagent output is lossy** — an Explore agent reads 40 files (70K tokens), returns a 3K summary. ~95% of observations are discarded.
2. **Reading is goal-biased** — agents extract only what matches their prompt. Incidental observations about patterns, conventions, and architecture are lost.
3. **Terminal analysis is ephemeral** — the parent's synthesis ("the automation layer is already universal") exists only in the session context.

**Design: two-layer capture**

**Layer 1: Subagent exploration files** — detailed, structured findings from Explore agents.

Location: `.claude/references/explorations/`

File format:
```markdown
---
date: 2026-02-12
query: "Understand the template system in FlowForge mobile"
files_read:
  - lib/github.ts
  - stores/store.ts
  - app/(app)/create.tsx
  - app/(app)/create/[type].tsx
  - __tests__/github.test.ts
stale_if_changed:
  - lib/github.ts
  - stores/store.ts
---
# Template System Exploration

## Primary Findings
[Direct answers to the query — template structure, factory pattern, FileToCreate interface, etc.]

## Incidental Findings
[Patterns, conventions, and architecture observed beyond the query scope]
- Zustand store pattern: single store, actions co-located, no middleware
- Auth flow: token stored in expo-secure-store, Octokit instantiated per-call
- Routing: Expo Router file-based, (app) group for auth guard
- Styling: NativeWind with custom dark theme, GitHub-inspired palette

## Dependency Map
[Import relationships between files explored]
- create.tsx → lib/github.ts (ProjectTemplate type)
- create/[type].tsx → lib/github.ts (createRepository, ProjectTemplate)
- create/[type].tsx → stores/store.ts (useStore)
```

**Layer 2: Parent synthesis files** — distilled conclusions from combining multiple explorations.

Location: `.claude/references/explorations/synthesis/`

File format:
```markdown
---
date: 2026-02-12
context: "Generalizing research workflow system"
based_on:
  - explorations/template-system-2026-02-12.md
  - explorations/screens-nav-2026-02-12.md
---
# Synthesis: Workflow Generalization Feasibility

## Key Conclusions
- The automation layer and memory architecture are already universal
- Only workflow phases, slash commands, and template dirs are research-specific
- The template system is simple (FileToCreate[]) but flexible — any file structure works
- Two orthogonal dimensions: workflow (phases) and stack (language/framework)

## Decisions
- Single template with workflow+stack composition, not multiple hardcoded templates
- 4 workflow presets: research, feature, greenfield, learning

## Open Questions
- CC web hook support maturity
- Stop-hook test loop for non-pytest projects
```

**Exploration index:** `.claude/references/explorations/_index.md`

```markdown
# Explorations Index

> CC: Before launching an Explore subagent, check this index. If the target
> area was explored recently and source files haven't changed, read the
> exploration file instead of re-exploring.

- `template-system-2026-02-12.md` — FlowForge template structure, factory pattern
  - **Keywords**: template, scaffold, FileToCreate, getTemplateFiles, ProjectTemplate
  - **Files**: lib/github.ts, stores/store.ts, create.tsx, [type].tsx
  - **Stale if**: lib/github.ts or stores/store.ts modified after 2026-02-12

- `screens-nav-2026-02-12.md` — App screens, routing, UX flow
  - **Keywords**: screen, route, navigation, create, success, login, dashboard
  - **Files**: app/ directory (all .tsx)

## Syntheses
- `synthesis/workflow-generalization-2026-02-12.md` — Feasibility analysis for generalizing beyond research workflow
```

**Staleness detection:**
- Each exploration file lists `stale_if_changed` files
- Before re-exploring, check if any listed file has been modified since the exploration date
- If stale: re-explore and overwrite (or create a new dated file)
- If fresh: read the existing exploration file — saves the full subagent cost

**Subagent prompt convention:**
All Explore agents launched in this system include these instructions:

```
After completing your exploration, write your detailed findings to:
  .claude/references/explorations/{topic}-{date}.md

Use this format:
- YAML frontmatter: date, query, files_read, stale_if_changed
- ## Primary Findings: answers to the specific question
- ## Incidental Findings: patterns, conventions, architecture, and
  anything surprising you noticed beyond the query scope
- ## Dependency Map: import relationships between files explored

Also update .claude/references/explorations/_index.md with a new entry.
```

**Parent synthesis convention:**
After processing subagent results and forming conclusions, the parent agent writes a synthesis file:

```
Write your analysis to:
  .claude/references/explorations/synthesis/{topic}-{date}.md

Include: key conclusions, decisions made, open questions.
Reference the exploration files this synthesis is based on.
```

**Automation hooks:**

**PostToolUse on Task (subagent return):**
When a Task tool returns (subagent completes), check if the subagent was an Explore type. If so, inject `additionalContext`: "If the exploration produced reusable findings, verify they were written to .claude/references/explorations/. If not, write a synthesis of the key findings now."

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Task",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/post-explore-reminder.sh"
          }
        ]
      }
    ]
  }
}
```

`post-explore-reminder.sh` checks the subagent input for `subagent_type: "Explore"` and returns `additionalContext` reminding CC to persist findings.

**Stop hook (prompt type) for parent synthesis:**
After CC processes exploration results and writes analysis to terminal, a lightweight prompt hook checks: "Did this turn involve significant exploration or analysis? If so, check if a synthesis file was written to .claude/references/explorations/synthesis/. If not, suggest writing one."

**CLAUDE.md integration:**
```markdown
## Exploration Persistence
Before exploring the codebase, check @.claude/references/explorations/_index.md
for recent, non-stale explorations of the same area. After exploring, persist
findings per the exploration file format. Syntheses of multiple explorations
go in the synthesis/ subdirectory.
```

**Token savings model:**
A typical exploration costs ~70K input tokens (subagent reads) + ~3K output tokens (summary). If the same area is explored again next session, reading the persisted file costs ~2K tokens. Over a multi-session project with 5+ sessions touching the same codebase areas, this saves 300K+ tokens — roughly 4x the cost of a single exploration.

### 1.2 Create `docs/architecture/workflow-presets.md`

Configurable layer — defines what kind of project you're doing.

**Structure:**
- Workflow/stack separation model (explains the two orthogonal dimensions)
- Composition model: `platform + workflow + stack → scaffold`
- Hook activation matrix (which hooks are on/off per preset)

**4 workflow presets, each with:**
- Phases (numbered, with actors and outputs)
- Workflow-specific slash commands (names, purpose, which phase)
- Directory structure additions under `docs/`
- CLAUDE.md workflow section content
- Workflow-specific hook configuration (e.g., learning disables test loop)

| Preset | Phases | Key Commands | Signature Hook Config |
|--------|--------|-------------|----------------------|
| `research` | Capture → Setup → Research → Plan → Build → Handover → Complete | `/research-setup`, `/tdd-plan` | Full TDD automation |
| `feature` | Intake → Explore → Plan → Build → Review → Handover | `/scope`, `/implementation-plan`, `/pre-review` | Full TDD automation |
| `greenfield` | Define → Architect → Plan → Build → Deploy → Handover | `/architect`, `/build-plan`, `/deploy-check` | Full TDD automation |
| `learning` | Goal → Explore → Capture → Handover | `/capture-learnings` | No test loop, no typecheck, no auto-deps |

**Stack configurations section:**
- `typescript-react`: formatter (prettier), linter (eslint), type checker (tsc), test runner (jest/vitest), .gitignore, devcontainer features
- `typescript-node`: same tools, different .gitignore (no .next/, out/)
- `python`: formatter (black/ruff), linter (ruff), type checker (mypy), test runner (pytest), .gitignore (\_\_pycache\_\_/, .venv/)
- `rust`: formatter (rustfmt), linter (clippy), type checker (compiler), test runner (cargo test)
- `custom`: minimal — no stack-specific tooling, user configures via `/project-setup`

Each stack config defines the concrete values that platform hooks read:
```
TEST_RUNNER_CMD, TEST_REPORT_FORMAT, TYPE_CHECK_CMD, FORMAT_CMD, LINT_CMD
```

### 1.3 Create `docs/architecture/flowforge-integration.md`

FlowForge's role and the mobile → CC web flow.

**Contents:**
- FlowForge's role: scaffolder today, project command center tomorrow
- Repo-as-operating-environment concept
- Template composition system (how platform + workflow + stack merge into `FileToCreate[]`)
- CLAUDE.md assembly (section-based, sources: platform/workflow/stack)
- `.claude/settings.json` merge (hook wiring per workflow preset)
- `.devcontainer/` composition (base + stack features)
- `.gitignore` merge (platform base + stack-specific)
- Mobile UX flow (workflow → stack → form → create — described but not built yet)
- Mobile → CC web deep link flow
- Phase 2 dashboard vision (reading project state from GitHub API)
- Success screen next-steps per workflow
- Implementation sequence (sprints)
- Open questions (§15 from current doc, plus new ones about CC web hook maturity)

### 1.4 Archive the original

Move `research-workflow-system-design-v2.md` to `docs/architecture/archive/research-workflow-system-design-v2.md`. Create a `docs/architecture/README.md` that links the 3 new documents.

---

## Part 2: FlowForge Data Model Refactor

Refactor types, template system, and store in the mobile app. No new screens.

### 2.1 New types — `lib/types.ts` (new file)

Extract and expand types from `lib/github.ts`:

```typescript
export type WorkflowPreset = 'research' | 'feature' | 'greenfield' | 'learning';
export type StackPreset = 'typescript-react' | 'typescript-node' | 'python' | 'rust' | 'custom';

export interface CreateRepoOptions {
  name: string;
  description?: string;
  isPrivate: boolean;
  workflow: WorkflowPreset;
  stack: StackPreset;
}

export interface CreateRepoResult {
  success: boolean;
  repo?: CreatedRepo;
  error?: string;
  partialRepo?: string;
}

export interface CreatedRepo {
  full_name: string;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  workflow: WorkflowPreset;
  stack: StackPreset;
  createdAt: string;
}

export interface FileToCreate {
  path: string;
  content: string;
}

// Metadata for UI (workflow selection screen, future use)
export interface WorkflowMeta {
  id: WorkflowPreset;
  title: string;
  description: string;
  icon: string;
}

export interface StackMeta {
  id: StackPreset;
  title: string;
  description: string;
  icon: string;
}
```

**Remove from `lib/github.ts`:** `ProjectTemplate`, `CreateRepoOptions`, `CreateRepoResult`, `FileToCreate` — import from `lib/types.ts` instead.

### 2.2 Template composition — `lib/templates/` (new directory)

Split the monolithic template functions into a composable system:

**`lib/templates/platform.ts`** — returns files every project gets:
- `.claude/references/_index.md` (skeleton with explorations section)
- `.claude/references/error-corrections/_index.md` (skeleton)
- `.claude/references/explorations/_index.md` (empty exploration index)
- `.claude/references/explorations/synthesis/.gitkeep`
- `docs/handover/.gitkeep`
- `.claude/commands/session-handover.md` (placeholder content)
- `.claude/commands/remap.md` (placeholder content)
- `.claude/commands/stack-check.md` (placeholder content)
- Platform portion of CLAUDE.md (returned as `ClaudeMdSection[]`, not a raw string — see 2.3)
  - Includes "Exploration Persistence" section pointing to explorations index
- Platform portion of `.gitignore` (IDE, OS, logs, .env)

**`lib/templates/workflows/research.ts`** (+ feature.ts, greenfield.ts, learning.ts):
Each exports: `getWorkflowFiles(name, description): FileToCreate[]` and `getWorkflowClaudeMdSections(): ClaudeMdSection[]`

`research.ts` returns:
- `docs/research-notes/.gitkeep`
- `docs/research-output/.gitkeep`
- `docs/stack-recommendation.md` (placeholder)
- `docs/implementation-plan.md` (placeholder)
- `.claude/commands/research-setup.md`
- `.claude/commands/tdd-plan.md`
- CLAUDE.md sections: workflow phases, TDD rules, handover triggers

`feature.ts` returns:
- `docs/spec.md` (placeholder)
- `docs/implementation-plan.md` (placeholder)
- `.claude/commands/scope.md`
- `.claude/commands/implementation-plan.md`
- `.claude/commands/pre-review.md`
- CLAUDE.md sections: feature dev workflow, PR prep

`greenfield.ts` returns:
- `docs/brief.md` (placeholder)
- `docs/architecture.md` (placeholder)
- `docs/build-plan.md` (placeholder)
- `.claude/commands/architect.md`
- `.claude/commands/build-plan.md`
- `.claude/commands/deploy-check.md`
- CLAUDE.md sections: greenfield workflow, architecture-first approach

`learning.ts` returns:
- `docs/goal.md` (placeholder)
- `docs/learnings.md` (placeholder)
- `docs/experiments/.gitkeep`
- `.claude/commands/capture-learnings.md`
- CLAUDE.md sections: exploration workflow, lightweight process

**`lib/templates/stacks/typescript-react.ts`** (+ typescript-node.ts, python.ts, rust.ts, custom.ts):
Each exports: `getStackFiles(name): FileToCreate[]`, `getStackClaudeMdSections(): ClaudeMdSection[]`, `getStackGitignore(): string`

`typescript-react.ts` returns:
- README.md with React/web getting-started
- `.gitignore` additions: `.next/`, `out/`, `build/`, `dist/`
- CLAUDE.md sections: tech stack (React/TS), build commands (`npm run dev`), project structure

`python.ts` returns:
- README.md with Python getting-started
- `.gitignore` additions: `__pycache__/`, `.venv/`, `*.pyc`, `.mypy_cache/`
- CLAUDE.md sections: tech stack (Python), build commands (`py -m pytest`), project structure

`custom.ts` returns:
- Minimal README.md
- Minimal .gitignore (just platform base)
- CLAUDE.md section: "Tech stack to be configured"

**`lib/templates/compose.ts`** — the orchestrator:

```typescript
export function composeTemplate(
  workflow: WorkflowPreset,
  stack: StackPreset,
  name: string,
  description?: string
): FileToCreate[]
```

1. Calls `getPlatformFiles()`
2. Calls the matching workflow's `getWorkflowFiles()`
3. Calls the matching stack's `getStackFiles()`
4. Assembles CLAUDE.md from all three sources' `ClaudeMdSection[]`
5. Merges `.gitignore` (platform base + stack additions, deduplicated)
6. Returns combined `FileToCreate[]` (deduped by path — later sources win for conflicts like README.md)

### 2.3 CLAUDE.md assembly — `lib/templates/claude-md.ts` (new file)

```typescript
export interface ClaudeMdSection {
  heading: string;      // e.g., "## Workflow"
  content: string;
  order: number;        // determines position in assembled file
  source: 'platform' | 'workflow' | 'stack';
}

export function assembleClaudeMd(
  name: string,
  description: string,
  sections: ClaudeMdSection[]
): string
```

Sorts sections by `order`, concatenates with headings. Produces a clean CLAUDE.md with consistent structure regardless of which workflow + stack combination.

Section ordering:
1. Project header (platform, order: 0)
2. Tech Stack (stack, order: 10)
3. Getting Started (stack, order: 20)
4. Workflow (workflow, order: 30)
5. Project Structure (stack, order: 40)
6. Development Guidelines (platform, order: 50)
7. References (platform, order: 60) — `@.claude/references/_index.md`, error patterns
8. Handover & Session Rules (platform, order: 70)

### 2.4 Update `lib/github.ts`

- Remove `ProjectTemplate` type, `getWebAppTemplate`, `getCliToolTemplate`, `getTemplateFiles`
- Import `CreateRepoOptions`, `CreateRepoResult`, `FileToCreate`, `CreatedRepo` from `lib/types.ts`
- Import `composeTemplate` from `lib/templates/compose.ts`
- Update `createRepository()`: call `composeTemplate(options.workflow, options.stack, name, description)` instead of `getTemplateFiles()`
- Update `CreateRepoResult.repo` to include `workflow`, `stack`, `createdAt`
- Keep `deleteRepository`, `isValidRepoName` unchanged

### 2.5 Update `stores/store.ts`

- Import `CreatedRepo` from `lib/types.ts` (instead of inline interface)
- The `CreatedRepo` interface now includes `workflow`, `stack`, `createdAt`
- Add `recentRepos: CreatedRepo[]` to state (foundation for future dashboard)
- Add `addRecentRepo(repo: CreatedRepo)` action
- `setLastCreatedRepo` also calls `addRecentRepo`

### 2.6 Backward-compatible screen updates

The screens (`create.tsx`, `create/[type].tsx`, `success.tsx`) still need to work after the data model change. Since we're not building new screens, make minimal compatibility updates:

**`create.tsx`:** Update `TemplateOption` to use `WorkflowPreset` instead of `ProjectTemplate`. Keep the same 2-card UI but change IDs to workflows:
- `'web-app'` → remap to `{ workflow: 'greenfield', stack: 'typescript-react' }`
- `'cli-tool'` → remap to `{ workflow: 'greenfield', stack: 'typescript-node' }`
- Keep "coming soon" placeholder — update text to mention Research, Feature, Learning workflows

**`create/[type].tsx`:** Update the URL param parsing. The `type` param now encodes both workflow and stack (e.g., `greenfield--typescript-react`). Parse it and pass to `createRepository()`.

**`success.tsx`:** No changes needed — it reads from `lastCreatedRepo` which just gained optional fields.

### 2.7 Update tests — `__tests__/github.test.ts`

- Replace `getWebAppTemplate` / `getCliToolTemplate` imports with `composeTemplate` from `lib/templates/compose.ts`
- Test that `composeTemplate('greenfield', 'typescript-react', ...)` produces files containing CLAUDE.md, README.md, .gitignore, and `.claude/` directory files
- Test that `composeTemplate('research', 'python', ...)` includes `docs/research-notes/`, `/research-setup` command
- Test that `composeTemplate('learning', 'custom', ...)` does NOT include TDD-related commands
- Test CLAUDE.md assembly: verify section ordering, no duplicate headings
- Test .gitignore merge: platform base + stack-specific, no duplicate lines
- Keep `isValidRepoName` tests unchanged

---

## File Manifest

### New files
| File | Purpose |
|------|---------|
| `docs/architecture/README.md` | Links the 3 architecture docs |
| `docs/architecture/platform-architecture.md` | Universal platform layer (includes exploration persistence) |
| `docs/architecture/workflow-presets.md` | 4 workflow presets + 5 stack configs |
| `docs/architecture/flowforge-integration.md` | FlowForge composition model + mobile vision |
| `flowforge-mobile/lib/types.ts` | Shared types (WorkflowPreset, StackPreset, etc.) |
| `flowforge-mobile/lib/templates/platform.ts` | Platform files generator (includes explorations/ skeleton) |
| `flowforge-mobile/lib/templates/compose.ts` | Template composition orchestrator |
| `flowforge-mobile/lib/templates/claude-md.ts` | CLAUDE.md section assembly |
| `flowforge-mobile/lib/templates/workflows/research.ts` | Research workflow files |
| `flowforge-mobile/lib/templates/workflows/feature.ts` | Feature dev workflow files |
| `flowforge-mobile/lib/templates/workflows/greenfield.ts` | Greenfield workflow files |
| `flowforge-mobile/lib/templates/workflows/learning.ts` | Learning workflow files |
| `flowforge-mobile/lib/templates/stacks/typescript-react.ts` | TS+React stack config |
| `flowforge-mobile/lib/templates/stacks/typescript-node.ts` | TS+Node stack config |
| `flowforge-mobile/lib/templates/stacks/python.ts` | Python stack config |
| `flowforge-mobile/lib/templates/stacks/rust.ts` | Rust stack config |
| `flowforge-mobile/lib/templates/stacks/custom.ts` | Minimal/custom stack config |

### Modified files
| File | Changes |
|------|---------|
| `flowforge-mobile/lib/github.ts` | Remove template functions, use `composeTemplate()` |
| `flowforge-mobile/stores/store.ts` | Import shared types, add `recentRepos` |
| `flowforge-mobile/app/(app)/create.tsx` | Use `WorkflowPreset` type, remap IDs |
| `flowforge-mobile/app/(app)/create/[type].tsx` | Parse workflow+stack from param |
| `flowforge-mobile/__tests__/github.test.ts` | Test composition system |

### Moved files
| From | To |
|------|-----|
| `research-workflow-system-design-v2.md` | `docs/architecture/archive/research-workflow-system-design-v2.md` |

---

## Verification

1. **Tests pass:** `cd flowforge-mobile && npm test` — all template composition tests pass
2. **Type check:** `cd flowforge-mobile && npm run typecheck` — no type errors
3. **Lint:** `cd flowforge-mobile && npm run lint` — clean
4. **Manual spot-check:** Read the output of `composeTemplate('research', 'python', 'test-project', 'Test')` and verify:
   - CLAUDE.md has sections in correct order (header → stack → getting started → workflow → structure → guidelines → references → handover)
   - CLAUDE.md includes "Exploration Persistence" section pointing to explorations index
   - `.gitignore` has both platform (IDE, OS) and Python-specific (`__pycache__/`, `.venv/`) entries
   - `docs/research-notes/.gitkeep` exists
   - `.claude/commands/research-setup.md` exists
   - `.claude/commands/session-handover.md` exists (universal)
   - `.claude/references/explorations/_index.md` exists (exploration persistence skeleton)
   - `.claude/references/explorations/synthesis/.gitkeep` exists
5. **Composition matrix:** Test at least `research+python`, `feature+typescript-node`, `greenfield+typescript-react`, `learning+custom` to verify all combinations produce valid file sets
6. **Design docs review:** Read all 3 new architecture docs end-to-end, verify:
   - No content lost from original design doc
   - Cross-references between docs are correct
   - Exploration persistence section is complete with file formats, hook specs, CLAUDE.md integration, and token savings model
   - Platform-architecture.md includes PostToolUse(Task) hook spec for exploration reminder

## Execution Order

1. Design docs first (Part 1 including 1.1a) — establishes the conceptual model and exploration persistence design
2. Types file (2.1) — foundation for everything else
3. Template modules (2.2, 2.3) — the composition system, including explorations/ skeleton in platform.ts
4. github.ts update (2.4) — wire composition into repo creation
5. Store update (2.5)
6. Screen compatibility (2.6)
7. Tests (2.7)
