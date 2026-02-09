export type Role = 'admin' | 'member' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  role: Role;
  createdAt: string;
  lastActiveAt: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  members: User[];
  createdAt: string;
  ownerId: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
