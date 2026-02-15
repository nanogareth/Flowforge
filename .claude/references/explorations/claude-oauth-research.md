# Claude Code OAuth Research

**Date**: 2026-02-15
**Keywords**: oauth, anthropic, claude code, authentication, api key, token

## Key Finding: Third-Party OAuth is NOT Supported

Anthropic does NOT provide a third-party OAuth registration portal. The `claude_code_oauth_token` uses
an internal OAuth flow tied to Claude Code CLI's hardcoded client ID.

### Why FlowForge Cannot Implement Claude OAuth Directly

1. **No app registration** — No way to get your own client_id
2. **Hardcoded redirect URI** — Only `https://console.anthropic.com/oauth/code/callback` accepted
3. **Active enforcement** — Anthropic blocks third-party clients via user-agent fingerprinting (Jan 2026)
4. **ToS violation** — Automated access via non-official means is prohibited

### OAuth Flow Details (Internal, Undocumented)

- **Auth endpoint**: `https://claude.ai/oauth/authorize` (Pro/Max) or `https://console.anthropic.com/oauth/authorize`
- **Token endpoint**: `https://console.anthropic.com/v1/oauth/token`
- **Client ID**: `9d1c250a-e61b-44d9-88ed-5944d1962f5e` (Claude Code CLI's)
- **Scopes**: `user:inference user:profile org:create_api_key`
- **Token format**: `sk-ant-oat01-...` (access, 8h TTL), `sk-ant-ort01-...` (refresh)

### Supported Authentication Methods for GitHub Actions

| Method                    | Secret Name               | How User Obtains It             |
| ------------------------- | ------------------------- | ------------------------------- |
| **API Key** (recommended) | `ANTHROPIC_API_KEY`       | Create at console.anthropic.com |
| **OAuth Token** (Pro/Max) | `CLAUDE_CODE_OAUTH_TOKEN` | Run `claude setup-token` in CLI |

### Recommendation for FlowForge

FlowForge should support BOTH methods but cannot implement the OAuth flow itself:

- **API Key path**: User pastes key from console.anthropic.com → FlowForge stores as repo secret
- **OAuth Token path**: User runs `claude setup-token` → pastes result → FlowForge stores as repo secret

Both can be stored as GitHub repo secrets via the API (requires repo admin scope).

### Sources

- [claude-code-action setup docs](https://github.com/anthropics/claude-code-action/blob/main/docs/setup.md)
- [Anthropic crackdown (VentureBeat)](https://venturebeat.com/technology/anthropic-cracks-down-on-unauthorized-claude-usage-by-third-party-harnesses)
- [opencode-anthropic-auth](https://github.com/anomalyco/opencode-anthropic-auth)
- [Claude Code OAuth issues](https://github.com/anthropics/claude-code/issues/6536)
