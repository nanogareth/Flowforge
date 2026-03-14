# FlowForge

A mobile companion for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) that creates GitHub repositories pre-configured with CLAUDE.md templates and provides remote terminal access to your development machine.

## What It Does

1. **Bootstrap repos for Claude Code** — Pick a workflow (research, feature dev, greenfield, learning) and a tech stack, and FlowForge creates a GitHub repo with a tailored CLAUDE.md, hook scripts, devcontainer config, and project scaffolding.

2. **Remote terminal access** — Pair your phone with a self-hosted server on your dev machine. Clone repos, browse projects, and open full interactive terminal sessions from anywhere — including launching Claude Code remotely.

3. **Auto-init** — After creating a repo, FlowForge can clone it to your server and automatically run `claude` with `/init` to set up the project in one tap.

## Architecture

Three packages, each independently deployable:

```
flowforge-mobile/     React Native (Expo) mobile app
flowforge-api/        Vercel serverless backend (GitHub OAuth token exchange)
flowforge-server/     Self-hosted Node.js server (terminal, cloning, project browsing)
```

**Auth flow:** Mobile app → GitHub OAuth → auth code sent to `flowforge-api` → backend exchanges for access token using client secret → token stored on device via expo-secure-store.

**Repo creation flow:** Creates empty GitHub repo → generates template files from workflow + stack selection → creates git tree via GitHub API → pushes initial commit.

**Remote terminal flow:** Mobile pairs with server via 6-digit code → receives JWT → WebSocket terminal sessions via node-pty + xterm.js in a WebView.

## Getting Started

### Prerequisites

- Node.js 18+
- A [GitHub OAuth App](https://github.com/settings/developers) (for the mobile app's login flow)
- Git (for the terminal server's clone feature)

### Mobile App

```bash
cd flowforge-mobile
npm install
cp .env.example .env   # Fill in your GitHub OAuth client ID and token endpoint
npm start              # Expo dev server
```

### OAuth Backend

The token exchange backend runs on Vercel. You need the GitHub OAuth App's client ID and secret set as environment variables.

```bash
cd flowforge-api
npm install
# Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in Vercel env or local .env
npm run dev            # Local dev via vercel dev
```

### Terminal Server

See [`flowforge-server/README.md`](flowforge-server/README.md) for full documentation including API reference, security model, and configuration.

```bash
cd flowforge-server
npm install
npm run dev            # Starts on port 7433, displays pairing code
```

The server requires a C/C++ toolchain for `node-pty` — see the [server README](flowforge-server/README.md#prerequisites) for platform-specific instructions.

## Template System

FlowForge generates project scaffolding through a three-layer composition:

- **Platform** — Universal Claude Code files: hook scripts, slash commands, reference library skeleton
- **Workflow** — 4 presets (research, feature, greenfield, learning) with phase-specific docs and CLAUDE.md sections
- **Stack** — 5 configs (TypeScript/React, TypeScript/Node, Python, Rust, custom) with appropriate tooling, gitignore, and config files

Templates are defined in `flowforge-mobile/lib/templates/` and composed at repo creation time.

## Running Tests

```bash
# Mobile app tests
cd flowforge-mobile && npm test

# Terminal server tests
cd flowforge-server && npm test
```

## License

[MIT](LICENSE)
