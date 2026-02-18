import type { WorkflowPreset, StackPreset } from "../types";

export interface ClaudeMdOptions {
  name: string;
  description: string;
  workflow: WorkflowPreset;
  stack: StackPreset;
  contextFilename?: string;
}

const STACK_HINTS: Record<StackPreset, string> = {
  "typescript-react":
    "Stack: TypeScript + React. Configure appropriate meta-framework, testing, linting, and formatting during /init.",
  "typescript-node":
    "Stack: TypeScript + Node.js. Configure appropriate runtime, testing, linting, and formatting during /init.",
  python:
    "Stack: Python. Configure appropriate virtual environment, testing, linting, and formatting during /init.",
  rust: "Stack: Rust. Configure appropriate project structure, testing, and tooling during /init.",
  custom:
    "Stack: Not specified. Choose and configure an appropriate tech stack during /init.",
};

const WORKFLOW_INSTRUCTIONS: Record<WorkflowPreset, string> = {
  greenfield:
    "During /init: Read the context file (if present), design system architecture, set up the project with appropriate tooling, create an initial build plan, and scaffold the core structure with tests.",
  research:
    "During /init: Read the context file (if present), analyze the research notes, recommend a tech stack with rationale, then scaffold the project structure with an implementation plan.",
  feature:
    "During /init: Read the context file (if present), explore the existing codebase, define the feature scope and acceptance criteria, then create an implementation plan with TDD structure.",
  learning:
    "During /init: Read the context file (if present), set up a lightweight exploration environment, and create an initial experiment based on the learning goals.",
};

export function assembleClaudeMd(options: ClaudeMdOptions): string {
  const { name, description, workflow, stack, contextFilename } = options;

  const lines: string[] = [];

  lines.push(`# ${name}`);
  lines.push("");
  if (description) {
    lines.push(description);
    lines.push("");
  }

  if (contextFilename) {
    lines.push("## Context");
    lines.push("");
    lines.push(
      `Read @context/${contextFilename} for the project background and requirements.`,
    );
    lines.push("");
  }

  lines.push("## Setup");
  lines.push("");
  lines.push(STACK_HINTS[stack]);
  lines.push("");
  lines.push(WORKFLOW_INSTRUCTIONS[workflow]);
  lines.push("");

  lines.push("## GitHub Integration");
  lines.push("");
  lines.push(
    "The @claude bot is active on this repository via the Claude GitHub App.",
  );
  lines.push(getGitHubIntegrationText(workflow));
  lines.push("");

  return lines.join("\n");
}

export function getGitHubIntegrationText(workflow: WorkflowPreset): string {
  const triggerDescriptions: string[] = [
    "- Comment `@claude <request>` on any PR or issue",
  ];

  // Import trigger config inline to avoid circular dependency
  const prOpened =
    workflow === "feature" || workflow === "greenfield";
  const prReviewSubmitted = workflow === "feature";
  const issueAssigned =
    workflow === "research" || workflow === "greenfield";
  const labelAdded =
    workflow === "research" || workflow === "greenfield";

  if (prOpened) {
    triggerDescriptions.push("- Claude automatically reviews new PRs");
  }

  if (prReviewSubmitted) {
    triggerDescriptions.push(
      "- Claude responds to PR reviews requesting changes",
    );
  }

  if (issueAssigned) {
    triggerDescriptions.push(
      "- Assign an issue to `claude` to trigger implementation",
    );
  }

  if (labelAdded) {
    triggerDescriptions.push(
      "- Add the `claude` label to an issue for Claude to pick it up",
    );
  }

  return "\n" + triggerDescriptions.join("\n");
}
