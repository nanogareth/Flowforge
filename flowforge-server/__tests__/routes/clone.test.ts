import { EventEmitter } from "events";
import type { Request, Response } from "express";

// Mock child_process.spawn
const mockSpawn = jest.fn();
jest.mock("child_process", () => ({
  spawn: mockSpawn,
}));

// Mock fs
jest.mock("fs", () => ({
  mkdirSync: jest.fn(),
}));

// Mock config
jest.mock("../../src/config", () => ({
  config: {
    cloneDir: "/tmp/test-projects",
  },
}));

// Mock auth middleware (pass-through)
jest.mock("../../src/auth/middleware", () => ({
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// Mock session manager
const mockCreateSession = jest.fn();
jest.mock("../../src/terminal/session-manager", () => ({
  createSession: mockCreateSession,
}));

import { cloneRouter } from "../../src/routes/clone";
import express from "express";
import http from "http";

// Helper: create a test app with the clone router
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(cloneRouter);
  return app;
}

// Helper: make a request to the clone endpoint
async function postClone(
  app: ReturnType<typeof express>,
  body: object,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const addr = server.address() as { port: number };
      fetch(`http://127.0.0.1:${addr.port}/api/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (res) => {
        const text = await res.text();
        server.close();
        resolve({ status: res.status, body: text });
      });
    });
  });
}

describe("clone route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("validation", () => {
    it("should reject missing cloneUrl", async () => {
      const app = createTestApp();
      const res = await postClone(app, {});
      expect(res.status).toBe(400);
      expect(JSON.parse(res.body).error).toBe("Missing cloneUrl");
    });

    it("should reject non-string cloneUrl", async () => {
      const app = createTestApp();
      const res = await postClone(app, { cloneUrl: 123 });
      expect(res.status).toBe(400);
      expect(JSON.parse(res.body).error).toBe("Missing cloneUrl");
    });

    it("should reject cloneUrl without https:// or git@ prefix", async () => {
      const app = createTestApp();
      const res = await postClone(app, {
        cloneUrl: "http://github.com/foo/bar",
      });
      expect(res.status).toBe(400);
      expect(JSON.parse(res.body).error).toMatch(/must start with/);
    });

    it("should accept https:// URLs", async () => {
      const mockProcess = new EventEmitter();
      Object.assign(mockProcess, {
        stderr: new EventEmitter(),
        stdout: new EventEmitter(),
      });
      mockSpawn.mockReturnValue(mockProcess);

      const app = createTestApp();
      // Start the request (don't await fully, just trigger the spawn)
      const resPromise = postClone(app, {
        cloneUrl: "https://github.com/user/repo.git",
      });

      // Wait for spawn to be called
      await new Promise((r) => setTimeout(r, 50));
      expect(mockSpawn).toHaveBeenCalledWith("git", [
        "clone",
        "--progress",
        "https://github.com/user/repo.git",
        expect.stringContaining("repo"),
      ]);

      // Complete the clone
      (mockProcess as EventEmitter).emit("close", 0);
      const res = await resPromise;
      expect(res.status).toBe(200);
    });

    it("should accept git@ URLs", async () => {
      const mockProcess = new EventEmitter();
      Object.assign(mockProcess, {
        stderr: new EventEmitter(),
        stdout: new EventEmitter(),
      });
      mockSpawn.mockReturnValue(mockProcess);

      const app = createTestApp();
      const resPromise = postClone(app, {
        cloneUrl: "git@github.com:user/repo.git",
      });

      await new Promise((r) => setTimeout(r, 50));
      (mockProcess as EventEmitter).emit("close", 0);
      const res = await resPromise;
      expect(res.status).toBe(200);
    });
  });

  describe("NDJSON streaming", () => {
    it("should stream progress messages from git stderr", async () => {
      const mockProcess = new EventEmitter();
      const mockStderr = new EventEmitter();
      const mockStdout = new EventEmitter();
      Object.assign(mockProcess, { stderr: mockStderr, stdout: mockStdout });
      mockSpawn.mockReturnValue(mockProcess);

      const app = createTestApp();
      const resPromise = postClone(app, {
        cloneUrl: "https://github.com/user/repo.git",
      });

      await new Promise((r) => setTimeout(r, 50));

      // Simulate git progress
      mockStderr.emit("data", Buffer.from("Cloning into 'repo'..."));
      mockStderr.emit("data", Buffer.from("Receiving objects: 50%"));
      (mockProcess as EventEmitter).emit("close", 0);

      const res = await resPromise;
      const lines = res.body
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l));

      // Should have: initial progress + 2 stderr messages + done
      expect(lines[0].type).toBe("progress");
      expect(
        lines.some((l: { type: string; message?: string }) =>
          l.message?.includes("Cloning into"),
        ),
      ).toBe(true);
      expect(lines[lines.length - 1].type).toBe("done");
    });

    it("should stream error on git failure", async () => {
      const mockProcess = new EventEmitter();
      Object.assign(mockProcess, {
        stderr: new EventEmitter(),
        stdout: new EventEmitter(),
      });
      mockSpawn.mockReturnValue(mockProcess);

      const app = createTestApp();
      const resPromise = postClone(app, {
        cloneUrl: "https://github.com/user/repo.git",
      });

      await new Promise((r) => setTimeout(r, 50));
      (mockProcess as EventEmitter).emit("close", 128);

      const res = await resPromise;
      const lines = res.body
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l));
      const errorLine = lines.find((l: { type: string }) => l.type === "error");
      expect(errorLine).toBeDefined();
      expect(errorLine.message).toMatch(/exited with code 128/);
    });
  });

  describe("launchClaude option", () => {
    it("should create a terminal session when launchClaude is true", async () => {
      const mockProcess = new EventEmitter();
      Object.assign(mockProcess, {
        stderr: new EventEmitter(),
        stdout: new EventEmitter(),
      });
      mockSpawn.mockReturnValue(mockProcess);
      mockCreateSession.mockReturnValue({ id: "session-123" });

      const app = createTestApp();
      const resPromise = postClone(app, {
        cloneUrl: "https://github.com/user/repo.git",
        launchClaude: true,
      });

      await new Promise((r) => setTimeout(r, 50));
      (mockProcess as EventEmitter).emit("close", 0);

      const res = await resPromise;
      const lines = res.body
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l));
      const doneLine = lines.find((l: { type: string }) => l.type === "done");
      expect(doneLine.sessionId).toBe("session-123");
      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({ cmd: "claude" }),
      );
    });

    it("should report error when session creation fails", async () => {
      const mockProcess = new EventEmitter();
      Object.assign(mockProcess, {
        stderr: new EventEmitter(),
        stdout: new EventEmitter(),
      });
      mockSpawn.mockReturnValue(mockProcess);
      mockCreateSession.mockReturnValue(null);

      const app = createTestApp();
      const resPromise = postClone(app, {
        cloneUrl: "https://github.com/user/repo.git",
        launchClaude: true,
      });

      await new Promise((r) => setTimeout(r, 50));
      (mockProcess as EventEmitter).emit("close", 0);

      const res = await resPromise;
      const lines = res.body
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l));
      const errorLine = lines.find((l: { type: string }) => l.type === "error");
      expect(errorLine).toBeDefined();
      expect(errorLine.message).toMatch(/max sessions/);
    });
  });
});
