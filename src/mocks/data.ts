import type { User, Project, Task, Notification, TaskStatus, TaskPriority, ProjectStatus, NotificationType, Role } from '../types';

// Realistic names and data
const firstNames = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie', 'Quinn',
  'Avery', 'Parker', 'Sage', 'Drew', 'Cameron', 'Skyler', 'Reese', 'Blake',
  'Harper', 'Emery', 'Finley', 'Rowan'
];

const lastNames = [
  'Chen', 'Patel', 'Williams', 'Johnson', 'Kim', 'Anderson', 'Martinez',
  'Thompson', 'Garcia', 'Lee', 'Robinson', 'Clark', 'Lewis', 'Walker',
  'Hall', 'Young', 'Allen', 'King', 'Wright', 'Scott'
];

const companyNames = [
  'Acme Corp', 'TechFlow', 'Quantum Labs', 'Nexus Digital', 'Apex Systems',
  'Horizon Innovations', 'Stellar Solutions', 'Velocity Tech', 'Pinnacle Software',
  'Fusion Dynamics', 'Catalyst AI', 'Ember Analytics', 'Prism Consulting',
  'Mosaic Ventures', 'Cipher Security'
];

const projectNames = [
  'Website Redesign', 'Mobile App v2.0', 'API Integration', 'Dashboard Overhaul',
  'Customer Portal', 'Analytics Platform', 'Payment Gateway', 'User Authentication',
  'Search Engine Optimization', 'Performance Optimization', 'Cloud Migration',
  'Data Pipeline', 'E-commerce Platform', 'CRM Integration', 'Notification System',
  'Reporting Module', 'Inventory Management', 'Booking System', 'Chat Application',
  'Document Management', 'Email Campaign Tool', 'Social Media Integration',
  'Video Streaming Service', 'File Storage Solution', 'Subscription Billing',
  'Admin Dashboard', 'Onboarding Flow', 'Feature Flags System', 'A/B Testing Platform',
  'Audit Logging', 'Rate Limiting Service', 'Caching Layer', 'Queue System',
  'Webhook Handler', 'OAuth Implementation', 'Two-Factor Auth', 'SSO Integration',
  'API Documentation', 'SDK Development', 'CLI Tool', 'Browser Extension',
  'Mobile Notifications', 'Real-time Sync', 'Offline Mode', 'Data Export',
  'Import Wizard', 'Batch Processing', 'Image Optimization', 'PDF Generator',
  'Email Templates', 'Localization System'
];

const taskTitles = [
  'Set up project scaffolding', 'Design database schema', 'Create API endpoints',
  'Implement user authentication', 'Build login page', 'Add form validation',
  'Write unit tests', 'Set up CI/CD pipeline', 'Configure deployment',
  'Optimize bundle size', 'Fix memory leak', 'Add error handling',
  'Implement caching', 'Create documentation', 'Review pull request',
  'Refactor legacy code', 'Add accessibility features', 'Implement dark mode',
  'Set up monitoring', 'Create database indexes', 'Implement pagination',
  'Add search functionality', 'Build filter system', 'Create export feature',
  'Implement file upload', 'Add drag and drop', 'Build notification system',
  'Create email templates', 'Set up analytics', 'Implement A/B testing',
  'Add feature flags', 'Build admin panel', 'Create user roles',
  'Implement permissions', 'Add audit logging', 'Build settings page',
  'Create onboarding flow', 'Implement webhooks', 'Add rate limiting',
  'Build queue system', 'Create backup system', 'Implement recovery',
  'Add data validation', 'Build import wizard', 'Create batch jobs',
  'Implement retry logic', 'Add timeout handling', 'Build health checks',
  'Create status page', 'Implement graceful shutdown'
];

const colors = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
];

const icons = ['📊', '🚀', '💼', '📱', '🔧', '📈', '🎯', '💡', '🔒', '⚡'];

const tags = [
  'frontend', 'backend', 'api', 'database', 'security', 'performance',
  'ui/ux', 'testing', 'documentation', 'infrastructure', 'bug', 'feature',
  'enhancement', 'refactor', 'urgent', 'blocked'
];

// Generate unique ID
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Generate random date within range
const randomDate = (start: Date, end: Date): string => {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString();
};

// Generate avatar URL
const generateAvatar = (name: string): string => {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;
};

// Generate 20 team members
export const generateUsers = (): User[] => {
  const users: User[] = [];
  const roles: Role[] = ['admin', 'member', 'member', 'member', 'viewer'];

  for (let i = 0; i < 20; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[i % lastNames.length];
    const name = `${firstName} ${lastName}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${companyNames[0].toLowerCase().replace(/\s/g, '')}.com`;

    users.push({
      id: generateId(),
      name,
      email,
      avatar: generateAvatar(name),
      role: roles[i % roles.length],
      createdAt: randomDate(new Date(2023, 0, 1), new Date(2024, 6, 1)),
      lastActiveAt: randomDate(new Date(2024, 6, 1), new Date()),
    });
  }

  return users;
};

