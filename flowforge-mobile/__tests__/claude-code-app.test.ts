import { setupClaudeCode } from "../lib/claude-code-app";

describe("setupClaudeCode", () => {
  it("should return configureUrl and enabled false", () => {
    const result = setupClaudeCode();
    expect(result.enabled).toBe(false);
    expect(result.configureUrl).toContain("github.com/apps/claude");
  });
});
