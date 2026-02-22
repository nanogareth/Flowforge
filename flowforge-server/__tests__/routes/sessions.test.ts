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
  const layer = (sessionsRouter.stack as any[]).find(
    (l: any) => l.route?.path === routePath && l.route?.methods[method],
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
    const next = jest.fn();
    handler(req, res, next);

    expect(res.data).toEqual(mockSessions);
  });

  it("should pass cwd query param as filter", () => {
    (getActiveSessions as jest.Mock).mockReturnValue([]);

    const handler = findHandler("/api/sessions/active");
    const req = createMockReq({ cwd: "/projects/foo" });
    const res = createMockRes();
    const next = jest.fn();
    handler(req, res, next);

    expect(getActiveSessions).toHaveBeenCalledWith("/projects/foo");
  });
});

describe("GET /api/sessions/history", () => {
  it("should return 400 when project param missing", async () => {
    const handler = findHandler("/api/sessions/history");
    const req = createMockReq();
    const res = createMockRes();
    const next = jest.fn();
    await handler(req, res, next);

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
    const next = jest.fn();
    await handler(req, res, next);

    expect(res.data).toEqual(mockHistory);
    const expectedPath = require("path").resolve("/tmp/test-projects", "my-project");
    expect(getConversationHistory).toHaveBeenCalledWith(expectedPath);
  });
});