// Generate 50 projects
export const generateProjects = (users: User[]): Project[] => {
  const projects: Project[] = [];
  const statuses: ProjectStatus[] = ['active', 'active', 'active', 'on_hold', 'completed', 'archived'];

  for (let i = 0; i < 50; i++) {
    const taskCount = Math.floor(Math.random() * 20) + 5;
    const completedTaskCount = Math.floor(Math.random() * taskCount);
    const progress = Math.round((completedTaskCount / taskCount) * 100);

    projects.push({
      id: generateId(),
      name: projectNames[i % projectNames.length],
      description: `This is the ${projectNames[i % projectNames.length]} project. It involves multiple phases of development, testing, and deployment.`,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      ownerId: users[Math.floor(Math.random() * users.length)].id,
      color: colors[i % colors.length],
      icon: icons[i % icons.length],
      createdAt: randomDate(new Date(2023, 0, 1), new Date(2024, 3, 1)),
      updatedAt: randomDate(new Date(2024, 3, 1), new Date()),
      dueDate: Math.random() > 0.3 ? randomDate(new Date(), new Date(2025, 11, 31)) : null,
      progress,
      taskCount,
      completedTaskCount,
    });
  }

  return projects;
};

// Generate 300 tasks across projects
export const generateTasks = (projects: Project[], users: User[]): Task[] => {
  const tasks: Task[] = [];
  const statuses: TaskStatus[] = ['todo', 'in_progress', 'done'];
  const priorities: TaskPriority[] = ['low', 'medium', 'medium', 'high', 'urgent'];

  let taskIndex = 0;
  for (const project of projects) {
    const numTasks = Math.floor(Math.random() * 8) + 4; // 4-12 tasks per project

    for (let i = 0; i < numTasks && taskIndex < 300; i++) {
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const taskTags = [];
      const numTags = Math.floor(Math.random() * 3) + 1;
      for (let t = 0; t < numTags; t++) {
        taskTags.push(tags[Math.floor(Math.random() * tags.length)]);
      }

      tasks.push({
        id: generateId(),
        title: taskTitles[taskIndex % taskTitles.length],
        description: `Detailed description for ${taskTitles[taskIndex % taskTitles.length]}. This task requires careful implementation and thorough testing.`,
        status,
        priority: priorities[Math.floor(Math.random() * priorities.length)],
        assigneeId: Math.random() > 0.2 ? users[Math.floor(Math.random() * users.length)].id : null,
        projectId: project.id,
        dueDate: Math.random() > 0.4 ? randomDate(new Date(), new Date(2025, 11, 31)) : null,
        createdAt: randomDate(new Date(2024, 0, 1), new Date(2024, 6, 1)),
        updatedAt: randomDate(new Date(2024, 6, 1), new Date()),
        tags: [...new Set(taskTags)],
      });

      taskIndex++;
    }
  }

  return tasks;
};

// Generate 150 notifications
export const generateNotifications = (users: User[], projects: Project[]): Notification[] => {
  const notifications: Notification[] = [];
  const types: NotificationType[] = [
    'task_assigned', 'task_completed', 'task_due_soon',
    'comment_added', 'project_updated', 'team_invite', 'mention'
  ];

  const messages: Record<NotificationType, string[]> = {
    task_assigned: [
      'assigned you to a new task',
      'added you to the task',
      'needs your help with a task'
    ],
    task_completed: [
      'completed the task',
      'marked the task as done',
      'finished working on the task'
    ],
    task_due_soon: [
      'Your task is due tomorrow',
      'Task deadline approaching',
      'Reminder: Task due in 2 days'
    ],
    comment_added: [
      'commented on your task',
      'replied to your comment',
      'mentioned you in a comment'
    ],
    project_updated: [
      'updated the project settings',
      'changed the project status',
      'added new milestones'
    ],
    team_invite: [
      'invited you to join the team',
      'wants you to collaborate',
      'sent you a team invitation'
    ],
    mention: [
      'mentioned you in a discussion',
      'tagged you in a comment',
      'needs your input'
    ]
  };

  for (let i = 0; i < 150; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const actor = users[Math.floor(Math.random() * users.length)];
    const project = projects[Math.floor(Math.random() * projects.length)];
    const messageOptions = messages[type];
    const message = messageOptions[Math.floor(Math.random() * messageOptions.length)];

    notifications.push({
      id: generateId(),
      type,
      title: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      message: type === 'task_due_soon' ? message : `${actor.name} ${message}`,
      read: Math.random() > 0.6,
      createdAt: randomDate(new Date(2024, 9, 1), new Date()),
      userId: users[Math.floor(Math.random() * users.length)].id,
      linkTo: `/projects/${project.id}`,
      metadata: {
        projectId: project.id,
        actorId: actor.id,
        actorName: actor.name,
        actorAvatar: actor.avatar,
      },
    });
  }

  // Sort by date descending
  notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return notifications;
};

// Initialize all mock data
export const users = generateUsers();
export const projects = generateProjects(users);
export const tasks = generateTasks(projects, users);
export const notifications = generateNotifications(users, projects);

// Current user (first admin)
export const currentUser = users.find(u => u.role === 'admin') || users[0];
