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

import fs from "fs";
import { projectsRouter } from "../../src/routes/projects";

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
