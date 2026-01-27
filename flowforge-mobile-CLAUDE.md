# FlowForge Mobile

Mobile app to create GitHub repositories with CLAUDE.md templates.

## Goal

Build a React Native (Expo) app that:
1. Authenticates with GitHub (repo scope)
2. Lets users select a project type
3. Creates a GitHub repo with CLAUDE.md, README.md, .gitignore via GitHub API
4. Shows success screen with clone command

## Tech Stack

- Expo SDK 52 + React Native
- Expo Router (file-based navigation)
- Zustand (state - single store with slices)
- React Hook Form + Zod (forms)
- @octokit/rest (GitHub API)
- expo-secure-store (token storage)
- NativeWind (styling)
- Sentry (crash reporting)

## MVP Scope (Strict)

### In Scope
- GitHub OAuth login/logout
- 2 templates: web-app, cli-tool (more added post-MVP)
- Create repo with CLAUDE.md, README.md, .gitignore
- Success screen with copy-able clone command
- Basic home screen with "New Project" button
- Error recovery for failed repo creation
- Crash reporting

### Out of Scope (v1.1+)
- Activity tab/feed
- Recently created repos list
- Additional templates (library, research, writing)
- Pull-to-refresh
- Haptic feedback
- Settings screen (beyond logout)

## Implementation Phases

### Phase 1: Project Setup

```bash
npx create-expo-app flowforge-mobile -t expo-template-blank-typescript
cd flowforge-mobile
npx expo install expo-router expo-linking expo-constants expo-status-bar
npx expo install expo-secure-store expo-web-browser expo-auth-session
npm install @octokit/rest zustand react-hook-form @hookform/resolvers zod
npm install nativewind tailwindcss
npm install @sentry/react-native
```

Configure `app.json`:
```json
{
  "expo": {
    "name": "FlowForge",
    "slug": "flowforge-mobile",
    "scheme": "flowforge",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0a0a0a"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.flowforge.mobile"
    },
    "android": {
      "package": "com.flowforge.mobile",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0a0a0a"
      }
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      "@sentry/react-native/expo"
    ]
  }
}
```

Initialize Sentry:
```typescript
// app/_layout.tsx
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !__DEV__,
});
```

### Phase 2: OAuth Backend (Vercel Edge Function)

Create a separate `flowforge-api` directory or add to existing Vercel project.

**`api/auth/token.ts`**:
```typescript
import { NextRequest, NextResponse } from 'next/server';

export const config = { runtime: 'edge' };

interface TokenRequest {
  code: string;
  redirect_uri: string;
}

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

export default async function handler(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { code, redirect_uri }: TokenRequest = await req.json();

    if (!code || !redirect_uri) {
      return NextResponse.json(
        { error: 'Missing code or redirect_uri' },
        { status: 400 }
      );
    }

    // Validate redirect_uri matches expected scheme
    if (!redirect_uri.startsWith('flowforge://')) {
      return NextResponse.json(
        { error: 'Invalid redirect_uri' },
        { status: 400 }
      );
    }

    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri,
      }),
    });

    const data: GitHubTokenResponse = await response.json();

    if (data.error) {
      return NextResponse.json(
        { error: data.error_description || data.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      access_token: data.access_token,
      token_type: data.token_type,
      scope: data.scope,
    });
  } catch (error) {
    console.error('Token exchange error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Backend Environment Variables** (Vercel):
```
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
```

**Security Considerations**:
- Validate redirect_uri matches `flowforge://` scheme
- Never expose client_secret to mobile app
- Rate limit the endpoint (Vercel handles basic rate limiting)
- Log failed attempts for monitoring

### Phase 3: Mobile Auth Flow

