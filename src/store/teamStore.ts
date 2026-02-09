import { create } from 'zustand';
import type { User, Role } from '../types';

interface TeamStore {
  members: User[];
  isLoading: boolean;
  error: string | null;

  fetchMembers: () => Promise<void>;
  inviteMember: (email: string, role: Role) => Promise<void>;
  updateMemberRole: (userId: string, role: Role) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
}

export const useTeamStore = create<TeamStore>((set) => ({
  members: [],
  isLoading: false,
  error: null,

  fetchMembers: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch team members');
      const members = await response.json();
      set({ members, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  inviteMember: async (email: string, role: Role) => {
    const response = await fetch('/api/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    });
    if (!response.ok) throw new Error('Failed to invite member');
    const member = await response.json();
    set((state) => ({ members: [...state.members, member] }));
  },

  updateMemberRole: async (userId: string, role: Role) => {
    const response = await fetch(`/api/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (!response.ok) throw new Error('Failed to update role');
    set((state) => ({
      members: state.members.map((m) =>
        m.id === userId ? { ...m, role } : m
      ),
    }));
  },

  removeMember: async (userId: string) => {
    const response = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to remove member');
    set((state) => ({
      members: state.members.filter((m) => m.id !== userId),
    }));
  },
}));
