export type NotificationType =
  | 'task_assigned'
  | 'task_completed'
  | 'task_due_soon'
  | 'comment_added'
  | 'project_updated'
  | 'team_invite'
  | 'mention';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  userId: string;
  linkTo: string | null;
  metadata: {
    projectId?: string;
    taskId?: string;
    actorId?: string;
    actorName?: string;
    actorAvatar?: string;
  };
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
  taskAssigned: boolean;
  taskCompleted: boolean;
  taskDueSoon: boolean;
  comments: boolean;
  mentions: boolean;
}
