import { fetchProjects } from "../lib/server-api";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("fetchProjects", () => {
  const serverUrl = "http://192.168.1.100:7433";
  const token = "test-jwt-token";

  it("should return projects on success", async () => {
    const mockData = {
      cloneDir: "/home/user/repos",
      projects: [
        {
          name: "my-app",
          path: "my-app",
          hasClaudeMd: true,
          lastModified: "2026-02-17T12:00:00Z",
        },
        {
          name: "another-repo",
          path: "another-repo",
          hasClaudeMd: false,
          lastModified: "2026-02-16T08:30:00Z",
        },
      ],
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const result = await fetchProjects(serverUrl, token);
    expect(result).toEqual(mockData);
    expect(result.projects).toHaveLength(2);
    expect(result.cloneDir).toBe("/home/user/repos");
  });

  it("should call GET /api/projects with Bearer auth", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cloneDir: "/repos", projects: [] }),
    });

    await fetchProjects(serverUrl, token);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.1.100:7433/api/projects",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer test-jwt-token" },
      }),
    );
  });

  it("should strip trailing slashes from URL", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cloneDir: "/repos", projects: [] }),
    });

    await fetchProjects("http://192.168.1.100:7433///", token);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.1.100:7433/api/projects",
      expect.anything(),
    );
  });

  it("should throw on HTTP error with server message", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });

    await expect(fetchProjects(serverUrl, token)).rejects.toThrow(
      "Failed to fetch projects (401): Unauthorized",
    );
  });

  it("should throw on HTTP 500 error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    await expect(fetchProjects(serverUrl, token)).rejects.toThrow(
      "Failed to fetch projects (500): Internal Server Error",
    );
  });

  it("should throw on network error", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    await expect(fetchProjects(serverUrl, token)).rejects.toThrow(
      "Network error",
    );
  });

  it("should handle empty projects list", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cloneDir: "/repos", projects: [] }),
    });

    const result = await fetchProjects(serverUrl, token);
    expect(result.projects).toEqual([]);
    expect(result.cloneDir).toBe("/repos");
  });
});
