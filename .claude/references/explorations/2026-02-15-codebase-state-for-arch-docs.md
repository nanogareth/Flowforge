# Codebase State for Architecture Doc Update

**Date:** 2026-02-15
**Scope:** Full codebase — lib/, app/, stores/, templates/, types, backend API
**Staleness trigger:** Changes to lib/github.ts, lib/frontmatter.ts, lib/claude-code-app.ts, stores/store.ts, app/(app)/pick.tsx, app/(app)/success.tsx, lib/templates/compose.ts, lib/templates/settings.ts

## Findings

### New Modules Since Last Arch Doc Update (v3.1, 2026-02-13)

**`lib/frontmatter.ts`** — YAML frontmatter parser for Obsidian import flow

- `parseFrontmatter(content)`: Regex-based YAML block extraction. Defaults: workflow="greenfield", stack="custom", isPrivate=true. Parses: workflow, stack, private, description.
- `filenameToRepoName(filename)`: Converts "My Research.md" → "my-research" (lowercase, hyphens, strip .md, truncate 100 chars, remove invalid chars)
- Validates workflow/stack against known presets; invalid values silently fall back to defaults

**`lib/claude-code-app.ts`** — GitHub App integration

- `setupClaudeCode(token, repoId)`: Orchestrator — finds installation, enables repo, returns status
- `findClaudeCodeInstallation(token)`: Lists user's GitHub App installations, finds "claude" by app_slug
- `enableClaudeCodeForRepo(token, installationId, repoId)`: Adds repo to Claude Code installation
- Install URL: `https://github.com/apps/claude`
- All operations are non-blocking / graceful failure

**`components/CopyableError.tsx`** — Reusable error display with copy-to-clipboard

### Store Changes (`stores/store.ts`)

New state fields:

- `claudeCodeEnabled: boolean` — whether Claude Code App was enabled for last created repo
- `claudeCodeError: string | null` — error from App setup attempt
- `recentRepos: CreatedRepo[]` — foundation for future dashboard (deduped by full_name)

New actions:

- `setClaudeCodeState(enabled, error)` — set App status
- `addRecentRepo(repo)` — prepend to recent repos list
- `resetCreationState()` — clear lastCreatedRepo + Claude Code state (for "Create Another" flow)
- `setLastCreatedRepo(repo)` — also calls addRecentRepo internally

### Type Changes (`lib/types.ts`)

- `CreateRepoOptions.contextFile?: { filename: string; content: string }` — NEW optional field
- `CreatedRepo.id?: number` — NEW optional field (GitHub repo ID for App API)
- `PickedFile` — NEW type: { uri, name, size, content } for document picker results
- `FrontmatterResult` — NEW type: { workflow, stack, isPrivate, description, body, rawContent }
- `WorkflowMeta` — NEW type: { id, title, description, icon } for future UI cards
- `StackMeta` — NEW type: { id, title, description, icon } for future UI cards

### Obsidian Import Flow (`app/(app)/pick.tsx`)

States: idle → picked → creating → error

1. File picker (DocumentPicker, type: text/markdown, max 500KB)
2. Validates .md extension
3. Reads file content via `new File(uri).text()` (Expo SDK 54 File API)
4. Parses frontmatter → extracts workflow/stack/isPrivate/description defaults
5. Auto-derives repo name from filename via `filenameToRepoName()`
6. Shows review screen: inferred settings, editable name/description/privacy
7. Calls `createRepository()` with `contextFile: { filename, content: rawContent }`
8. Calls `setupClaudeCode()` non-blocking
9. Navigates to success screen

### Context File Injection (`lib/github.ts`)

When `options.contextFile` is provided:

- File stored at `context/{filename}` in repo
- CLAUDE.md gets appended section: `## Project Context` with `@context/{filename}` reference
- Injection happens after `composeTemplate()` returns, before blob creation

### Home Screen (`app/(app)/index.tsx`)

Two primary flow buttons:

1. "Import from Obsidian" → `/(app)/pick` (primary, green bg)
2. "Create Manually" → `/(app)/create` (secondary, surface bg)

### Manual Create Flow (unchanged)

`app/(app)/create.tsx` still uses hardcoded templates:

- "Web App" → greenfield--typescript-react
- "CLI Tool" → greenfield--typescript-node
- Comment in code: "More workflows coming soon: Research, Feature, Learning"

### Success Screen (`app/(app)/success.tsx`)

- Shows Claude Code GitHub App status: enabled (green) / not installed (tap to install) / hidden if no status
- Clone command with copy-to-clipboard
- Generic "Quick Start" instructions (Open Claude Code → select repo → run /init → start building)
- Does NOT yet show workflow-specific next-steps (Section 11 of integration doc is still future)
- "Open Claude Code" button → opens https://claude.ai/code
- "Create Another Project" button → resets state, goes to home

### Template Composition (`lib/templates/compose.ts`)

`composeTemplate(workflow, stack, name, description?)` handles everything internally:

- Calls `getPlatformFiles()`, `getWorkflowFiles()`, `getStackFiles()`
- Calls `assembleClaudeMd()` for CLAUDE.md
- Calls `mergeGitignore()` for .gitignore
- Calls `buildSettings(workflow, stack)` for .claude/settings.json
- Calls `getDevcontainerFiles(stack, name)` for .devcontainer/
- Returns deduplicated FileToCreate[]
- Section 8's `handleCreate()` code example in the integration doc is stale — it shows `buildSettings` called separately

### Platform Hooks — Template vs. Global

The template (`platform.ts`) generates 10 hook scripts:

1. block-test-execution.sh (PreToolUse:Bash)
2. protect-files.sh (PreToolUse:Edit|Write)
3. auto-format.sh (PostToolUse:Edit|Write)
4. auto-deps.sh (PostToolUse:Edit|Write, async)
5. auto-remap.sh (PostToolUse:Write, async)
6. post-typecheck.sh (PostToolUse:Edit|Write)
7. session-state.sh (SessionStart)
8. pre-compact-handover.sh (PreCompact:auto)
9. stop-test-loop.sh (Stop, TDD)
10. post-explore-reminder.sh (PostToolUse:Task)

NOT template-generated (from platform-architecture.md):

- RTK auto-wrapper (§5.2) — installed globally via `rtk init --global`
- Context budget monitor (§5.9) — prompt-type Stop hook, not in `buildSettings()` output

### Backend API (unchanged)

- `api/auth/token.ts`: POST, accepts code + redirect_uri + code_verifier (PKCE)
- `api/health.ts`: GET, returns { status: "ok", timestamp }
- No changes since v3.1

## Open Questions

- Should the context budget monitor (prompt-type Stop hook) be added to `buildSettings()` template output?
- The manual create flow still uses hardcoded templates — when will the full workflow/stack selection UI be built?
- `WorkflowMeta` and `StackMeta` types exist but aren't used in any screen yet — they're for the future selection UI
