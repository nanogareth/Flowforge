import { composeTemplate } from '../lib/templates/compose';
import { assembleClaudeMd, type ClaudeMdSection } from '../lib/templates/claude-md';
import { isValidRepoName } from '../lib/github';
import type { WorkflowPreset, StackPreset } from '../lib/types';

describe('Template Composition', () => {
  describe('composeTemplate — greenfield + typescript-react', () => {
    const files = composeTemplate('greenfield', 'typescript-react', 'my-app', 'A web application');
    const paths = files.map((f) => f.path);

    it('should include core files', () => {
      expect(paths).toContain('CLAUDE.md');
      expect(paths).toContain('README.md');
      expect(paths).toContain('.gitignore');
    });

    it('should include platform files', () => {
      expect(paths).toContain('.claude/references/_index.md');
      expect(paths).toContain('.claude/references/error-corrections/_index.md');
      expect(paths).toContain('.claude/references/explorations/_index.md');
      expect(paths).toContain('.claude/references/explorations/synthesis/.gitkeep');
      expect(paths).toContain('docs/handover/.gitkeep');
      expect(paths).toContain('.claude/commands/session-handover.md');
      expect(paths).toContain('.claude/commands/remap.md');
      expect(paths).toContain('.claude/commands/stack-check.md');
    });

    it('should include greenfield workflow files', () => {
      expect(paths).toContain('docs/brief.md');
      expect(paths).toContain('docs/architecture.md');
      expect(paths).toContain('docs/build-plan.md');
      expect(paths).toContain('.claude/commands/architect.md');
      expect(paths).toContain('.claude/commands/build-plan.md');
      expect(paths).toContain('.claude/commands/deploy-check.md');
    });

    it('should include project name in CLAUDE.md', () => {
      const claudeMd = files.find((f) => f.path === 'CLAUDE.md');
      expect(claudeMd?.content).toContain('# my-app');
      expect(claudeMd?.content).toContain('A web application');
    });

    it('should include stack info in CLAUDE.md', () => {
      const claudeMd = files.find((f) => f.path === 'CLAUDE.md');
      expect(claudeMd?.content).toContain('TypeScript');
      expect(claudeMd?.content).toContain('React');
    });

    it('should include workflow info in CLAUDE.md', () => {
      const claudeMd = files.find((f) => f.path === 'CLAUDE.md');
      expect(claudeMd?.content).toContain('Greenfield');
    });

    it('should include exploration persistence section in CLAUDE.md', () => {
      const claudeMd = files.find((f) => f.path === 'CLAUDE.md');
      expect(claudeMd?.content).toContain('Exploration Persistence');
      expect(claudeMd?.content).toContain('explorations/_index.md');
    });

    it('should merge gitignore with platform and stack entries', () => {
      const gitignore = files.find((f) => f.path === '.gitignore');
      // Platform entries
      expect(gitignore?.content).toContain('.DS_Store');
      expect(gitignore?.content).toContain('.env');
      // Stack entries
      expect(gitignore?.content).toContain('node_modules/');
      expect(gitignore?.content).toContain('.next/');
    });
  });

  describe('composeTemplate — research + python', () => {
    const files = composeTemplate('research', 'python', 'test-project', 'Test');
    const paths = files.map((f) => f.path);

    it('should include research workflow files', () => {
      expect(paths).toContain('docs/research-notes/.gitkeep');
      expect(paths).toContain('docs/research-output/.gitkeep');
      expect(paths).toContain('docs/stack-recommendation.md');
      expect(paths).toContain('docs/implementation-plan.md');
      expect(paths).toContain('.claude/commands/research-setup.md');
      expect(paths).toContain('.claude/commands/tdd-plan.md');
    });

    it('should include platform universal commands', () => {
      expect(paths).toContain('.claude/commands/session-handover.md');
    });

    it('should include exploration persistence skeleton', () => {
      expect(paths).toContain('.claude/references/explorations/_index.md');
      expect(paths).toContain('.claude/references/explorations/synthesis/.gitkeep');
    });

    it('should have Python-specific gitignore entries', () => {
      const gitignore = files.find((f) => f.path === '.gitignore');
      expect(gitignore?.content).toContain('__pycache__/');
      expect(gitignore?.content).toContain('.venv/');
      expect(gitignore?.content).toContain('.mypy_cache/');
    });

    it('should have platform gitignore entries', () => {
      const gitignore = files.find((f) => f.path === '.gitignore');
      expect(gitignore?.content).toContain('.DS_Store');
      expect(gitignore?.content).toContain('.env');
    });

    it('should include research workflow in CLAUDE.md', () => {
      const claudeMd = files.find((f) => f.path === 'CLAUDE.md');
      expect(claudeMd?.content).toContain('Research');
      expect(claudeMd?.content).toContain('Python');
    });
  });

  describe('composeTemplate — feature + typescript-node', () => {
    const files = composeTemplate('feature', 'typescript-node', 'my-feature', 'Feature work');
    const paths = files.map((f) => f.path);

    it('should include feature workflow files', () => {
      expect(paths).toContain('docs/spec.md');
      expect(paths).toContain('docs/implementation-plan.md');
      expect(paths).toContain('.claude/commands/scope.md');
      expect(paths).toContain('.claude/commands/implementation-plan.md');
      expect(paths).toContain('.claude/commands/pre-review.md');
    });

    it('should include TS-Node stack gitignore entries', () => {
      const gitignore = files.find((f) => f.path === '.gitignore');
      expect(gitignore?.content).toContain('node_modules/');
      expect(gitignore?.content).toContain('dist/');
      // Should NOT include .next/ (that's typescript-react)
      expect(gitignore?.content).not.toContain('.next/');
    });
  });

  describe('composeTemplate — learning + custom', () => {
    const files = composeTemplate('learning', 'custom', 'my-learning', 'Learning project');
    const paths = files.map((f) => f.path);

    it('should include learning workflow files', () => {
      expect(paths).toContain('docs/goal.md');
      expect(paths).toContain('docs/learnings.md');
      expect(paths).toContain('docs/experiments/.gitkeep');
      expect(paths).toContain('.claude/commands/capture-learnings.md');
    });

    it('should NOT include TDD-related commands', () => {
      expect(paths).not.toContain('.claude/commands/tdd-plan.md');
      expect(paths).not.toContain('.claude/commands/research-setup.md');
      expect(paths).not.toContain('.claude/commands/architect.md');
    });

    it('should include learning workflow in CLAUDE.md', () => {
      const claudeMd = files.find((f) => f.path === 'CLAUDE.md');
      expect(claudeMd?.content).toContain('Learning');
      expect(claudeMd?.content).toContain('Lightweight');
    });

    it('should have minimal gitignore (platform base only)', () => {
      const gitignore = files.find((f) => f.path === '.gitignore');
      expect(gitignore?.content).toContain('.DS_Store');
      // No stack-specific entries
      expect(gitignore?.content).not.toContain('node_modules/');
      expect(gitignore?.content).not.toContain('__pycache__/');
    });
  });

  describe('file deduplication', () => {
    it('should deduplicate by path — later sources win', () => {
      // Stack provides README.md, so it should override any other README.md
      const files = composeTemplate('greenfield', 'python', 'test', 'Test');
      const readmes = files.filter((f) => f.path === 'README.md');
      expect(readmes).toHaveLength(1);
      // Python stack README should win
      expect(readmes[0].content).toContain('python -m venv');
    });
  });
});

