import { composeTemplate } from '../lib/templates/compose';
import { assembleClaudeMd, type ClaudeMdSection } from '../lib/templates/claude-md';
import { buildSettings } from '../lib/templates/settings';
import { getDevcontainerFiles } from '../lib/templates/devcontainer';
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

describe('Settings Generation', () => {
  const workflows: WorkflowPreset[] = ['research', 'feature', 'greenfield', 'learning'];
  const stacks: StackPreset[] = ['typescript-react', 'typescript-node', 'python', 'rust', 'custom'];

  for (const workflow of workflows) {
    for (const stack of stacks) {
      it(`${workflow} + ${stack} should include settings.json`, () => {
        const files = composeTemplate(workflow, stack, 'test', 'Test');
        const paths = files.map((f) => f.path);
        expect(paths).toContain('.claude/settings.json');
      });
    }
  }

  it('should include Stop hook for research workflow', () => {
    const settings = JSON.parse(buildSettings('research', 'python'));
    expect(settings.hooks.Stop).toBeDefined();
    expect(settings.hooks.Stop.length).toBeGreaterThan(0);
  });

  it('should include Stop hook for feature workflow', () => {
    const settings = JSON.parse(buildSettings('feature', 'typescript-react'));
    expect(settings.hooks.Stop).toBeDefined();
  });

  it('should include Stop hook for greenfield workflow', () => {
    const settings = JSON.parse(buildSettings('greenfield', 'rust'));
    expect(settings.hooks.Stop).toBeDefined();
  });

  it('should NOT include Stop hook for learning workflow', () => {
    const settings = JSON.parse(buildSettings('learning', 'custom'));
    expect(settings.hooks.Stop).toBeUndefined();
  });

  it('should NOT include post-typecheck for learning workflow', () => {
    const settings = JSON.parse(buildSettings('learning', 'python'));
    const postToolUse = settings.hooks.PostToolUse;
    const allCommands = postToolUse.flatMap(
      (entry: { hooks: { command: string }[] }) =>
        entry.hooks.map((h: { command: string }) => h.command)
    );
    expect(allCommands.some((c: string) => c.includes('post-typecheck'))).toBe(false);
  });

  it('should have Python env vars for research + python', () => {
    const settings = JSON.parse(buildSettings('research', 'python'));
    expect(settings.env.TEST_RUNNER_CMD).toContain('pytest');
    expect(settings.env.TYPE_CHECK_CMD).toContain('mypy');
    expect(settings.env.FORMAT_CMD).toBe('black');
    expect(settings.env.LINT_CMD).toContain('ruff');
    expect(settings.env.TEST_REPORT_FORMAT).toBe('pytest-json');
  });

  it('should have TS env vars for feature + typescript-react', () => {
    const settings = JSON.parse(buildSettings('feature', 'typescript-react'));
    expect(settings.env.TEST_RUNNER_CMD).toContain('jest');
    expect(settings.env.TYPE_CHECK_CMD).toContain('tsc');
    expect(settings.env.FORMAT_CMD).toContain('prettier');
    expect(settings.env.LINT_CMD).toContain('eslint');
    expect(settings.env.TEST_REPORT_FORMAT).toBe('jest-json');
  });

  it('should have Rust env vars for greenfield + rust', () => {
    const settings = JSON.parse(buildSettings('greenfield', 'rust'));
    expect(settings.env.TEST_RUNNER_CMD).toContain('cargo test');
    expect(settings.env.TYPE_CHECK_CMD).toBe('cargo check');
    expect(settings.env.FORMAT_CMD).toBe('rustfmt');
    expect(settings.env.LINT_CMD).toBe('cargo clippy');
    expect(settings.env.TEST_REPORT_FORMAT).toBe('cargo-json');
  });

  it('should have no env block for learning + custom', () => {
    const settings = JSON.parse(buildSettings('learning', 'custom'));
    expect(settings.env).toBeUndefined();
  });

  it('should always include PreToolUse hooks', () => {
    const settings = JSON.parse(buildSettings('learning', 'custom'));
    expect(settings.hooks.PreToolUse).toBeDefined();
    expect(settings.hooks.PreToolUse.length).toBe(2);
  });

  it('should always include SessionStart and PreCompact hooks', () => {
    const settings = JSON.parse(buildSettings('learning', 'custom'));
    expect(settings.hooks.SessionStart).toBeDefined();
    expect(settings.hooks.PreCompact).toBeDefined();
  });
});

