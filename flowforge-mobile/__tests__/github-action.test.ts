import {
  getGitHubActionFiles,
  getGitHubIntegrationSection,
  TRIGGER_MATRIX,
} from "../lib/templates/github-action";
import { composeTemplate } from "../lib/templates/compose";
import type { WorkflowPreset } from "../lib/types";

const ALL_WORKFLOWS: WorkflowPreset[] = [
  "research",
  "feature",
  "greenfield",
  "learning",
];

describe("GitHub Action Template", () => {
  describe("getGitHubActionFiles", () => {
    it.each(ALL_WORKFLOWS)(
      "%s — returns exactly one file at .github/workflows/claude.yml",
      (workflow) => {
        const files = getGitHubActionFiles(workflow);
        expect(files).toHaveLength(1);
        expect(files[0].path).toBe(".github/workflows/claude.yml");
      },
    );

    it.each(ALL_WORKFLOWS)(
      "%s — generates valid YAML structure",
      (workflow) => {
        const [file] = getGitHubActionFiles(workflow);
        expect(file.content).toContain("name: Claude");
        expect(file.content).toContain("on:");
        expect(file.content).toContain("jobs:");
        expect(file.content).toContain("runs-on: ubuntu-latest");
        expect(file.content).toContain("actions/checkout@v4");
        expect(file.content).toContain("anthropics/claude-code-action@v1");
      },
    );

    it.each(ALL_WORKFLOWS)("%s — includes required permissions", (workflow) => {
      const [file] = getGitHubActionFiles(workflow);
      expect(file.content).toContain("contents: write");
      expect(file.content).toContain("pull-requests: write");
      expect(file.content).toContain("issues: write");
    });

    it.each(ALL_WORKFLOWS)(
      "%s — always includes issue_comment and pull_request_review_comment triggers",
      (workflow) => {
        const [file] = getGitHubActionFiles(workflow);
        expect(file.content).toContain("issue_comment:");
        expect(file.content).toContain("pull_request_review_comment:");
      },
    );

    it.each(ALL_WORKFLOWS)(
      "%s — always includes @claude trigger phrase",
      (workflow) => {
        const [file] = getGitHubActionFiles(workflow);
        expect(file.content).toContain('trigger_phrase: "@claude"');
      },
    );
  });

  describe("Trigger matrix — workflow-specific triggers", () => {
    // Use "  <trigger>:\n" pattern to match on: block triggers only,
    // avoiding false matches with "permissions: issues: write" etc.
    it("research — includes issues trigger but not pull_request", () => {
      const [file] = getGitHubActionFiles("research");
      expect(file.content).toContain("  issues:\n");
      expect(file.content).not.toContain("  pull_request:\n");
      expect(file.content).not.toContain("  pull_request_review:\n");
    });

    it("feature — includes pull_request and pull_request_review but not issues", () => {
      const [file] = getGitHubActionFiles("feature");
      expect(file.content).toContain("  pull_request:\n");
      expect(file.content).toContain("  pull_request_review:\n");
      expect(file.content).not.toContain("  issues:\n");
    });

    it("greenfield — includes pull_request and issues but not pull_request_review", () => {
      const [file] = getGitHubActionFiles("greenfield");
      expect(file.content).toContain("  pull_request:\n");
      expect(file.content).toContain("  issues:\n");
      expect(file.content).not.toContain("  pull_request_review:\n");
    });

    it("learning — only includes issue_comment and pull_request_review_comment", () => {
      const [file] = getGitHubActionFiles("learning");
      expect(file.content).toContain("  issue_comment:\n");
      expect(file.content).toContain("  pull_request_review_comment:\n");
      expect(file.content).not.toContain("  pull_request:\n");
      expect(file.content).not.toContain("  pull_request_review:\n");
      expect(file.content).not.toContain("  issues:\n");
    });
  });

  describe("Workflow-specific action config", () => {
    it("research — includes assignee_trigger and label_trigger", () => {
      const [file] = getGitHubActionFiles("research");
      expect(file.content).toContain('assignee_trigger: "claude"');
      expect(file.content).toContain('label_trigger: "claude"');
      expect(file.content).not.toContain("include_fix_links");
    });

    it("feature — includes include_fix_links", () => {
      const [file] = getGitHubActionFiles("feature");
      expect(file.content).toContain("include_fix_links: true");
      expect(file.content).not.toContain("assignee_trigger");
      expect(file.content).not.toContain("label_trigger");
    });

    it("greenfield — includes assignee_trigger and label_trigger", () => {
      const [file] = getGitHubActionFiles("greenfield");
      expect(file.content).toContain('assignee_trigger: "claude"');
      expect(file.content).toContain('label_trigger: "claude"');
    });

    it("learning — minimal config (trigger_phrase and sticky comment only)", () => {
      const [file] = getGitHubActionFiles("learning");
      expect(file.content).toContain('trigger_phrase: "@claude"');
      expect(file.content).toContain("use_sticky_comment: true");
      expect(file.content).not.toContain("assignee_trigger");
      expect(file.content).not.toContain("label_trigger");
      expect(file.content).not.toContain("include_fix_links");
    });
  });

  describe("TRIGGER_MATRIX correctness", () => {
    it("all workflows have issueComment and prReviewComment enabled", () => {
      for (const workflow of ALL_WORKFLOWS) {
        expect(TRIGGER_MATRIX[workflow].issueComment).toBe(true);
        expect(TRIGGER_MATRIX[workflow].prReviewComment).toBe(true);
      }
    });

    it("prOpened — enabled for feature and greenfield only", () => {
      expect(TRIGGER_MATRIX.feature.prOpened).toBe(true);
      expect(TRIGGER_MATRIX.greenfield.prOpened).toBe(true);
      expect(TRIGGER_MATRIX.research.prOpened).toBe(false);
      expect(TRIGGER_MATRIX.learning.prOpened).toBe(false);
    });

    it("prReviewSubmitted — enabled for feature only", () => {
      expect(TRIGGER_MATRIX.feature.prReviewSubmitted).toBe(true);
      expect(TRIGGER_MATRIX.research.prReviewSubmitted).toBe(false);
      expect(TRIGGER_MATRIX.greenfield.prReviewSubmitted).toBe(false);
      expect(TRIGGER_MATRIX.learning.prReviewSubmitted).toBe(false);
    });

    it("issueAssigned — enabled for research and greenfield only", () => {
      expect(TRIGGER_MATRIX.research.issueAssigned).toBe(true);
      expect(TRIGGER_MATRIX.greenfield.issueAssigned).toBe(true);
      expect(TRIGGER_MATRIX.feature.issueAssigned).toBe(false);
      expect(TRIGGER_MATRIX.learning.issueAssigned).toBe(false);
    });

    it("labelAdded — enabled for research and greenfield only", () => {
      expect(TRIGGER_MATRIX.research.labelAdded).toBe(true);
      expect(TRIGGER_MATRIX.greenfield.labelAdded).toBe(true);
      expect(TRIGGER_MATRIX.feature.labelAdded).toBe(false);
      expect(TRIGGER_MATRIX.learning.labelAdded).toBe(false);
    });
  });
});

