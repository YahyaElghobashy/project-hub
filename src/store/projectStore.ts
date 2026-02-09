import { create } from 'zustand';
import type { Project, Task, TaskStatus } from '../types';

interface ProjectStore {
  projects: Project[];
  currentProject: Project | null;
  tasks: Task[];
  isLoading: boolean;
  error: string | null;

  fetchProjects: () => Promise<void>;
  fetchProject: (id: string) => Promise<void>;
  createProject: (project: Partial<Project>) => Promise<Project>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  fetchTasks: (projectId: string) => Promise<void>;
  createTask: (task: Partial<Task>) => Promise<Task>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  updateTaskStatus: (id: string, status: TaskStatus) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;

  setCurrentProject: (project: Project | null) => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  currentProject: null,
  tasks: [],
  isLoading: false,
  error: null,

  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error('Failed to fetch projects');
      const projects = await response.json();
      set({ projects, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  fetchProject: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/projects/${id}`);
      if (!response.ok) throw new Error('Failed to fetch project');
      const project = await response.json();
      set({ currentProject: project, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  createProject: async (projectData) => {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectData),
    });
    if (!response.ok) throw new Error('Failed to create project');
    const project = await response.json();
    set((state) => ({ projects: [...state.projects, project] }));
    return project;
  },

  updateProject: async (id, updates) => {
    const response = await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update project');
    const updated = await response.json();
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? updated : p)),
      currentProject: state.currentProject?.id === id ? updated : state.currentProject,
    }));
  },

  deleteProject: async (id) => {
    const response = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete project');
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProject: state.currentProject?.id === id ? null : state.currentProject,
    }));
  },

  fetchTasks: async (projectId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/projects/${projectId}/tasks`);
      if (!response.ok) throw new Error('Failed to fetch tasks');
      const tasks = await response.json();
      set({ tasks, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  createTask: async (taskData) => {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskData),
    });
    if (!response.ok) throw new Error('Failed to create task');
    const task = await response.json();
    set((state) => ({ tasks: [...state.tasks, task] }));
    return task;
  },

  updateTask: async (id, updates) => {
    const response = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update task');
    const updated = await response.json();
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? updated : t)),
    }));
  },

  updateTaskStatus: async (id, status) => {
    await get().updateTask(id, { status });
  },

  deleteTask: async (id) => {
    const response = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete task');
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    }));
  },

  setCurrentProject: (project) => {
    set({ currentProject: project });
  },
}));