**`lib/auth.ts`** - Auth utilities:
```typescript
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const GITHUB_CLIENT_ID = process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID!;
const TOKEN_ENDPOINT = process.env.EXPO_PUBLIC_TOKEN_ENDPOINT!;
const TOKEN_KEY = 'github_access_token';

const discovery = {
  authorizationEndpoint: 'https://github.com/login/oauth/authorize',
  tokenEndpoint: 'https://github.com/login/oauth/access_token',
};

export function useGitHubAuth() {
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'flowforge' });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GITHUB_CLIENT_ID,
      scopes: ['repo', 'read:user'],
      redirectUri,
    },
    discovery
  );

  return { request, response, promptAsync, redirectUri };
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<string> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirect_uri: redirectUri }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Token exchange failed');
  }

  const { access_token } = await response.json();
  return access_token;
}

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
```

**`stores/store.ts`** - Single Zustand store:
```typescript
import { create } from 'zustand';
import { Octokit } from '@octokit/rest';
import * as Sentry from '@sentry/react-native';
import { getToken, saveToken, clearToken } from '../lib/auth';

interface User {
  login: string;
  name: string | null;
  avatar_url: string;
}

interface AppState {
  // Auth slice
  token: string | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  token: null,
  user: null,
  isLoading: true,
  error: null,

  initialize: async () => {
    try {
      const token = await getToken();
      if (token) {
        await get().login(token);
      }
    } catch (error) {
      Sentry.captureException(error);
      console.error('Init error:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (token: string) => {
    set({ isLoading: true, error: null });
    try {
      const octokit = new Octokit({ auth: token });
      const { data } = await octokit.users.getAuthenticated();

      await saveToken(token);

      Sentry.setUser({ username: data.login });

      set({
        token,
        user: {
          login: data.login,
          name: data.name,
          avatar_url: data.avatar_url,
        },
        isLoading: false,
      });
    } catch (error) {
      Sentry.captureException(error);
      set({ error: 'Failed to authenticate', isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    await clearToken();
    Sentry.setUser(null);
    set({ token: null, user: null });
  },

  clearError: () => set({ error: null }),
}));
```

### Phase 4: GitHub Client with Error Recovery

