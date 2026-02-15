import { EventEmitter } from "events";

// Create a mock pty process
function createMockPty() {
  const emitter = new EventEmitter();
  return {
    onData: (cb: (data: string) => void) => emitter.on("data", cb),
    onExit: (cb: (e: { exitCode: number }) => void) => emitter.on("exit", cb),
    write: jest.fn(),
    kill: jest.fn(),
    resize: jest.fn(),
    _emit: (event: string, data: unknown) => emitter.emit(event, data),
  };
}

let mockPty: ReturnType<typeof createMockPty>;

jest.mock("node-pty", () => ({
  spawn: jest.fn(() => {
    mockPty = createMockPty();
    return mockPty;
  }),
}));

jest.mock("uuid", () => ({
  v4: jest.fn(() => "test-session-id"),
}));

jest.mock("../../src/config", () => ({
  config: {
    maxSessions: 2,
    scrollbackSize: 100, // small for testing
    inactivityTimeout: 30 * 60 * 1000,
  },
}));

import {
  createSession,
  getSession,
  getSessionCount,
  attachClient,
  detachClient,
  destroySession,
} from "../../src/terminal/session-manager";

// Mock WebSocket
function createMockWs(readyState = 1) {
  return {
    readyState,
    send: jest.fn(),
  } as unknown as import("ws").WebSocket;
}

describe("session-manager", () => {
  afterEach(() => {
    // Clean up all sessions
    const session = getSession("test-session-id");
    if (session) destroySession("test-session-id");
  });

  describe("createSession", () => {
    it("should create a session and return it", () => {
      const session = createSession();
      expect(session).not.toBeNull();
      expect(session!.id).toBe("test-session-id");
      expect(session!.scrollback).toBe("");
      expect(session!.exited).toBe(false);
    });

    it("should be retrievable via getSession", () => {
      const session = createSession();
      const retrieved = getSession("test-session-id");
      expect(retrieved).toBe(session);
    });

    it("should increment session count", () => {
      const before = getSessionCount();
      createSession();
      expect(getSessionCount()).toBe(before + 1);
    });

    it("should send initial command if provided", () => {
      createSession({ cmd: "claude" });
      expect(mockPty.write).toHaveBeenCalledWith("claude\r");
    });

    it("should return null when max sessions reached", () => {
      // Create sessions up to max (2)
      const { v4 } = require("uuid");
      v4.mockReturnValueOnce("session-1");
      createSession();
      v4.mockReturnValueOnce("session-2");
      createSession();

      v4.mockReturnValueOnce("session-3");
      const third = createSession();
      expect(third).toBeNull();

      // Cleanup
      destroySession("session-1");
      destroySession("session-2");
    });
  });

  describe("attachClient / detachClient", () => {
    it("should attach a client and send scrollback", () => {
      const session = createSession()!;
      const ws = createMockWs();

      const attached = attachClient(session.id, ws);
      expect(attached).toBe(true);
      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "scrollback", data: "" }),
      );
    });

    it("should return false for non-existent session", () => {
      const ws = createMockWs();
      expect(attachClient("nonexistent", ws)).toBe(false);
    });

    it("should remove client on detach", () => {
      const session = createSession()!;
      const ws = createMockWs();
      attachClient(session.id, ws);
      expect(session.clients.size).toBe(1);

      detachClient(session.id, ws);
      expect(session.clients.size).toBe(0);
    });

    it("should handle detach from non-existent session gracefully", () => {
      const ws = createMockWs();
      expect(() => detachClient("nonexistent", ws)).not.toThrow();
    });
  });

  describe("broadcast via pty output", () => {
    it("should broadcast output to attached clients", () => {
      const session = createSession()!;
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      attachClient(session.id, ws1);
      attachClient(session.id, ws2);

      // Clear the scrollback send calls
      (ws1.send as jest.Mock).mockClear();
      (ws2.send as jest.Mock).mockClear();

      // Simulate pty output
      mockPty._emit("data", "hello world");

      const expected = JSON.stringify({ type: "output", data: "hello world" });
      expect(ws1.send).toHaveBeenCalledWith(expected);
      expect(ws2.send).toHaveBeenCalledWith(expected);
    });

    it("should skip clients that are not open", () => {
      const session = createSession()!;
      const openWs = createMockWs(1); // OPEN
      const closedWs = createMockWs(3); // CLOSED
      attachClient(session.id, openWs);
      attachClient(session.id, closedWs);

      (openWs.send as jest.Mock).mockClear();
      (closedWs.send as jest.Mock).mockClear();

      mockPty._emit("data", "test");

      expect(openWs.send).toHaveBeenCalled();
      expect(closedWs.send).not.toHaveBeenCalled();
    });
  });

  describe("scrollback", () => {
    it("should accumulate output in scrollback", () => {
      const session = createSession()!;
      mockPty._emit("data", "line1\n");
      mockPty._emit("data", "line2\n");
      expect(session.scrollback).toBe("line1\nline2\n");
    });

    it("should truncate scrollback when exceeding max size", () => {
      const session = createSession()!;
      // Our mock config sets scrollbackSize to 100
      const bigChunk = "x".repeat(80);
      mockPty._emit("data", bigChunk);
      mockPty._emit("data", bigChunk);
      // Should be truncated to last 100 chars
      expect(session.scrollback.length).toBeLessThanOrEqual(100);
    });

    it("should send accumulated scrollback to newly attached clients", () => {
      const session = createSession()!;
      mockPty._emit("data", "previous output");

      const ws = createMockWs();
      attachClient(session.id, ws);

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "scrollback", data: "previous output" }),
      );
    });
  });

  describe("destroySession", () => {
    it("should remove the session", () => {
      createSession();
      expect(getSession("test-session-id")).toBeDefined();
      destroySession("test-session-id");
      expect(getSession("test-session-id")).toBeUndefined();
    });

    it("should kill the pty if not exited", () => {
      createSession();
      destroySession("test-session-id");
      expect(mockPty.kill).toHaveBeenCalled();
    });

    it("should not kill the pty if already exited", () => {
      const session = createSession()!;
      mockPty._emit("exit", { exitCode: 0 });
      expect(session.exited).toBe(true);

      mockPty.kill.mockClear();
      destroySession("test-session-id");
      expect(mockPty.kill).not.toHaveBeenCalled();
    });

    it("should handle destroying non-existent session gracefully", () => {
      expect(() => destroySession("nonexistent")).not.toThrow();
    });
  });

  describe("pty exit handling", () => {
    it("should mark session as exited and broadcast exit", () => {
      const session = createSession()!;
      const ws = createMockWs();
      attachClient(session.id, ws);
      (ws.send as jest.Mock).mockClear();

      mockPty._emit("exit", { exitCode: 42 });

      expect(session.exited).toBe(true);
      expect(session.exitCode).toBe(42);
      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "exit", code: 42 }),
      );
    });
  });
});
