# FlowForge Android Testing Guide

> Step-by-step setup to run FlowForge on a physical Android device via Expo Go.

---

## Prerequisites

| Requirement                                             | Check                                                                              |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Node.js 18+                                             | `node --version`                                                                   |
| npm                                                     | `npm --version`                                                                    |
| Android phone on the **same Wi-Fi** as your dev machine | Settings > Wi-Fi                                                                   |
| **Expo Go** app installed from Google Play Store        | [Play Store link](https://play.google.com/store/apps/details?id=host.exp.exponent) |
| GitHub account                                          | For OAuth login                                                                    |

---

## 1. Create a GitHub OAuth App

The app uses GitHub OAuth for login. You need your own OAuth app for testing.

1. Go to **https://github.com/settings/developers**
2. Click **New OAuth App**
3. Fill in:
   - **Application name:** `FlowForge Dev`
   - **Homepage URL:** `https://github.com/your-username/Flowforge`
   - **Authorization callback URL:** `flowforge://`
4. Click **Register application**
5. Copy the **Client ID** (you'll need it in step 3)
6. Click **Generate a new client secret** — copy it (you'll need it in step 4)

> The callback URL `flowforge://` matches the Expo deep link scheme defined in `app.json`.

---

## 2. Deploy the Token Exchange Backend

The mobile app cannot store the GitHub client secret. A Vercel serverless function exchanges the OAuth code for an access token.

```bash
cd flowforge-api
npm install
```

### Option A: Deploy to Vercel (recommended)

```bash
npx vercel login

# First-time setup — creates and links the Vercel project
npx vercel
# Prompts: Set up and deploy? [Y/n] → Y
#          Which scope? → select your account
#          Link to existing project? → N (create new)
#          Project name? → flowforge-api (or your choice)
#          Directory? → ./
#          Override settings? → N
#
# It will say "No framework detected" — that's correct.
# This is a serverless functions project (api/*.ts), not a framework app.
# Accept all defaults (Build Command, Output Directory, etc.).

# Add environment variables (prompts for values interactively, masked input)
npx vercel env add GITHUB_CLIENT_ID
npx vercel env add GITHUB_CLIENT_SECRET
# When prompted for environments, select: Production, Preview, Development

# Deploy to production (re-deploy so the env vars take effect)
npx vercel --prod
```

Vercel stores env values encrypted — they never appear in shell history or logs.

Note the deployment URL from the output (e.g., `https://flowforge-api-xxxxx.vercel.app`). Your token endpoint is:

```
https://flowforge-api-xxxxx.vercel.app/api/auth/token
```

### Option B: Run locally with Vercel CLI

```bash
# Create .env in flowforge-api/
echo "GITHUB_CLIENT_ID=your_client_id" > .env
echo "GITHUB_CLIENT_SECRET=your_client_secret" >> .env

npx vercel dev
```

This starts on `http://localhost:3000`. Your token endpoint is:

```
http://YOUR_LOCAL_IP:3000/api/auth/token
```

> Use your machine's LAN IP (e.g., `192.168.1.x`), not `localhost` — the phone can't reach `localhost`.

---

## 3. Configure the Mobile App

```bash
cd flowforge-mobile
cp .env.example .env
```

Edit `.env`:

```env
EXPO_PUBLIC_GITHUB_CLIENT_ID=your_client_id_from_step_1
EXPO_PUBLIC_TOKEN_ENDPOINT=https://flowforge-api-xxxxx.vercel.app/api/auth/token
EXPO_PUBLIC_SENTRY_DSN=
```

- `GITHUB_CLIENT_ID` — from step 1
- `TOKEN_ENDPOINT` — from step 2 (Vercel URL or local IP)
- `SENTRY_DSN` — leave blank for testing (crash reporting is optional)

---

## 4. Install Dependencies and Start

```bash
cd flowforge-mobile
npm install
npm start
```

This launches the Expo dev server and displays a QR code in your terminal.

---

## 5. Connect Your Android Phone

1. Open **Expo Go** on your phone
2. Tap **Scan QR Code**
3. Scan the QR code from your terminal
4. The app will bundle and load on your phone

> If the QR code doesn't connect, press `s` in the terminal to switch to **Expo Go** mode (not development build), then try again.

### Troubleshooting connection issues

| Problem                      | Fix                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------- |
| "Network response timed out" | Phone and PC must be on the same Wi-Fi network                                    |
| QR code won't scan           | Press `s` to switch connection mode, or type the `exp://` URL manually in Expo Go |
| Metro bundler crash          | Delete `node_modules/.cache` and restart with `npm start -- --clear`              |
| "Unable to resolve module"   | Run `npm install` again, then restart                                             |

---

## 6. Test the App

### Login flow

1. App opens on the **login screen** — "Sign in with GitHub" button
2. Tap the button — opens GitHub OAuth in the system browser
3. Authorize the app — redirected back to FlowForge via `flowforge://` deep link
4. App shows the **home screen** with your GitHub username

### Repo creation flow

1. From home, tap a template type (e.g., "Web App")
2. Fill in repo name and description
3. Tap **Create Repository**
4. On success — shows the **success screen** with repo URL
5. Verify the repo on GitHub — should contain `CLAUDE.md` and template files

### Things to verify

- [ ] OAuth login completes without errors
- [ ] Token is persisted — kill the app and reopen, should stay logged in
- [ ] Repo creation works for each template type
- [ ] Created repos contain the expected file tree (CLAUDE.md, .claude/hooks/, etc.)
- [ ] Error states display correctly (e.g., duplicate repo name, network offline)
- [ ] Logout works (if implemented)

---

## Quick Reference

| Action                 | Command                                       |
| ---------------------- | --------------------------------------------- |
| Start dev server       | `cd flowforge-mobile && npm start`            |
| Start with cache clear | `cd flowforge-mobile && npm start -- --clear` |
| Run tests              | `cd flowforge-mobile && npm test`             |
| Type check             | `cd flowforge-mobile && npm run typecheck`    |
| Lint                   | `cd flowforge-mobile && npm run lint`         |

---

## Notes

- **Expo Go limitations:** Expo Go runs a pre-built native runtime. Custom native modules (beyond what Expo SDK provides) require a development build (`npx expo run:android`), but FlowForge uses only Expo SDK modules so Expo Go is sufficient.
- **Hot reload:** Code changes on your PC are reflected on the phone in ~1-2 seconds via Fast Refresh.
- **Secure Store:** `expo-secure-store` uses Android Keystore on physical devices. On emulators it falls back to SharedPreferences (less secure, fine for testing).
- **OAuth redirect:** The `flowforge://` scheme is registered by Expo via `app.json`. On Android, Expo Go handles this scheme automatically — no manual intent filter setup needed.
