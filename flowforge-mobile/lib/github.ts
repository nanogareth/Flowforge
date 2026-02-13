import { Octokit } from '@octokit/rest';
import type { CreateRepoOptions, CreateRepoResult, FileToCreate } from './types';
import { composeTemplate } from './templates/compose';

// Rate limit: minimum 500ms between repo creations
let lastCreationTime = 0;
const MIN_CREATION_INTERVAL = 500;

export async function createRepository(
  token: string,
  options: CreateRepoOptions
): Promise<CreateRepoResult> {
  // Rate limiting
  const now = Date.now();
  const timeSinceLastCreation = now - lastCreationTime;
  if (timeSinceLastCreation < MIN_CREATION_INTERVAL) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_CREATION_INTERVAL - timeSinceLastCreation)
    );
  }
  lastCreationTime = Date.now();

  const octokit = new Octokit({ auth: token });
  const { name, description, isPrivate, workflow, stack } = options;

  let repoFullName: string | undefined;

  try {
    // Step 1: Create empty repo
    const { data: repo } = await octokit.repos.createForAuthenticatedUser({
      name,
      description: description || undefined,
      private: isPrivate,
      auto_init: false,
    });

    repoFullName = repo.full_name;
    const [owner, repoName] = repo.full_name.split('/');

    // Step 2: Compose template files from workflow + stack
    const files: FileToCreate[] = composeTemplate(workflow, stack, name, description);

    // Step 3: Create blobs for each file
    const blobs = await Promise.all(
      files.map((file) =>
        octokit.git.createBlob({
          owner,
          repo: repoName,
          content: Buffer.from(file.content).toString('base64'),
          encoding: 'base64',
        })
      )
    );

    // Step 4: Create tree
    const { data: tree } = await octokit.git.createTree({
      owner,
      repo: repoName,
      tree: blobs.map((blob, index) => ({
        path: files[index].path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blob.data.sha,
      })),
    });

    // Step 5: Create commit
    const { data: commit } = await octokit.git.createCommit({
      owner,
      repo: repoName,
      message: 'Initial setup via FlowForge',
      tree: tree.sha,
    });

    // Step 6: Create main branch
    await octokit.git.createRef({
      owner,
      repo: repoName,
      ref: 'refs/heads/main',
      sha: commit.sha,
    });

    // Step 7: Set default branch
    await octokit.repos.update({
      owner,
      repo: repoName,
      default_branch: 'main',
    });

    return {
      success: true,
      repo: {
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
        error: 'Repository name already exists or is invalid.',
      };
    }

    if (err.status === 403) {
      return {
        success: false,
        error: 'API rate limit exceeded. Please wait a moment and try again.',
      };
    }

    return {
      success: false,
      error: err.message || 'Failed to create repository',
    };
  }
}

export async function deleteRepository(
  token: string,
  fullName: string
): Promise<boolean> {
  try {
    const octokit = new Octokit({ auth: token });
    const [owner, repo] = fullName.split('/');
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
