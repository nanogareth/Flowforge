# Session Rejoining Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to list and rejoin running terminal sessions and resume past Claude Code conversations from the mobile app's project detail screen.

**Architecture:** Server exposes active sessions (from in-memory Map) and conversation history (from `~/.claude/projects/` JSONL files) via new REST endpoints. Mobile adds a project detail screen between the project list and terminal, showing running sessions and resumable conversations. Tapping a running session reconnects via existing WebSocket session ID; tapping a past conversation launches `claude --resume <id>` in a new terminal.

**Tech Stack:** Express (server routes), node-pty sessions, Claude JSONL parsing, React Native (Expo Router), NativeWind, WebView postMessage bridge.

---

### Task 1: Add `getActiveSessions()` to Session Manager

**Files:**
- Modify: `flowforge-server/src/terminal/session-manager.ts:76-82`
- Modify: `flowforge-server/src/types.ts`

**Step 1: Add `ActiveSessionInfo` type to `types.ts`**

Add after the `ServerMessage` type at the bottom of `flowforge-server/src/types.ts`:

```typescript
export interface ActiveSessionInfo {
  id: string;
  cwd: string;
  lastActivity: number;
  exited: boolean;
  clientCount: number;
}
```

**Step 2: Add `getActiveSessions()` export to `session-manager.ts`**

Add after the `getSessionCount()` function (line 82):

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

Import `ActiveSessionInfo` from `../types` in the imports at top of session-manager.ts.

**Step 3: Commit**

```bash
git add flowforge-server/src/types.ts flowforge-server/src/terminal/session-manager.ts
git commit -m "feat(server): add getActiveSessions() to session manager"
```

---

### Task 2: Add Claude Session History Scanner

**Files:**
- Create: `flowforge-server/src/routes/sessions.ts`
- Modify: `flowforge-server/src/types.ts`
- Modify: `flowforge-server/src/index.ts`

**Step 1: Add `ConversationInfo` type to `types.ts`**

Add after `ActiveSessionInfo`:

```typescript
export interface ConversationInfo {
  sessionId: string;
  slug: string | null;
  timestamp: string;
  gitBranch: string | null;
}
```

**Step 2: Create `sessions.ts` route file**

Create `flowforge-server/src/routes/sessions.ts`:

```typescript
import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import os from "os";
import readline from "readline";
import { authMiddleware } from "../auth/middleware";
import { config } from "../config";
import { getActiveSessions } from "../terminal/session-manager";
import type { ConversationInfo } from "../types";

export const sessionsRouter = Router();

// GET /api/sessions/active?cwd=<path>
sessionsRouter.get(
  "/api/sessions/active",
  authMiddleware,
  (req: Request, res: Response) => {
    const cwdPrefix = (req.query.cwd as string) || undefined;
    res.json(getActiveSessions(cwdPrefix));
  },
);

// Build the Claude project slug for a given absolute path.
// Claude uses: absolute path with separators replaced by "--",
// drive letter colon replaced by nothing.
// e.g. C:\GitHub\my-project -> C--GitHub--my-project
function buildClaudeSlug(absolutePath: string): string {
  return absolutePath
    .replace(/:/g, "")
    .replace(/[\\/]+/g, "--")
    .replace(/^-+/, "");
}

// Parse the first non-snapshot JSONL entry to extract session metadata.
async function parseSessionFile(
  filePath: string,
): Promise<ConversationInfo | null> {
  const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  try {
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        // Skip file-history-snapshot entries — they don't have session metadata
        if (entry.type === "file-history-snapshot") continue;
        // Skip progress entries (hook_progress etc.)
        if (entry.type === "progress") continue;

        return {
          sessionId: entry.sessionId || path.basename(filePath, ".jsonl"),
          slug: entry.slug || null,
          timestamp: entry.timestamp || null,
          gitBranch: entry.gitBranch || null,
        };
      } catch {
        continue; // malformed line
      }
    }
  } finally {
    rl.close();
    stream.destroy();
  }

  // Fallback: use filename as session ID, get mtime as timestamp
  const stat = fs.statSync(filePath);
  return {
    sessionId: path.basename(filePath, ".jsonl"),
    slug: null,
    timestamp: stat.mtime.toISOString(),
    gitBranch: null,
  };
}

// GET /api/sessions/history?project=<dirname>
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
      const slug = buildClaudeSlug(projectPath);

      const claudeProjectsDir = path.join(os.homedir(), ".claude", "projects");
      if (!fs.existsSync(claudeProjectsDir)) {
        res.json([]);
        return;
      }

      // Find matching directory — Claude may use slightly different slug formats,
      // so we scan for directories that match our slug
      const dirs = fs.readdirSync(claudeProjectsDir);
      const matchingDir = dirs.find((d) => d === slug);

      if (!matchingDir) {
        res.json([]);
        return;
      }

      const sessionDir = path.join(claudeProjectsDir, matchingDir);
      const files = fs.readdirSync(sessionDir).filter((f) => f.endsWith(".jsonl"));

      // Parse all session files in parallel
      const conversations: ConversationInfo[] = [];
      const parsePromises = files.map(async (file) => {
        const info = await parseSessionFile(path.join(sessionDir, file));
        if (info) conversations.push(info);
      });
      await Promise.all(parsePromises);

      // Sort by timestamp descending, return last 20
      conversations.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      res.json(conversations.slice(0, 20));
    } catch (err) {
      res.status(500).json({ error: "Failed to read session history" });
    }
  },
);
```

