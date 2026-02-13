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
cargo build
\`\`\`

## Development

\`\`\`bash
cargo run              # Run
cargo test             # Run tests
cargo clippy           # Lint
cargo fmt              # Format
cargo check            # Type check (fast compile check)
\`\`\`

## License

MIT
`,
    },
  ];
}

export function getStackClaudeMdSections(): ClaudeMdSection[] {
  return [
    {
      heading: '## Tech Stack',
      content: `- **Language:** Rust
- **Formatter:** rustfmt
- **Linter:** Clippy
- **Type Checker:** Rust compiler
- **Test Runner:** cargo test`,
      order: 10,
      source: 'stack',
    },
    {
      heading: '## Getting Started',
      content: `\`\`\`bash
cargo build
cargo run
\`\`\``,
      order: 20,
      source: 'stack',
    },
    {
      heading: '## Project Structure',
      content: `\`\`\`
src/
├── main.rs        # Entry point
├── lib.rs         # Library root
└── modules/       # Feature modules
tests/
└── integration/   # Integration tests
\`\`\``,
      order: 40,
      source: 'stack',
    },
  ];
}

export function getStackGitignore(): string {
  return `# Rust
target/
Cargo.lock
`;
}
