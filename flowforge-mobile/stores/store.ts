import { create } from "zustand";
import { Octokit } from "@octokit/rest";
import { getToken, saveToken, clearToken } from "../lib/auth";
import {
  getServerCredentials,
  saveServerCredentials,
  clearServerCredentials,
  checkHealth,
  getTailscaleUrl,
  saveTailscaleUrl,
} from "../lib/server-auth";
import type { CreatedRepo } from "../lib/types";

interface User {
  login: string;
  name: string | null;
  avatar_url: string;
}

interface AppState {
  // Auth state
  token: string | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;

  // Last created repo (for success screen)
  lastCreatedRepo: CreatedRepo | null;

  // Home server state
  homeServerUrl: string | null;
  homeServerToken: string | null;
  homeServerTailscaleUrl: string | null;
  isServerConnected: boolean;

  // Actions
  initialize: () => Promise<void>;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  setLastCreatedRepo: (repo: CreatedRepo | null) => void;
  resetCreationState: () => void;

  // Home server actions
  setHomeServer: (
    url: string,
    token: string,
    tailscaleUrl?: string,
  ) => Promise<void>;
  clearHomeServer: () => Promise<void>;
  checkServerHealth: () => Promise<boolean>;
}

export const useStore = create<AppState>((set, get) => ({
  token: null,
  user: null,
  isLoading: true,
  error: null,
  lastCreatedRepo: null,
  homeServerUrl: null,
  homeServerToken: null,
  homeServerTailscaleUrl: null,
  isServerConnected: false,

  initialize: async () => {
    try {
      const token = await getToken();
      if (token) {
        await get().login(token);
      }

      // Load server credentials
      const serverCreds = await getServerCredentials();
      if (serverCreds) {
        const tailscaleUrl = await getTailscaleUrl();
        set({
          homeServerUrl: serverCreds.url,
          homeServerToken: serverCreds.token,
          homeServerTailscaleUrl: tailscaleUrl,
        });
        // Check health in background (don't block init)
        checkHealth(serverCreds.url).then((connected) => {
          set({ isServerConnected: connected });
        });
      }
    } catch (error) {
      console.error("Init error:", error);
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
      set({ error: "Failed to authenticate", isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    // Only clear GitHub auth state; server credentials persist across logout
    await clearToken();
    set({
      token: null,
      user: null,
      lastCreatedRepo: null,
    });
  },

  clearError: () => set({ error: null }),

  setLastCreatedRepo: (repo) => {
    set({ lastCreatedRepo: repo });
  },

  resetCreationState: () =>
    set({
      lastCreatedRepo: null,
    }),

  setHomeServer: async (url, token, tailscaleUrl?) => {
    await saveServerCredentials(url, token);
    if (tailscaleUrl) {
      await saveTailscaleUrl(tailscaleUrl);
    }
    set({
      homeServerUrl: url,
      homeServerToken: token,
      homeServerTailscaleUrl: tailscaleUrl ?? null,
      isServerConnected: true,
    });
  },

  clearHomeServer: async () => {
    await clearServerCredentials();
    set({
      homeServerUrl: null,
      homeServerToken: null,
      homeServerTailscaleUrl: null,
      isServerConnected: false,
    });
  },

  checkServerHealth: async () => {
    const { homeServerUrl, homeServerTailscaleUrl, homeServerToken } = get();
    if (!homeServerUrl) return false;

    // Try primary URL first
    const primaryOk = await checkHealth(homeServerUrl);
    if (primaryOk) {
      set({ isServerConnected: true });
      return true;
    }

    // If primary fails and we have a Tailscale URL, try failover
    if (homeServerTailscaleUrl && homeServerTailscaleUrl !== homeServerUrl) {
      const tailscaleOk = await checkHealth(homeServerTailscaleUrl);
      if (tailscaleOk) {
        // Swap to Tailscale URL as the new primary
        if (homeServerToken) {
          await saveServerCredentials(homeServerTailscaleUrl, homeServerToken);
        }
        set({
          homeServerUrl: homeServerTailscaleUrl,
          isServerConnected: true,
        });
        return true;
      }
    }

    set({ isServerConnected: false });
    return false;
  },
}));
