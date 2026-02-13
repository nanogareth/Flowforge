import type { FileToCreate } from '../../types';
import type { ClaudeMdSection } from '../claude-md';

export function getStackFiles(name: string): FileToCreate[] {
  return [
    {
      path: 'README.md',
      content: `# ${name}

## Getting Started

\`\`\`bash
git clone https://github.com/USERNAME/${name}.git
cd ${name}
python -m venv .venv
source .venv/bin/activate  # or .venv\\Scripts\\activate on Windows
pip install -e ".[dev]"
\`\`\`

## Development

\`\`\`bash
py -m pytest           # Run tests
py -m ruff check .     # Lint
py -m mypy .           # Type check
py -m black .          # Format
\`\`\`

## License

MIT
`,
    },
    {
      path: 'pyproject.toml',
      content: `[project]
name = "${name}"
version = "0.1.0"
description = ""
requires-python = ">=3.11"
dependencies = []

[project.optional-dependencies]
dev = [
    "pytest",
    "pytest-json-report",
    "black",
    "ruff",
    "mypy",
]

[build-system]
requires = ["setuptools>=68.0"]
build-backend = "setuptools.backends._legacy:_Backend"
`,
    },
    {
      path: 'tests/conftest.py',
      content: `"""Pytest configuration — shared fixtures and settings."""


def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line("markers", "slow: mark test as slow-running")
    config.addinivalue_line("markers", "integration: mark test as integration test")
`,
    },
  ];
}

export function getStackClaudeMdSections(): ClaudeMdSection[] {
  return [
    {
      heading: '## Tech Stack',
      content: `- **Language:** Python
- **Formatter:** Black / Ruff
- **Linter:** Ruff
- **Type Checker:** mypy
- **Test Runner:** pytest`,
      order: 10,
      source: 'stack',
    },
    {
      heading: '## Getting Started',
      content: `\`\`\`bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
\`\`\``,
      order: 20,
      source: 'stack',
    },
    {
      heading: '## Project Structure',
      content: `\`\`\`
src/
├── __init__.py
├── main.py        # Entry point
├── lib/           # Core logic
└── utils/         # Utility functions
tests/
├── conftest.py    # pytest configuration
└── test_*.py      # Test files
\`\`\``,
      order: 40,
      source: 'stack',
    },
  ];
}

export function getStackGitignore(): string {
  return `# Python
__pycache__/
*.py[cod]
*$py.class
*.egg-info/
.eggs/

# Virtual environment
.venv/
venv/

# Type checking
.mypy_cache/

# Testing
.pytest_cache/
htmlcov/

# Distribution
dist/
build/
`;
}
