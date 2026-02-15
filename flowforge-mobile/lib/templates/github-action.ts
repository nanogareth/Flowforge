import type { WorkflowPreset, FileToCreate } from "../types";
import type { ClaudeMdSection } from "./claude-md";

interface TriggerConfig {
  issueComment: boolean;
  prReviewComment: boolean;
  prOpened: boolean;
  prReviewSubmitted: boolean;
  issueAssigned: boolean;
  labelAdded: boolean;
}

const TRIGGER_MATRIX: Record<WorkflowPreset, TriggerConfig> = {
  research: {
    issueComment: true,
    prReviewComment: true,
    prOpened: false,
    prReviewSubmitted: false,
    issueAssigned: true,
    labelAdded: true,
  },
  feature: {
    issueComment: true,
    prReviewComment: true,
    prOpened: true,
    prReviewSubmitted: true,
    issueAssigned: false,
    labelAdded: false,
  },
  greenfield: {
    issueComment: true,
    prReviewComment: true,
    prOpened: true,
    prReviewSubmitted: false,
    issueAssigned: true,
    labelAdded: true,
  },
  learning: {
    issueComment: true,
    prReviewComment: true,
    prOpened: false,
    prReviewSubmitted: false,
    issueAssigned: false,
    labelAdded: false,
  },
};

function buildOnBlock(triggers: TriggerConfig): string {
  const lines: string[] = [];
  lines.push("on:");

  // issue_comment covers both issue and PR comments (@claude mentions)
  if (triggers.issueComment) {
    lines.push("  issue_comment:");
    lines.push("    types: [created]");
  }

  // PR review comments
  if (triggers.prReviewComment) {
    lines.push("  pull_request_review_comment:");
    lines.push("    types: [created]");
  }

  // PR opened
  if (triggers.prOpened) {
    lines.push("  pull_request:");
    lines.push("    types: [opened, synchronize]");
  }

  // PR review submitted
  if (triggers.prReviewSubmitted) {
    lines.push("  pull_request_review:");
    lines.push("    types: [submitted]");
  }

  // Issue assigned
  if (triggers.issueAssigned) {
    lines.push("  issues:");
    lines.push("    types: [assigned]");
  }

  return lines.join("\n");
}

function buildIfCondition(triggers: TriggerConfig): string {
  const conditions: string[] = [];

  if (triggers.issueComment) {
    conditions.push(
      "(github.event_name == 'issue_comment' && contains(github.event.comment.body, '@claude'))",
    );
  }

  if (triggers.prReviewComment) {
    conditions.push(
      "(github.event_name == 'pull_request_review_comment' && contains(github.event.comment.body, '@claude'))",
    );
  }

  if (triggers.prOpened) {
    conditions.push("github.event_name == 'pull_request'");
  }

  if (triggers.prReviewSubmitted) {
    conditions.push(
      "(github.event_name == 'pull_request_review' && github.event.review.state == 'changes_requested')",
    );
  }

  if (triggers.issueAssigned) {
    conditions.push(
      "(github.event_name == 'issues' && github.event.action == 'assigned')",
    );
  }

  return conditions.join(" ||\n      ");
}

function buildWithBlock(workflow: WorkflowPreset): string {
  const lines: string[] = [];
  lines.push('          trigger_phrase: "@claude"');
  lines.push("          use_sticky_comment: true");

  if (workflow === "research" || workflow === "greenfield") {
    lines.push('          assignee_trigger: "claude"');
    lines.push('          label_trigger: "claude"');
  }

  if (workflow === "feature") {
    lines.push("          include_fix_links: true");
  }

  return lines.join("\n");
}

export function getGitHubActionFiles(workflow: WorkflowPreset): FileToCreate[] {
  const triggers = TRIGGER_MATRIX[workflow];
  const onBlock = buildOnBlock(triggers);
  const ifCondition = buildIfCondition(triggers);
  const withBlock = buildWithBlock(workflow);

  const yaml = `name: Claude

${onBlock}

jobs:
  claude:
    if: |
      ${ifCondition}
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      issues: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 1
      - uses: anthropics/claude-code-action@v1
        with:
${withBlock}
`;

  return [
    {
      path: ".github/workflows/claude.yml",
      content: yaml,
    },
  ];
}

export function getGitHubIntegrationSection(
  workflow: WorkflowPreset,
): ClaudeMdSection {
  const triggers = TRIGGER_MATRIX[workflow];
  const triggerDescriptions: string[] = [
    "- Comment `@claude <request>` on any PR or issue",
  ];

  if (triggers.prOpened) {
    triggerDescriptions.push("- Claude automatically reviews new PRs");
  }

  if (triggers.prReviewSubmitted) {
    triggerDescriptions.push(
      "- Claude responds to PR reviews requesting changes",
    );
  }

  if (triggers.issueAssigned) {
    triggerDescriptions.push(
      "- Assign an issue to `claude` to trigger implementation",
    );
  }

  if (triggers.labelAdded) {
    triggerDescriptions.push(
      "- Add the `claude` label to an issue for Claude to pick it up",
    );
  }

  return {
    heading: "## GitHub Integration",
    content: `The \`@claude\` bot is active on this repository via the Claude GitHub App.

Usage:
${triggerDescriptions.join("\n")}`,
    order: 65,
    source: "platform",
  };
}

// Exported for testing
export { TRIGGER_MATRIX };
export type { TriggerConfig };
