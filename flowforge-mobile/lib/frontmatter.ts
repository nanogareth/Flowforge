import type { FrontmatterResult, WorkflowPreset, StackPreset } from "./types";

const VALID_WORKFLOWS: WorkflowPreset[] = [
  "research",
  "feature",
  "greenfield",
  "learning",
];
const VALID_STACKS: StackPreset[] = [
  "typescript-react",
  "typescript-node",
  "python",
  "rust",
  "custom",
];

const FRONTMATTER_REGEX =
  /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n([\s\S]*)$/;

function parseYamlValue(raw: string): string {
  const trimmed = raw.trim();
  // Strip surrounding quotes (single or double)
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseBooleanish(value: string): boolean {
  const lower = value.toLowerCase();
  if (["false", "no", "0"].includes(lower)) return false;
  return true; // default to true (private)
}

export function parseFrontmatter(content: string): FrontmatterResult {
  const defaults: FrontmatterResult = {
    workflow: "greenfield",
    stack: "custom",
    isPrivate: true,
    description: "",
    body: content,
    rawContent: content,
  };

  const match = content.match(FRONTMATTER_REGEX);
  if (!match) return defaults;

  const yamlBlock = match[1];
  const body = match[2];

  const result: FrontmatterResult = { ...defaults, body, rawContent: content };

  for (const line of yamlBlock.split(/\r?\n/)) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim().toLowerCase();
    const rawValue = line.slice(colonIndex + 1);
    const value = parseYamlValue(rawValue);

    switch (key) {
      case "workflow":
        if (VALID_WORKFLOWS.includes(value as WorkflowPreset)) {
          result.workflow = value as WorkflowPreset;
        }
        break;
      case "stack":
        if (VALID_STACKS.includes(value as StackPreset)) {
          result.stack = value as StackPreset;
        }
        break;
      case "private":
        result.isPrivate = parseBooleanish(value);
        break;
      case "description":
        result.description = value;
        break;
    }
  }

  return result;
}

export function filenameToRepoName(filename: string): string {
  return filename
    .replace(/\.md$/i, "") // strip .md extension
    .toLowerCase() // lowercase
    .replace(/[\s_]+/g, "-") // spaces and underscores → hyphens
    .replace(/[^a-z0-9-]/g, "") // remove invalid chars
    .replace(/^-+|-+$/g, "") // trim leading/trailing hyphens
    .replace(/-{2,}/g, "-") // collapse multiple hyphens
    .slice(0, 100); // truncate to 100 chars
}
