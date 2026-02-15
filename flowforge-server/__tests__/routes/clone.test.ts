import { EventEmitter } from "events";

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

// Extract the actual handler from the router stack
// The router has: [jsonParser middleware, authMiddleware, handler]
function getHandler() {
  const layer = cloneRouter.stack.find(
    (l: { route?: { path: string } }) => l.route?.path === "/api/clone",
  );
  // The route has its own stack of handlers; the last one is our handler
  const handlers = layer!.route!.stack;
  return handlers[handlers.length - 1].handle;
}

// Mock Express req/res
function createMockReq(body: Record<string, unknown> = {}) {
  return { body, headers: {} } as unknown as import("express").Request;
}

function createMockRes() {
  const chunks: string[] = [];
  const headers: Record<string, string> = {};
  let statusCode = 200;

  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: unknown) {
      statusCode = statusCode;
      chunks.push(JSON.stringify(data));
    },
    setHeader(key: string, value: string) {
      headers[key] = value;
    },
    write(chunk: string) {
      chunks.push(chunk);
    },
    end() {
      // noop
    },
    get statusCode() {
      return statusCode;
    },
    get written() {
      return chunks.join("");
    },
    get ndjsonLines() {
      return chunks
        .join("")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l));
    },
  };
  return res;
}

describe("clone route", () => {
  let handler: Function;

  beforeAll(() => {
    handler = getHandler();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("validation", () => {
    it("should reject missing cloneUrl", () => {
      const req = createMockReq({});
      const res = createMockRes();
      handler(req, res);
      expect(res.statusCode).toBe(400);
      expect(res.ndjsonLines).toEqual([{ error: "Missing cloneUrl" }]);
    });

    it("should reject non-string cloneUrl", () => {
      const req = createMockReq({ cloneUrl: 123 as unknown as string });
      const res = createMockRes();
      handler(req, res);
      expect(res.statusCode).toBe(400);
    });

    it("should reject cloneUrl without https:// or git@ prefix", () => {
      const req = createMockReq({ cloneUrl: "http://github.com/foo/bar" });
      const res = createMockRes();
      handler(req, res);
      expect(res.statusCode).toBe(400);
      expect(res.ndjsonLines[0].error).toMatch(/must start with/);
    });
  });

  describe("git clone execution", () => {
    function setupMockProcess() {
      const proc = new EventEmitter();
      Object.assign(proc, {
        stderr: new EventEmitter(),
        stdout: new EventEmitter(),
      });
      mockSpawn.mockReturnValue(proc);
      return proc as EventEmitter & {
        stderr: EventEmitter;
        stdout: EventEmitter;
      };
    }

    it("should spawn git clone with correct args for https URL", () => {
      const proc = setupMockProcess();
      const req = createMockReq({
        cloneUrl: "https://github.com/user/repo.git",
      });
      const res = createMockRes();

      handler(req, res);

      expect(mockSpawn).toHaveBeenCalledWith("git", [
        "clone",
        "--progress",
        "https://github.com/user/repo.git",
        expect.stringContaining("repo"),
      ]);

      proc.emit("close", 0);
    });

    it("should spawn git clone for git@ URLs", () => {
      const proc = setupMockProcess();
      const req = createMockReq({ cloneUrl: "git@github.com:user/repo.git" });
      const res = createMockRes();

      handler(req, res);

      expect(mockSpawn).toHaveBeenCalledWith("git", [
        "clone",
        "--progress",
        "git@github.com:user/repo.git",
        expect.stringContaining("repo"),
      ]);

      proc.emit("close", 0);
    });

    it("should stream progress from git stderr", () => {
      const proc = setupMockProcess();
      const req = createMockReq({
        cloneUrl: "https://github.com/user/repo.git",
      });
      const res = createMockRes();

      handler(req, res);

      proc.stderr.emit("data", Buffer.from("Cloning into 'repo'..."));
      proc.stderr.emit("data", Buffer.from("Receiving objects: 50%"));
      proc.emit("close", 0);

      const lines = res.ndjsonLines;
      expect(lines[0].type).toBe("progress");
      expect(
        lines.some((l: { type: string; message?: string }) =>
          l.message?.includes("Cloning into"),
        ),
      ).toBe(true);
      expect(lines[lines.length - 1].type).toBe("done");
    });

    it("should stream error on non-zero exit code", () => {
      const proc = setupMockProcess();
      const req = createMockReq({
        cloneUrl: "https://github.com/user/repo.git",
      });
      const res = createMockRes();

      handler(req, res);
      proc.emit("close", 128);

      const errorLine = res.ndjsonLines.find(
        (l: { type: string }) => l.type === "error",
      );
      expect(errorLine).toBeDefined();
      expect(errorLine.message).toMatch(/exited with code 128/);
    });

    it("should handle spawn error event", () => {
      const proc = setupMockProcess();
      const req = createMockReq({
        cloneUrl: "https://github.com/user/repo.git",
      });
      const res = createMockRes();

      handler(req, res);
      proc.emit("error", new Error("ENOENT"));

      const errorLine = res.ndjsonLines.find(
        (l: { type: string }) => l.type === "error",
      );
      expect(errorLine).toBeDefined();
      expect(errorLine.message).toBe("ENOENT");
    });
  });

  describe("launchClaude option", () => {
    it("should create a terminal session when launchClaude is true", () => {
      const proc = new EventEmitter();
      Object.assign(proc, {
        stderr: new EventEmitter(),
        stdout: new EventEmitter(),
      });
      mockSpawn.mockReturnValue(proc);
      mockCreateSession.mockReturnValue({ id: "session-123" });

      const req = createMockReq({
        cloneUrl: "https://github.com/user/repo.git",
        launchClaude: true,
      });
      const res = createMockRes();

      handler(req, res);
      proc.emit("close", 0);

      const doneLine = res.ndjsonLines.find(
        (l: { type: string }) => l.type === "done",
      );
      expect(doneLine.sessionId).toBe("session-123");
      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({ cmd: "claude" }),
      );
    });

    it("should report error when session creation fails", () => {
      const proc = new EventEmitter();
      Object.assign(proc, {
        stderr: new EventEmitter(),
        stdout: new EventEmitter(),
      });
      mockSpawn.mockReturnValue(proc);
      mockCreateSession.mockReturnValue(null);

      const req = createMockReq({
        cloneUrl: "https://github.com/user/repo.git",
        launchClaude: true,
      });
      const res = createMockRes();

      handler(req, res);
      proc.emit("close", 0);

      const errorLine = res.ndjsonLines.find(
        (l: { type: string }) => l.type === "error",
      );
      expect(errorLine).toBeDefined();
      expect(errorLine.message).toMatch(/max sessions/);
    });

    it("should not create session when launchClaude is false", () => {
      const proc = new EventEmitter();
      Object.assign(proc, {
        stderr: new EventEmitter(),
        stdout: new EventEmitter(),
      });
      mockSpawn.mockReturnValue(proc);

      const req = createMockReq({
        cloneUrl: "https://github.com/user/repo.git",
        launchClaude: false,
      });
      const res = createMockRes();

      handler(req, res);
      proc.emit("close", 0);

      expect(mockCreateSession).not.toHaveBeenCalled();
      const doneLine = res.ndjsonLines.find(
        (l: { type: string }) => l.type === "done",
      );
      expect(doneLine).toBeDefined();
      expect(doneLine.sessionId).toBeUndefined();
    });
  });
});