describe("GitHub Integration CLAUDE.md Section", () => {
  it.each(ALL_WORKFLOWS)("%s — returns a section with order 65", (workflow) => {
    const section = getGitHubIntegrationSection(workflow);
    expect(section.heading).toBe("## GitHub Integration");
    expect(section.order).toBe(65);
    expect(section.source).toBe("platform");
  });

  it.each(ALL_WORKFLOWS)("%s — always mentions @claude", (workflow) => {
    const section = getGitHubIntegrationSection(workflow);
    expect(section.content).toContain("@claude");
  });

  it("feature — mentions PR reviews", () => {
    const section = getGitHubIntegrationSection("feature");
    expect(section.content).toContain("reviews new PRs");
    expect(section.content).toContain("reviews requesting changes");
  });

  it("research — mentions assign and label triggers", () => {
    const section = getGitHubIntegrationSection("research");
    expect(section.content).toContain("Assign an issue");
    expect(section.content).toContain("`claude` label");
  });

  it("learning — minimal triggers (only @claude mention)", () => {
    const section = getGitHubIntegrationSection("learning");
    expect(section.content).toContain("@claude");
    expect(section.content).not.toContain("Assign");
    expect(section.content).not.toContain("label");
    expect(section.content).not.toContain("reviews new PRs");
  });
});

describe("compose.ts integration", () => {
  it("should include .github/workflows/claude.yml in composed output", () => {
    const files = composeTemplate(
      "feature",
      "typescript-react",
      "test-app",
      "Test",
    );
    const paths = files.map((f) => f.path);
    expect(paths).toContain(".github/workflows/claude.yml");
  });

  it("should include GitHub Integration section in CLAUDE.md", () => {
    const files = composeTemplate("research", "python", "test-app", "Test");
    const claudeMd = files.find((f) => f.path === "CLAUDE.md");
    expect(claudeMd?.content).toContain("## GitHub Integration");
    expect(claudeMd?.content).toContain("@claude");
  });

  it.each(ALL_WORKFLOWS)(
    "%s — includes workflow file in all workflow combos",
    (workflow) => {
      const files = composeTemplate(workflow, "custom", "test", "Test");
      const paths = files.map((f) => f.path);
      expect(paths).toContain(".github/workflows/claude.yml");
    },
  );
});
