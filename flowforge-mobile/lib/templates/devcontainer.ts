import type { StackPreset, FileToCreate } from '../types';

interface DevcontainerJson {
  name: string;
  image: string;
  features?: Record<string, Record<string, string>>;
  customizations?: {
    vscode?: {
      extensions?: string[];
    };
  };
  postCreateCommand?: string;
}

const BASE_EXTENSIONS = [
  'anthropics.claude-code',
];

const STACK_CONFIG: Record<
  string,
  {
    features: Record<string, Record<string, string>>;
    extensions: string[];
    postCreateTools: string[];
  }
> = {
  'typescript-react': {
    features: {
      'ghcr.io/devcontainers/features/node:1': {},
    },
    extensions: [
      'dbaeumer.vscode-eslint',
      'esbenp.prettier-vscode',
    ],
    postCreateTools: ['npm install -g typescript eslint'],
  },
  'typescript-node': {
    features: {
      'ghcr.io/devcontainers/features/node:1': {},
    },
    extensions: [
      'dbaeumer.vscode-eslint',
      'esbenp.prettier-vscode',
    ],
    postCreateTools: ['npm install -g typescript eslint'],
  },
  python: {
    features: {
      'ghcr.io/devcontainers/features/python:1': { version: '3.12' },
    },
    extensions: [
      'ms-python.python',
      'ms-python.mypy-type-checker',
      'charliermarsh.ruff',
    ],
    postCreateTools: [
      'pip install --user black ruff mypy pytest pytest-json-report',
    ],
  },
  rust: {
    features: {
      'ghcr.io/devcontainers/features/rust:1': {},
    },
    extensions: [
      'rust-lang.rust-analyzer',
    ],
    postCreateTools: ['rustup component add rustfmt clippy'],
  },
  custom: {
    features: {},
    extensions: [],
    postCreateTools: [],
  },
};

export function getDevcontainerFiles(
  stack: StackPreset,
  name: string
): FileToCreate[] {
  const config = STACK_CONFIG[stack] ?? STACK_CONFIG.custom;

  const devcontainer: DevcontainerJson = {
    name,
    image: 'mcr.microsoft.com/devcontainers/universal:2',
  };

  if (Object.keys(config.features).length > 0) {
    devcontainer.features = config.features;
  }

  const allExtensions = [...BASE_EXTENSIONS, ...config.extensions];
  devcontainer.customizations = {
    vscode: { extensions: allExtensions },
  };

  devcontainer.postCreateCommand = 'bash .devcontainer/post-create.sh';

  const postCreateLines = [
    '#!/bin/bash',
    'set -e',
    '',
    '# Platform base setup',
    'echo "Setting up Claude Code environment..."',
    'chmod +x .claude/hooks/*.sh 2>/dev/null || true',
    '',
  ];

  if (config.postCreateTools.length > 0) {
    postCreateLines.push('# Stack-specific tools');
    for (const cmd of config.postCreateTools) {
      postCreateLines.push(cmd);
    }
    postCreateLines.push('');
  }

  postCreateLines.push('echo "Dev container setup complete."');
  postCreateLines.push('');

  return [
    {
      path: '.devcontainer/devcontainer.json',
      content: JSON.stringify(devcontainer, null, 2) + '\n',
    },
    {
      path: '.devcontainer/post-create.sh',
      content: postCreateLines.join('\n'),
    },
  ];
}