describe('CLAUDE.md Assembly', () => {
  it('should sort sections by order', () => {
    const sections: ClaudeMdSection[] = [
      { heading: '## Workflow', content: 'Workflow content', order: 30, source: 'workflow' },
      { heading: '## Tech Stack', content: 'Stack content', order: 10, source: 'stack' },
      { heading: '## Guidelines', content: 'Guidelines content', order: 50, source: 'platform' },
    ];

    const result = assembleClaudeMd('test', 'desc', sections);
    const stackIndex = result.indexOf('## Tech Stack');
    const workflowIndex = result.indexOf('## Workflow');
    const guidelinesIndex = result.indexOf('## Guidelines');

    expect(stackIndex).toBeLessThan(workflowIndex);
    expect(workflowIndex).toBeLessThan(guidelinesIndex);
  });

  it('should include project name and description', () => {
    const sections: ClaudeMdSection[] = [
      { heading: '## Tech Stack', content: 'React', order: 10, source: 'stack' },
    ];

    const result = assembleClaudeMd('my-project', 'A cool project', sections);
    expect(result).toContain('# my-project');
    expect(result).toContain('A cool project');
  });

  it('should not produce duplicate headings from different sources', () => {
    const files = composeTemplate('research', 'python', 'test', 'Test');
    const claudeMd = files.find((f) => f.path === 'CLAUDE.md')!;

    // Count occurrences of each heading
    const headingCounts = new Map<string, number>();
    const headingRegex = /^## .+$/gm;
    let match;
    while ((match = headingRegex.exec(claudeMd.content)) !== null) {
      const count = headingCounts.get(match[0]) || 0;
      headingCounts.set(match[0], count + 1);
    }

    for (const [heading, count] of headingCounts) {
      expect(count).toBe(1);
    }
  });
});

