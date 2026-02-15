import {
  saveServerCredentials,
  getServerCredentials,
  clearServerCredentials,
  pairWithServer,
  checkHealth,
} from "../lib/server-auth";

// Mock expo-secure-store
const store = new Map<string, string>();

jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn((key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve();
  }),
  getItemAsync: jest.fn((key: string) => {
    return Promise.resolve(store.get(key) ?? null);
  }),
  deleteItemAsync: jest.fn((key: string) => {
    store.delete(key);
    return Promise.resolve();
  }),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  store.clear();
  mockFetch.mockReset();
});

describe("server credentials", () => {
  describe("saveServerCredentials + getServerCredentials", () => {
    it("should store and retrieve credentials", async () => {
      await saveServerCredentials("http://192.168.1.100:7433", "jwt-token-123");
      const creds = await getServerCredentials();
      expect(creds).toEqual({
        url: "http://192.168.1.100:7433",
        token: "jwt-token-123",
      });
    });
  });

  describe("getServerCredentials", () => {
    it("should return null when no credentials stored", async () => {
      const creds = await getServerCredentials();
      expect(creds).toBeNull();
    });

    it("should return null when only url is stored", async () => {
      store.set("home_server_url", "http://localhost:7433");
      const creds = await getServerCredentials();
      expect(creds).toBeNull();
    });

    it("should return null when only token is stored", async () => {
      store.set("home_server_token", "some-token");
      const creds = await getServerCredentials();
      expect(creds).toBeNull();
    });
  });

  describe("clearServerCredentials", () => {
    it("should remove stored credentials", async () => {
      await saveServerCredentials("http://localhost:7433", "token");
      await clearServerCredentials();
      const creds = await getServerCredentials();
      expect(creds).toBeNull();
    });
  });
});

describe("pairWithServer", () => {
  it("should return token on successful pairing", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: "new-jwt-token" }),
    });

    const token = await pairWithServer("http://192.168.1.100:7433", "123456");
    expect(token).toBe("new-jwt-token");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.1.100:7433/api/pair",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ code: "123456" }),
      }),
    );
  });

  it("should strip trailing slashes from URL", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: "token" }),
    });

    await pairWithServer("http://192.168.1.100:7433///", "123456");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.1.100:7433/api/pair",
      expect.anything(),
    );
  });

  it("should throw on HTTP error with server message", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Invalid or expired code" }),
    });

    await expect(
      pairWithServer("http://localhost:7433", "000000"),
    ).rejects.toThrow("Invalid or expired code");
  });

  it("should throw generic error when server returns no JSON", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("not json")),
    });

    await expect(
      pairWithServer("http://localhost:7433", "000000"),
    ).rejects.toThrow("Pairing failed (500)");
  });

  it("should throw when response has no token", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await expect(
      pairWithServer("http://localhost:7433", "123456"),
    ).rejects.toThrow("No token in pairing response");
  });
});

describe("checkHealth", () => {
  it("should return true when server responds ok", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const result = await checkHealth("http://192.168.1.100:7433");
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.1.100:7433/health",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("should strip trailing slashes", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await checkHealth("http://192.168.1.100:7433/");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.1.100:7433/health",
      expect.anything(),
    );
  });

  it("should return false when server responds with error", async () => {
    mockFetch.mockResolvedValue({ ok: false });
    const result = await checkHealth("http://192.168.1.100:7433");
    expect(result).toBe(false);
  });

  it("should return false on network error", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    const result = await checkHealth("http://192.168.1.100:7433");
    expect(result).toBe(false);
  });

  it("should return false on timeout (abort)", async () => {
    mockFetch.mockRejectedValue(new DOMException("Aborted", "AbortError"));
    const result = await checkHealth("http://192.168.1.100:7433");
    expect(result).toBe(false);
  });
});
