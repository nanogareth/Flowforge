import { composeTemplate } from "../lib/templates/compose";
import { assembleClaudeMd } from "../lib/templates/claude-md";
import { isValidRepoName } from "../lib/github";
import type { WorkflowPreset, StackPreset } from "../lib/types";

const ALL_WORKFLOWS: WorkflowPreset[] = [
  "research",
  "feature",
  "greenfield",
  "learning",
];
const ALL_STACKS: StackPreset[] = [
  "typescript-react",
  "typescript-node",
  "python",
  "rust",
  "custom",
];

describe("Template Composition", () => {
  describe("composeTemplate — produces exactly 3 files", () => {
    it.each(ALL_WORKFLOWS.flatMap((w) => ALL_STACKS.map((s) => [w, s])))(
      "%s + %s → exactly 3 files",
      (workflow, stack) => {
        const files = composeTemplate(
          workflow as WorkflowPreset,
          stack as StackPreset,
          "test",
          "Test",
        );
        expect(files).toHaveLength(3);
        const paths = files.map((f) => f.path);
        expect(paths).toContain("CLAUDE.md");
        expect(paths).toContain(".gitignore");
        expect(paths).toContain(".github/workflows/claude.yml");
      },
    );
  });

  describe("CLAUDE.md content — greenfield + typescript-react", () => {
    const files = composeTemplate(
      "greenfield",
      "typescript-react",
      "my-app",
      "A web application",
    );
    const claudeMd = files.find((f) => f.path === "CLAUDE.md")!;

    it("should include project name and description", () => {
      expect(claudeMd.content).toContain("# my-app");
      expect(claudeMd.content).toContain("A web application");
    });

    it("should include stack hint", () => {
      expect(claudeMd.content).toContain("TypeScript + React");
    });

    it("should include workflow /init instructions", () => {
      expect(claudeMd.content).toContain("design system architecture");
    });

    it("should include GitHub Integration section", () => {
      expect(claudeMd.content).toContain("## GitHub Integration");
      expect(claudeMd.content).toContain("@claude");
    });

    it("should not have Context section without contextFilename", () => {
      expect(claudeMd.content).not.toContain("## Context");
    });
  });

  describe("CLAUDE.md content — research + python", () => {
    const files = composeTemplate("research", "python", "test-project", "Test");
    const claudeMd = files.find((f) => f.path === "CLAUDE.md")!;

    it("should include Python stack hint", () => {
      expect(claudeMd.content).toContain("Python");
    });

    it("should include research /init instructions", () => {
      expect(claudeMd.content).toContain("analyze the research notes");
    });
  });

  describe("CLAUDE.md content — feature + typescript-node", () => {
    const files = composeTemplate(
      "feature",
      "typescript-node",
      "my-feature",
      "Feature work",
    );
    const claudeMd = files.find((f) => f.path === "CLAUDE.md")!;

    it("should include TypeScript + Node.js stack hint", () => {
      expect(claudeMd.content).toContain("TypeScript + Node.js");
    });

    it("should include feature /init instructions", () => {
      expect(claudeMd.content).toContain("define the feature scope");
    });
  });

  describe("CLAUDE.md content — learning + custom", () => {
    const files = composeTemplate(
      "learning",
      "custom",
      "my-learning",
      "Learning project",
    );
    const claudeMd = files.find((f) => f.path === "CLAUDE.md")!;

    it("should include custom stack hint", () => {
      expect(claudeMd.content).toContain("Not specified");
    });

    it("should include learning /init instructions", () => {
      expect(claudeMd.content).toContain("lightweight exploration environment");
    });
  });

  describe("context filename parameter", () => {
    it("should include Context section when contextFilename is provided", () => {
      const files = composeTemplate(
        "greenfield",
        "typescript-react",
        "test",
        "Test app",
        "notes.md",
      );
      const claudeMd = files.find((f) => f.path === "CLAUDE.md")!;
      expect(claudeMd.content).toContain("## Context");
      expect(claudeMd.content).toContain("@context/notes.md");
    });

    it("should omit Context section when contextFilename is not provided", () => {
      const files = composeTemplate(
        "learning",
        "custom",
        "test",
        "Test",
      );
      const claudeMd = files.find((f) => f.path === "CLAUDE.md")!;
      expect(claudeMd.content).not.toContain("## Context");
    });
  });
});

