import { create } from 'zustand';
import type { Notification, NotificationPreferences } from '../types';

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  isPanelOpen: boolean;
  preferences: NotificationPreferences;

  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
}

const defaultPreferences: NotificationPreferences = {
  email: true,
  push: true,
  inApp: true,
  taskAssigned: true,
  taskCompleted: true,
  taskDueSoon: true,
  comments: true,
  mentions: true,
};

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  isPanelOpen: false,
  preferences: defaultPreferences,

  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const response = await fetch('/api/notifications');
      if (!response.ok) throw new Error('Failed to fetch notifications');
      const notifications = await response.json();
      const unreadCount = notifications.filter((n: Notification) => !n.read).length;
      set({ notifications, unreadCount, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
    }
  },

  markAsRead: async (id: string) => {
    const response = await fetch(`/api/notifications/${id}/read`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to mark as read');
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
  },

  markAllAsRead: async () => {
    const response = await fetch('/api/notifications/read-all', {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to mark all as read');
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  deleteNotification: async (id: string) => {
    const response = await fetch(`/api/notifications/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete notification');
    const notification = get().notifications.find((n) => n.id === id);
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
      unreadCount: notification && !notification.read
        ? state.unreadCount - 1
        : state.unreadCount,
    }));
  },

  togglePanel: () => {
    set((state) => ({ isPanelOpen: !state.isPanelOpen }));
  },

  openPanel: () => {
    set({ isPanelOpen: true });
  },

  closePanel: () => {
    set({ isPanelOpen: false });
  },

  updatePreferences: async (prefs) => {
    const response = await fetch('/api/notifications/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    });
    if (!response.ok) throw new Error('Failed to update preferences');
    set((state) => ({
      preferences: { ...state.preferences, ...prefs },
    }));
  },
}));
