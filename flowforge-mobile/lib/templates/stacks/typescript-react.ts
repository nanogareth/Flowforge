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

## Development

\`\`\`bash
npm run dev        # Start development server
npm test           # Run tests
npm run build      # Production build
npm run lint       # Lint code
npm run typecheck  # Check types
\`\`\`

## License

MIT
`,
    },
    {
      path: 'tsconfig.json',
      content: `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "outDir": "dist",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
`,
    },
  ];
}

export function getStackClaudeMdSections(): ClaudeMdSection[] {
  return [
    {
      heading: '## Tech Stack',
      content: `- **Language:** TypeScript
- **Framework:** React (configure specific framework after setup)
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
├── components/    # Reusable UI components
├── pages/         # Page components/routes
├── lib/           # Utility functions
├── hooks/         # Custom React hooks
└── styles/        # Global styles
\`\`\``,
      order: 40,
      source: 'stack',
    },
  ];
}

export function getStackGitignore(): string {
  return `# Dependencies
node_modules/
.pnp
.pnp.js

# Build
dist/
build/
.next/
out/

# TypeScript
*.tsbuildinfo

# Testing
coverage/
`;
}
