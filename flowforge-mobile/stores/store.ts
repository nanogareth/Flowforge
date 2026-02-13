import { create } from 'zustand';
import { Octokit } from '@octokit/rest';
import { getToken, saveToken, clearToken } from '../lib/auth';
import type { CreatedRepo } from '../lib/types';

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

  // Recent repos (foundation for future dashboard)
  recentRepos: CreatedRepo[];

  // Actions
  initialize: () => Promise<void>;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  setLastCreatedRepo: (repo: CreatedRepo | null) => void;
  addRecentRepo: (repo: CreatedRepo) => void;
}

export const useStore = create<AppState>((set, get) => ({
  token: null,
  user: null,
  isLoading: true,
  error: null,
  lastCreatedRepo: null,
  recentRepos: [],

  initialize: async () => {
    try {
      const token = await getToken();
      if (token) {
        await get().login(token);
      }
    } catch (error) {
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
      set({ error: 'Failed to authenticate', isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    await clearToken();
    set({ token: null, user: null, lastCreatedRepo: null, recentRepos: [] });
  },

  clearError: () => set({ error: null }),

  setLastCreatedRepo: (repo) => {
    set({ lastCreatedRepo: repo });
    if (repo) {
      get().addRecentRepo(repo);
    }
  },

  addRecentRepo: (repo) =>
    set((state) => ({
      recentRepos: [repo, ...state.recentRepos.filter((r) => r.full_name !== repo.full_name)],
    })),
}));
