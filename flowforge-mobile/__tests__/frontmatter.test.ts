import { parseFrontmatter, filenameToRepoName } from "../lib/frontmatter";

describe("parseFrontmatter", () => {
  it("should parse all fields present", () => {
    const content = `---
workflow: research
stack: python
private: false
description: My research project
---
# Body content here
`;
    const result = parseFrontmatter(content);
    expect(result.workflow).toBe("research");
    expect(result.stack).toBe("python");
    expect(result.isPrivate).toBe(false);
    expect(result.description).toBe("My research project");
    expect(result.body).toBe("# Body content here\n");
    expect(result.rawContent).toBe(content);
  });

  it("should return defaults when no frontmatter present", () => {
    const content = "# Just a heading\n\nSome content.";
    const result = parseFrontmatter(content);
    expect(result.workflow).toBe("greenfield");
    expect(result.stack).toBe("custom");
    expect(result.isPrivate).toBe(true);
    expect(result.description).toBe("");
    expect(result.body).toBe(content);
  });

  it("should return defaults for invalid workflow/stack values", () => {
    const content = `---
workflow: invalid-workflow
stack: java
---
Body`;
    const result = parseFrontmatter(content);
    expect(result.workflow).toBe("greenfield");
    expect(result.stack).toBe("custom");
  });

  it("should handle quoted strings", () => {
    const content = `---
description: "A project with: colons"
workflow: 'feature'
---
Body`;
    const result = parseFrontmatter(content);
    expect(result.description).toBe("A project with: colons");
    expect(result.workflow).toBe("feature");
  });

  it("should handle CRLF line endings", () => {
    const content =
      "---\r\nworkflow: research\r\nstack: rust\r\n---\r\nBody with CRLF";
    const result = parseFrontmatter(content);
    expect(result.workflow).toBe("research");
    expect(result.stack).toBe("rust");
    expect(result.body).toBe("Body with CRLF");
  });

  it("should handle partial fields", () => {
    const content = `---
workflow: learning
---
Body`;
    const result = parseFrontmatter(content);
    expect(result.workflow).toBe("learning");
    expect(result.stack).toBe("custom");
    expect(result.isPrivate).toBe(true);
    expect(result.description).toBe("");
  });

  it("should handle boolean variations for private", () => {
    const cases = [
      { input: "true", expected: true },
      { input: "false", expected: false },
      { input: "yes", expected: true },
      { input: "no", expected: false },
      { input: "1", expected: true },
      { input: "0", expected: false },
      { input: "True", expected: true },
      { input: "False", expected: false },
    ];

    for (const { input, expected } of cases) {
      const content = `---\nprivate: ${input}\n---\nBody`;
      const result = parseFrontmatter(content);
      expect(result.isPrivate).toBe(expected);
    }
  });

  it("should handle empty description", () => {
    const content = `---
description:
---
Body`;
    const result = parseFrontmatter(content);
    expect(result.description).toBe("");
  });

  it("should preserve body content", () => {
    const body =
      "# Title\n\n## Section\n\nParagraph with **bold** and _italic_.\n\n- list item\n- another";
    const content = `---\nworkflow: feature\n---\n${body}`;
    const result = parseFrontmatter(content);
    expect(result.body).toBe(body);
  });

  it("should handle all valid stacks", () => {
    const stacks = [
      "typescript-react",
      "typescript-node",
      "python",
      "rust",
      "custom",
    ];
    for (const stack of stacks) {
      const content = `---\nstack: ${stack}\n---\nBody`;
      const result = parseFrontmatter(content);
      expect(result.stack).toBe(stack);
    }
  });

  it("should handle all valid workflows", () => {
    const workflows = ["research", "feature", "greenfield", "learning"];
    for (const workflow of workflows) {
      const content = `---\nworkflow: ${workflow}\n---\nBody`;
      const result = parseFrontmatter(content);
      expect(result.workflow).toBe(workflow);
    }
  });
});

describe("filenameToRepoName", () => {
  it("should convert spaces to hyphens", () => {
    expect(filenameToRepoName("My Project Notes.md")).toBe("my-project-notes");
  });

  it("should convert underscores to hyphens", () => {
    expect(filenameToRepoName("my_project_notes.md")).toBe("my-project-notes");
  });

  it("should remove special characters", () => {
    expect(filenameToRepoName("my@project#v2!.md")).toBe("myprojectv2");
  });

  it("should strip leading and trailing hyphens", () => {
    expect(filenameToRepoName("--my-project--.md")).toBe("my-project");
  });

  it("should truncate long names to 100 chars", () => {
    const longName = "a".repeat(150) + ".md";
    expect(filenameToRepoName(longName).length).toBeLessThanOrEqual(100);
  });

  it("should handle filename without extension", () => {
    expect(filenameToRepoName("readme")).toBe("readme");
  });

  it("should strip .md extension case-insensitively", () => {
    expect(filenameToRepoName("MyProject.MD")).toBe("myproject");
  });

  it("should collapse multiple hyphens", () => {
    expect(filenameToRepoName("my - - project.md")).toBe("my-project");
  });

  it("should handle mixed spaces and underscores", () => {
    expect(filenameToRepoName("my project_notes here.md")).toBe(
      "my-project-notes-here",
    );
  });
});
