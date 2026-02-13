import type { FileToCreate } from '../../types';
import type { ClaudeMdSection } from '../claude-md';

export function getStackFiles(name: string): FileToCreate[] {
  return [
    {
      path: 'README.md',
      content: `# ${name}

## Getting Started

Clone the repository and configure your tech stack:

\`\`\`bash
git clone https://github.com/USERNAME/${name}.git
cd ${name}
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
      content: `Tech stack to be configured. Update this section after choosing your language, framework, and tooling.`,
      order: 10,
      source: 'stack',
    },
    {
      heading: '## Getting Started',
      content: `(Configure your development setup here.)`,
      order: 20,
      source: 'stack',
    },
    {
      heading: '## Project Structure',
      content: `(Define your project structure here.)`,
      order: 40,
      source: 'stack',
    },
  ];
}

export function getStackGitignore(): string {
  return '';
}