**`lib/github.ts`**:
```typescript
import { Octokit } from '@octokit/rest';
import * as Sentry from '@sentry/react-native';

export type ProjectTemplate = 'web-app' | 'cli-tool';

export interface CreateRepoOptions {
  name: string;
  description?: string;
  isPrivate: boolean;
  template: ProjectTemplate;
}

export interface CreateRepoResult {
  success: boolean;
  repo?: {
    full_name: string;
    html_url: string;
    clone_url: string;
    ssh_url: string;
  };
  error?: string;
  partialRepo?: string; // Set if repo was created but files failed
}

interface FileToCreate {
  path: string;
  content: string;
}

// Rate limit: minimum 500ms between repo creations
let lastCreationTime = 0;
const MIN_CREATION_INTERVAL = 500;

export async function createRepository(
  token: string,
  options: CreateRepoOptions
): Promise<CreateRepoResult> {
  // Rate limiting
  const now = Date.now();
  const timeSinceLastCreation = now - lastCreationTime;
  if (timeSinceLastCreation < MIN_CREATION_INTERVAL) {
    await new Promise(resolve =>
      setTimeout(resolve, MIN_CREATION_INTERVAL - timeSinceLastCreation)
    );
  }
  lastCreationTime = Date.now();

  const octokit = new Octokit({ auth: token });
  const { name, description, isPrivate, template } = options;

  let repoFullName: string | undefined;

  try {
    // Step 1: Create empty repo
    const { data: repo } = await octokit.repos.createForAuthenticatedUser({
      name,
      description: description || undefined,
      private: isPrivate,
      auto_init: false,
    });

    repoFullName = repo.full_name;
    const [owner, repoName] = repo.full_name.split('/');

    // Step 2: Get template files
    const files = getTemplateFiles(template, name, description);

    // Step 3: Create blobs for each file
    const blobs = await Promise.all(
      files.map(file =>
        octokit.git.createBlob({
          owner,
          repo: repoName,
          content: Buffer.from(file.content).toString('base64'),
          encoding: 'base64',
        })
      )
    );

    // Step 4: Create tree
    const { data: tree } = await octokit.git.createTree({
      owner,
      repo: repoName,
      tree: blobs.map((blob, index) => ({
        path: files[index].path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blob.data.sha,
      })),
    });

    // Step 5: Create commit
    const { data: commit } = await octokit.git.createCommit({
      owner,
      repo: repoName,
      message: 'Initial setup via FlowForge',
      tree: tree.sha,
    });

    // Step 6: Create main branch
    await octokit.git.createRef({
      owner,
      repo: repoName,
      ref: 'refs/heads/main',
      sha: commit.sha,
    });

    // Step 7: Set default branch
    await octokit.repos.update({
      owner,
      repo: repoName,
      default_branch: 'main',
    });

    return {
      success: true,
      repo: {
        full_name: repo.full_name,
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        ssh_url: repo.ssh_url,
      },
    };
  } catch (error: any) {
    Sentry.captureException(error, {
      extra: { repoName: name, template, partialRepo: repoFullName },
    });

    // If repo was created but files failed, offer recovery info
    if (repoFullName) {
      return {
        success: false,
        error: `Repository created but file setup failed: ${error.message}. You can delete the repo and try again, or add files manually.`,
        partialRepo: repoFullName,
      };
    }

    // Handle specific GitHub errors
    if (error.status === 422) {
      return {
        success: false,
        error: 'Repository name already exists or is invalid.',
      };
    }

    if (error.status === 403) {
      return {
        success: false,
        error: 'API rate limit exceeded. Please wait a moment and try again.',
      };
    }

    return {
      success: false,
      error: error.message || 'Failed to create repository',
    };
  }
}

export async function deleteRepository(
  token: string,
  fullName: string
): Promise<boolean> {
  try {
    const octokit = new Octokit({ auth: token });
    const [owner, repo] = fullName.split('/');
    await octokit.repos.delete({ owner, repo });
    return true;
  } catch (error) {
    Sentry.captureException(error);
    return false;
  }
}

function getTemplateFiles(
  template: ProjectTemplate,
  projectName: string,
  description?: string
): FileToCreate[] {
  const templates = {
    'web-app': getWebAppTemplate,
    'cli-tool': getCliToolTemplate,
  };

  return templates[template](projectName, description || '');
}

function getWebAppTemplate(name: string, description: string): FileToCreate[] {
  return [
    {
      path: 'CLAUDE.md',
      content: `# ${name}

${description}

## Project Overview

This is a web application project.

## Tech Stack

- Framework: (To be determined)
- Styling: (To be determined)
- Deployment: (To be determined)

## Development Guidelines

- Write clean, maintainable code
- Follow established patterns in the codebase
- Add tests for new functionality
- Update documentation as needed

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev
\`\`\`

## Project Structure

\`\`\`
src/
├── components/    # Reusable UI components
├── pages/         # Page components/routes
├── lib/           # Utility functions
├── hooks/         # Custom React hooks
└── styles/        # Global styles
\`\`\`
`,
    },
    {
      path: 'README.md',
      content: `# ${name}

${description}

## Getting Started

\`\`\`bash
git clone https://github.com/USERNAME/${name}.git
cd ${name}
npm install
npm run dev
\`\`\`

## License

MIT
`,
    },
    {
      path: '.gitignore',
      content: `# Dependencies
node_modules/
.pnp
.pnp.js

# Build
dist/
build/
.next/
out/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Testing
coverage/

# Misc
*.tsbuildinfo
`,
    },
  ];
}

