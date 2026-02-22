# Session Rejoining Design

**Date:** 2026-02-18
**Status:** Approved

## Problem

Users cannot rejoin Claude Code sessions that were started previously. Every project tap or repo creation starts a fresh Claude session. Running terminal sessions are invisible once the user leaves the terminal screen.

## Goals

1. List and reconnect to **running terminal sessions** on the home server
2. List and resume **past Claude conversations** via `claude --resume <session-id>`
3. Both accessible from the mobile app's project detail screen
4. Desktop already supported via `claude --resume` (no changes needed)

## Design

### Server API (flowforge-server)

#### `GET /api/sessions/active?cwd=<path>`

Returns active terminal sessions from the in-memory session map.

- Auth: JWT required
- Query param `cwd`: optional prefix filter (e.g., `/home/user/GitHub/my-project`)
- Response:

```json
[{
  "id": "uuid",
  "cwd": "/home/user/GitHub/my-project",
  "lastActivity": 1708300000000,
  "exited": false,
  "clientCount": 1
}]
```

Implementation: iterate `sessions` Map, filter by `cwd` startsWith, return metadata.

#### `GET /api/sessions/history?project=<dirname>`

Scans `~/.claude/projects/` for JSONL session files matching the project directory.

- Auth: JWT required
- Query param `project`: directory name (e.g., `my-project`). Server resolves to Claude's slug format (`C--GitHub-my-project` etc.) by scanning `~/.claude/projects/` for directories whose decoded path matches.
- Parses the first non-snapshot JSONL entry per file to extract session metadata.
- Returns last 20 sessions sorted by most recent.
- Response:

```json
[{
  "sessionId": "uuid",
  "slug": "fluffy-bouncing-hellman",
  "timestamp": "2026-02-16T14:03:26.605Z",
  "gitBranch": "main"
}]
```

**Slug resolution:** Claude stores sessions under directory names like `C--GitHub-Flowforge` (absolute path with path separators replaced by `--`). The server's `cloneDir` config gives us the parent directory. For a project named `my-project`, the Claude project slug is the absolute path `<cloneDir>/my-project` with `/` and `\` replaced by `--`, drive letter prefix stripped or included.

#### `GET /api/projects/:name` (enhanced)

Returns project metadata plus active sessions and recent history in one call:

```json
{
  "name": "my-project",
  "path": "my-project",
  "hasClaudeMd": true,
  "lastModified": "2026-02-18T20:00:00Z",
  "activeSessions": [...],
  "recentConversations": [...]
}
```

### Mobile — Project Detail Screen

**New route:** `app/(app)/server/project-detail.tsx`

**Navigation change:** Projects list tap now navigates to project-detail instead of directly to terminal.

**Layout:**

1. **Header:** Project name + "New Session" button (launches `claude` fresh)
2. **Running Sessions** section:
   - Each item shows: shortened session ID, elapsed time since last activity, green status dot
   - Tap → navigate to terminal with `sessionId` param (WebSocket reconnects to existing PTY)
   - Empty state: "No running sessions"
3. **Recent Conversations** section:
   - Each item shows: conversation slug, relative timestamp, git branch badge
   - Tap → navigate to terminal with `cmd=claude --resume <sessionId>` and `cwd=<projectDir>`
   - Empty state: "No previous conversations"
4. Pull-to-refresh reloads both lists

### Session ID Persistence Fix

**Problem:** Session IDs are trapped in WebView JS memory. If user navigates away, the ID is lost.

**Fix:**
- After WebView JS receives `{ type: "session", id }`, it posts the session ID back to React Native via `window.ReactNativeWebView.postMessage(JSON.stringify({ type: "sessionId", id }))`.
- Terminal screen's `onMessage` handler stores the session ID in a React ref.
- If the terminal screen re-renders or the user navigates back, the session ID is available for reconnection.
- This also means the project detail screen's "Running Sessions" list can be populated from the server's active sessions endpoint rather than needing client-side tracking.

### Desktop

No changes. `claude --resume` and `claude --continue` already work from any terminal.

## Key Decisions

- **Scan `~/.claude/projects/` directly** rather than maintaining our own session database. Zero maintenance, always accurate, but depends on Claude's JSONL format.
- **Project detail screen** as intermediate navigation between project list and terminal. Extra tap but surfaces much more information.
- **Combine active + history in one endpoint** (`GET /api/projects/:name`) to reduce mobile round-trips.

## Files to Create/Modify

### Server (flowforge-server)
- `src/routes/sessions.ts` — new: active sessions + history endpoints
- `src/routes/projects.ts` — modify: enhance with sessions data for single-project endpoint
- `src/terminal/session-manager.ts` — modify: add `getActiveSessions()` and `getSessionsByPath()` exports
- `src/types.ts` — modify: add response types for session endpoints

### Mobile (flowforge-mobile)
- `app/(app)/server/project-detail.tsx` — new: project detail screen with sessions
- `app/(app)/server/projects.tsx` — modify: tap navigates to project-detail
- `lib/server-api.ts` — modify: add `fetchProjectDetail()` API function
- `lib/terminal-html.ts` — modify: postMessage session ID back to React Native
- `app/(app)/server/terminal.tsx` — modify: handle session ID from WebView onMessage
