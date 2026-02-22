# Session Rejoining Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to list and rejoin running terminal sessions and resume past Claude Code conversations from the mobile app's project detail screen.

**Architecture:** Server exposes active sessions (from in-memory Map) and conversation history (from `~/.claude/projects/` JSONL files) via new REST endpoints. Mobile adds a project detail screen between project list and terminal, showing running sessions and resumable conversations. Tapping a running session reconnects via existing WebSocket session ID; tapping a past conversation launches `claude --resume <id>` in a new terminal.

**Tech Stack:** Express (server routes), node-pty sessions, Claude JSONL parsing, React Native (Expo Router), NativeWind, WebView postMessage bridge. Jest for tests.

**Design doc:** `docs/plans/2026-02-18-session-rejoining-design.md`

---

### Task 1: Add `getActiveSessions()` to Session Manager

**Files:**
- Modify: `flowforge-server/src/terminal/session-manager.ts:82` (after `getSessionCount`)
- Test: `flowforge-server/__tests__/terminal/session-manager.test.ts`

**Note:** `ActiveSessionInfo` type already exists in `flowforge-server/src/types.ts:29-35` and is already imported in `session-manager.ts:5`.

**Step 1: Write the failing test**

Add to `session-manager.test.ts` — import `getActiveSessions` alongside the other imports (line 37-44), then add this describe block after the `pty exit handling` block:

```typescript
describe("getActiveSessions", () => {
  it("should return all active sessions", () => {
    const { v4 } = require("uuid");
    v4.mockReturnValueOnce("session-a");
    createSession({ cwd: "/projects/foo" });
    v4.mockReturnValueOnce("session-b");
    createSession({ cwd: "/projects/bar" });

    const active = getActiveSessions();
    expect(active).toHaveLength(2);
    expect(active[0]).toMatchObject({
      id: "session-a",
      cwd: "/projects/foo",
      exited: false,
    });
    expect(active[1]).toMatchObject({
      id: "session-b",
      cwd: "/projects/bar",
      exited: false,
    });

    destroySession("session-a");
    destroySession("session-b");
  });

  it("should filter by cwd prefix", () => {
    const { v4 } = require("uuid");
    v4.mockReturnValueOnce("session-a");
    createSession({ cwd: "/projects/foo" });
    v4.mockReturnValueOnce("session-b");
    createSession({ cwd: "/other/bar" });

    const filtered = getActiveSessions("/projects");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("session-a");

    destroySession("session-a");
    destroySession("session-b");
  });

  it("should include client count", () => {
    createSession();
    const ws = createMockWs();
    attachClient("test-session-id", ws);

    const active = getActiveSessions();
    expect(active[0].clientCount).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd flowforge-server && npx jest __tests__/terminal/session-manager.test.ts -t "getActiveSessions" --no-coverage`
Expected: FAIL — `getActiveSessions is not a function` or similar import error.

**Step 3: Write minimal implementation**

Add after `getSessionCount()` at line 82 of `session-manager.ts`:

```typescript
export function getActiveSessions(cwdPrefix?: string): ActiveSessionInfo[] {
  const result: ActiveSessionInfo[] = [];
  for (const session of sessions.values()) {
    if (cwdPrefix && !session.cwd.startsWith(cwdPrefix)) continue;
    result.push({
      id: session.id,
      cwd: session.cwd,
      lastActivity: session.lastActivity,
      exited: session.exited,
      clientCount: session.clients.size,
    });
  }
  return result;
}
```

**Step 4: Run test to verify it passes**

Run: `cd flowforge-server && npx jest __tests__/terminal/session-manager.test.ts -t "getActiveSessions" --no-coverage`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add flowforge-server/src/terminal/session-manager.ts flowforge-server/__tests__/terminal/session-manager.test.ts
git commit -m "feat(server): add getActiveSessions() to session manager"
```

---

### Task 2: Create Shared Claude Session Parsing Utility

**Files:**
- Create: `flowforge-server/src/lib/claude-sessions.ts`
- Modify: `flowforge-server/src/types.ts`
- Create: `flowforge-server/__tests__/lib/claude-sessions.test.ts`

**Step 1: Add `ConversationInfo` type to `types.ts`**

Add after `ActiveSessionInfo` (line 35):

```typescript
export interface ConversationInfo {
  sessionId: string;
  slug: string | null;
  timestamp: string;
  gitBranch: string | null;
}
```

**Step 2: Write the failing tests**

Create `flowforge-server/__tests__/lib/claude-sessions.test.ts`:

```typescript
import fs from "fs";
import path from "path";
import os from "os";

