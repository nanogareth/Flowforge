# FlowForge Mobile

Mobile app to create GitHub repositories with CLAUDE.md templates.

## Goal

Build a React Native (Expo) app that:
1. Authenticates with GitHub (repo scope)
2. Lets users select a project type (web-app, cli-tool, library, research, writing)
3. Creates a GitHub repo with CLAUDE.md, README.md, .gitignore via GitHub API
4. Shows success screen with clone command

## Tech Stack

- Expo SDK 52 + React Native
- Expo Router (file-based navigation)
- Zustand (state)
- React Hook Form + Zod (forms)
- @octokit/rest (GitHub API)
- expo-secure-store (token storage)
- NativeWind (styling)

## Implementation Tasks

### Phase 1: Setup

```bash
npx create-expo-app flowforge-mobile -t expo-template-blank-typescript
cd flowforge-mobile
npx expo install expo-router expo-linking expo-constants
npx expo install expo-secure-store expo-web-browser expo-auth-session
npm install @octokit/rest zustand react-hook-form @hookform/resolvers zod
npm install nativewind tailwindcss
```

Configure `app.json`:
- scheme: "flowforge"
- bundleIdentifier: "com.flowforge.mobile"
- package: "com.flowforge.mobile"

### Phase 2: Auth

Create auth store (`stores/auth.ts`):
- token: string | null
- user: { login, name, avatar_url } | null
- login(token) - saves to SecureStore, fetches user
- logout() - clears SecureStore
- checkAuth() - loads token on app start

Create login screen (`app/login.tsx`):
- Uses expo-auth-session with GitHub OAuth
- Scopes: ['repo', 'read:user']
- On success, exchanges code for token via backend endpoint

Create root layout (`app/_layout.tsx`):
- Checks auth on mount
- Redirects to /login if not authenticated
- Redirects to /(tabs) if authenticated

**Note**: GitHub OAuth requires a backend to exchange code for token. Create Vercel Edge Function at `/api/token`:
```typescript
// POST { code, redirect_uri } -> { access_token }
```

### Phase 3: Repo Creation (Core Feature)

Create GitHub client (`lib/github.ts`):

```typescript
async function createRepository(options: {
  name: string;
  description?: string;
  isPrivate: boolean;
  template: ProjectTemplate;
}) {
  // 1. POST /user/repos - create empty repo
  // 2. Create blobs for each file (CLAUDE.md, README, .gitignore)
  // 3. POST /git/trees - create tree with all files
  // 4. POST /git/commits - create commit
  // 5. POST /git/refs - create main branch pointing to commit
  return repo;
}
```

Create templates (`constants/templates/`):
- `web-app.ts` - React/Next.js projects
- `cli-tool.ts` - CLI applications  
- `library.ts` - npm packages
- `research.ts` - data/research projects
- `writing.ts` - docs/content projects

Each template exports:
- `claudeMd: string` - CLAUDE.md content with {{PROJECT_NAME}}, {{DESCRIPTION}} placeholders
- `readme: string` - README.md content
- `gitignore: string` - .gitignore content
- `directories: string[]` - folders to create

Create project type selector (`app/(tabs)/new-project/index.tsx`):
- Grid of 5 project types with icons
- Tap navigates to `/new-project/[type]`

Create project form (`app/(tabs)/new-project/[type].tsx`):
- Name input (required, lowercase-hyphen validated)
- Description input (optional)
- Private toggle (default: true)
- "Create Repository" button
- On submit: calls createRepository, navigates to success

Create success screen (`app/(tabs)/new-project/success.tsx`):
- Checkmark animation
- Clone command with copy button
- "Create Another" button
- Quick start instructions

### Phase 4: Home & Navigation

Create tab layout (`app/(tabs)/_layout.tsx`):
- Home, Create (+), Activity, Settings tabs
- Dark theme styling

Create home screen (`app/(tabs)/index.tsx`):
- Welcome message with user name
- Large "New Project" button
- List of recently created repos
- Pull to refresh

Create repos store (`stores/repos.ts`):
- Persists created repos to AsyncStorage
- addRepo(repo), loadRepos()

Create settings screen (`app/(tabs)/settings.tsx`):
- User info display
- Sign out button

### Phase 5: Polish

- Loading states on all async actions
- Error handling with user-friendly messages
- Haptic feedback on button presses
- Pull-to-refresh on lists
- Empty states with helpful messaging

## File Structure

```
flowforge-mobile/
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── login.tsx
│   └── (tabs)/
│       ├── _layout.tsx
│       ├── index.tsx
│       ├── activity.tsx
│       ├── settings.tsx
│       └── new-project/
│           ├── index.tsx
│           ├── [type].tsx
│           └── success.tsx
├── lib/
│   ├── github.ts
│   └── auth.ts
├── stores/
│   ├── auth.ts
│   └── repos.ts
├── constants/
│   └── templates/
│       ├── index.ts
│       ├── web-app.ts
│       ├── cli-tool.ts
│       ├── library.ts
│       ├── research.ts
│       └── writing.ts
├── components/
│   └── (as needed)
├── app.json
└── package.json
```

## Environment Variables

```
EXPO_PUBLIC_GITHUB_CLIENT_ID=xxx
EXPO_PUBLIC_TOKEN_ENDPOINT=https://your-backend.vercel.app/api/token
```

## Key Implementation Details

### GitHub Repo Creation Flow

The core feature creates repos via GitHub's Git Data API:

```typescript
// 1. Create repo
const { data: repo } = await octokit.repos.createForAuthenticatedUser({
  name, description, private: isPrivate, auto_init: false
});

// 2. Create file blobs
const blobs = await Promise.all(files.map(f => 
  octokit.git.createBlob({ owner, repo, content: btoa(f.content), encoding: 'base64' })
));

// 3. Create tree
const { data: tree } = await octokit.git.createTree({
  owner, repo,
  tree: blobs.map((b, i) => ({ path: files[i].path, sha: b.data.sha, mode: '100644', type: 'blob' }))
});

// 4. Create commit
const { data: commit } = await octokit.git.createCommit({
  owner, repo, message: 'Initial setup via FlowForge', tree: tree.sha
});

// 5. Create main branch
await octokit.git.createRef({ owner, repo, ref: 'refs/heads/main', sha: commit.sha });
```

### Template Interpolation

Templates use placeholders replaced at creation time:

```typescript
function interpolate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '');
}

// Usage
const claudeMd = interpolate(webAppTemplate.claudeMd, {
  PROJECT_NAME: 'my-app',
  DESCRIPTION: 'My awesome app'
});
```

### Form Validation Schema

```typescript
const schema = z.object({
  name: z.string()
    .min(1, 'Required')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, hyphens only'),
  description: z.string().max(500).optional(),
  isPrivate: z.boolean()
});
```

## Testing Checkpoints

After each phase, verify:

1. **Setup**: App runs without errors
2. **Auth**: Can login with GitHub, token persists across restarts
3. **Repo Creation**: Can create repo, CLAUDE.md is correct, clone URL works
4. **Home**: Shows created repos, navigation works
5. **Polish**: No crashes, good UX

## Commands

```bash
# Development
npx expo start

# Build preview
eas build --platform ios --profile preview
eas build --platform android --profile preview

# Production
eas build --platform all --profile production
```
