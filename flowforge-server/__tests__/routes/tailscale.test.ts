const mockExecFile = jest.fn();
jest.mock("child_process", () => ({
  execFile: mockExecFile,
}));

jest.mock("../../src/config", () => ({
  config: {
    port: 7433,
  },
}));

import { tailscaleRouter } from "../../src/routes/tailscale";

function getHandler() {
  const layer = tailscaleRouter.stack.find(
    (l: { route?: { path: string } }) => l.route?.path === "/api/tailscale",
  );
  const handlers = layer!.route!.stack;
  return handlers[handlers.length - 1].handle;
}

function createMockReq() {
  return {} as unknown as import("express").Request;
}

function createMockRes() {
  let jsonData: unknown;
  const res = {
    json(data: unknown) {
      jsonData = data;
    },
    get data() {
      return jsonData;
    },
  };
  return res;
}

describe("tailscale route", () => {
  let handler: Function;

  beforeAll(() => {
    handler = getHandler();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return available: false when tailscale is not installed", async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(new Error("ENOENT"), "", "");
      },
    );

    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res);

    expect(res.data).toEqual({
      available: false,
      ip: null,
      hostname: null,
      serverPort: 7433,
    });
  });

  it("should return tailscale info when available", async () => {
    const statusJson = JSON.stringify({
      Self: {
        TailscaleIPs: ["100.64.1.2", "fd7a::1"],
        HostName: "my-pc",
        DNSName: "my-pc.tailnet.ts.net.",
      },
    });

    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null, statusJson, "");
      },
    );

    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res);

    expect(res.data).toEqual({
      available: true,
      ip: "100.64.1.2",
      hostname: "my-pc",
      serverPort: 7433,
    });
  });

  it("should handle malformed JSON from tailscale", async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null, "not valid json", "");
      },
    );

    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res);

    expect(res.data).toEqual({
      available: false,
      ip: null,
      hostname: null,
      serverPort: 7433,
    });
  });

  it("should handle missing Self in status", async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null, JSON.stringify({}), "");
      },
    );

    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res);

    expect(res.data).toEqual({
      available: false,
      ip: null,
      hostname: null,
      serverPort: 7433,
    });
  });

  it("should use DNSName when HostName is missing", async () => {
    const statusJson = JSON.stringify({
      Self: {
        TailscaleIPs: ["100.64.1.5"],
        DNSName: "server.tailnet.ts.net.",
      },
    });

    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null, statusJson, "");
      },
    );

    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res);

    expect(res.data).toEqual({
      available: true,
      ip: "100.64.1.5",
      hostname: "server.tailnet.ts.net",
      serverPort: 7433,
    });
  });
});
