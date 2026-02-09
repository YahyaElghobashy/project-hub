export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  projectId: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  ownerId: string;
  color: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
  dueDate: string | null;
  progress: number;
  taskCount: number;
  completedTaskCount: number;
}

export interface ProjectWithTasks extends Project {
  tasks: Task[];
}
