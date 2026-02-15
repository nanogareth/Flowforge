# Codebase Map

> **Last updated**: 2026-02-15

## Module Index

### `flowforge-api/api/auth/token.ts`
- `TokenRequest`
- `GitHubTokenResponse`
- `handler()`

### `flowforge-api/api/health.ts`
- `handler()`

### `flowforge-mobile/.expo/types/router.d.ts`
- `__routes`

### `flowforge-mobile/__tests__/github-action.test.ts`
- `ALL_WORKFLOWS`

### `flowforge-mobile/__tests__/github.test.ts`
- `HOOK_SCRIPTS`

### `flowforge-mobile/app/(app)/_layout.tsx`
- `AppLayout()`

### `flowforge-mobile/app/(app)/create/[type].tsx`
- `FormData`
- `parseTypeParam()`
- `CreateForm()`

### `flowforge-mobile/app/(app)/index.tsx`
- `Home()`

### `flowforge-mobile/app/(app)/pick.tsx`
- `PickState`
- `PickScreen()`
- `MAX_FILE_SIZE`

### `flowforge-mobile/app/(app)/server/index.tsx`
- `ServerSettings()`

### `flowforge-mobile/app/(app)/server/pair.tsx`
- `PairScreen()`

### `flowforge-mobile/app/(app)/server/terminal.tsx`
- `TerminalScreen()`

### `flowforge-mobile/app/(app)/success.tsx`
- `Success()`

### `flowforge-mobile/app/_layout.tsx`
- `RootLayout()`

### `flowforge-mobile/app/index.tsx`
- `Index()`

### `flowforge-mobile/app/login.tsx`
- `Login()`

### `flowforge-mobile/components/CopyableError.tsx`
- `CopyableErrorProps`
- `CopyableError()`

### `flowforge-mobile/lib/auth.ts`
- `useGitHubAuth()`
- `exchangeCodeForToken()`
- `getToken()`
- `saveToken()`
- `clearToken()`
- `GITHUB_CLIENT_ID`
- `TOKEN_ENDPOINT`
- `TOKEN_KEY`

### `flowforge-mobile/lib/claude-code-app.ts`
- `ClaudeCodeSetupResult`
- `setupClaudeCode()`

### `flowforge-mobile/lib/frontmatter.ts`
- `parseYamlValue()`
- `filenameToRepoName()`
- `parseBooleanish()`
- `parseFrontmatter()`
- `VALID_WORKFLOWS`
- `FRONTMATTER_REGEX`
- `VALID_STACKS`

### `flowforge-mobile/lib/github.ts`
- `toBase64()`
- `createRepository()`
- `deleteRepository()`
- `isValidRepoName()`
- `MIN_CREATION_INTERVAL`

### `flowforge-mobile/lib/server-api.ts`
- `cloneAndLaunch()`

### `flowforge-mobile/lib/server-auth.ts`
- `saveServerCredentials()`
- `checkHealth()`
- `clearServerCredentials()`
- `getServerCredentials()`
- `pairWithServer()`
- `SERVER_URL_KEY`
- `SERVER_TOKEN_KEY`

### `flowforge-mobile/lib/templates/claude-md.ts`
- `ClaudeMdSection`
- `assembleClaudeMd()`

### `flowforge-mobile/lib/templates/compose.ts`
- `composeTemplate()`
- `mergeGitignore()`
- `deduplicateFiles()`

### `flowforge-mobile/lib/templates/devcontainer.ts`
- `DevcontainerJson`
- `getDevcontainerFiles()`
- `BASE_EXTENSIONS`
- `STACK_CONFIG`

### `flowforge-mobile/lib/templates/github-action.ts`
- `TriggerConfig`
- `buildOnBlock()`
- `buildIfCondition()`
- `buildWithBlock()`
- `getGitHubActionFiles()`
- `getGitHubIntegrationSection()`
- `TRIGGER_MATRIX`