describe("CLAUDE.md Assembly", () => {
  it("should include project name and description", () => {
    const result = assembleClaudeMd({
      name: "my-project",
      description: "A cool project",
      workflow: "greenfield",
      stack: "typescript-react",
    });
    expect(result).toContain("# my-project");
    expect(result).toContain("A cool project");
  });

  it("should include Setup section with stack hint and workflow instructions", () => {
    const result = assembleClaudeMd({
      name: "test",
      description: "desc",
      workflow: "research",
      stack: "python",
    });
    expect(result).toContain("## Setup");
    expect(result).toContain("Python");
    expect(result).toContain("analyze the research notes");
  });

  it("should include GitHub Integration section", () => {
    const result = assembleClaudeMd({
      name: "test",
      description: "desc",
      workflow: "feature",
      stack: "typescript-node",
    });
    expect(result).toContain("## GitHub Integration");
    expect(result).toContain("@claude");
  });

  it("should include Context section when contextFilename provided", () => {
    const result = assembleClaudeMd({
      name: "test",
      description: "desc",
      workflow: "greenfield",
      stack: "rust",
      contextFilename: "research.md",
    });
    expect(result).toContain("## Context");
    expect(result).toContain("@context/research.md");
  });

  it("should omit Context section when no contextFilename", () => {
    const result = assembleClaudeMd({
      name: "test",
      description: "desc",
      workflow: "greenfield",
      stack: "rust",
    });
    expect(result).not.toContain("## Context");
  });
});

describe("Gitignore Merge", () => {
  it("should merge platform and stack entries for typescript-react", () => {
    const files = composeTemplate(
      "greenfield",
      "typescript-react",
      "test",
      "Test",
    );
    const gitignore = files.find((f) => f.path === ".gitignore")!;
    // Platform entries
    expect(gitignore.content).toContain(".DS_Store");
    expect(gitignore.content).toContain(".env");
    // Stack entries
    expect(gitignore.content).toContain("node_modules/");
    expect(gitignore.content).toContain(".next/");
  });

  it("should have Python-specific gitignore entries", () => {
    const files = composeTemplate("research", "python", "test", "Test");
    const gitignore = files.find((f) => f.path === ".gitignore")!;
    expect(gitignore.content).toContain("__pycache__/");
    expect(gitignore.content).toContain(".venv/");
    expect(gitignore.content).toContain(".mypy_cache/");
  });

  it("should have Rust-specific gitignore entries", () => {
    const files = composeTemplate("greenfield", "rust", "test", "Test");
    const gitignore = files.find((f) => f.path === ".gitignore")!;
    expect(gitignore.content).toContain("target/");
  });

  it("should have TS-Node gitignore entries without .next/", () => {
    const files = composeTemplate("feature", "typescript-node", "test", "Test");
    const gitignore = files.find((f) => f.path === ".gitignore")!;
    expect(gitignore.content).toContain("node_modules/");
    expect(gitignore.content).toContain("dist/");
    expect(gitignore.content).not.toContain(".next/");
  });

  it("should have minimal gitignore for custom stack (platform base only)", () => {
    const files = composeTemplate("learning", "custom", "test", "Test");
    const gitignore = files.find((f) => f.path === ".gitignore")!;
    expect(gitignore.content).toContain(".DS_Store");
    expect(gitignore.content).not.toContain("node_modules/");
    expect(gitignore.content).not.toContain("__pycache__/");
  });

  it("should not have duplicate entries", () => {
    const files = composeTemplate(
      "greenfield",
      "typescript-react",
      "test",
      "Test",
    );
    const gitignore = files.find((f) => f.path === ".gitignore")!;
    const lines = gitignore.content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
    const uniqueLines = new Set(lines);
    expect(lines.length).toBe(uniqueLines.size);
  });
});

describe("Repository Name Validation", () => {
  describe("valid names", () => {
    const validNames = [
      "a",
      "ab",
      "my-app",
      "test123",
      "my-cool-project",
      "a1",
      "1a",
      "app-v2",
    ];

    validNames.forEach((name) => {
      it(`should accept valid name: "${name}"`, () => {
        expect(isValidRepoName(name)).toBe(true);
      });
    });
  });

  describe("invalid names", () => {
    const invalidNames = [
      "My App", // spaces
      "TEST", // uppercase
      "test_app", // underscore
      "test.app", // dot
      "-test", // starts with hyphen
      "test-", // ends with hyphen
      "", // empty
      "Test", // uppercase
    ];

    invalidNames.forEach((name) => {
      it(`should reject invalid name: "${name}"`, () => {
        expect(isValidRepoName(name)).toBe(false);
      });
    });
  });

  it("should accept double hyphens (valid for GitHub)", () => {
    expect(isValidRepoName("my--app")).toBe(true);
  });
});
