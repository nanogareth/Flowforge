# Plan: Obsidian Vault → Claude Code Flow

## Context

After GitHub auth, FlowForge currently lands back on the landing page with a link to Log in to github using OAuth; but Github is already logged in. I want to pick a markdown file from an Obsidian vault → auto-derive repo name from filename + workflow/stack from YAML frontmatter → create repo with the file as committed context → enable the Claude Code GitHub App on the repo → open claude.ai/code in browser for the user to run `/init`.

## New Flow

```
Auth → Home (redesigned) → "Import from Obsidian" → System file picker (.md)
  → Review/confirm (editable repo name, inferred workflow/stack, private toggle)
  → Create repo (template + context file) → Enable Claude Code App → Success screen
  → "Open Claude Code" button → claude.ai/code in browser
```

The existing manual create flow is preserved as a secondary "Create manually" option.

## Implementation Steps

### Phase 1: Library code (no deps needed)

**1. Create `flowforge-mobile/lib/frontmatter.ts`**

- `parseFrontmatter(content)` — regex-based YAML frontmatter parser
  - Extracts `workflow`, `stack`, `private`, `description` from `---` blocks
  - Defaults: `greenfield` / `custom` / `true` / `''` when absent or invalid
  - Returns `{ frontmatter, body, rawContent }`
- `filenameToRepoName(filename)` — strip `.md`, lowercase, spaces→hyphens, remove invalid chars

**2. Create `flowforge-mobile/__tests__/frontmatter.test.ts`**

- Full coverage: no frontmatter, partial, invalid values, quoted strings, CRLF, edge cases

**3. Extend `flowforge-mobile/lib/types.ts`**

- Add `PickedFile` interface
- Add `contextFile?: { filename, content }` to `CreateRepoOptions`
- Add `id?: number` to `CreatedRepo` (GitHub repo ID for installation API)

### Phase 2: Install dependencies

**4. Install Expo packages** (from `flowforge-mobile/`)

```
npx expo install expo-document-picker expo-file-system
```

### Phase 3: GitHub API extensions

**5. Create `flowforge-mobile/lib/claude-code-app.ts`**

- `findClaudeCodeInstallation(token)` — `GET /user/installations`, filter by `app_slug === 'claude'`
- `enableClaudeCodeForRepo(token, installationId, repoId)` — `PUT /user/installations/{id}/repositories/{id}`
- `setupClaudeCode(token, repoId)` — combined find + enable, returns structured result
- Handle not-installed (direct to `github.com/apps/claude`), 404, network errors

**6. Create `flowforge-mobile/__tests__/claude-code-app.test.ts`**

- Mock Octokit, test find/enable/combined flows

**7. Modify `flowforge-mobile/lib/github.ts`**

- Accept optional `contextFile` in `createRepository` options
- If present, append `{ path: 'context/<filename>.md', content }` to files array
- Capture and return `repo.id` in the result (needed for installation API)

### Phase 4: Template context section

**8. Modify `flowforge-mobile/lib/templates/compose.ts`**

- Add `composeTemplateWithContext(workflow, stack, name, description?, contextFilename?)` wrapper
- Appends a `## Project Context` section to CLAUDE.md referencing `@context/<filename>`
- Or: inject context reference post-hoc in `github.ts` (simpler, avoids changing compose signature)

Decision: Post-hoc approach in `github.ts` — append context CLAUDE.md section after `composeTemplate()` returns, keeping the template system untouched.

### Phase 5: State management

**9. Modify `flowforge-mobile/stores/store.ts`**

- Add `claudeCodeEnabled: boolean`, `claudeCodeError: string | null`
- Add `setClaudeCodeState()` action
- Add `resetCreationState()` action (clears repo + claude code state)

### Phase 6: UI screens

**10. Modify `flowforge-mobile/app/(app)/_layout.tsx`**

- Register `pick` screen in Stack navigator