jest.mock("../../src/config", () => ({
  config: { cloneDir: "/tmp/test-projects" },
}));

import {
  buildClaudeSlug,
  parseSessionFile,
  getConversationHistory,
} from "../../src/lib/claude-sessions";

describe("buildClaudeSlug", () => {
  it("should convert Windows absolute path to slug", () => {
    expect(buildClaudeSlug("C:\\GitHub\\my-project")).toBe(
      "C--GitHub--my-project",
    );
  });

  it("should convert Unix absolute path to slug", () => {
    expect(buildClaudeSlug("/home/user/GitHub/my-project")).toBe(
      "home--user--GitHub--my-project",
    );
  });
});

describe("parseSessionFile", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-session-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should parse session metadata from first valid JSONL entry", async () => {
    const filePath = path.join(tmpDir, "test-session.jsonl");
    const entry = JSON.stringify({
      sessionId: "abc-123",
      slug: "fluffy-bouncing-hellman",
      timestamp: "2026-02-16T14:03:26.605Z",
      gitBranch: "main",
    });
    fs.writeFileSync(filePath, entry + "\n");

    const result = await parseSessionFile(filePath);
    expect(result).toEqual({
      sessionId: "abc-123",
      slug: "fluffy-bouncing-hellman",
      timestamp: "2026-02-16T14:03:26.605Z",
      gitBranch: "main",
    });
  });

  it("should skip file-history-snapshot entries", async () => {
    const filePath = path.join(tmpDir, "test-session.jsonl");
    const snapshot = JSON.stringify({ type: "file-history-snapshot" });
    const real = JSON.stringify({
      sessionId: "real-id",
      slug: "real-slug",
      timestamp: "2026-02-16T14:03:26.605Z",
      gitBranch: "feat",
    });
    fs.writeFileSync(filePath, snapshot + "\n" + real + "\n");

    const result = await parseSessionFile(filePath);
    expect(result!.sessionId).toBe("real-id");
  });

  it("should fall back to filename as sessionId when no valid entries", async () => {
    const filePath = path.join(tmpDir, "fallback-id.jsonl");
    fs.writeFileSync(filePath, "not json\n");

    const result = await parseSessionFile(filePath);
    expect(result!.sessionId).toBe("fallback-id");
    expect(result!.slug).toBeNull();
  });
});

