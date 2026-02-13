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
npm install
npm run dev
\`\`\`

## Usage

\`\`\`bash
npm run dev        # Run in development
npm run build      # Build for production
npm start          # Run built version
npm test           # Run tests
npm run lint       # Lint code
npm run typecheck  # Check types
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
      content: `- **Language:** TypeScript (Node.js)
- **Formatter:** Prettier
- **Linter:** ESLint
- **Type Checker:** tsc
- **Test Runner:** Jest or Vitest`,
      order: 10,
      source: 'stack',
    },
    {
      heading: '## Getting Started',
      content: `\`\`\`bash
npm install
npm run dev
\`\`\``,
      order: 20,
      source: 'stack',
    },
    {
      heading: '## Project Structure',
      content: `\`\`\`
src/
├── index.ts       # Entry point
├── lib/           # Core logic
├── utils/         # Utility functions
└── types/         # Type definitions
\`\`\``,
      order: 40,
      source: 'stack',
    },
  ];
}

export function getStackGitignore(): string {
  return `# Dependencies
node_modules/

# Build
dist/

# TypeScript
*.tsbuildinfo

# Testing
coverage/
`;
}
