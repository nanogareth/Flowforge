import {
  findClaudeCodeInstallation,
  enableClaudeCodeForRepo,
  setupClaudeCode,
} from "../lib/claude-code-app";

// Mock Octokit
const mockListInstallations = jest.fn();
const mockAddRepo = jest.fn();

jest.mock("@octokit/rest", () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    apps: {
      listInstallationsForAuthenticatedUser: mockListInstallations,
      addRepoToInstallationForAuthenticatedUser: mockAddRepo,
    },
  })),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("findClaudeCodeInstallation", () => {
  it("should return installation id when Claude app is found", async () => {
    mockListInstallations.mockResolvedValue({
      data: {
        installations: [
          { id: 123, app_slug: "other-app" },
          { id: 456, app_slug: "claude" },
        ],
      },
    });

    const result = await findClaudeCodeInstallation("token");
    expect(result).toBe(456);
  });

  it("should return null when Claude app is not installed", async () => {
    mockListInstallations.mockResolvedValue({
      data: {
        installations: [{ id: 123, app_slug: "other-app" }],
      },
    });

    const result = await findClaudeCodeInstallation("token");
    expect(result).toBeNull();
  });

  it("should return null on API error", async () => {
    mockListInstallations.mockRejectedValue(new Error("Network error"));

    const result = await findClaudeCodeInstallation("token");
    expect(result).toBeNull();
  });
});

describe("enableClaudeCodeForRepo", () => {
  it("should return true on success", async () => {
    mockAddRepo.mockResolvedValue({});

    const result = await enableClaudeCodeForRepo("token", 456, 789);
    expect(result).toBe(true);
    expect(mockAddRepo).toHaveBeenCalledWith({
      installation_id: 456,
      repository_id: 789,
    });
  });

  it("should return false on error", async () => {
    mockAddRepo.mockRejectedValue(new Error("Not found"));

    const result = await enableClaudeCodeForRepo("token", 456, 789);
    expect(result).toBe(false);
  });
});

describe("setupClaudeCode", () => {
  it("should return enabled true when app is installed and repo added", async () => {
    mockListInstallations.mockResolvedValue({
      data: {
        installations: [{ id: 456, app_slug: "claude" }],
      },
    });
    mockAddRepo.mockResolvedValue({});

    const result = await setupClaudeCode("token", 789);
    expect(result.success).toBe(true);
    expect(result.enabled).toBe(true);
  });

  it("should return installUrl when app is not installed", async () => {
    mockListInstallations.mockResolvedValue({
      data: { installations: [] },
    });

    const result = await setupClaudeCode("token", 789);
    expect(result.success).toBe(true);
    expect(result.enabled).toBe(false);
    expect(result.installUrl).toBe("https://github.com/apps/claude");
  });

  it("should handle enable failure gracefully", async () => {
    mockListInstallations.mockResolvedValue({
      data: {
        installations: [{ id: 456, app_slug: "claude" }],
      },
    });
    mockAddRepo.mockRejectedValue(new Error("Forbidden"));

    const result = await setupClaudeCode("token", 789);
    expect(result.success).toBe(true);
    expect(result.enabled).toBe(false);
    expect(result.installUrl).toBeDefined();
  });

  it("should handle network error in find", async () => {
    mockListInstallations.mockRejectedValue(new Error("Network error"));

    const result = await setupClaudeCode("token", 789);
    // findClaudeCodeInstallation returns null on error → treated as not installed
    expect(result.success).toBe(true);
    expect(result.enabled).toBe(false);
    expect(result.installUrl).toBeDefined();
  });
});
