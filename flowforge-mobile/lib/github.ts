import { Octokit } from "@octokit/rest";
import type {
  CreateRepoOptions,
  CreateRepoResult,
  FileToCreate,
} from "./types";
import { composeTemplate } from "./templates/compose";

// Base64 encode that works in React Native (no Buffer)
function toBase64(str: string): string {
  // Handle UTF-8 by encoding to percent-escaped bytes first
  const encoded = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
  return btoa(encoded);
}

// Rate limit: minimum 500ms between repo creations
let lastCreationTime = 0;
const MIN_CREATION_INTERVAL = 500;

export async function createRepository(
  token: string,
  options: CreateRepoOptions,
): Promise<CreateRepoResult> {
  // Rate limiting
  const now = Date.now();
  const timeSinceLastCreation = now - lastCreationTime;
  if (timeSinceLastCreation < MIN_CREATION_INTERVAL) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_CREATION_INTERVAL - timeSinceLastCreation),
    );
  }
  lastCreationTime = Date.now();

  const octokit = new Octokit({ auth: token });
  const { name, description, isPrivate, workflow, stack, contextFile } =
    options;

  let repoFullName: string | undefined;

  try {
    // Step 1: Create repo with initial commit (required for Git Data API)
    const { data: repo } = await octokit.repos.createForAuthenticatedUser({
      name,
      description: description || undefined,
      private: isPrivate,
      auto_init: true,
    });

    repoFullName = repo.full_name;
    const repoId = repo.id;
    const [owner, repoName] = repo.full_name.split("/");

    // Step 2: Get the initial commit SHA
    const { data: ref } = await octokit.git.getRef({
      owner,
      repo: repoName,
      ref: "heads/main",
    });
    const baseSha = ref.object.sha;

    // Step 3: Compose template files from workflow + stack
    const files: FileToCreate[] = composeTemplate(
      workflow,
      stack,
      name,
      description,
    );

    // Step 3b: Inject context file if provided
    if (contextFile) {
      files.push({
        path: `context/${contextFile.filename}`,
        content: contextFile.content,
      });
      const claudeMdIndex = files.findIndex((f) => f.path === "CLAUDE.md");
      if (claudeMdIndex !== -1) {
        files[claudeMdIndex].content +=
          "\n\n---\n\n## Project Context\n\n" +
          "This repository was initialized from an Obsidian note. The original content is preserved at:\n\n" +
          `- \`@context/${contextFile.filename}\`\n\n` +
          "Refer to this file for project background, requirements, or research notes.\n";
      }
    }

    // Step 4: Create blobs for each file
    const blobs = await Promise.all(
      files.map((file) =>
        octokit.git.createBlob({
          owner,
          repo: repoName,
          content: toBase64(file.content),
          encoding: "base64",
        }),
      ),
    );

    // Step 5: Create tree
    const { data: tree } = await octokit.git.createTree({
      owner,
      repo: repoName,
      tree: blobs.map((blob, index) => ({
        path: files[index].path,
        mode: "100644" as const,
        type: "blob" as const,
        sha: blob.data.sha,
      })),
    });

    // Step 6: Create commit on top of initial commit
    const { data: commit } = await octokit.git.createCommit({
      owner,
      repo: repoName,
      message: "Initial setup via FlowForge",
      tree: tree.sha,
      parents: [baseSha],
    });

    // Step 7: Update main branch to point to new commit
    await octokit.git.updateRef({
      owner,
      repo: repoName,
      ref: "heads/main",
      sha: commit.sha,
    });

    return {
      success: true,
      repo: {
        id: repoId,
        full_name: repo.full_name,
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        ssh_url: repo.ssh_url,
        workflow,
        stack,
        createdAt: new Date().toISOString(),
      },
    };
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };

    // If repo was created but files failed, offer recovery info
    if (repoFullName) {
      return {
        success: false,
        error: `Repository created but file setup failed: ${err.message}. You can delete the repo and try again, or add files manually.`,
        partialRepo: repoFullName,
      };
    }

    // Handle specific GitHub errors
    if (err.status === 422) {
      return {
        success: false,
        error: "Repository name already exists or is invalid.",
      };
    }

    if (err.status === 403) {
      return {
        success: false,
        error: "API rate limit exceeded. Please wait a moment and try again.",
      };
    }

    return {
      success: false,
      error: err.message || "Failed to create repository",
    };
  }
}

export async function deleteRepository(
  token: string,
  fullName: string,
): Promise<boolean> {
  try {
    const octokit = new Octokit({ auth: token });
    const [owner, repo] = fullName.split("/");
    await octokit.repos.delete({ owner, repo });
    return true;
  } catch {
    return false;
  }
}

// Validation helper
export function isValidRepoName(name: string): boolean {
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(name);
}
