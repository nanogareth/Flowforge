# Claude GitHub App Research

**Date**: 2026-02-15
**Keywords**: github app, claude code action, github actions, CI/CD, bot

## Key Finding: Two Distinct GitHub Apps

| App                     | URL                                 | Purpose                                                  |
| ----------------------- | ----------------------------------- | -------------------------------------------------------- |
| **"Claude"**            | `github.com/apps/claude`            | Claude Code in GitHub Actions — works on PRs/issues      |
| **"Claude for GitHub"** | `github.com/apps/claude-for-github` | Read-only connector for claude.ai web app (context sync) |

**FlowForge cares about the first one** — the Claude Code GitHub Actions integration.

## "Claude" App — How It Works

Two-component system:

1. **GitHub App** (`github.com/apps/claude`) — handles auth, provides `claude[bot]` identity, manages permissions
2. **GitHub Action** (`anthropics/claude-code-action@v1`) — workflow runner using Claude Code SDK

Flow: GitHub event → triggers workflow → action authenticates via app → runs Claude Code SDK → posts comments / creates commits / opens PRs

### Triggers

| Trigger           | How                                       |
| ----------------- | ----------------------------------------- |
| `@claude` mention | PR comment, issue comment, review comment |
| Issue assignment  | `assignee_trigger: "claude"`              |
| Label addition    | `label_trigger: "claude"`                 |
| PR opened         | `pull_request: types: [opened]`           |
| PR review         | `pull_request_review: types: [submitted]` |
| Scheduled/cron    | Automation with explicit `prompt`         |

### Required Secrets

- `ANTHROPIC_API_KEY` — for direct API access
- OR `CLAUDE_CODE_OAUTH_TOKEN` — for Pro/Max users

### Permissions (App-Level)

- Contents: Read & Write
- Issues: Read & Write
- Pull Requests: Read & Write
- Actions: Read
- Metadata: Read

### Configuration Files Read from Repos

| File                                      | Purpose                               |
| ----------------------------------------- | ------------------------------------- |
| `CLAUDE.md` (root or `.claude/CLAUDE.md`) | Project instructions                  |
| `.claude/rules/*.md`                      | Modular topic rules (with path globs) |
| `.claude/settings.json`                   | Permissions, hooks, env vars          |
| `.mcp.json`                               | MCP server configuration              |
| `.github/workflows/claude.yml`            | **The workflow definition itself**    |

### Action Parameters (`anthropics/claude-code-action@v1`)

| Parameter                 | Description                                   |
| ------------------------- | --------------------------------------------- |
| `anthropic_api_key`       | API key                                       |
| `claude_code_oauth_token` | OAuth alternative                             |
| `prompt`                  | Instructions for automation tasks             |
| `claude_args`             | CLI args (`--max-turns`, `--model`, etc.)     |
| `trigger_phrase`          | Custom trigger (default: `@claude`)           |
| `assignee_trigger`        | Username for issue assignment trigger         |
| `label_trigger`           | Label trigger                                 |
| `branch_prefix`           | Claude's branch prefix (default: `claude/`)   |
| `include_fix_links`       | "Fix this" links in reviews (default: `true`) |
| `use_sticky_comment`      | Single updating comment                       |
| `settings`                | Inline JSON or path to settings file          |
| `use_commit_signing`      | Sign commits via GitHub API                   |
| `allowed_bots`            | Bot usernames allowed to trigger              |

### Minimal Workflow Example

```yaml
name: Claude Code
on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
  pull_request_review:
    types: [submitted]
  issues:
    types: [opened, assigned, labeled]
  pull_request:
    types: [opened, labeled]

jobs:
  claude:
    if: |
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@claude')) ||
      (github.event_name == 'pull_request_review_comment' && contains(github.event.comment.body, '@claude')) ||
      (github.event_name == 'pull_request_review') ||
      (github.event_name == 'issues') ||
      (github.event_name == 'pull_request')
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
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Sources

- [Claude Code GitHub Actions Docs](https://code.claude.com/docs/en/github-actions)
- [claude-code-action repo](https://github.com/anthropics/claude-code-action)
- [Setup docs](https://github.com/anthropics/claude-code-action/blob/main/docs/setup.md)
- [Configuration docs](https://github.com/anthropics/claude-code-action/blob/main/docs/configuration.md)
- [Usage docs](https://github.com/anthropics/claude-code-action/blob/main/docs/usage.md)
- [Security docs](https://github.com/anthropics/claude-code-action/blob/main/docs/security.md)
- [GitHub App Manifest](https://github.com/anthropics/claude-code-action/blob/main/github-app-manifest.json)
