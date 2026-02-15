import { create } from "zustand";
import { Octokit } from "@octokit/rest";
import { getToken, saveToken, clearToken } from "../lib/auth";
import {
  getServerCredentials,
  saveServerCredentials,
  clearServerCredentials,
  checkHealth,
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

  // Claude Code integration state
  claudeCodeConfigureUrl: string | null;

  // Home server state
  homeServerUrl: string | null;
  homeServerToken: string | null;
  isServerConnected: boolean;

  // Actions
  initialize: () => Promise<void>;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  setLastCreatedRepo: (repo: CreatedRepo | null) => void;
  setClaudeCodeState: (configureUrl: string | null) => void;
  resetCreationState: () => void;

  // Home server actions
  setHomeServer: (url: string, token: string) => Promise<void>;
  clearHomeServer: () => Promise<void>;
  checkServerHealth: () => Promise<boolean>;
}

export const useStore = create<AppState>((set, get) => ({
  token: null,
  user: null,
  isLoading: true,
  error: null,
  lastCreatedRepo: null,
  claudeCodeConfigureUrl: null,
  homeServerUrl: null,
  homeServerToken: null,
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
        set({
          homeServerUrl: serverCreds.url,
          homeServerToken: serverCreds.token,
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
      claudeCodeConfigureUrl: null,
    });
  },

  clearError: () => set({ error: null }),

  setLastCreatedRepo: (repo) => {
    set({ lastCreatedRepo: repo });
  },

  setClaudeCodeState: (configureUrl) =>
    set({ claudeCodeConfigureUrl: configureUrl }),

  resetCreationState: () =>
    set({
      lastCreatedRepo: null,
      claudeCodeConfigureUrl: null,
    }),

  setHomeServer: async (url, token) => {
    await saveServerCredentials(url, token);
    set({
      homeServerUrl: url,
      homeServerToken: token,
      isServerConnected: true,
    });
  },

  clearHomeServer: async () => {
    await clearServerCredentials();
    set({
      homeServerUrl: null,
      homeServerToken: null,
      isServerConnected: false,
    });
  },

  checkServerHealth: async () => {
    const { homeServerUrl } = get();
    if (!homeServerUrl) return false;
    const connected = await checkHealth(homeServerUrl);
    set({ isServerConnected: connected });
    return connected;
  },
}));