describe('Devcontainer', () => {
  it('should produce devcontainer.json and post-create.sh', () => {
    const files = getDevcontainerFiles('python', 'test-project');
    const paths = files.map((f) => f.path);
    expect(paths).toContain('.devcontainer/devcontainer.json');
    expect(paths).toContain('.devcontainer/post-create.sh');
  });

  it('should include python feature for python stack', () => {
    const files = getDevcontainerFiles('python', 'test');
    const devcontainer = JSON.parse(
      files.find((f) => f.path === '.devcontainer/devcontainer.json')!.content
    );
    expect(Object.keys(devcontainer.features)).toContain(
      'ghcr.io/devcontainers/features/python:1'
    );
  });

  it('should include node feature for typescript-react stack', () => {
    const files = getDevcontainerFiles('typescript-react', 'test');
    const devcontainer = JSON.parse(
      files.find((f) => f.path === '.devcontainer/devcontainer.json')!.content
    );
    expect(Object.keys(devcontainer.features)).toContain(
      'ghcr.io/devcontainers/features/node:1'
    );
  });

  it('should include node feature for typescript-node stack', () => {
    const files = getDevcontainerFiles('typescript-node', 'test');
    const devcontainer = JSON.parse(
      files.find((f) => f.path === '.devcontainer/devcontainer.json')!.content
    );
    expect(Object.keys(devcontainer.features)).toContain(
      'ghcr.io/devcontainers/features/node:1'
    );
  });

  it('should include rust feature for rust stack', () => {
    const files = getDevcontainerFiles('rust', 'test');
    const devcontainer = JSON.parse(
      files.find((f) => f.path === '.devcontainer/devcontainer.json')!.content
    );
    expect(Object.keys(devcontainer.features)).toContain(
      'ghcr.io/devcontainers/features/rust:1'
    );
  });

  it('should not include features for custom stack', () => {
    const files = getDevcontainerFiles('custom', 'test');
    const devcontainer = JSON.parse(
      files.find((f) => f.path === '.devcontainer/devcontainer.json')!.content
    );
    expect(devcontainer.features).toBeUndefined();
  });

  it('should install python tools in post-create.sh for python stack', () => {
    const files = getDevcontainerFiles('python', 'test');
    const postCreate = files.find((f) => f.path === '.devcontainer/post-create.sh')!;
    expect(postCreate.content).toContain('black');
    expect(postCreate.content).toContain('ruff');
    expect(postCreate.content).toContain('mypy');
    expect(postCreate.content).toContain('pytest');
  });

  it('should install TS tools in post-create.sh for typescript-react stack', () => {
    const files = getDevcontainerFiles('typescript-react', 'test');
    const postCreate = files.find((f) => f.path === '.devcontainer/post-create.sh')!;
    expect(postCreate.content).toContain('typescript');
    expect(postCreate.content).toContain('eslint');
  });

  it('should install rustfmt and clippy for rust stack', () => {
    const files = getDevcontainerFiles('rust', 'test');
    const postCreate = files.find((f) => f.path === '.devcontainer/post-create.sh')!;
    expect(postCreate.content).toContain('rustfmt');
    expect(postCreate.content).toContain('clippy');
  });

  it('should include devcontainer files in composed template', () => {
    const files = composeTemplate('research', 'python', 'test', 'Test');
    const paths = files.map((f) => f.path);
    expect(paths).toContain('.devcontainer/devcontainer.json');
    expect(paths).toContain('.devcontainer/post-create.sh');
  });
});