describe("getConversationHistory", () => {
  let tmpDir: string;
  let claudeProjectsDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-hist-test-"));
    claudeProjectsDir = tmpDir;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return empty array when no matching project dir exists", async () => {
    const result = await getConversationHistory(
      "/tmp/test-projects/nonexistent",
      20,
      claudeProjectsDir,
    );
    expect(result).toEqual([]);
  });

  it("should find and parse session files", async () => {
    // Create directory matching the slug for /tmp/test-projects/my-project
    const slug = "tmp--test-projects--my-project";
    const sessionDir = path.join(claudeProjectsDir, slug);
    fs.mkdirSync(sessionDir, { recursive: true });

    const entry = JSON.stringify({
      sessionId: "sess-1",
      slug: "happy-fox",
      timestamp: "2026-02-16T14:00:00.000Z",
      gitBranch: "main",
    });
    fs.writeFileSync(path.join(sessionDir, "sess-1.jsonl"), entry + "\n");

    const result = await getConversationHistory(
      "/tmp/test-projects/my-project",
      20,
      claudeProjectsDir,
    );
    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe("sess-1");
  });

  it("should sort by timestamp descending and respect limit", async () => {
    const slug = "tmp--test-projects--my-project";
    const sessionDir = path.join(claudeProjectsDir, slug);
    fs.mkdirSync(sessionDir, { recursive: true });

    for (let i = 0; i < 5; i++) {
      const entry = JSON.stringify({
        sessionId: `sess-${i}`,
        slug: `slug-${i}`,
        timestamp: `2026-02-${String(10 + i).padStart(2, "0")}T14:00:00.000Z`,
        gitBranch: "main",
      });
      fs.writeFileSync(
        path.join(sessionDir, `sess-${i}.jsonl`),
        entry + "\n",
      );
    }

    const result = await getConversationHistory(
      "/tmp/test-projects/my-project",
      3,
      claudeProjectsDir,
    );
    expect(result).toHaveLength(3);
    // Most recent first
    expect(result[0].sessionId).toBe("sess-4");
    expect(result[1].sessionId).toBe("sess-3");
    expect(result[2].sessionId).toBe("sess-2");
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `cd flowforge-server && npx jest __tests__/lib/claude-sessions.test.ts --no-coverage`
Expected: FAIL — module not found.

**Step 4: Write the implementation**

Create `flowforge-server/src/lib/claude-sessions.ts`:

```typescript
import fs from "fs";
import path from "path";
import os from "os";
import readline from "readline";
import type { ConversationInfo } from "../types";

export function buildClaudeSlug(absolutePath: string): string {
  return absolutePath
    .replace(/:/g, "")
    .replace(/[\\/]+/g, "--")
    .replace(/^-+/, "");
}

export async function parseSessionFile(
  filePath: string,
): Promise<ConversationInfo | null> {
  const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  try {
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.type === "file-history-snapshot") continue;
        if (entry.type === "progress") continue;

        return {
          sessionId: entry.sessionId || path.basename(filePath, ".jsonl"),
          slug: entry.slug || null,
          timestamp: entry.timestamp || null,
          gitBranch: entry.gitBranch || null,
        };
      } catch {
        continue;
      }
    }
  } finally {
    rl.close();
    stream.destroy();
  }

  const stat = fs.statSync(filePath);
  return {
    sessionId: path.basename(filePath, ".jsonl"),
    slug: null,
    timestamp: stat.mtime.toISOString(),
    gitBranch: null,
  };
}

export async function getConversationHistory(
  projectAbsPath: string,
  limit = 20,
  claudeProjectsDir?: string,
): Promise<ConversationInfo[]> {
  const slug = buildClaudeSlug(projectAbsPath);
  const projectsDir =
    claudeProjectsDir || path.join(os.homedir(), ".claude", "projects");

  if (!fs.existsSync(projectsDir)) return [];

  const dirs = fs.readdirSync(projectsDir);
  const matchingDir = dirs.find((d) => d === slug);
  if (!matchingDir) return [];

  const sessionDir = path.join(projectsDir, matchingDir);
  const files = fs.readdirSync(sessionDir).filter((f) => f.endsWith(".jsonl"));

  const conversations: ConversationInfo[] = [];
  const parsePromises = files.map(async (file) => {
    const info = await parseSessionFile(path.join(sessionDir, file));
    if (info) conversations.push(info);
  });
  await Promise.all(parsePromises);

  conversations.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return conversations.slice(0, limit);
}
```

**Step 5: Run tests to verify they pass**

Run: `cd flowforge-server && npx jest __tests__/lib/claude-sessions.test.ts --no-coverage`
Expected: PASS (all 6 tests)

**Step 6: Verify full server build**

Run: `cd flowforge-server && npx tsc --noEmit`
Expected: clean, no errors.

**Step 7: Commit**

```bash
git add flowforge-server/src/types.ts flowforge-server/src/lib/claude-sessions.ts flowforge-server/__tests__/lib/claude-sessions.test.ts
git commit -m "feat(server): add shared claude session parsing utility"
```

---

### Task 3: Add Sessions Router with Active + History Endpoints

**Files:**
- Create: `flowforge-server/src/routes/sessions.ts`
- Modify: `flowforge-server/src/index.ts:10,34` (add import + mount)
- Create: `flowforge-server/__tests__/routes/sessions.test.ts`

**Step 1: Write the failing tests**

Create `flowforge-server/__tests__/routes/sessions.test.ts`:

```typescript
jest.mock("../../src/config", () => ({
  config: { cloneDir: "/tmp/test-projects" },
}));

jest.mock("../../src/auth/middleware", () => ({
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock("../../src/terminal/session-manager", () => ({
  getActiveSessions: jest.fn(() => []),
}));

jest.mock("../../src/lib/claude-sessions", () => ({
  getConversationHistory: jest.fn(async () => []),
}));

import { sessionsRouter } from "../../src/routes/sessions";
import { getActiveSessions } from "../../src/terminal/session-manager";
import { getConversationHistory } from "../../src/lib/claude-sessions";

function findHandler(routePath: string, method = "get") {
  const layer = sessionsRouter.stack.find(
    (l: { route?: { path: string; methods: Record<string, boolean> } }) =>
      l.route?.path === routePath && l.route?.methods[method],
  );
  const handlers = layer!.route!.stack;
  return handlers[handlers.length - 1].handle;
}

function createMockReq(query: Record<string, string> = {}) {
  return { query, headers: {} } as unknown as import("express").Request;
}

function createMockRes() {
  let jsonData: unknown;
  let statusCode = 200;
  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: unknown) {
      jsonData = data;
    },
    get data() {
      return jsonData;
    },
    get statusCode() {
      return statusCode;
    },
  };
  return res;
}

describe("GET /api/sessions/active", () => {
  it("should return active sessions", () => {
    const mockSessions = [
      { id: "s1", cwd: "/projects/foo", lastActivity: 1000, exited: false, clientCount: 1 },
    ];
    (getActiveSessions as jest.Mock).mockReturnValue(mockSessions);

    const handler = findHandler("/api/sessions/active");
    const req = createMockReq();
    const res = createMockRes();
    handler(req, res);

    expect(res.data).toEqual(mockSessions);
  });

  it("should pass cwd query param as filter", () => {
    (getActiveSessions as jest.Mock).mockReturnValue([]);

    const handler = findHandler("/api/sessions/active");
    const req = createMockReq({ cwd: "/projects/foo" });
    const res = createMockRes();
    handler(req, res);

    expect(getActiveSessions).toHaveBeenCalledWith("/projects/foo");
  });
});

describe("GET /api/sessions/history", () => {
  it("should return 400 when project param missing", async () => {
    const handler = findHandler("/api/sessions/history");
    const req = createMockReq();
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(400);
  });

  it("should return conversation history", async () => {
    const mockHistory = [
      { sessionId: "abc", slug: "happy-fox", timestamp: "2026-02-16T14:00:00Z", gitBranch: "main" },
    ];
    (getConversationHistory as jest.Mock).mockResolvedValue(mockHistory);

    const handler = findHandler("/api/sessions/history");
    const req = createMockReq({ project: "my-project" });
    const res = createMockRes();
    await handler(req, res);

    expect(res.data).toEqual(mockHistory);
    expect(getConversationHistory).toHaveBeenCalledWith("/tmp/test-projects/my-project");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd flowforge-server && npx jest __tests__/routes/sessions.test.ts --no-coverage`
Expected: FAIL — module not found.

**Step 3: Write the implementation**

Create `flowforge-server/src/routes/sessions.ts`:

```typescript
import { Router, Request, Response } from "express";
import path from "path";
import { authMiddleware } from "../auth/middleware";
import { config } from "../config";
import { getActiveSessions } from "../terminal/session-manager";
import { getConversationHistory } from "../lib/claude-sessions";

export const sessionsRouter = Router();

sessionsRouter.get(
  "/api/sessions/active",
  authMiddleware,
  (req: Request, res: Response) => {
    const cwdPrefix = (req.query.cwd as string) || undefined;
    res.json(getActiveSessions(cwdPrefix));
  },
);

sessionsRouter.get(
  "/api/sessions/history",
  authMiddleware,
  async (req: Request, res: Response) => {
    const projectName = req.query.project as string;
    if (!projectName) {
      res.status(400).json({ error: "project query param required" });
      return;
    }

    try {
      const projectPath = path.resolve(config.cloneDir, projectName);
      const conversations = await getConversationHistory(projectPath);
      res.json(conversations);
    } catch {
      res.status(500).json({ error: "Failed to read session history" });
    }
  },
);
```

**Step 4: Wire sessions router into `index.ts`**

Add import at line 10 (after projectsRouter import):

```typescript
import { sessionsRouter } from "./routes/sessions";
```

Add mount after `app.use(projectsRouter)` (line 34):

```typescript
app.use(sessionsRouter);
```

**Step 5: Run tests to verify they pass**

Run: `cd flowforge-server && npx jest __tests__/routes/sessions.test.ts --no-coverage`
Expected: PASS (4 tests)

**Step 6: Verify full build**

Run: `cd flowforge-server && npx tsc --noEmit`
Expected: clean.

**Step 7: Commit**

```bash
git add flowforge-server/src/routes/sessions.ts flowforge-server/src/index.ts flowforge-server/__tests__/routes/sessions.test.ts
git commit -m "feat(server): add sessions active + history API endpoints"
```

---

### Task 4: Add Combined Project Detail Endpoint

**Files:**
- Modify: `flowforge-server/src/routes/projects.ts`
- Modify: `flowforge-server/__tests__/routes/projects.test.ts`

**Step 1: Write the failing test**

Add to `__tests__/routes/projects.test.ts`. First add these mocks at the top (before existing imports):

```typescript
jest.mock("../../src/terminal/session-manager", () => ({
  getActiveSessions: jest.fn(() => []),
}));

jest.mock("../../src/lib/claude-sessions", () => ({
  getConversationHistory: jest.fn(async () => []),
}));
```

Then add a new describe block and helper:

```typescript
import { getActiveSessions } from "../../src/terminal/session-manager";
import { getConversationHistory } from "../../src/lib/claude-sessions";

function findParamHandler() {
  const layer = projectsRouter.stack.find(
    (l: { route?: { path: string } }) => l.route?.path === "/api/projects/:name",
  );
  const handlers = layer!.route!.stack;
  return handlers[handlers.length - 1].handle;
}

function createMockReqWithParams(params: Record<string, string>) {
  return { params, query: {}, headers: {} } as unknown as import("express").Request;
}

describe("GET /api/projects/:name", () => {
  let handler: Function;

  beforeAll(() => {
    handler = findParamHandler();
  });

  it("should return 404 for non-existent project", async () => {
    mockStatSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const req = createMockReqWithParams({ name: "nonexistent" });
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(404);
  });

  it("should return project detail with sessions and history", async () => {
    mockStatSync.mockReturnValue({
      isDirectory: () => true,
      mtime: new Date("2026-02-15T10:00:00Z"),
    });
    mockExistsSync.mockReturnValue(true);

    const mockActive = [
      { id: "s1", cwd: "/tmp/test-projects/my-project", lastActivity: 1000, exited: false, clientCount: 1 },
    ];
    (getActiveSessions as jest.Mock).mockReturnValue(mockActive);

    const mockHistory = [
      { sessionId: "abc", slug: "happy-fox", timestamp: "2026-02-16T14:00:00Z", gitBranch: "main" },
    ];
    (getConversationHistory as jest.Mock).mockResolvedValue(mockHistory);

    const req = createMockReqWithParams({ name: "my-project" });
    const res = createMockRes();
    await handler(req, res);

    expect(res.data).toMatchObject({
      name: "my-project",
      path: "my-project",
      hasClaudeMd: true,
      activeSessions: mockActive,
      recentConversations: mockHistory,
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd flowforge-server && npx jest __tests__/routes/projects.test.ts -t "GET /api/projects/:name" --no-coverage`
Expected: FAIL — handler not found (route doesn't exist yet).

**Step 3: Write the implementation**

Add to `flowforge-server/src/routes/projects.ts`. Add imports at top:

```typescript
import { getActiveSessions } from "../terminal/session-manager";
import { getConversationHistory } from "../lib/claude-sessions";
```

Add the new route after the existing handler (after line 67):

```typescript
projectsRouter.get(
  "/api/projects/:name",
  authMiddleware,
  async (req: Request, res: Response) => {
    const projectName = req.params.name;
    const dirPath = path.join(config.cloneDir, projectName);

    try {
      const gitPath = path.join(dirPath, ".git");
      const gitStat = fs.statSync(gitPath);
      if (!gitStat.isDirectory()) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const claudeMdPath = path.join(dirPath, "CLAUDE.md");
      const hasClaudeMd = fs.existsSync(claudeMdPath);

      const activeSessions = getActiveSessions(path.resolve(dirPath));
      const recentConversations = await getConversationHistory(
        path.resolve(dirPath),
      );

      res.json({
        name: projectName,
        path: projectName,
        hasClaudeMd,
        lastModified: gitStat.mtime.toISOString(),
        activeSessions,
        recentConversations,
      });
    } catch {
      res.status(404).json({ error: "Project not found" });
    }
  },
);
```

**Step 4: Run tests to verify they pass**

Run: `cd flowforge-server && npx jest __tests__/routes/projects.test.ts --no-coverage`
Expected: PASS (all tests including new ones)

**Step 5: Verify full build**

Run: `cd flowforge-server && npx tsc --noEmit`
Expected: clean.

**Step 6: Commit**

```bash
git add flowforge-server/src/routes/projects.ts flowforge-server/__tests__/routes/projects.test.ts
git commit -m "feat(server): add GET /api/projects/:name with sessions and history"
```

---

### Task 5: Add `fetchProjectDetail()` to Mobile API Client

**Files:**
- Modify: `flowforge-mobile/lib/server-api.ts`
- Modify: `flowforge-mobile/__tests__/server-api-projects.test.ts`

**Step 1: Write the failing test**

Add to `flowforge-mobile/__tests__/server-api-projects.test.ts`:

```typescript
import { fetchProjectDetail } from "../lib/server-api";

describe("fetchProjectDetail", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("should fetch project detail with correct URL and auth header", async () => {
    const mockData = {
      name: "my-project",
      path: "my-project",
      hasClaudeMd: true,
      lastModified: "2026-02-15T10:00:00Z",
      activeSessions: [],
      recentConversations: [],
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    const result = await fetchProjectDetail(
      "http://localhost:7433",
      "test-token",
      "my-project",
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:7433/api/projects/my-project",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer test-token" },
      }),
    );
    expect(result).toEqual(mockData);
  });

  it("should throw on non-ok response", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "Not found",
    });

    await expect(
      fetchProjectDetail("http://localhost:7433", "test-token", "missing"),
    ).rejects.toThrow("Failed to fetch project detail (404)");
  });

  it("should URL-encode the project name", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await fetchProjectDetail(
      "http://localhost:7433",
      "test-token",
      "my project",
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:7433/api/projects/my%20project",
      expect.anything(),
    );
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd flowforge-mobile && npx jest __tests__/server-api-projects.test.ts -t "fetchProjectDetail" --no-coverage`
Expected: FAIL — `fetchProjectDetail` is not exported.

**Step 3: Write the implementation**

Add to `flowforge-mobile/lib/server-api.ts` (after the existing `Project` interface block, before `CloneProgress`):

```typescript
export interface ActiveSession {
  id: string;
  cwd: string;
  lastActivity: number;
  exited: boolean;
  clientCount: number;
}

export interface Conversation {
  sessionId: string;
  slug: string | null;
  timestamp: string;
  gitBranch: string | null;
}

export interface ProjectDetail {
  name: string;
  path: string;
  hasClaudeMd: boolean;
  lastModified: string;
  activeSessions: ActiveSession[];
  recentConversations: Conversation[];
}

export async function fetchProjectDetail(
  serverUrl: string,
  serverToken: string,
  projectName: string,
): Promise<ProjectDetail> {
  const normalizedUrl = serverUrl.replace(/\/+$/, "");
  const response = await fetch(
    `${normalizedUrl}/api/projects/${encodeURIComponent(projectName)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${serverToken}`,
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to fetch project detail (${response.status}): ${text}`,
    );
  }

  return response.json();
}
```

**Step 4: Run tests to verify they pass**

Run: `cd flowforge-mobile && npx jest __tests__/server-api-projects.test.ts -t "fetchProjectDetail" --no-coverage`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add flowforge-mobile/lib/server-api.ts flowforge-mobile/__tests__/server-api-projects.test.ts
git commit -m "feat(mobile): add fetchProjectDetail API client"
```

---

### Task 6: Bridge Session ID from WebView to React Native

**Files:**
- Modify: `flowforge-mobile/lib/terminal-html.ts:93-95` (session case)
- Modify: `flowforge-mobile/app/(app)/server/terminal.tsx`
- Modify: `flowforge-mobile/__tests__/terminal-html.test.ts`

**Step 1: Write the failing test**

Add to `flowforge-mobile/__tests__/terminal-html.test.ts`:

```typescript
it("should postMessage session ID to React Native", () => {
  const html = getTerminalHtml("ws://localhost:7433/terminal?token=t");
  expect(html).toContain("window.ReactNativeWebView.postMessage");
  expect(html).toContain("type: 'sessionId'");
});
```

**Step 2: Run test to verify it fails**

Run: `cd flowforge-mobile && npx jest __tests__/terminal-html.test.ts -t "postMessage session ID" --no-coverage`
Expected: FAIL — no `postMessage` in HTML.

**Step 3: Update the WebView HTML**

In `flowforge-mobile/lib/terminal-html.ts`, change the `case 'session'` block (lines 93-95) from:

```javascript
            case 'session':
              sessionId = msg.id;
              break;
```

To:

```javascript
            case 'session':
              sessionId = msg.id;
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'sessionId', id: msg.id }));
              }
              break;
```

**Step 4: Update terminal screen to handle onMessage**

In `flowforge-mobile/app/(app)/server/terminal.tsx`:

Add after `const webViewRef = useRef<WebView>(null);` (line 27):

```typescript
const currentSessionId = useRef<string | null>(sessionId || null);

const handleWebViewMessage = (event: { nativeEvent: { data: string } }) => {
  try {
    const msg = JSON.parse(event.nativeEvent.data);
    if (msg.type === "sessionId" && msg.id) {
      currentSessionId.current = msg.id;
    }
  } catch {
    // ignore parse errors
  }
};
```

Add `onMessage={handleWebViewMessage}` prop to the `<WebView>` component (around line 63).

**Step 5: Run tests to verify they pass**

Run: `cd flowforge-mobile && npx jest __tests__/terminal-html.test.ts --no-coverage`
Expected: PASS

**Step 6: Commit**

```bash
git add flowforge-mobile/lib/terminal-html.ts flowforge-mobile/app/\(app\)/server/terminal.tsx
git commit -m "feat(mobile): bridge session ID from WebView to React Native"
```

---

### Task 7: Create Project Detail Screen

**Files:**
- Create: `flowforge-mobile/app/(app)/server/project-detail.tsx`

This is a UI screen — no unit test needed (would require full React Native rendering setup). We'll verify with typecheck + lint.

**Step 1: Create the screen**

Create `flowforge-mobile/app/(app)/server/project-detail.tsx` with the content from the design doc (see `docs/plans/2026-02-18-session-rejoining.md` Task 6 for full code). Key elements:

- SectionList with "Running Sessions" and "Recent Conversations" sections
- Active sessions show green dot, shortened ID, relative time, "Rejoin" action
- Conversations show slug/ID, timestamp, git branch badge, "Resume" action
- "New Session" button in header
- Pull-to-refresh
- Error/loading/empty states
- Navigation: back to projects, tap active session → terminal with `sessionId`, tap conversation → terminal with `cmd=claude --resume <id>`

```tsx
import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  SectionList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useStore } from "../../../stores/store";
import {
  fetchProjectDetail,
  type ActiveSession,
  type Conversation,
  type ProjectDetail,
} from "../../../lib/server-api";

function formatRelativeTime(dateOrMs: string | number): string {
  const now = Date.now();
  const then =
    typeof dateOrMs === "number" ? dateOrMs : new Date(dateOrMs).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(then).toLocaleDateString();
}

type SectionItem =
  | { type: "active"; data: ActiveSession | null }
  | { type: "conversation"; data: Conversation | null };

export default function ProjectDetailScreen() {
  const router = useRouter();
  const { name, cloneDir } = useLocalSearchParams<{
    name: string;
    cloneDir: string;
  }>();

  const { homeServerUrl, homeServerToken } = useStore();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(
    async (refresh = false) => {
      if (!homeServerUrl || !homeServerToken || !name) return;

      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);

      try {
        const data = await fetchProjectDetail(
          homeServerUrl,
          homeServerToken,
          name,
        );
        setDetail(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load project",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [homeServerUrl, homeServerToken, name],
  );

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  if (!homeServerUrl || !homeServerToken) {
    router.replace("/(app)");
    return null;
  }

  const handleNewSession = () => {
    const cwd = `${cloneDir}/${name}`;
    router.push({
      pathname: "/(app)/server/terminal",
      params: { cwd, cmd: "claude" },
    });
  };

  const handleActiveSession = (session: ActiveSession) => {
    router.push({
      pathname: "/(app)/server/terminal",
      params: { sessionId: session.id },
    });
  };

  const handleConversation = (conv: Conversation) => {
    const cwd = `${cloneDir}/${name}`;
    router.push({
      pathname: "/(app)/server/terminal",
      params: { cwd, cmd: `claude --resume ${conv.sessionId}` },
    });
  };

  const sections: Array<{
    title: string;
    data: SectionItem[];
    emptyMessage: string;
  }> = [];

  if (detail) {
    const activeSessions: SectionItem[] = detail.activeSessions
      .filter((s) => !s.exited)
      .map((s) => ({ type: "active" as const, data: s }));

    sections.push({
      title: "Running Sessions",
      data:
        activeSessions.length > 0
          ? activeSessions
          : [{ type: "active" as const, data: null }],
      emptyMessage: "No running sessions",
    });

    const conversations: SectionItem[] = detail.recentConversations.map(
      (c) => ({ type: "conversation" as const, data: c }),
    );

    sections.push({
      title: "Recent Conversations",
      data:
        conversations.length > 0
          ? conversations
          : [{ type: "conversation" as const, data: null }],
      emptyMessage: "No previous conversations",
    });
  }

  const renderItem = ({
    item,
    section,
  }: {
    item: SectionItem;
    section: { emptyMessage: string };
  }) => {
    if (!item.data) {
      return (
        <View className="px-4 py-6">
          <Text className="text-gray-500 text-sm text-center">
            {section.emptyMessage}
          </Text>
        </View>
      );
    }

    if (item.type === "active") {
      const session = item.data;
      return (
        <Pressable
          onPress={() => handleActiveSession(session)}
          className="bg-surface border border-border rounded-lg p-4 mx-4 mb-2 active:border-primary"
        >
          <View className="flex-row items-center">
            <View className="w-2.5 h-2.5 rounded-full bg-green-500 mr-3" />
            <View className="flex-1">
              <Text className="text-white text-sm font-medium">
                Session {session.id.slice(0, 8)}...
              </Text>
              <Text className="text-gray-500 text-xs mt-0.5">
                Active {formatRelativeTime(session.lastActivity)}
                {session.clientCount > 0
                  ? ` · ${session.clientCount} connected`
                  : ""}
              </Text>
            </View>
            <Text className="text-primary text-sm">Rejoin</Text>
          </View>
        </Pressable>
      );
    }

    const conv = item.data;
    return (
      <Pressable
        onPress={() => handleConversation(conv)}
        className="bg-surface border border-border rounded-lg p-4 mx-4 mb-2 active:border-primary"
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1 mr-3">
            <Text
              className="text-white text-sm font-medium"
              numberOfLines={1}
            >
              {conv.slug || conv.sessionId.slice(0, 8)}
            </Text>
            <View className="flex-row items-center mt-0.5">
              <Text className="text-gray-500 text-xs">
                {formatRelativeTime(conv.timestamp)}
              </Text>
              {conv.gitBranch && (
                <View className="bg-[#1f2937] rounded px-1.5 py-0.5 ml-2">
                  <Text className="text-blue-400 text-[10px]">
                    {conv.gitBranch}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <Text className="text-primary text-sm">Resume</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1">
        <View className="px-6 pt-4 pb-2">
          <Pressable onPress={() => router.back()} className="mb-4">
            <Text className="text-primary text-base">← Projects</Text>
          </Pressable>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 mr-4">
              <Text className="text-white text-2xl font-bold">{name}</Text>
              {detail?.hasClaudeMd && (
                <Text className="text-gray-500 text-xs mt-1">
                  CLAUDE.md configured
                </Text>
              )}
            </View>
            <Pressable
              onPress={handleNewSession}
              className="bg-primary px-4 py-2.5 rounded-lg active:bg-primary-hover"
            >
              <Text className="text-white font-semibold text-sm">
                New Session
              </Text>
            </Pressable>
          </View>
        </View>

        {isLoading && (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#238636" size="large" />
          </View>
        )}

        {!isLoading && error && (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-red-400 text-base text-center mb-4">
              {error}
            </Text>
            <Pressable
              onPress={() => loadDetail()}
              className="bg-primary px-6 py-3 rounded-lg active:bg-primary-hover"
            >
              <Text className="text-white font-semibold">Retry</Text>
            </Pressable>
          </View>
        )}

        {!isLoading && !error && detail && (
          <SectionList
            sections={sections}
            keyExtractor={(item, index) =>
              item.data
                ? item.type === "active"
                  ? item.data.id
                  : item.data.sessionId
                : `empty-${index}`
            }
            renderItem={renderItem}
            renderSectionHeader={({ section: { title } }) => (
              <View className="px-6 pt-5 pb-2">
                <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
                  {title}
                </Text>
              </View>
            )}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => loadDetail(true)}
                tintColor="#238636"
              />
            }
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
```

**Step 2: Run typecheck**

Run: `cd flowforge-mobile && npx tsc --noEmit`
Expected: clean.

**Step 3: Run lint**

Run: `cd flowforge-mobile && npx eslint app/\(app\)/server/project-detail.tsx`
Expected: clean.

**Step 4: Commit**

```bash
git add flowforge-mobile/app/\(app\)/server/project-detail.tsx
git commit -m "feat(mobile): add project detail screen with sessions list"
```

---

### Task 8: Update Projects Screen Navigation

**Files:**
- Modify: `flowforge-mobile/app/(app)/server/projects.tsx:76-82`

**Step 1: Change `handleProjectPress` to navigate to project-detail**

Replace the `handleProjectPress` function (lines 76-82):

```typescript
const handleProjectPress = (project: Project) => {
  router.push({
    pathname: "/(app)/server/project-detail",
    params: { name: project.name, cloneDir },
  });
};
```

**Step 2: Run typecheck**

Run: `cd flowforge-mobile && npx tsc --noEmit`
Expected: clean.

**Step 3: Commit**

```bash
git add flowforge-mobile/app/\(app\)/server/projects.tsx
git commit -m "feat(mobile): navigate to project detail instead of terminal"
```

---

### Task 9: Full Build Verification and Run All Tests

**Step 1: Server tests**

Run: `cd flowforge-server && npm test`
Expected: all tests pass.

**Step 2: Server build**

Run: `cd flowforge-server && npm run build`
Expected: clean compile.

**Step 3: Mobile typecheck**

Run: `cd flowforge-mobile && npm run typecheck`
Expected: clean.

**Step 4: Mobile lint**

Run: `cd flowforge-mobile && npm run lint`
Expected: clean.

**Step 5: Mobile tests**

Run: `cd flowforge-mobile && npm test`
Expected: all tests pass.

**Step 6: Fix any issues discovered, re-run, commit if needed**

**Step 7: Final commit if any fixes were applied**

```bash
git add -A
git commit -m "fix: address test/lint issues from session rejoining"
```
