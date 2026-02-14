import { Octokit } from "@octokit/rest";

export interface ClaudeCodeSetupResult {
  success: boolean;
  enabled?: boolean;
  error?: string;
  installUrl?: string;
  message?: string;
}

const CLAUDE_APP_SLUG = "claude";
const CLAUDE_INSTALL_URL = "https://github.com/apps/claude";

export async function findClaudeCodeInstallation(
  token: string,
): Promise<number | null> {
  const octokit = new Octokit({ auth: token });

  try {
    const { data } = await octokit.apps.listInstallationsForAuthenticatedUser();
    const installation = data.installations.find(
      (inst) => inst.app_slug === CLAUDE_APP_SLUG,
    );
    return installation?.id ?? null;
  } catch {
    return null;
  }
}

export async function enableClaudeCodeForRepo(
  token: string,
  installationId: number,
  repoId: number,
): Promise<boolean> {
  const octokit = new Octokit({ auth: token });

  try {
    await octokit.apps.addRepoToInstallationForAuthenticatedUser({
      installation_id: installationId,
      repository_id: repoId,
    });
    return true;
  } catch {
    return false;
  }
}

export async function setupClaudeCode(
  token: string,
  repoId: number,
): Promise<ClaudeCodeSetupResult> {
  try {
    const installationId = await findClaudeCodeInstallation(token);

    if (!installationId) {
      return {
        success: true,
        enabled: false,
        installUrl: CLAUDE_INSTALL_URL,
        message:
          "Claude Code GitHub App is not installed. Install it to enable Claude Code for your repos.",
      };
    }

    const enabled = await enableClaudeCodeForRepo(
      token,
      installationId,
      repoId,
    );

    if (!enabled) {
      return {
        success: true,
        enabled: false,
        error: "Failed to enable Claude Code for this repository.",
        installUrl: CLAUDE_INSTALL_URL,
        message:
          "Could not add repo to Claude Code installation. You can enable it manually.",
      };
    }

    return {
      success: true,
      enabled: true,
      message: "Claude Code enabled for this repository.",
    };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return {
      success: false,
      enabled: false,
      error: err.message || "Failed to set up Claude Code",
      installUrl: CLAUDE_INSTALL_URL,
    };
  }
}
