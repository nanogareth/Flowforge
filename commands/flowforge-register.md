---
description: "Register an existing project with Gaia and backfill Claude Code config"
argument-hint: "[project-path]"
allowed-tools: ["Bash", "Read", "Write", "Glob", "Grep", "Edit"]
---

# /flowforge-register — Register Existing Project

Register an existing project with Gaia's manifest and optionally backfill missing Claude Code configuration files (`.claude/settings.json`, `.github/workflows/claude.yml`).

Use this for projects that existed before FlowForge, or that were set up manually.

## Inputs

**Optional argument:** `$ARGUMENTS` — path to the project directory. If empty, use the current working directory.

**Interactive prompts:**

1. **Confirm project** — show the detected project name (from directory basename) and git remote (if any). Ask the user to confirm or correct.
2. **Description** — one-line project description. Pre-fill from CLAUDE.md title/first paragraph if it exists.
3. **Gaia domain** — which domain to register under. Show available domains from `manifest.yaml`. Required.
4. **Backfill config?** — ask whether to also generate missing Claude Code files:
   - `.claude/settings.json` (if not present)
   - `.github/workflows/claude.yml` (if not present)
   If yes, ask for **workflow** and **stack** (same options as `/flowforge-init`).

## Execution

### Step 1: Detect project info

```bash
PROJECT_PATH="${ARGUMENTS:-$(pwd)}"
PROJECT_NAME=$(basename "$PROJECT_PATH")
```

Read the git remote if available:

```bash
git -C "$PROJECT_PATH" remote get-url origin 2>/dev/null
```

Parse the owner/repo from the remote URL (e.g., `https://github.com/owner/repo.git` → `owner/repo`).

Check for existing files:
- `CLAUDE.md` — read first few lines for description
- `.claude/settings.json` — exists?
- `.github/workflows/claude.yml` — exists?

### Step 2: Locate Gaia

Check `$GAIA_ROOT` env var, then fall back to `C:\GitHub\Gaia` (Windows) or `~/GitHub/Gaia` (elsewhere).

If `manifest.yaml` doesn't exist at that location, tell the user Gaia was not found and ask for the path. If still not found, abort — registration requires Gaia.

### Step 3: Check for duplicate

Read `manifest.yaml` and check if an entry with the same `name:` already exists. If so, tell the user and ask whether to update the existing entry or skip registration.

### Step 4: Read available domains

Parse `manifest.yaml` to extract unique `domain:` values from existing entries. Present these to the user as options, plus the ability to type a custom domain name.

### Step 5: Register in manifest

Append to `manifest.yaml`:

```yaml
  - name: {project name}
    github: {owner/repo from git remote, or ask user}
    domain: {chosen domain}
    status: active
    description: {project description}
```

### Step 6: Update domain file

If `domains/{domain}.md` exists in the Gaia root, append a subsection under `## Current State`:

```markdown
### {project name}

- **Status:** Active
- **Focus:** {description}
- **Repo:** [{owner/repo}](https://github.com/{owner/repo})
```

If the domain file doesn't exist, skip this step.

### Step 7: Backfill config (if requested)

If the user chose to backfill:

**`.claude/settings.json`** — generate using the same stack-based env vars as `/flowforge-init` Step 4. Only create if the file doesn't already exist.

**`.github/workflows/claude.yml`** — generate using the same workflow-based triggers as `/flowforge-init` Step 5. Only create if the file doesn't already exist.

If either file was created, commit them to the project repo:

```bash
cd "$PROJECT_PATH"
git add .claude/settings.json .github/workflows/claude.yml
git commit -m "chore: add Claude Code config via FlowForge"
```

### Step 8: Commit Gaia changes

```bash
cd "$GAIA_ROOT"
git add manifest.yaml "domains/{domain}.md"
git commit -m "register: {project name} in {domain}"
git push
```

If the push fails, warn the user but don't fail the overall flow.

### Step 9: Summary

```
Registered: {project name}
Domain: {domain}
Gaia manifest: updated
Domain file: {updated or "skipped (file not found)"}
Config backfill: {list of files created, or "skipped"}

The SessionEnd hook will now auto-sync Claude Code sessions
in this project to Gaia's domain file and daily log.
```

## Important Notes

- This command modifies the Gaia repo, not the current project (unless backfill is requested).
- The SessionEnd hook (`~/.claude/hooks/gaia-session-sync.ps1`) matches projects by directory basename against `manifest.yaml` entries. The `name:` field in the manifest must match the project's directory name for auto-sync to work.
- If the project has been renamed or moved, update the manifest entry manually.
- Always use `py` (not `python` or `python3`) for Python stack commands.