function getCliToolTemplate(name: string, description: string): FileToCreate[] {
  return [
    {
      path: 'CLAUDE.md',
      content: `# ${name}

${description}

## Project Overview

This is a command-line tool project.

## Tech Stack

- Language: TypeScript/Node.js
- CLI Framework: (commander, yargs, or similar)
- Build: tsup or esbuild

## Development Guidelines

- Keep the CLI interface intuitive
- Provide helpful error messages
- Support --help for all commands
- Add tests for command parsing and core logic

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Run in development
npm run dev -- [args]

# Build
npm run build

# Run built version
node dist/index.js [args]
\`\`\`

## Command Structure

\`\`\`
${name} <command> [options]

Commands:
  (Define your commands here)

Options:
  -h, --help     Show help
  -v, --version  Show version
\`\`\`
`,
    },
    {
      path: 'README.md',
      content: `# ${name}

${description}

## Installation

\`\`\`bash
npm install -g ${name}
\`\`\`

## Usage

\`\`\`bash
${name} --help
\`\`\`

## Development

\`\`\`bash
git clone https://github.com/USERNAME/${name}.git
cd ${name}
npm install
npm run dev
\`\`\`

## License

MIT
`,
    },
    {
      path: '.gitignore',
      content: `# Dependencies
node_modules/

# Build
dist/

# Environment
.env
.env.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Testing
coverage/

# Misc
*.tsbuildinfo
`,
    },
  ];
}
```

### Phase 5: Screens & Navigation

**File Structure (MVP)**:
```
flowforge-mobile/
├── app/
│   ├── _layout.tsx          # Root layout with Sentry, auth check
│   ├── index.tsx            # Redirect based on auth
│   ├── login.tsx            # GitHub OAuth login
│   └── (app)/
│       ├── _layout.tsx      # App layout (authenticated)
│       ├── index.tsx        # Home screen
│       ├── create.tsx       # Template selection
│       ├── create/[type].tsx # Create form
│       └── success.tsx      # Success screen
├── lib/
│   ├── auth.ts
│   └── github.ts
├── stores/
│   └── store.ts
├── components/
│   ├── Button.tsx
│   ├── Input.tsx
│   └── TemplateCard.tsx
├── app.json
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

**`app/_layout.tsx`** - Root layout:
```typescript
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import { useStore } from '../stores/store';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !__DEV__,
});

function RootLayout() {
  const initialize = useStore(state => state.initialize);

  useEffect(() => {
    initialize();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

export default Sentry.wrap(RootLayout);
```

**`app/index.tsx`** - Auth redirect:
```typescript
import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useStore } from '../stores/store';

export default function Index() {
  const { isLoading, token } = useStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' }}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  if (token) {
    return <Redirect href="/(app)" />;
  }

  return <Redirect href="/login" />;
}
```

**`app/login.tsx`** - Login screen:
```typescript
import { useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import { useGitHubAuth, exchangeCodeForToken } from '../lib/auth';
import { useStore } from '../stores/store';

export default function Login() {
  const router = useRouter();
  const { request, response, promptAsync, redirectUri } = useGitHubAuth();
  const { login, isLoading, error, clearError } = useStore();

  useEffect(() => {
    if (response?.type === 'success') {
      const { code } = response.params;
      handleCodeExchange(code);
    } else if (response?.type === 'error') {
      Sentry.captureMessage('OAuth error', { extra: { response } });
    }
  }, [response]);

  const handleCodeExchange = async (code: string) => {
    try {
      const token = await exchangeCodeForToken(code, redirectUri);
      await login(token);
      router.replace('/(app)');
    } catch (err) {
      Sentry.captureException(err);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a', padding: 24 }}>
      <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#ffffff', marginBottom: 8 }}>
        FlowForge
      </Text>
      <Text style={{ fontSize: 16, color: '#888888', marginBottom: 48, textAlign: 'center' }}>
        Create GitHub repos with CLAUDE.md templates
      </Text>

      {error && (
        <View style={{ backgroundColor: '#331111', padding: 16, borderRadius: 8, marginBottom: 24 }}>
          <Text style={{ color: '#ff6666' }}>{error}</Text>
        </View>
      )}

      <Pressable
        onPress={() => {
          clearError();
          promptAsync();
        }}
        disabled={!request || isLoading}
        style={{
          backgroundColor: '#238636',
          paddingHorizontal: 32,
          paddingVertical: 16,
          borderRadius: 8,
          opacity: !request || isLoading ? 0.5 : 1,
        }}
      >
        {isLoading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '600' }}>
            Sign in with GitHub
          </Text>
        )}
      </Pressable>
    </View>
  );
}
```