**11. Create `flowforge-mobile/app/(app)/pick.tsx`** — Main new screen

- State machine: `idle` → `picked` → `creating` → success/error
- Idle: large "Pick a Markdown File" button → opens `DocumentPicker.getDocumentAsync({ type: ['text/markdown', 'text/plain'], copyToCacheDirectory: true })`
- Picked: shows file name, inferred settings, editable repo name, private toggle, description
- Creating: spinner with status text
- On create: calls `createRepository` → `setupClaudeCode` (non-blocking) → navigate to success
- File size guard: reject >500KB files
- MIME types: accept `text/markdown`, `text/plain`, `application/octet-stream` + validate `.md` extension

**12. Modify `flowforge-mobile/app/(app)/index.tsx`** — Redesigned home

- Primary card: "Import from Obsidian" → pushes to `/(app)/pick`
- Secondary link: "Create manually" → pushes to `/(app)/create` (existing flow preserved)
- Keep header (user avatar, welcome) and sign out footer

**13. Modify `flowforge-mobile/app/(app)/success.tsx`** — Enhanced success

- Add Claude Code status section (enabled ✓ / error + install link)
- Add "Open Claude Code" primary button → `WebBrowser.openBrowserAsync('https://claude.ai/code')`
- Updated Quick Start: "1. Open Claude Code 2. Select repo 3. Run /init 4. Start building!"
- Keep clone/SSH URLs as secondary info

## Key Design Decisions

1. **System file picker over custom vault browser** — `expo-document-picker` is cross-platform, no vault path setup needed. Users navigate to their Obsidian vault in the system Files/file manager app. Custom vault browser can be a future enhancement.

2. **Claude Code enablement is non-blocking** — Repo creation always completes first. If Claude Code app setup fails (not installed, API error), the success screen shows appropriate status + manual install link. The user still gets their repo.

3. **Regex frontmatter parser over js-yaml** — Avoids a dependency for simple key-value parsing. Unknown/invalid keys are silently ignored with sensible defaults.

4. **Context file at `context/<filename>.md`** — Committed into the repo. CLAUDE.md gets a `## Project Context` section with `@context/<filename>` reference so Claude Code reads it automatically.

5. **`expo-file-system` with `copyToCacheDirectory: true`** — Avoids Android `content://` URI issues. Fallback to legacy `FileSystem.readAsStringAsync()` if new `File` API has issues.

## Files Summary

| Action  | File                                                                                   |
| ------- | -------------------------------------------------------------------------------------- |
| Create  | `lib/frontmatter.ts`                                                                   |
| Create  | `lib/claude-code-app.ts`                                                               |
| Create  | `app/(app)/pick.tsx`                                                                   |
| Create  | `__tests__/frontmatter.test.ts`                                                        |
| Create  | `__tests__/claude-code-app.test.ts`                                                    |
| Modify  | `lib/types.ts` — add PickedFile, contextFile, repo id                                  |
| Modify  | `lib/github.ts` — accept contextFile, return repo.id, inject CLAUDE.md context section |
| Modify  | `stores/store.ts` — add Claude Code state                                              |
| Modify  | `app/(app)/_layout.tsx` — register pick screen                                         |
| Modify  | `app/(app)/index.tsx` — redesign with two paths                                        |
| Modify  | `app/(app)/success.tsx` — Claude Code button + status                                  |
| Install | `expo-document-picker`, `expo-file-system`                                             |

## Verification

1. `npm test` — all existing + new tests pass
2. `npm run typecheck` — no TypeScript errors
3. Manual test on iOS simulator: auth → pick → file from Files → confirm → create → success → open Claude Code
4. Manual test on Android emulator: same flow with Obsidian vault folder
5. Verify manual create flow still works via "Create manually" path
6. Verify Claude Code enablement when app is installed vs. not installed
7. Verify context file appears in repo at `context/<filename>.md`
8. Verify CLAUDE.md contains `## Project Context` section
