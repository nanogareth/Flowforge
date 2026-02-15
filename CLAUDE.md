# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

FlowForge is a mobile app that creates GitHub repositories pre-configured with CLAUDE.md templates. Three packages:

- **flowforge-mobile/** — React Native (Expo SDK 52) app with Expo Router, Zustand, NativeWind, Octokit
- **flowforge-api/** — Vercel serverless backend for GitHub OAuth token exchange
- **flowforge-server/** — Self-hosted Node.js terminal server (Express, ws, node-pty) for remote repo cloning and Claude Code access via mobile

## Commands

### Mobile App (run from `flowforge-mobile/`)

```
npm start              # Expo dev server
npm test               # Jest tests
npm run test:watch     # Tests in watch mode
npm run lint           # ESLint
npm run typecheck      # TypeScript checking
```

### Backend API (run from `flowforge-api/`)

```
npm run dev            # Local dev (vercel dev)
npm run deploy         # Deploy to production
```

### Terminal Server (run from `flowforge-server/`)

```
npm run dev            # nodemon + ts-node
npm run build          # TypeScript compile
npm start              # Run compiled JS
```

## Architecture

**Auth flow:** Mobile app initiates GitHub OAuth via expo-auth-session → receives auth code → sends to `flowforge-api/api/auth/token.ts` → backend exchanges code for access token using client secret → token stored in expo-secure-store.

**Repo creation flow (`lib/github.ts`):** Creates empty repo → generates template files via `composeTemplate()` → creates git blobs → creates tree → creates commit → creates main branch → sets default branch. On failure, `deleteRepository()` provides cleanup.

**Remote terminal flow (`flowforge-server/`):** Mobile pairs with home server via 6-digit code → receives JWT → stores in SecureStore. Can clone repos via `POST /api/clone` (NDJSON streaming progress) and open interactive terminal via WebSocket (`/terminal`). Terminal uses node-pty with xterm.js in a WebView. Sessions support reconnection (50KB scrollback), multi-client broadcast, and 30-min inactivity GC.

**State:** Single Zustand store (`stores/store.ts`) manages auth state, user info, last created repo, and home server connection state.

**Routing:** Expo Router file-based routing. `app/(app)/` group is auth-guarded. `app/login.tsx` handles unauthenticated state.

**Styling:** NativeWind (Tailwind for RN) with dark theme. Custom colors defined in `tailwind.config.js` — GitHub-inspired palette (primary=#238636, background=#0a0a0a).

**Template composition system (`lib/templates/`):** Three-layer composition: platform + workflow + stack → fully scaffolded CC environment. Orchestrated by `compose.ts`:

- **`platform.ts`** — Universal files: 10 hook scripts (`.claude/hooks/`), slash commands, reference library skeleton, `tests/reports/` directory
- **`settings.ts`** — `buildSettings(workflow, stack)` generates `.claude/settings.json` with hook wiring and per-stack env vars (`TEST_RUNNER_CMD`, `FORMAT_CMD`, `TYPE_CHECK_CMD`, `LINT_CMD`). TDD hooks (stop-test-loop, typecheck, auto-deps, auto-remap) enabled for research/feature/greenfield, disabled for learning.
- **`devcontainer.ts`** — `getDevcontainerFiles(stack, name)` generates `.devcontainer/` with per-stack features (node, python, rust) and post-create tooling
- **`claude-md.ts`** — Section-based CLAUDE.md assembly (sorted by `order`, sources: platform/workflow/stack)
- **`workflows/`** — 4 presets (research, feature, greenfield, learning): phase-specific docs, slash commands, CLAUDE.md sections
- **`stacks/`** — 5 configs (typescript-react, typescript-node, python, rust, custom): README, stack config files (tsconfig.json, pyproject.toml, Cargo.toml), .gitignore additions, CLAUDE.md sections

## Environment Variables

Mobile (`.env`): `EXPO_PUBLIC_GITHUB_CLIENT_ID`, `EXPO_PUBLIC_TOKEN_ENDPOINT`, `EXPO_PUBLIC_SENTRY_DSN`

Backend (Vercel env): `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

Terminal Server (`.env`): `PORT` (default 7433). JWT secret auto-generated to `~/.flowforge-server/secret.key`.
