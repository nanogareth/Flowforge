import type { FileToCreate } from '../../types';
import type { ClaudeMdSection } from '../claude-md';

export function getWorkflowFiles(
  name: string,
  description?: string
): FileToCreate[] {
  return [
    {
      path: 'docs/goal.md',
      content: `# Learning Goal

> What do you want to learn or explore?

## Goal

(Describe your learning objective.)

## Topics

- [ ] (List specific topics or skills)

## Resources

- (Links, books, courses, docs)
`,
    },
    {
      path: 'docs/learnings.md',
      content: `# Learnings

> Captured insights from exploration and experimentation.

(Use \`/capture-learnings\` to populate this file.)
`,
    },
    { path: 'docs/experiments/.gitkeep', content: '' },
    {
      path: '.claude/commands/capture-learnings.md',
      content: `# Capture Learnings

Document what you've learned:

1. Review the experiments and explorations from this session
2. Extract key insights and "aha" moments
3. Note what worked and what didn't
4. Identify follow-up questions or next areas to explore
5. Append to \`docs/learnings.md\` with today's date
`,
    },
  ];
}

export function getWorkflowClaudeMdSections(): ClaudeMdSection[] {
  return [
    {
      heading: '## Workflow',
      content: `**Preset:** Learning — exploration, experimentation, and skill-building.

### Phases
1. **Goal** — Define your learning objective in \`docs/goal.md\`
2. **Explore** — Investigate topics, run experiments in \`docs/experiments/\`
3. **Capture** — \`/capture-learnings\` documents insights
4. **Handover** — \`/session-handover\` preserves context

### Lightweight Process
This workflow intentionally skips TDD automation and type checking.
Focus on exploration and understanding — formalise later if needed.`,
      order: 30,
      source: 'workflow',
    },
  ];
}
