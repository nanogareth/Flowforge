# FlowForge Terminal Server

A self-hosted server that lets the FlowForge mobile app clone repositories and open interactive terminal sessions on your development machine.

## Features

- **Pairing** — Secure 6-digit code displayed on startup; pairs once, stays connected
- **Git clone** — Clone repos from mobile with real-time NDJSON progress streaming
- **Terminal** — Full xterm.js terminal via WebSocket (node-pty), supports reconnection
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
4. Enter your server's IP address and port (e.g. `http://192.168.1.100:7433`)
5. Enter the pairing code

The mobile app receives a JWT token that's valid for 365 days. You only need to pair once.

> **Tip:** Your phone and server must be on the same network (or reachable via Tailscale/VPN).

## Configuration

Create a `.env` file (see `.env.example`):

```env
PORT=7433           # Server port (default: 7433)
```

Other settings are in `src/config.ts`:

| Setting             | Default      | Description                      |
| ------------------- | ------------ | -------------------------------- |
| `port`              | 7433         | HTTP/WebSocket port              |
| `jwtExpiry`         | 365 days     | Token lifetime                   |
| `maxSessions`       | 5            | Max concurrent terminal sessions |
| `scrollbackSize`    | 50 KB        | Per-session scrollback buffer    |
| `inactivityTimeout` | 30 min       | Idle session garbage collection  |
| `cloneDir`          | `~/projects` | Where repos are cloned           |
| `pairingExpiry`     | 10 min       | Pairing code validity window     |
| `pairingRateLimit`  | 5/min        | Max pairing attempts per minute  |

## API Reference

### `GET /health`

Health check. Returns server status, session count, and uptime.

```json
{ "status": "ok", "sessions": 2, "paired": true, "uptime": 3600 }
```

### `POST /api/pair`

Exchange a pairing code for a JWT token.

**Body:** `{ "code": "847291" }`
**Response:** `{ "token": "eyJ..." }`
**Errors:** 400 (missing code), 401 (invalid/expired), 429 (rate limited)

### `POST /api/clone` (authenticated)

Clone a git repository with streaming progress.

**Headers:** `Authorization: Bearer <token>`
**Body:** `{ "cloneUrl": "https://github.com/user/repo.git", "launchClaude": true }`
**Response:** NDJSON stream:

```
{"type":"progress","message":"Cloning https://... into /home/user/projects/repo..."}
{"type":"progress","message":"Receiving objects: 100%"}
{"type":"done","sessionId":"abc-123"}
```

If `launchClaude` is true, a terminal session is created with `claude` as the initial command. The `sessionId` in the response can be used to connect via WebSocket.

### `WebSocket /terminal` (authenticated)

Open a new terminal session.

**URL:** `ws://host:7433/terminal?token=<jwt>`

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

| Type         | Fields            | Description                     |
| ------------ | ----------------- | ------------------------------- |
| `output`     | `data: string`    | Terminal output                 |
| `scrollback` | `data: string`    | Replay buffer (sent on connect) |
| `exit`       | `code: number`    | Process exited                  |
| `pong`       | —                 | Keepalive response              |
| `error`      | `message: string` | Error message                   |

## Security

- **JWT authentication** — All API and WebSocket endpoints (except `/health` and `/api/pair`) require a valid Bearer token
- **One-time pairing code** — Code is invalidated after successful use; rate-limited to 5 attempts/minute
- **Auto-generated secret** — JWT signing key is created on first run and stored in `~/.flowforge-server/secret.key` with restricted permissions (0600 on Unix)
- **LAN-only by design** — The server binds to `0.0.0.0` but is intended for local network use. Use a VPN or Tailscale for remote access — do not expose directly to the internet.

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
│   ├── health.ts              # GET /health
│   ├── pair.ts                # POST /api/pair (rate-limited)
│   └── clone.ts               # POST /api/clone (NDJSON streaming)
└── terminal/
    ├── session-manager.ts     # Session lifecycle, scrollback, GC
    └── ws-handler.ts          # WebSocket routing and message handling
```
