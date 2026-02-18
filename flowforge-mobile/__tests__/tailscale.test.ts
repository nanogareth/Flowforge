import { buildServerUrl } from "../lib/tailscale";

const originalFetch = global.fetch;
const mockFetch = jest.fn();

beforeAll(() => {
  global.fetch = mockFetch as unknown as typeof fetch;
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe("buildServerUrl", () => {
  it("should add http:// and port to bare IP", () => {
    expect(buildServerUrl("100.64.1.2")).toBe("http://100.64.1.2:7433");
  });

  it("should add http:// and port to hostname", () => {
    expect(buildServerUrl("my-pc")).toBe("http://my-pc:7433");
  });

  it("should use custom port", () => {
    expect(buildServerUrl("100.64.1.2", 8080)).toBe("http://100.64.1.2:8080");
  });

  it("should return full URL as-is for http://", () => {
    expect(buildServerUrl("http://100.64.1.2:7433")).toBe(
      "http://100.64.1.2:7433",
    );
  });

  it("should return full URL as-is for https://", () => {
    expect(buildServerUrl("https://server.example.com")).toBe(
      "https://server.example.com",
    );
  });

  it("should trim whitespace and trailing slashes", () => {
    expect(buildServerUrl("  100.64.1.2/  ")).toBe("http://100.64.1.2:7433");
  });

  it("should strip trailing slash from full URL", () => {
    expect(buildServerUrl("http://100.64.1.2:7433/")).toBe(
      "http://100.64.1.2:7433",
    );
  });
});

describe("discoverServer", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("should call /api/tailscale endpoint", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          available: true,
          ip: "100.64.1.2",
          hostname: "my-pc",
          serverPort: 7433,
        }),
    });

    const { discoverServer } = require("../lib/tailscale");
    const result = await discoverServer("http://192.168.1.100:7433");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.1.100:7433/api/tailscale",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result.available).toBe(true);
    expect(result.ip).toBe("100.64.1.2");
  });

  it("should throw on non-ok response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
    });

    const { discoverServer } = require("../lib/tailscale");
    await expect(discoverServer("http://192.168.1.100:7433")).rejects.toThrow(
      "Discovery failed (404)",
    );
  });
});

describe("checkTailscaleReachable", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockFetch.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should return true when health endpoint responds ok", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const { checkTailscaleReachable } = require("../lib/tailscale");
    const promise = checkTailscaleReachable("100.64.1.2", 7433);
    jest.runAllTimers();
    const result = await promise;
    expect(result).toBe(true);
  });

  it("should return false on network error", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { checkTailscaleReachable } = require("../lib/tailscale");
    const promise = checkTailscaleReachable("100.64.1.2", 7433);
    jest.runAllTimers();
    const result = await promise;
    expect(result).toBe(false);
  });
});
