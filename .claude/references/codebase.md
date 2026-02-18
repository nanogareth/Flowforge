# Codebase Map

> **Last updated**: 2026-02-18

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
- `ALL_WORKFLOWS`
- `ALL_STACKS`

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

### `flowforge-mobile/app/(app)/server/projects.tsx`
- `formatRelativeTime()`
- `ProjectsScreen()`

### `flowforge-mobile/app/(app)/server/terminal.tsx`
- `TerminalScreen()`

### `flowforge-mobile/app/(app)/success.tsx`
- `Phase`
- `StepInfo`
- `getPhaseFromMessage()`
- `Success()`
- `phaseIndex()`
- `STEPS`

### `flowforge-mobile/app/_layout.tsx`
- `RootLayout()`

### `flowforge-mobile/app/index.tsx`
- `Index()`

### `flowforge-mobile/app/login.tsx`
- `Login()`

### `flowforge-mobile/components/CopyableError.tsx`
- `CopyableErrorProps`
- `CopyableError()`

### `flowforge-mobile/components/TerminalToolbar.tsx`
- `TerminalToolbarProps`
- `TerminalToolbar()`
- `KEYS`
- `CTRL_COMBOS`

### `flowforge-mobile/lib/auth.ts`
- `useGitHubAuth()`
- `getToken()`
- `saveToken()`
- `clearToken()`
- `exchangeCodeForToken()`
- `GITHUB_CLIENT_ID`
- `TOKEN_ENDPOINT`
- `TOKEN_KEY`

### `flowforge-mobile/lib/frontmatter.ts`
- `parseYamlValue()`
- `filenameToRepoName()`
- `parseBooleanish()`
- `parseFrontmatter()`
- `VALID_STACKS`
- `FRONTMATTER_REGEX`
- `VALID_WORKFLOWS`

### `flowforge-mobile/lib/github.ts`
- `toBase64()`
- `isValidRepoName()`
- `createRepository()`
- `deleteRepository()`
- `MIN_CREATION_INTERVAL`

### `flowforge-mobile/lib/server-api.ts`
- `Project`
- `CloneProgress`
- `fetchProjects()`
- `cloneAndLaunch()`

### `flowforge-mobile/lib/server-auth.ts`
- `saveServerCredentials()`
- `getServerCredentials()`
- `getTailscaleUrl()`
- `saveTailscaleUrl()`
- `clearServerCredentials()`
- `clearTailscaleUrl()`
- `pairWithServer()`
- `checkHealth()`
- `SERVER_URL_KEY`
- `SERVER_TAILSCALE_URL_KEY`
- `SERVER_TOKEN_KEY`

### `flowforge-mobile/lib/tailscale.ts`
- `TailscaleInfo`
- `discoverServer()`
- `buildServerUrl()`
- `checkTailscaleReachable()`

### `flowforge-mobile/lib/templates/claude-md.ts`
- `ClaudeMdOptions`
- `assembleClaudeMd()`
- `getGitHubIntegrationText()`
- `STACK_HINTS`
- `WORKFLOW_INSTRUCTIONS`

### `flowforge-mobile/lib/templates/compose.ts`
- `composeTemplate()`
- `mergeGitignore()`

### `flowforge-mobile/lib/templates/github-action.ts`
- `TriggerConfig`
- `buildOnBlock()`
- `getGitHubActionFiles()`
- `buildWithBlock()`
- `buildIfCondition()`
- `TRIGGER_MATRIX`

### `flowforge-mobile/lib/templates/platform.ts`
- `getPlatformGitignore()`

### `flowforge-mobile/lib/templates/stacks/custom.ts`
- `getStackGitignore()`

### `flowforge-mobile/lib/templates/stacks/python.ts`
- `getStackGitignore()`

### `flowforge-mobile/lib/templates/stacks/rust.ts`
- `getStackGitignore()`

### `flowforge-mobile/lib/templates/stacks/typescript-node.ts`
- `getStackGitignore()`

### `flowforge-mobile/lib/templates/stacks/typescript-react.ts`
- `getStackGitignore()`

### `flowforge-mobile/lib/terminal-html.ts`
- `getTerminalHtml()`

### `flowforge-mobile/lib/types.ts`
- `WorkflowPreset`
- `StackPreset`
- `PickedFile`
- `CreatedRepo`
- `FrontmatterResult`
- `FileToCreate`
- `CreateRepoResult`
- `CreateRepoOptions`

### `flowforge-mobile/stores/store.ts`
- `User`
- `AppState`
- `useStore()`

### `flowforge-server/__tests__/routes/clone.test.ts`
- `getHandler()`
- `createMockRes()`
- `setupMockProcess()`
- `createMockReq()`

### `flowforge-server/__tests__/routes/projects.test.ts`
- `getHandler()`
- `createMockRes()`
- `createMockReq()`

### `flowforge-server/__tests__/routes/tailscale.test.ts`
- `getHandler()`
- `createMockRes()`
- `createMockReq()`

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

### `flowforge-server/src/routes/clone.ts`
- `cloneRouter()`
- `PROMPT_PATTERNS`
- `INIT_TIMEOUT_MS`

### `flowforge-server/src/routes/health.ts`
- `markPaired()`
- `isPaired()`
- `setSessionCountFn()`
- `getTailscaleIp()`

### `flowforge-server/src/routes/pair.ts`
- `isRateLimited()`

### `flowforge-server/src/routes/projects.ts`
- `projectsRouter()`

### `flowforge-server/src/routes/tailscale.ts`
- `TailscaleStatus`
- `tailscaleRouter()`
- `getTailscaleStatus()`

### `flowforge-server/src/terminal/session-manager.ts`
- `broadcast()`
- `appendScrollback()`
- `getSession()`
- `getSessionCount()`
- `createSession()`
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
