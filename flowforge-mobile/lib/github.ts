import { Octokit } from '@octokit/rest';

export type ProjectTemplate = 'web-app' | 'cli-tool';

export interface CreateRepoOptions {
  name: string;
  description?: string;
  isPrivate: boolean;
  template: ProjectTemplate;
}

export interface CreateRepoResult {
  success: boolean;
  repo?: {
    full_name: string;
    html_url: string;
    clone_url: string;
    ssh_url: string;
  };
  error?: string;
  partialRepo?: string;
}

interface FileToCreate {
  path: string;
  content: string;
}

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
  const { name, description, isPrivate, template } = options;

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

    // Step 2: Get template files
    const files = getTemplateFiles(template, name, description);

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

function getTemplateFiles(
  template: ProjectTemplate,
  projectName: string,
  description?: string
): FileToCreate[] {
  const templates = {
    'web-app': getWebAppTemplate,
    'cli-tool': getCliToolTemplate,
  };

  return templates[template](projectName, description || '');
}

export function getWebAppTemplate(
  name: string,
  description: string
): FileToCreate[] {
  return [
    {
      path: 'CLAUDE.md',
      content: `# ${name}

${description}

## Project Overview

This is a web application project.

## Tech Stack

- Framework: (To be determined)
- Styling: (To be determined)
- Deployment: (To be determined)

## Development Guidelines

- Write clean, maintainable code
- Follow established patterns in the codebase
- Add tests for new functionality
- Update documentation as needed

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev
\`\`\`

## Project Structure

\`\`\`
src/
├── components/    # Reusable UI components
├── pages/         # Page components/routes
├── lib/           # Utility functions
├── hooks/         # Custom React hooks
└── styles/        # Global styles
\`\`\`
`,
    },
    {
      path: 'README.md',
      content: `# ${name}

${description}

## Getting Started

\`\`\`bash
git clone https://github.com/USERNAME/${name}.git
cd ${name}
npm install
npm run dev
\`\`\`

## License

MIT
`,
    },
    {
      path: '.gitignore',
      content: `# Dependencies
node_modules/
.pnp
.pnp.js

# Build
dist/
build/
.next/
out/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Testing
coverage/

# Misc
*.tsbuildinfo
`,
    },
  ];
}

export function getCliToolTemplate(
  name: string,
  description: string
): FileToCreate[] {
  return [
    {
      path: 'CLAUDE.md',
      content: `# ${name}

${description}

## Project Overview

This is a command-line tool project.

## Tech Stack

- Language: TypeScript/Node.js
- CLI Framework: (commander, yargs, or similar)
- Build: tsup or esbuild

## Development Guidelines

- Keep the CLI interface intuitive
- Provide helpful error messages
- Support --help for all commands
- Add tests for command parsing and core logic

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Run in development
npm run dev -- [args]

# Build
npm run build

# Run built version
node dist/index.js [args]
\`\`\`

## Command Structure

\`\`\`
${name} <command> [options]

Commands:
  (Define your commands here)

Options:
  -h, --help     Show help
  -v, --version  Show version
\`\`\`
`,
    },
    {
      path: 'README.md',
      content: `# ${name}

${description}

## Installation

\`\`\`bash
npm install -g ${name}
\`\`\`

## Usage

\`\`\`bash
${name} --help
\`\`\`

## Development

\`\`\`bash
git clone https://github.com/USERNAME/${name}.git
cd ${name}
npm install
npm run dev
\`\`\`

## License

MIT
`,
    },
    {
      path: '.gitignore',
      content: `# Dependencies
node_modules/

# Build
dist/

# Environment
.env
.env.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Testing
coverage/

# Misc
*.tsbuildinfo
`,
    },
  ];
}

// Validation helper
export function isValidRepoName(name: string): boolean {
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(name);
}
