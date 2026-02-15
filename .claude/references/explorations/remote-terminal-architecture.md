# Remote Terminal Architecture Research (2026-02-15)

## Goal

Connect FlowForge mobile app to a home server running VS Code to: clone repos, launch Claude Code, and interact with the terminal.

## Key Findings

### Network Layer (NAT Traversal)

- **Tailscale** is the best option — mesh VPN via WireGuard, zero port forwarding, zero-trust ACLs
- No React Native SDK — users must install the official Tailscale app separately, then your app routes through the tailnet
- Tailscale API: `GET /api/v2/tailnet/:tailnet/devices` for reachability checks
- VS Code tunnels (`code tunnel`) use Microsoft's relay but have no programmatic terminal API for third-party apps

### Terminal Server (Home Server Side)

- **ttyd** (C, fast) or **custom node-pty + ws** (full control) — both expose PTY over WebSocket
- Auth: JWT validation via Caddy reverse proxy `forward_auth` directive
- GoTTY is an alternative but less actively maintained
- node-pty is very mature (powers VS Code, Hyper terminals)

### Terminal UI (Mobile Side)

- **xterm.js in WebView** via `@fressh/react-native-xtermjs-webview`
- **Critical Android bug**: `term.onData` only fires on double-Enter press (xterm.js #5108)
- WebView postMessage has measurable overhead in production builds
- No viable native terminal emulator components for RN
- Direct SSH libraries for RN are unmaintained/risky — avoid

### Authentication Flow

```
Mobile app → JWT from FlowForge auth
           → wss://home-server.tailnet:port/terminal (JWT in first message)
           → Caddy validates JWT via forward_auth
           → ttyd/node-pty provides terminal session
           → xterm.js renders in WebView
```

## Architecture Options

### Option A: Tailscale + ttyd (simplest)

- Home: Tailscale + ttyd behind Caddy with JWT auth
- Mobile: Tailscale app + WebView with xterm.js
- Pros: Minimal custom code, battle-tested components
- Cons: Requires separate Tailscale app install, Android xterm.js input bug

### Option B: Tailscale + custom node-pty server (most control)

- Home: Tailscale + Node.js server (node-pty + ws + JWT auth)
- Mobile: Tailscale app + WebView with xterm.js
- Pros: Full control over session management, can add commands like "clone + launch"
- Cons: More code to maintain

### Option C: Cloud relay (no Tailscale dependency)

- Home: Persistent WebSocket to cloud relay (Vercel/Cloudflare Worker)
- Relay: Bridges mobile ↔ home server connections
- Mobile: Connects to relay, no VPN needed
- Pros: No extra app install, works on any network
- Cons: More infrastructure, relay latency, relay becomes SPOF

## Recommendation

Option B for power users (Tailscale already common in dev setups).
Option C as stretch goal for broader accessibility.
