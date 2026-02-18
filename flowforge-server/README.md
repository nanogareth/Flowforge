# FlowForge Terminal Server

A self-hosted server that lets the FlowForge mobile app clone repositories and open interactive terminal sessions on your development machine.

## Features

- **Pairing** — Secure 6-digit code displayed on startup; pairs once, stays connected
- **Git clone** — Clone repos from mobile with real-time NDJSON progress streaming
- **Auto-init** — Optionally launches Claude Code after cloning and runs `/init` automatically
- **Terminal** — Full xterm.js terminal via WebSocket (node-pty), supports reconnection with session IDs
- **Project browsing** — List cloned repos with CLAUDE.md detection, launch Claude in any project
- **Tailscale discovery** — Exposes Tailscale IP/hostname so the mobile app can auto-discover and failover to your VPN address
- **Session management** — Up to 5 concurrent sessions, 50KB scrollback, 30-min inactivity GC

## Prerequisites

- Node.js 18+
- Git (for cloning repos)
- A C/C++ toolchain for `node-pty` (see [node-pty requirements](https://github.com/nicokosi/node-pty#dependencies))
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux**: `build-essential` and `python3` (`sudo apt install build-essential python3`)
  - **Windows**: Visual Studio Build Tools with "Desktop development with C++"

## Quick Start

```bash
# Install dependencies
cd flowforge-server
npm install

# Start in development mode (auto-restart on changes)
npm run dev

# Or build and run for production
npm run build
npm start
```

On startup you'll see:

```
╔══════════════════════════════════════╗
║   FlowForge Terminal Server          ║
║   Pairing Code: 847291               ║
║   Port: 7433                         ║
╚══════════════════════════════════════╝
```

## Pairing with Mobile

1. Start the server — note the 6-digit pairing code
2. Open FlowForge on your phone
3. Go to **Terminal** → **Connect to Server**
4. Enter your Tailscale hostname (e.g. `my-pc`) and tap **Discover**, or enter the server URL manually (e.g. `http://192.168.1.100:7433`)
5. Enter the pairing code

The mobile app receives a JWT token that's valid for 365 days. You only need to pair once.

If Tailscale is installed, the app automatically saves both the LAN and Tailscale URLs. When the LAN address becomes unreachable (e.g. you leave home), the app transparently fails over to the Tailscale address.

## Configuration

Create a `.env` file (see `.env.example`):

```env
PORT=7433                   # Server port (default: 7433)
CLONE_DIR=                  # Where repos are cloned (default: C:\GitHub on Windows, ~/GitHub elsewhere)
TAILSCALE_ENABLED=true      # Enable Tailscale discovery endpoint
TAILSCALE_HOSTNAME=         # Override Tailscale hostname (auto-detected if blank)
```

Other settings are in `src/config.ts`:

| Setting             | Default                               | Description                      |
| ------------------- | ------------------------------------- | -------------------------------- |
| `port`              | 7433                                  | HTTP/WebSocket port              |
| `jwtExpiry`         | 365 days                              | Token lifetime                   |
| `maxSessions`       | 5                                     | Max concurrent terminal sessions |
| `scrollbackSize`    | 50 KB                                 | Per-session scrollback buffer    |
| `inactivityTimeout` | 30 min                                | Idle session garbage collection  |
| `cloneDir`          | `C:\GitHub` (Win) / `~/GitHub` (Unix) | Where repos are cloned           |
| `pairingExpiry`     | 10 min                                | Pairing code validity window     |
| `pairingRateLimit`  | 5/min                                 | Max pairing attempts per minute  |
| `tailscaleEnabled`  | false                                 | Enable Tailscale discovery       |
| `tailscaleHostname` | auto-detected                         | Override Tailscale hostname      |

## API Reference

### `GET /health`

Health check. Returns server status, session count, uptime, and Tailscale IP (if available).

```json
{
  "status": "ok",
  "sessions": 2,
  "paired": true,
  "uptime": 3600,
  "tailscaleIp": "100.64.1.2"
}
```

### `GET /api/tailscale`

Tailscale discovery (unauthenticated — used before pairing). Returns Tailscale status so the mobile app can auto-fill the server URL.

```json
{
  "available": true,
  "ip": "100.64.1.2",
  "hostname": "my-pc",
  "serverPort": 7433
}
```

Returns `{ "available": false }` if Tailscale is not installed or not running.

### `POST /api/pair`

Exchange a pairing code for a JWT token.

**Body:** `{ "code": "847291" }`
**Response:** `{ "token": "eyJ..." }`
**Errors:** 400 (missing code), 401 (invalid/expired), 429 (rate limited)

### `POST /api/clone` (authenticated)

Clone a git repository with streaming progress.

**Headers:** `Authorization: Bearer <token>`
**Body:** `{ "cloneUrl": "https://github.com/user/repo.git", "launchClaude": true, "runInit": true }`
**Response:** NDJSON stream:

```
{"type":"progress","message":"Cloning https://... into /home/user/GitHub/repo..."}
{"type":"progress","message":"Receiving objects: 100%"}
{"type":"progress","message":"Launching Claude..."}
{"type":"progress","message":"Running /init..."}
{"type":"done","sessionId":"abc-123"}
```

If `launchClaude` is true, a terminal session is created with `claude` as the initial command. If `runInit` is also true, the server waits for Claude to load and automatically sends `/init` to configure the project. The `sessionId` in the response can be used to connect via WebSocket.

### `GET /api/projects` (authenticated)

List cloned git repositories.

**Headers:** `Authorization: Bearer <token>`
**Response:**

```json
{
  "cloneDir": "/home/user/GitHub",
  "projects": [
    {
      "name": "my-app",
      "path": "my-app",
      "hasClaudeMd": true,
      "lastModified": "2026-02-17T12:00:00Z"
    },
    {
      "name": "another-repo",
      "path": "another-repo",
      "hasClaudeMd": false,
      "lastModified": "2026-02-16T08:30:00Z"
    }
  ]
}
```

Projects are sorted by `lastModified` descending. `hasClaudeMd` indicates whether the project has a `CLAUDE.md` file.

### `WebSocket /terminal` (authenticated)

Open a new terminal session.

**URL:** `ws://host:7433/terminal?token=<jwt>`
**Optional params:** `cwd` (working directory, must be within `cloneDir`), `cmd` (initial command, e.g. `claude`)

On connection, the server sends a `session` message with the session ID:

```json
{ "type": "session", "id": "abc-123" }
```

### `WebSocket /terminal/:id` (authenticated)

Reconnect to an existing terminal session (scrollback is replayed).

**URL:** `ws://host:7433/terminal/abc-123?token=<jwt>`

#### Client → Server messages

| Type     | Fields               | Description         |
| -------- | -------------------- | ------------------- |
| `input`  | `data: string`       | Terminal keystrokes |
| `resize` | `cols, rows: number` | Terminal resize     |
| `ping`   | —                    | Keepalive           |

#### Server → Client messages

| Type         | Fields            | Description                               |
| ------------ | ----------------- | ----------------------------------------- |
| `session`    | `id: string`      | Session ID (sent on new session creation) |
| `output`     | `data: string`    | Terminal output                           |
| `scrollback` | `data: string`    | Replay buffer (sent on reconnect)         |
| `exit`       | `code: number`    | Process exited                            |
| `pong`       | —                 | Keepalive response                        |
| `error`      | `message: string` | Error message                             |

## Security

- **JWT authentication** — All API and WebSocket endpoints (except `/health`, `/api/pair`, and `/api/tailscale`) require a valid Bearer token
- **One-time pairing code** — Code is invalidated after successful use; rate-limited to 5 attempts/minute
- **Auto-generated secret** — JWT signing key is created on first run and stored in `~/.flowforge-server/secret.key` with restricted permissions (0600 on Unix)
- **Path validation** — WebSocket `cwd` parameter is validated to be within `cloneDir`, preventing path traversal attacks
- **Tailscale-friendly** — The `/api/tailscale` endpoint is unauthenticated by design (used during initial pairing). It only exposes the machine's Tailscale IP and hostname — no secrets. For remote access, use Tailscale rather than exposing the server directly to the internet.

## Running Tests

```bash
npm test
```

## Project Structure

```
src/
├── index.ts                    # Express + WebSocket server setup
├── config.ts                   # Environment and defaults
├── types.ts                    # Shared TypeScript types
├── auth/
│   ├── jwt.ts                  # JWT sign/verify with auto-generated secret
│   ├── middleware.ts           # Express auth middleware
│   └── pairing.ts             # 6-digit pairing code generation/validation
├── routes/
│   ├── health.ts              # GET /health (includes Tailscale IP)
│   ├── pair.ts                # POST /api/pair (rate-limited)
│   ├── clone.ts               # POST /api/clone (NDJSON streaming, auto /init)
│   ├── projects.ts            # GET /api/projects (list cloned repos)
│   └── tailscale.ts           # GET /api/tailscale (discovery endpoint)
└── terminal/
    ├── session-manager.ts     # Session lifecycle, scrollback, GC
    └── ws-handler.ts          # WebSocket routing, cwd/cmd params, path validation
```