**Step 3: Wire sessions router into `index.ts`**

Add to imports in `flowforge-server/src/index.ts`:

```typescript
import { sessionsRouter } from "./routes/sessions";
```

Add after the `app.use(projectsRouter)` line:

```typescript
app.use(sessionsRouter);
```

**Step 4: Verify the server compiles**

```bash
cd flowforge-server && npm run build
```

**Step 5: Commit**

```bash
git add flowforge-server/src/routes/sessions.ts flowforge-server/src/types.ts flowforge-server/src/index.ts
git commit -m "feat(server): add session history and active sessions endpoints"
```

---

### Task 3: Add Combined Project Detail Endpoint

**Files:**
- Modify: `flowforge-server/src/routes/projects.ts`

**Step 1: Add `GET /api/projects/:name` route**

Add a second route handler after the existing `GET /api/projects` handler in `projects.ts`. This combines project metadata with active sessions and conversation history in a single call.

```typescript
import os from "os";
import readline from "readline";
import { getActiveSessions } from "../terminal/session-manager";
import type { ConversationInfo } from "../types";
```

Add these imports at the top, then add this route after the existing one:

```typescript
// Reuse slug builder and parser (imported from sessions or duplicated inline)
function buildClaudeSlug(absolutePath: string): string {
  return absolutePath
    .replace(/:/g, "")
    .replace(/[\\/]+/g, "--")
    .replace(/^-+/, "");
}

async function parseSessionFile(
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

projectsRouter.get(
  "/api/projects/:name",
  authMiddleware,
  async (req: Request, res: Response) => {
    const projectName = req.params.name;
    const dirPath = path.join(config.cloneDir, projectName);

    try {
      // Project metadata
      const gitPath = path.join(dirPath, ".git");
      const gitStat = fs.statSync(gitPath);
      if (!gitStat.isDirectory()) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const claudeMdPath = path.join(dirPath, "CLAUDE.md");
      const hasClaudeMd = fs.existsSync(claudeMdPath);

      // Active sessions filtered to this project's cwd
      const activeSessions = getActiveSessions(path.resolve(dirPath));

      // Conversation history
      const projectPath = path.resolve(dirPath);
      const slug = buildClaudeSlug(projectPath);
      const claudeProjectsDir = path.join(os.homedir(), ".claude", "projects");
      let recentConversations: ConversationInfo[] = [];

      if (fs.existsSync(claudeProjectsDir)) {
        const dirs = fs.readdirSync(claudeProjectsDir);
        const matchingDir = dirs.find((d) => d === slug);

        if (matchingDir) {
          const sessionDir = path.join(claudeProjectsDir, matchingDir);
          const files = fs
            .readdirSync(sessionDir)
            .filter((f) => f.endsWith(".jsonl"));

          const parsePromises = files.map(async (file) => {
            const info = await parseSessionFile(
              path.join(sessionDir, file),
            );
            if (info) recentConversations.push(info);
          });
          await Promise.all(parsePromises);

          recentConversations.sort(
            (a, b) =>
              new Date(b.timestamp).getTime() -
              new Date(a.timestamp).getTime(),
          );
          recentConversations = recentConversations.slice(0, 20);
        }
      }

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

**Important:** The `:name` route MUST be registered after the parameterless `/api/projects` route so Express doesn't confuse them. Since both are in the same router and the parameterless one is defined first, this is already handled.

**Step 2: Verify build**

```bash
cd flowforge-server && npm run build
```

**Step 3: Commit**

```bash
git add flowforge-server/src/routes/projects.ts
git commit -m "feat(server): add GET /api/projects/:name with sessions and history"
```

---

### Task 4: Refactor — Extract Shared Session Parsing Utility

The `buildClaudeSlug` and `parseSessionFile` functions are duplicated between `sessions.ts` and `projects.ts`. Extract them.

**Files:**
- Create: `flowforge-server/src/lib/claude-sessions.ts`
- Modify: `flowforge-server/src/routes/sessions.ts`
- Modify: `flowforge-server/src/routes/projects.ts`

**Step 1: Create shared module**

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
): Promise<ConversationInfo[]> {
  const slug = buildClaudeSlug(projectAbsPath);
  const claudeProjectsDir = path.join(os.homedir(), ".claude", "projects");

  if (!fs.existsSync(claudeProjectsDir)) return [];

  const dirs = fs.readdirSync(claudeProjectsDir);
  const matchingDir = dirs.find((d) => d === slug);
  if (!matchingDir) return [];

  const sessionDir = path.join(claudeProjectsDir, matchingDir);
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

**Step 2: Update `sessions.ts` to use shared module**

Replace the inline `buildClaudeSlug`, `parseSessionFile` functions and the history endpoint logic with:

```typescript
import { getConversationHistory } from "../lib/claude-sessions";
```

And simplify the history endpoint to:

```typescript
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

