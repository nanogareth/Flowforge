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