describe('Gitignore Merge', () => {
  it('should not have duplicate entries', () => {
    const files = composeTemplate('greenfield', 'typescript-react', 'test', 'Test');
    const gitignore = files.find((f) => f.path === '.gitignore')!;

    const lines = gitignore.content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));

    const uniqueLines = new Set(lines);
    expect(lines.length).toBe(uniqueLines.size);
  });
});

describe('Repository Name Validation', () => {
  describe('valid names', () => {
    const validNames = [
      'a',
      'ab',
      'my-app',
      'test123',
      'my-cool-project',
      'a1',
      '1a',
      'app-v2',
    ];

    validNames.forEach((name) => {
      it(`should accept valid name: "${name}"`, () => {
        expect(isValidRepoName(name)).toBe(true);
      });
    });
  });

  describe('invalid names', () => {
    const invalidNames = [
      'My App', // spaces
      'TEST', // uppercase
      'test_app', // underscore
      'test.app', // dot
      '-test', // starts with hyphen
      'test-', // ends with hyphen
      '', // empty
      'Test', // uppercase
    ];

    invalidNames.forEach((name) => {
      it(`should reject invalid name: "${name}"`, () => {
        expect(isValidRepoName(name)).toBe(false);
      });
    });
  });

  it('should accept double hyphens (valid for GitHub)', () => {
    expect(isValidRepoName('my--app')).toBe(true);
  });
});

describe('Composition Matrix — all combinations produce valid files', () => {
  const workflows: WorkflowPreset[] = ['research', 'feature', 'greenfield', 'learning'];
  const stacks: StackPreset[] = ['typescript-react', 'typescript-node', 'python', 'rust', 'custom'];

  const requiredPlatformFiles = [
    'CLAUDE.md',
    '.gitignore',
    '.claude/references/_index.md',
    '.claude/references/explorations/_index.md',
    'docs/handover/.gitkeep',
    '.claude/commands/session-handover.md',
  ];

  for (const workflow of workflows) {
    for (const stack of stacks) {
      it(`${workflow} + ${stack} should produce all required platform files`, () => {
        const files = composeTemplate(workflow, stack, 'test', 'Test');
        const paths = files.map((f) => f.path);

        for (const required of requiredPlatformFiles) {
          expect(paths).toContain(required);
        }
      });

      it(`${workflow} + ${stack} should have non-empty CLAUDE.md`, () => {
        const files = composeTemplate(workflow, stack, 'test', 'Test');
        const claudeMd = files.find((f) => f.path === 'CLAUDE.md');
        expect(claudeMd).toBeDefined();
        expect(claudeMd!.content.length).toBeGreaterThan(100);
      });
    }
  }
});