**Step 3: Update `projects.ts` to use shared module**

Replace inline functions with import from `../lib/claude-sessions` and call `getConversationHistory(path.resolve(dirPath))`.

**Step 4: Verify build**

```bash
cd flowforge-server && npm run build
```

**Step 5: Commit**

```bash
git add flowforge-server/src/lib/claude-sessions.ts flowforge-server/src/routes/sessions.ts flowforge-server/src/routes/projects.ts
git commit -m "refactor(server): extract shared claude session parsing utility"
```

---

### Task 5: Add `fetchProjectDetail()` to Mobile API Client

**Files:**
- Modify: `flowforge-mobile/lib/server-api.ts`

**Step 1: Add types and fetch function**

Add to `flowforge-mobile/lib/server-api.ts`:

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

**Step 2: Commit**

```bash
git add flowforge-mobile/lib/server-api.ts
git commit -m "feat(mobile): add fetchProjectDetail API client"
```

---

### Task 6: Create Project Detail Screen

**Files:**
- Create: `flowforge-mobile/app/(app)/server/project-detail.tsx`

**Step 1: Create the project detail screen**

Create `flowforge-mobile/app/(app)/server/project-detail.tsx`:

```tsx
import { useState, useEffect, useCallback } from "react";
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

type SectionItem = { type: "active"; data: ActiveSession } | { type: "conversation"; data: Conversation };

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

  // Build sections for SectionList
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
          : [{ type: "active" as const, data: null as any }], // placeholder for empty
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
          : [{ type: "conversation" as const, data: null as any }],
      emptyMessage: "No previous conversations",
    });
  }

  const renderItem = ({ item, section }: { item: SectionItem; section: any }) => {
    // Empty state placeholder
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
                  ? ` \u00B7 ${session.clientCount} connected`
                  : ""}
              </Text>
            </View>
            <Text className="text-primary text-sm">Rejoin</Text>
          </View>
        </Pressable>
      );
    }

    // Conversation
    const conv = item.data;
    return (
      <Pressable
        onPress={() => handleConversation(conv)}
        className="bg-surface border border-border rounded-lg p-4 mx-4 mb-2 active:border-primary"
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-white text-sm font-medium" numberOfLines={1}>
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
        {/* Header */}
        <View className="px-6 pt-4 pb-2">
          <Pressable onPress={() => router.back()} className="mb-4">
            <Text className="text-primary text-base">{"\u2190"} Projects</Text>
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

        {/* Loading */}
        {isLoading && (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#238636" size="large" />
          </View>
        )}

        {/* Error */}
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

        {/* Sessions list */}
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

**Step 2: Commit**

```bash
git add flowforge-mobile/app/\(app\)/server/project-detail.tsx
git commit -m "feat(mobile): add project detail screen with sessions list"
```

---

### Task 7: Update Projects Screen Navigation

**Files:**
- Modify: `flowforge-mobile/app/(app)/server/projects.tsx`

**Step 1: Change `handleProjectPress` to navigate to project-detail**

Change the `handleProjectPress` function (line 76-82) from:

```typescript
const handleProjectPress = (project: Project) => {
    const cwd = `${cloneDir}/${project.path}`;
    router.push({
      pathname: "/(app)/server/terminal",
      params: { cwd, cmd: "claude" },
    });
  };