### `flowforge-mobile/lib/templates/platform.ts`
- `getPlatformFiles()`
- `getPlatformClaudeMdSections()`
- `getPlatformGitignore()`

### `flowforge-mobile/lib/templates/settings.ts`
- `HookEntry`
- `HookMatcher`
- `SettingsJson`
- `buildSettings()`
- `HOOK_DIR`
- `TDD_WORKFLOWS`
- `STACK_ENV`

### `flowforge-mobile/lib/templates/stacks/custom.ts`
- `getStackFiles()`
- `getStackGitignore()`
- `getStackClaudeMdSections()`

### `flowforge-mobile/lib/templates/stacks/python.ts`
- `getStackFiles()`
- `getStackClaudeMdSections()`
- `getStackGitignore()`

### `flowforge-mobile/lib/templates/stacks/rust.ts`
- `getStackFiles()`
- `getStackClaudeMdSections()`
- `getStackGitignore()`

### `flowforge-mobile/lib/templates/stacks/typescript-node.ts`
- `getStackFiles()`
- `getStackGitignore()`
- `getStackClaudeMdSections()`

### `flowforge-mobile/lib/templates/stacks/typescript-react.ts`
- `getStackFiles()`
- `getStackClaudeMdSections()`
- `getStackGitignore()`

### `flowforge-mobile/lib/templates/workflows/feature.ts`
- `getWorkflowFiles()`
- `getWorkflowClaudeMdSections()`

### `flowforge-mobile/lib/templates/workflows/greenfield.ts`
- `getWorkflowFiles()`
- `getWorkflowClaudeMdSections()`

### `flowforge-mobile/lib/templates/workflows/learning.ts`
- `getWorkflowFiles()`
- `getWorkflowClaudeMdSections()`

### `flowforge-mobile/lib/templates/workflows/research.ts`
- `getWorkflowFiles()`
- `getWorkflowClaudeMdSections()`

### `flowforge-mobile/lib/terminal-html.ts`
- `getTerminalHtml()`

### `flowforge-mobile/lib/types.ts`
- `WorkflowPreset`
- `StackPreset`
- `CreatedRepo`
- `CreateRepoResult`
- `FileToCreate`
- `CreateRepoOptions`
- `PickedFile`
- `FrontmatterResult`

### `flowforge-mobile/stores/store.ts`
- `User`
- `AppState`
- `useStore()`

### `flowforge-server/__tests__/routes/clone.test.ts`
- `getHandler()`
- `createMockRes()`
- `createMockReq()`
- `setupMockProcess()`

### `flowforge-server/__tests__/terminal/session-manager.test.ts`
- `createMockPty()`
- `createMockWs()`

### `flowforge-server/src/auth/jwt.ts`
- `getSecret()`
- `verify()`
- `sign()`

### `flowforge-server/src/auth/middleware.ts`
- `Request`
- `authMiddleware()`

### `flowforge-server/src/auth/pairing.ts`
- `generatePairingCode()`
- `validatePairingCode()`

### `flowforge-server/src/config.ts`
- `config()`

### `flowforge-server/src/routes/clone.ts`
- `cloneRouter()`

### `flowforge-server/src/routes/health.ts`
- `markPaired()`
- `setSessionCountFn()`
- `isPaired()`

### `flowforge-server/src/routes/pair.ts`
- `isRateLimited()`

### `flowforge-server/src/terminal/session-manager.ts`
- `broadcast()`
- `getSessionCount()`
- `createSession()`
- `getSession()`
- `appendScrollback()`
- `attachClient()`
- `detachClient()`
- `destroySession()`
- `startGarbageCollector()`

### `flowforge-server/src/terminal/ws-handler.ts`
- `handleWebSocket()`
- `wireSession()`

### `flowforge-server/src/types.ts`
- `TerminalSession`
- `ClientMessage`
- `ServerMessage`
