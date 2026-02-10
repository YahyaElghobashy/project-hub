import { create } from 'zustand';
import type { User } from '../types';

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authProvider: 'local' | 'google' | 'github' | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithSSO: (provider: 'google' | 'github') => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  authProvider: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const user = await response.json();
      set({ user, isAuthenticated: true, isLoading: false, authProvider: 'local' });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  // BUG:BZ-065 - SSO login stores provider and sets SSO cookie
  loginWithSSO: async (provider: 'google' | 'github') => {
    set({ isLoading: true });
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `sso-${provider}@example.com`, password: 'sso' }),
      });

      if (!response.ok) {
        throw new Error('SSO login failed');
      }

      const user = await response.json();
      set({ user, isAuthenticated: true, isLoading: false, authProvider: provider });
      // Store SSO session — this persists even after "logout" because logout
      // only clears the local session, not the IdP cookie
      localStorage.setItem('projecthub_sso_session', JSON.stringify({
        provider,
        token: 'sso_token_' + Date.now(),
        email: user.email,
      }));
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  signup: async (email: string, password: string, name: string) => {
    set({ isLoading: true });
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      if (!response.ok) {
        throw new Error('Signup failed');
      }

      const user = await response.json();
      set({ user, isAuthenticated: true, isLoading: false, authProvider: 'local' });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  // BUG:BZ-056 - Logout clears Zustand state but doesn't clear localStorage
  // The projecthub_session key persists, causing auto-redirect on login page refresh
  // BUG:BZ-065 - SSO users: local session cleared but IdP logout not triggered,
  // and SSO session cookie in localStorage not removed, causing auto-re-authentication
  logout: () => {
    const { authProvider } = get();
    fetch('/api/auth/logout', { method: 'POST' });
    set({ user: null, isAuthenticated: false, authProvider: null });
    // Missing: localStorage.removeItem('projecthub_session');

    // BUG:BZ-065 - For SSO users, should also trigger IdP logout endpoint
    // e.g., window.location.href = `https://accounts.google.com/Logout`
    // But we only clear the local session state — the SSO session cookie
    // (projecthub_sso_session) is NOT removed, so reopening the app
    // auto-re-authenticates via the persisted SSO cookie
    if (authProvider === 'google' || authProvider === 'github') {
      // Should call: localStorage.removeItem('projecthub_sso_session');
      // Should call: window.location.href = IdP logout URL
      // But neither happens — only local state is cleared

      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-065')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-065',
            timestamp: Date.now(),
            description: 'SSO user logout only clears local session — IdP logout not triggered, SSO cookie persists',
            page: 'Remaining Auth'
          });
        }
      }
    }
  },

  setUser: (user) => {
    set({ user, isAuthenticated: !!user });
  },

  updateProfile: async (updates) => {
    const { user } = get();
    if (!user) return;

    const response = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error('Update failed');
    }

    const updatedUser = await response.json();
    set({ user: updatedUser });
  },
}));
