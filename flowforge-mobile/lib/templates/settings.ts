import type { WorkflowPreset, StackPreset } from '../types';

interface HookEntry {
  type: 'command';
  command: string;
  timeout?: number;
  async?: boolean;
}

interface HookMatcher {
  matcher?: string;
  hooks: HookEntry[];
}

interface SettingsJson {
  hooks: Record<string, HookMatcher[]>;
  env?: Record<string, string>;
}

const HOOK_DIR = '"$CLAUDE_PROJECT_DIR"/.claude/hooks';

/** Workflows that enable the full TDD automation layer */
const TDD_WORKFLOWS: ReadonlySet<WorkflowPreset> = new Set([
  'research',
  'feature',
  'greenfield',
]);

/** Stack → environment variable mapping for tooling commands */
const STACK_ENV: Record<string, Record<string, string>> = {
  'typescript-react': {
    TEST_RUNNER_CMD: 'npx jest --json --outputFile=tests/reports/latest.json',
    TEST_REPORT_FORMAT: 'jest-json',
    TYPE_CHECK_CMD: 'npx tsc --noEmit',
    FORMAT_CMD: 'npx prettier --write',
    LINT_CMD: 'npx eslint src/',
  },
  'typescript-node': {
    TEST_RUNNER_CMD: 'npx jest --json --outputFile=tests/reports/latest.json',
    TEST_REPORT_FORMAT: 'jest-json',
    TYPE_CHECK_CMD: 'npx tsc --noEmit',
    FORMAT_CMD: 'npx prettier --write',
    LINT_CMD: 'npx eslint src/',
  },
  python: {
    TEST_RUNNER_CMD:
      'py -m pytest --tb=short -q --json-report --json-report-file=tests/reports/latest.json',
    TEST_REPORT_FORMAT: 'pytest-json',
    TYPE_CHECK_CMD: 'py -m mypy',
    FORMAT_CMD: 'black',
    LINT_CMD: 'py -m ruff check src/ --output-format=concise',
  },
  rust: {
    TEST_RUNNER_CMD: 'cargo test -- --format json',
    TEST_REPORT_FORMAT: 'cargo-json',
    TYPE_CHECK_CMD: 'cargo check',
    FORMAT_CMD: 'rustfmt',
    LINT_CMD: 'cargo clippy',
  },
};

export function buildSettings(workflow: WorkflowPreset, stack: StackPreset): string {
  const tddEnabled = TDD_WORKFLOWS.has(workflow);

  const settings: SettingsJson = {
    hooks: {
      PreToolUse: [
        {
          matcher: 'Bash',
          hooks: [
            {
              type: 'command',
              command: `${HOOK_DIR}/block-test-execution.sh`,
            },
          ],
        },
        {
          matcher: 'Edit|Write',
          hooks: [
            {
              type: 'command',
              command: `${HOOK_DIR}/protect-files.sh`,
            },
          ],
        },
      ],
      PostToolUse: [
        {
          matcher: 'Edit|Write',
          hooks: [
            {
              type: 'command',
              command: `${HOOK_DIR}/auto-format.sh`,
            },
            ...(tddEnabled
              ? [
                  {
                    type: 'command' as const,
                    command: `${HOOK_DIR}/post-typecheck.sh`,
                  },
                  {
                    type: 'command' as const,
                    command: `${HOOK_DIR}/auto-deps.sh`,
                    async: true,
                  },
                ]
              : []),
          ],
        },
        ...(tddEnabled
          ? [
              {
                matcher: 'Write',
                hooks: [
                  {
                    type: 'command' as const,
                    command: `${HOOK_DIR}/auto-remap.sh`,
                    async: true,
                  },
                ],
              },
              {
                matcher: 'Task',
                hooks: [
                  {
                    type: 'command' as const,
                    command: `${HOOK_DIR}/post-explore-reminder.sh`,
                  },
                ],
              },
            ]
          : []),
      ],
      SessionStart: [
        {
          matcher: 'startup|resume|compact',
          hooks: [
            {
              type: 'command',
              command: `${HOOK_DIR}/session-state.sh`,
              timeout: 10,
            },
          ],
        },
      ],
      PreCompact: [
        {
          matcher: 'auto',
          hooks: [
            {
              type: 'command',
              command: `${HOOK_DIR}/pre-compact-handover.sh`,
              timeout: 15,
            },
          ],
        },
      ],
      ...(tddEnabled
        ? {
            Stop: [
              {
                hooks: [
                  {
                    type: 'command' as const,
                    command: `${HOOK_DIR}/stop-test-loop.sh`,
                    timeout: 300,
                  },
                ],
              },
            ],
          }
        : {}),
    },
  };

  // Add env vars for known stacks
  const envVars = STACK_ENV[stack];
  if (envVars && tddEnabled) {
    settings.env = { ...envVars };
  }

  return JSON.stringify(settings, null, 2) + '\n';
}