```

To:

```typescript
const handleProjectPress = (project: Project) => {
    router.push({
      pathname: "/(app)/server/project-detail",
      params: { name: project.name, cloneDir },
    });
  };
```

**Step 2: Commit**

```bash
git add flowforge-mobile/app/\(app\)/server/projects.tsx
git commit -m "feat(mobile): navigate to project detail instead of terminal"
```

---

### Task 8: Fix Session ID Persistence in WebView Bridge

**Files:**
- Modify: `flowforge-mobile/lib/terminal-html.ts`
- Modify: `flowforge-mobile/app/(app)/server/terminal.tsx`

**Step 1: Add postMessage to WebView JS**

In `flowforge-mobile/lib/terminal-html.ts`, find the `case 'session':` block (line 93-94):

```javascript
            case 'session':
              sessionId = msg.id;
              break;
```

Change to:

```javascript
            case 'session':
              sessionId = msg.id;
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'sessionId', id: msg.id }));
              }
              break;
```

**Step 2: Handle `onMessage` in terminal screen**

In `flowforge-mobile/app/(app)/server/terminal.tsx`, add a `currentSessionId` ref and `onMessage` handler.

Add after the `webViewRef` declaration:

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

Add `onMessage={handleWebViewMessage}` to the WebView component.

**Step 3: Commit**

```bash
git add flowforge-mobile/lib/terminal-html.ts flowforge-mobile/app/\(app\)/server/terminal.tsx
git commit -m "feat(mobile): bridge session ID from WebView back to React Native"
```

---

### Task 9: Build Verification and Manual Testing

**Step 1: Build the server**

```bash
cd flowforge-server && npm run build
```

Expected: clean compile, no errors.

**Step 2: Run mobile typecheck**

```bash
cd flowforge-mobile && npm run typecheck
```

Expected: clean, no errors.

**Step 3: Run mobile lint**

```bash
cd flowforge-mobile && npm run lint
```

Expected: clean.

**Step 4: Manual test plan**

1. Start the server (`cd flowforge-server && npm run dev`)
2. Open a terminal to a project dir to create a session
3. Call `GET /api/projects/<name>` — verify `activeSessions` includes the running terminal
4. Call `GET /api/sessions/history?project=<name>` — verify past Claude conversations appear
5. On mobile, tap a project — verify project detail screen loads with sections
6. Tap "New Session" — verify new terminal opens
7. Go back, verify the session appears under "Running Sessions"
8. Tap a running session — verify reconnection (scrollback replayed)
9. Tap a past conversation — verify `claude --resume <id>` launches

**Step 5: Commit any fixes and final commit**

```bash
git add -A
git commit -m "feat: session rejoining — list and resume Claude sessions from mobile"
```