describe('Hook Scripts', () => {
  const HOOK_SCRIPTS = [
    '.claude/hooks/block-test-execution.sh',
    '.claude/hooks/protect-files.sh',
    '.claude/hooks/auto-format.sh',
    '.claude/hooks/auto-deps.sh',
    '.claude/hooks/auto-remap.sh',
    '.claude/hooks/post-typecheck.sh',
    '.claude/hooks/session-state.sh',
    '.claude/hooks/pre-compact-handover.sh',
    '.claude/hooks/stop-test-loop.sh',
    '.claude/hooks/post-explore-reminder.sh',
  ];

  it('should include all 10 hook scripts in scaffolded output', () => {
    const files = composeTemplate('research', 'python', 'test', 'Test');
    const paths = files.map((f) => f.path);

    for (const hookScript of HOOK_SCRIPTS) {
      expect(paths).toContain(hookScript);
    }
  });

  it('should include hook scripts even for learning + custom', () => {
    const files = composeTemplate('learning', 'custom', 'test', 'Test');
    const paths = files.map((f) => f.path);

    for (const hookScript of HOOK_SCRIPTS) {
      expect(paths).toContain(hookScript);
    }
  });

  it('should include hook-check command', () => {
    const files = composeTemplate('research', 'python', 'test', 'Test');
    const paths = files.map((f) => f.path);
    expect(paths).toContain('.claude/commands/hook-check.md');
  });

  it('stop-test-loop.sh should check stop_hook_active to prevent loops', () => {
    const files = composeTemplate('research', 'python', 'test', 'Test');
    const stopHook = files.find(
      (f) => f.path === '.claude/hooks/stop-test-loop.sh'
    )!;
    expect(stopHook.content).toContain('stop_hook_active');
  });

  it('all hook scripts should have shebang line', () => {
    const files = composeTemplate('research', 'python', 'test', 'Test');
    for (const hookPath of HOOK_SCRIPTS) {
      const file = files.find((f) => f.path === hookPath)!;
      expect(file.content.startsWith('#!/bin/bash')).toBe(true);
    }
  });
});

describe('Stack Config Files', () => {
  it('typescript-react should include tsconfig.json', () => {
    const files = composeTemplate('feature', 'typescript-react', 'test', 'Test');
    const paths = files.map((f) => f.path);
    expect(paths).toContain('tsconfig.json');

    const tsconfig = JSON.parse(
      files.find((f) => f.path === 'tsconfig.json')!.content
    );
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.jsx).toBe('react-jsx');
  });

  it('typescript-node should include tsconfig.json', () => {
    const files = composeTemplate('feature', 'typescript-node', 'test', 'Test');
    const paths = files.map((f) => f.path);
    expect(paths).toContain('tsconfig.json');

    const tsconfig = JSON.parse(
      files.find((f) => f.path === 'tsconfig.json')!.content
    );
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.module).toBe('NodeNext');
  });

  it('python should include pyproject.toml', () => {
    const files = composeTemplate('research', 'python', 'test-py', 'Test');
    const paths = files.map((f) => f.path);
    expect(paths).toContain('pyproject.toml');

    const pyproject = files.find((f) => f.path === 'pyproject.toml')!;
    expect(pyproject.content).toContain('test-py');
    expect(pyproject.content).toContain('pytest');
    expect(pyproject.content).toContain('black');
    expect(pyproject.content).toContain('ruff');
    expect(pyproject.content).toContain('mypy');
  });

  it('python should include tests/conftest.py', () => {
    const files = composeTemplate('research', 'python', 'test', 'Test');
    const paths = files.map((f) => f.path);
    expect(paths).toContain('tests/conftest.py');
  });

  it('rust should include Cargo.toml', () => {
    const files = composeTemplate('greenfield', 'rust', 'my-crate', 'Test');
    const paths = files.map((f) => f.path);
    expect(paths).toContain('Cargo.toml');

    const cargo = files.find((f) => f.path === 'Cargo.toml')!;
    expect(cargo.content).toContain('my-crate');
    expect(cargo.content).toContain('edition = "2021"');
  });

  it('custom should not include stack config files', () => {
    const files = composeTemplate('learning', 'custom', 'test', 'Test');
    const paths = files.map((f) => f.path);
    expect(paths).not.toContain('tsconfig.json');
    expect(paths).not.toContain('pyproject.toml');
    expect(paths).not.toContain('Cargo.toml');
  });
});

describe('Tests Reports Directory', () => {
  it('should include tests/reports/.gitkeep', () => {
    const files = composeTemplate('research', 'python', 'test', 'Test');
    const paths = files.map((f) => f.path);
    expect(paths).toContain('tests/reports/.gitkeep');
  });

  it('should include tests/reports/.gitkeep for all combos', () => {
    const files = composeTemplate('learning', 'custom', 'test', 'Test');
    const paths = files.map((f) => f.path);
    expect(paths).toContain('tests/reports/.gitkeep');
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
    '.claude/settings.json',
    '.claude/hooks/block-test-execution.sh',
    '.claude/hooks/protect-files.sh',
    '.claude/hooks/auto-format.sh',
    '.claude/hooks/session-state.sh',
    '.claude/hooks/pre-compact-handover.sh',
    '.claude/commands/hook-check.md',
    'tests/reports/.gitkeep',
    '.devcontainer/devcontainer.json',
    '.devcontainer/post-create.sh',
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
