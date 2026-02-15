export interface ClaudeCodeSetupResult {
  enabled: boolean;
  configureUrl: string;
}

/**
 * Claude GitHub App repo access cannot be granted programmatically because
 * the /user/installations API requires a GitHub App OAuth token, but
 * FlowForge uses a regular OAuth App token.
 *
 * Instead, we return a direct link to the Claude App configuration page
 * where the user can add the repo with one tap.
 */
export function setupClaudeCode(): ClaudeCodeSetupResult {
  return {
    enabled: false,
    configureUrl: "https://github.com/apps/claude/installations/select_target",
  };
}