### Phase 6: Testing

**`__tests__/github.test.ts`**:
```typescript
import { getWebAppTemplate, getCliToolTemplate } from '../lib/github';

describe('Template Generation', () => {
  describe('getWebAppTemplate', () => {
    it('should include project name in CLAUDE.md', () => {
      const files = getWebAppTemplate('my-app', 'Test description');
      const claudeMd = files.find(f => f.path === 'CLAUDE.md');

      expect(claudeMd).toBeDefined();
      expect(claudeMd?.content).toContain('# my-app');
      expect(claudeMd?.content).toContain('Test description');
    });

    it('should generate all required files', () => {
      const files = getWebAppTemplate('test', '');
      const paths = files.map(f => f.path);

      expect(paths).toContain('CLAUDE.md');
      expect(paths).toContain('README.md');
      expect(paths).toContain('.gitignore');
    });
  });

  describe('getCliToolTemplate', () => {
    it('should include CLI-specific content', () => {
      const files = getCliToolTemplate('my-cli', 'A CLI tool');
      const claudeMd = files.find(f => f.path === 'CLAUDE.md');

      expect(claudeMd?.content).toContain('command-line tool');
      expect(claudeMd?.content).toContain('--help');
    });
  });
});

describe('Repository Name Validation', () => {
  const validNames = ['my-app', 'test123', 'a', 'my-cool-project'];
  const invalidNames = ['My App', 'test_app', 'test.app', '-test', 'test-'];

  validNames.forEach(name => {
    it(`should accept valid name: ${name}`, () => {
      const isValid = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(name);
      expect(isValid).toBe(true);
    });
  });

  invalidNames.forEach(name => {
    it(`should reject invalid name: ${name}`, () => {
      const isValid = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(name);
      expect(isValid).toBe(false);
    });
  });
});
```

**`jest.config.js`**:
```javascript
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
};
```

## Environment Variables

**Mobile App (.env)**:
```
EXPO_PUBLIC_GITHUB_CLIENT_ID=xxx
EXPO_PUBLIC_TOKEN_ENDPOINT=https://flowforge-api.vercel.app/api/auth/token
EXPO_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
```

**Backend (Vercel)**:
```
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
```

## GitHub OAuth App Setup

1. Go to GitHub Settings > Developer Settings > OAuth Apps
2. Create new OAuth App:
   - Application name: FlowForge
   - Homepage URL: https://flowforge.app (or your domain)
   - Authorization callback URL: flowforge://oauth
3. Note the Client ID and generate a Client Secret
4. Add Client ID to mobile app env, both to backend env

## Commands

```bash
# Development
npx expo start

# Run tests
npm test

# Type check
npx tsc --noEmit

# Build preview
eas build --platform ios --profile preview
eas build --platform android --profile preview

# Production
eas build --platform all --profile production
```

## Testing Checkpoints

| Phase | Verification |
|-------|-------------|
| 1. Setup | App runs, Sentry initialized |
| 2. Backend | Token endpoint returns access_token |
| 3. Auth | Can login, token persists, logout works |
| 4. GitHub | Can create repo, files appear, errors handled |
| 5. Screens | Full flow works end-to-end |
| 6. Tests | All tests pass |

## Error Recovery

| Scenario | Handling |
|----------|----------|
| OAuth fails | Show error, allow retry |
| Token expired | Redirect to login |
| Repo name taken | Show error, suggest rename |
| Repo created but files fail | Offer to delete and retry |
| Rate limit hit | Show wait message |
| Network error | Show retry button |
