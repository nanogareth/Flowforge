import type { WorkflowPreset, StackPreset, FileToCreate } from "../types";
import { assembleClaudeMd } from "./claude-md";
import { getPlatformGitignore } from "./platform";
import { getGitHubActionFiles } from "./github-action";

import * as typescriptReactStack from "./stacks/typescript-react";
import * as typescriptNodeStack from "./stacks/typescript-node";
import * as pythonStack from "./stacks/python";
import * as rustStack from "./stacks/rust";
import * as customStack from "./stacks/custom";

const stackModules = {
  "typescript-react": typescriptReactStack,
  "typescript-node": typescriptNodeStack,
  python: pythonStack,
  rust: rustStack,
  custom: customStack,
} as const;

export function composeTemplate(
  workflow: WorkflowPreset,
  stack: StackPreset,
  name: string,
  description?: string,
  contextFilename?: string,
): FileToCreate[] {
  const sMod = stackModules[stack];

  // 1. Assemble CLAUDE.md
  const claudeMdContent = assembleClaudeMd({
    name,
    description: description || "",
    workflow,
    stack,
    contextFilename,
  });

  // 2. Merge .gitignore (platform base + stack additions, deduplicated)
  const gitignoreContent = mergeGitignore(
    getPlatformGitignore(),
    sMod.getStackGitignore(),
  );

  // 3. GitHub Action workflow file
  const githubActionFiles = getGitHubActionFiles(workflow);

  return [
    { path: "CLAUDE.md", content: claudeMdContent },
    { path: ".gitignore", content: gitignoreContent },
    ...githubActionFiles,
  ];
}

function mergeGitignore(platform: string, stack: string): string {
  const platformLines = platform.split("\n");
  const stackLines = stack.split("\n");

  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of [
    ...platformLines,
    "",
    "# Stack-specific",
    ...stackLines,
  ]) {
    const trimmed = line.trim();
    // Always allow comments and blank lines, but deduplicate actual patterns
    if (trimmed === "" || trimmed.startsWith("#")) {
      result.push(line);
    } else if (!seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(line);
    }
  }

  // Clean up: collapse 3+ consecutive blank lines to 2
  const cleaned: string[] = [];
  let blankCount = 0;
  for (const line of result) {
    if (line.trim() === "") {
      blankCount++;
      if (blankCount <= 2) cleaned.push(line);
    } else {
      blankCount = 0;
      cleaned.push(line);
    }
  }

  return cleaned.join("\n").trimEnd() + "\n";
}
