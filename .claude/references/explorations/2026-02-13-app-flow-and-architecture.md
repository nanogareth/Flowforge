# FlowForge App Flow & Architecture

**Date:** 2026-02-13
**Scope:** Full mobile app — auth, routing, store, repo creation, template system
**Staleness trigger:** Changes to app/(app)/ routes, stores/store.ts, lib/github.ts, lib/templates/compose.ts

## Findings

### Auth Flow

- OAuth scopes: `['repo', 'read:user']` (lib/auth.ts:22)
- After auth code received → `exchangeCodeForToken()` → `store.login(token)` → `router.replace('/(app)')` (app/login.tsx:16-18)
- Token stored in expo-secure-store, Octokit instance created with token to fetch user data

### Routing Structure

```
app/
├── _layout.tsx          — Root Stack, calls store.initialize()
├── index.tsx            — Auth gate: token → /(app), no token → /login
├── login.tsx            — GitHub OAuth screen
└── (app)/
    ├── _layout.tsx      — Auth guard layout (redirects to /login if no token)
    ├── index.tsx         — Home: "Welcome back" + "+ New Project" button
    ├── create.tsx        — Template selection grid (workflow--stack combos)
    ├── create/[type].tsx — Form: repo name (zod validated), description, private toggle
    └── success.tsx       — Clone/SSH URLs, "Create Another" / "Back to Home"
```

### Zustand Store (stores/store.ts)

- State: `token`, `user` (login/name/avatar_url), `isLoading`, `error`, `lastCreatedRepo`, `recentRepos`
- Actions: `initialize()`, `login(token)`, `logout()`, `clearError()`, `setLastCreatedRepo()`, `addRecentRepo()`
- No persistence beyond SecureStore for token

### Repo Creation (lib/github.ts)

- `createRepository(token, options: CreateRepoOptions)` → 7 steps:
  1. Rate limit check (500ms min interval)
  2. `octokit.repos.createForAuthenticatedUser()` — creates empty repo
  3. `composeTemplate(workflow, stack, name, description)` → `FileToCreate[]`
  4. Create git blobs (base64 encoded, parallel)
  5. Create tree from blobs
  6. Create commit ("Initial setup via FlowForge")
  7. Create ref (main branch) + set default branch
- Returns `CreateRepoResult` with `repo.full_name`, `html_url`, `clone_url`, `ssh_url`
- Does NOT currently return `repo.id` (GitHub numeric ID)
- Error handling: 422 (name exists), 403 (rate limit), partial failure (repo created, files failed)

### Template Composition (lib/templates/compose.ts)

- `composeTemplate(workflow, stack, name, description?)` → `FileToCreate[]`
- Three-layer: platform (hooks, commands, refs) + workflow (4 presets) + stack (5 presets)
- Assembles CLAUDE.md from sorted sections, merges .gitignore, builds settings.json, generates devcontainer
- Deduplicates files by path (later sources win)
- No current mechanism for injecting custom/external files

### Types (lib/types.ts)

- `WorkflowPreset`: 'research' | 'feature' | 'greenfield' | 'learning'
- `StackPreset`: 'typescript-react' | 'typescript-node' | 'python' | 'rust' | 'custom'
- `CreateRepoOptions`: { name, description?, isPrivate, workflow, stack }
- `FileToCreate`: { path, content }
- `CreatedRepo`: { full_name, html_url, clone_url, ssh_url, workflow, stack, createdAt }

### Dependencies (package.json)

- Expo SDK 54, expo-router 6, zustand 4, @octokit/rest 20
- expo-auth-session, expo-secure-store, expo-web-browser, expo-clipboard
- nativewind 4, react-hook-form, zod 3
- NOT present: expo-document-picker, expo-file-system

### Deep Linking

- App scheme: "flowforge" (app.json)
- Only used for OAuth redirect currently
- No custom URL handlers or intent filters

## Open Questions

- Does `GET /user/installations` work with OAuth tokens (not GitHub App user access tokens)?
- What is the exact slug for the Claude Code GitHub App? (likely "claude")
- Can claude.ai/code accept URL params to pre-select a repo or pre-fill a prompt?
- How does expo-file-system's new File API behave on SDK 54 with SAF content:// URIs?
