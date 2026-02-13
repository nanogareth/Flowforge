import type { FileToCreate } from '../types';
import type { ClaudeMdSection } from './claude-md';

export function getPlatformFiles(): FileToCreate[] {
  return [
    {
      path: '.claude/references/_index.md',
      content: `# Reference Index

> CC: Read this first to find relevant reference files by keyword.

## Codebase
- \`codebase.md\` — AST-generated codebase map (generated after /init)
  - **Keywords**: module, class, function, import, structure

## Error Corrections
- \`error-corrections/_index.md\` — Language/framework-specific error patterns
  - **Keywords**: error, bug, fix, workaround, gotcha

## Explorations
- \`explorations/_index.md\` — Cached exploration results from CC subagents
  - **Keywords**: exploration, analysis, architecture, pattern

## Installed Tooling

### Plugins
| Plugin | Trigger Keywords | Purpose |
|--------|-----------------|---------|
| (configured per project) | | |

### MCP Servers
| Server | Trigger Keywords | Purpose |
|--------|-----------------|---------|
| (configured per project) | | |
`,
    },
    {
      path: '.claude/references/error-corrections/_index.md',
      content: `# Error Corrections Index

> CC: Read this when you encounter an error or before making changes to areas with known issues.

- \`project-specific.md\` — This project's unique gotchas
  - **Keywords**: (populated during development)
`,
    },
    {
      path: '.claude/references/explorations/_index.md',
      content: `# Explorations Index

> CC: Before launching an Explore subagent, check this index. If the target
> area was explored recently and source files haven't changed, read the
> exploration file instead of re-exploring.

(No explorations yet — entries will be added as CC explores the codebase.)

## Syntheses

(No syntheses yet.)
`,
    },
    {
      path: '.claude/references/explorations/synthesis/.gitkeep',
      content: '',
    },
    {
      path: 'docs/handover/.gitkeep',
      content: '',
    },
    {
      path: '.claude/commands/session-handover.md',
      content: `# Session Handover

Perform a structured session handover:

1. Write a handover document to \`docs/handover/handover-YYYYMMDD-N.md\` containing:
   - Current implementation status and progress
   - Decisions made and their rationale
   - Open issues and blockers
   - Next steps for the incoming session

2. Reflect on errors encountered — propose additions to \`.claude/references/error-corrections/\`

3. Update MEMORY.md topic files with session notes

4. Update \`.claude/references/_index.md\` if new reference assets were created

5. Ask: "Run /revise-claude-md for a full CLAUDE.md audit?"

6. Ask: "Ready to commit and /clear?"
`,
    },
    {
      path: '.claude/commands/remap.md',
      content: `# Remap Codebase

Re-run the codebase mapper to update the AST-generated codebase index.

1. Run: \`py .claude/scripts/codebase-mapper.py .\`
2. Verify \`.claude/references/codebase.md\` was updated
3. Verify \`.claude/references/_index.md\` codebase section is current
4. Report what changed (new modules, removed modules, renamed items)
`,
    },
    {
      path: '.claude/commands/stack-check.md',
      content: `# Stack Check

Re-evaluate the project's tooling setup:

1. Review recent challenges and pain points in the session
2. Search for helpful plugins/MCPs that could address them
3. Check if any installed tools have updates
4. Verify all hooks are present and functional
5. Report findings and recommendations
`,
    },
  ];
}

export function getPlatformClaudeMdSections(): ClaudeMdSection[] {
  return [
    {
      heading: '## Development Guidelines',
      content: `- Write clean, maintainable code following established patterns
- Add tests for new functionality
- Follow the workflow phases defined below
- Commit atomically at each green test state
- Error patterns go in \`.claude/references/error-corrections/\`, not in CLAUDE.md`,
      order: 50,
      source: 'platform',
    },
    {
      heading: '## References',
      content: `For the full reference index: @.claude/references/_index.md

### Error Patterns
When encountering errors or modifying code in areas with known issues, consult:
@.claude/references/error-corrections/_index.md

### Exploration Persistence
Before exploring the codebase, check @.claude/references/explorations/_index.md
for recent, non-stale explorations of the same area. After exploring, persist
findings per the exploration file format. Syntheses of multiple explorations
go in the \`synthesis/\` subdirectory.`,
      order: 60,
      source: 'platform',
    },
    {
      heading: '## Handover & Session Rules',
      content: `- Handover at ~65-70% context usage or natural phase boundaries
- Use \`/session-handover\` to externalise session state
- New sessions: load CLAUDE.md + latest handover doc via \`@docs/handover/latest.md\`
- Tests are executed by the human or by automation hooks — CC writes test files and provides instructions`,
      order: 70,
      source: 'platform',
    },
  ];
}

export function getPlatformGitignore(): string {
  return `# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local
.env.*.local

# Logs
*.log
npm-debug.log*

# Testing
coverage/

# Claude Code
.claude/settings.local.json
tests/reports/.iteration-count
tests/reports/.last-test-run
`;
}
