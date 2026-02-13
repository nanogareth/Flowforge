import type { WorkflowPreset, StackPreset, FileToCreate } from '../types';
import { assembleClaudeMd, type ClaudeMdSection } from './claude-md';
import { getPlatformFiles, getPlatformClaudeMdSections, getPlatformGitignore } from './platform';
import { buildSettings } from './settings';
import { getDevcontainerFiles } from './devcontainer';

import * as researchWorkflow from './workflows/research';
import * as featureWorkflow from './workflows/feature';
import * as greenfieldWorkflow from './workflows/greenfield';
import * as learningWorkflow from './workflows/learning';

import * as typescriptReactStack from './stacks/typescript-react';
import * as typescriptNodeStack from './stacks/typescript-node';
import * as pythonStack from './stacks/python';
import * as rustStack from './stacks/rust';
import * as customStack from './stacks/custom';

const workflowModules = {
  research: researchWorkflow,
  feature: featureWorkflow,
  greenfield: greenfieldWorkflow,
  learning: learningWorkflow,
} as const;

const stackModules = {
  'typescript-react': typescriptReactStack,
  'typescript-node': typescriptNodeStack,
  python: pythonStack,
  rust: rustStack,
  custom: customStack,
} as const;

export function composeTemplate(
  workflow: WorkflowPreset,
  stack: StackPreset,
  name: string,
  description?: string
): FileToCreate[] {
  const wMod = workflowModules[workflow];
  const sMod = stackModules[stack];

  // 1. Gather files from all three layers
  const platformFiles = getPlatformFiles();
  const workflowFiles = wMod.getWorkflowFiles(name, description);
  const stackFiles = sMod.getStackFiles(name);

  // 2. Gather CLAUDE.md sections from all three layers
  const sections: ClaudeMdSection[] = [
    ...getPlatformClaudeMdSections(),
    ...wMod.getWorkflowClaudeMdSections(),
    ...sMod.getStackClaudeMdSections(),
  ];

  // 3. Assemble CLAUDE.md
  const claudeMdContent = assembleClaudeMd(name, description || '', sections);

  // 4. Merge .gitignore (platform base + stack additions, deduplicated)
  const gitignoreContent = mergeGitignore(
    getPlatformGitignore(),
    sMod.getStackGitignore()
  );

  // 5. Build settings.json and devcontainer
  const settingsContent = buildSettings(workflow, stack);
  const devcontainerFiles = getDevcontainerFiles(stack, name);

  // 6. Combine all files
  const allFiles: FileToCreate[] = [
    ...platformFiles,
    ...workflowFiles,
    ...stackFiles,
    ...devcontainerFiles,
    { path: 'CLAUDE.md', content: claudeMdContent },
    { path: '.gitignore', content: gitignoreContent },
    { path: '.claude/settings.json', content: settingsContent },
  ];

  // 7. Deduplicate by path (later sources win)
  return deduplicateFiles(allFiles);
}

function mergeGitignore(platform: string, stack: string): string {
  const platformLines = platform.split('\n');
  const stackLines = stack.split('\n');

  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of [...platformLines, '', '# Stack-specific', ...stackLines]) {
    const trimmed = line.trim();
    // Always allow comments and blank lines, but deduplicate actual patterns
    if (trimmed === '' || trimmed.startsWith('#')) {
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
    if (line.trim() === '') {
      blankCount++;
      if (blankCount <= 2) cleaned.push(line);
    } else {
      blankCount = 0;
      cleaned.push(line);
    }
  }

  return cleaned.join('\n').trimEnd() + '\n';
}

function deduplicateFiles(files: FileToCreate[]): FileToCreate[] {
  const map = new Map<string, FileToCreate>();
  for (const file of files) {
    map.set(file.path, file);
  }
  return Array.from(map.values());
}
