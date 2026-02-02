# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

FlowForge is a mobile app that creates GitHub repositories pre-configured with CLAUDE.md templates. Two packages:

- **flowforge-mobile/** — React Native (Expo SDK 52) app with Expo Router, Zustand, NativeWind, Octokit
- **flowforge-api/** — Vercel serverless backend for GitHub OAuth token exchange

## Commands

### Mobile App (run from `flowforge-mobile/`)
```
npm start              # Expo dev server
npm test               # Jest tests
npm run test:watch     # Tests in watch mode
npm run lint           # ESLint
npm run typecheck      # TypeScript checking
```

### Backend API (run from `flowforge-api/`)
```
npm run dev            # Local dev (vercel dev)
npm run deploy         # Deploy to production
```

## Architecture

**Auth flow:** Mobile app initiates GitHub OAuth via expo-auth-session → receives auth code → sends to `flowforge-api/api/auth/token.ts` → backend exchanges code for access token using client secret → token stored in expo-secure-store.

**Repo creation flow (`lib/github.ts`):** Creates empty repo → generates template files (CLAUDE.md, README.md, .gitignore) → creates git blobs → creates tree → creates commit → creates main branch → sets default branch. On failure, `deleteRepository()` provides cleanup.

**State:** Single Zustand store (`stores/store.ts`) manages auth state, user info, and last created repo.

**Routing:** Expo Router file-based routing. `app/(app)/` group is auth-guarded. `app/login.tsx` handles unauthenticated state.

**Styling:** NativeWind (Tailwind for RN) with dark theme. Custom colors defined in `tailwind.config.js` — GitHub-inspired palette (primary=#238636, background=#0a0a0a).

**Templates:** Two templates in `lib/github.ts`: `getWebAppTemplate()` and `getCliToolTemplate()`. Each generates CLAUDE.md, README.md, and .gitignore content.

## Environment Variables

Mobile (`.env`): `EXPO_PUBLIC_GITHUB_CLIENT_ID`, `EXPO_PUBLIC_TOKEN_ENDPOINT`, `EXPO_PUBLIC_SENTRY_DSN`

Backend (Vercel env): `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
