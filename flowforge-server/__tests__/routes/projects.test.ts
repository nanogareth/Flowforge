jest.mock("fs", () => ({
  readdirSync: jest.fn(),
  statSync: jest.fn(),
  existsSync: jest.fn(),
}));

jest.mock("../../src/config", () => ({
  config: {
    cloneDir: "/tmp/test-projects",
  },
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

import fs from "fs";
import { projectsRouter } from "../../src/routes/projects";
import { getActiveSessions } from "../../src/terminal/session-manager";
import { getConversationHistory } from "../../src/lib/claude-sessions";

const mockReaddirSync = fs.readdirSync as jest.Mock;
const mockStatSync = fs.statSync as jest.Mock;
const mockExistsSync = fs.existsSync as jest.Mock;

function getHandler() {
  const layer = projectsRouter.stack.find(
    (l: { route?: { path: string } }) => l.route?.path === "/api/projects",
  );
  const handlers = layer!.route!.stack;
  return handlers[handlers.length - 1].handle;
}

function createMockReq() {
  return { headers: {} } as unknown as import("express").Request;
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
      return jsonData as Record<string, unknown>;
    },
    get statusCode() {
      return statusCode;
    },
  };
  return res;
}

describe("projects route", () => {
  let handler: Function;

  beforeAll(() => {
    handler = getHandler();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return empty array when cloneDir does not exist", () => {
    mockReaddirSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const req = createMockReq();
    const res = createMockRes();
    handler(req, res);

    expect(res.data).toEqual({
      cloneDir: "/tmp/test-projects",
      projects: [],
    });
  });

  it("should return only git repos", () => {
    mockReaddirSync.mockReturnValue([
      { name: "my-project", isDirectory: () => true },
      { name: "not-a-repo", isDirectory: () => true },
      { name: "file.txt", isDirectory: () => false },
    ]);

    mockStatSync.mockImplementation((path: string) => {
      if (path.includes("my-project")) {
        return {
          isDirectory: () => true,
          mtime: new Date("2026-01-15T10:00:00Z"),
        };
      }
      throw new Error("ENOENT");
    });

    mockExistsSync.mockImplementation((path: string) => {
      return path.includes("my-project") && path.includes("CLAUDE.md");
    });

    const req = createMockReq();
    const res = createMockRes();
    handler(req, res);

    expect(res.data.projects).toHaveLength(1);
    const projects = res.data.projects as Array<Record<string, unknown>>;
    expect(projects[0].name).toBe("my-project");
    expect(projects[0].hasClaudeMd).toBe(true);
  });

  it("should report hasClaudeMd false when missing", () => {
    mockReaddirSync.mockReturnValue([
      { name: "bare-repo", isDirectory: () => true },
    ]);

    mockStatSync.mockReturnValue({
      isDirectory: () => true,
      mtime: new Date("2026-01-10T10:00:00Z"),
    });

    mockExistsSync.mockReturnValue(false);

    const req = createMockReq();
    const res = createMockRes();
    handler(req, res);

    const projects = res.data.projects as Array<Record<string, unknown>>;
    expect(projects).toHaveLength(1);
    expect(projects[0].hasClaudeMd).toBe(false);
  });

  it("should sort by lastModified descending", () => {
    mockReaddirSync.mockReturnValue([
      { name: "old-project", isDirectory: () => true },
      { name: "new-project", isDirectory: () => true },
    ]);

    mockStatSync.mockImplementation((path: string) => {
      if (path.includes("old-project")) {
        return {
          isDirectory: () => true,
          mtime: new Date("2026-01-01T00:00:00Z"),
        };
      }
      return {
        isDirectory: () => true,
        mtime: new Date("2026-02-01T00:00:00Z"),
      };
    });

    mockExistsSync.mockReturnValue(false);

    const req = createMockReq();
    const res = createMockRes();
    handler(req, res);

    const projects = res.data.projects as Array<Record<string, unknown>>;
    expect(projects).toHaveLength(2);
    expect(projects[0].name).toBe("new-project");
    expect(projects[1].name).toBe("old-project");
  });
});

function findParamHandler() {
  const layer = (projectsRouter.stack as any[]).find(
    (l: any) => l.route?.path === "/api/projects/:name",
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 404 for non-existent project", async () => {
    mockStatSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const req = createMockReqWithParams({ name: "nonexistent" });
    const res = createMockRes();
    const next = jest.fn();
    await handler(req, res, next);

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
    const next = jest.fn();
    await handler(req, res, next);

    expect(res.data).toMatchObject({
      name: "my-project",
      path: "my-project",
      hasClaudeMd: true,
      activeSessions: mockActive,
      recentConversations: mockHistory,
    });
  });
});
