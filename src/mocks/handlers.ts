import { http, HttpResponse, delay } from 'msw';
import { users, projects, tasks, notifications, currentUser } from './data';
import type { User, Project, Task, Notification, Role } from '../types';

// Mutable copies for CRUD operations
let mockUsers = [...users];
let mockProjects = [...projects];
let mockTasks = [...tasks];
let mockNotifications = [...notifications];
let authenticatedUser: User | null = null;

// Helper to generate IDs
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const handlers = [
  // ============ AUTH ENDPOINTS ============

  http.post('/api/auth/login', async ({ request }) => {
    await delay(300);
    const body = await request.json() as { email: string; password: string };

    // Find user by email (password check is mocked)
    const user = mockUsers.find(u => u.email.toLowerCase() === body.email.toLowerCase());

    if (user) {
      authenticatedUser = user;
      return HttpResponse.json(user);
    }

    // If email not found, authenticate as current user for demo
    authenticatedUser = currentUser;
    return HttpResponse.json(currentUser);
  }),

  http.post('/api/auth/signup', async ({ request }) => {
    await delay(300);
    const body = await request.json() as { email: string; password: string; name: string };

    const newUser: User = {
      id: generateId(),
      email: body.email,
      name: body.name,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(body.name)}`,
      role: 'member',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    mockUsers.push(newUser);
    authenticatedUser = newUser;
    return HttpResponse.json(newUser);
  }),

  http.post('/api/auth/logout', async () => {
    await delay(100);
    authenticatedUser = null;
    return HttpResponse.json({ success: true });
  }),

  http.get('/api/auth/me', async () => {
    await delay(100);
    if (authenticatedUser) {
      return HttpResponse.json(authenticatedUser);
    }
    return HttpResponse.json(currentUser);
  }),

  // ============ USER ENDPOINTS ============

  http.get('/api/users', async () => {
    await delay(200);
    return HttpResponse.json(mockUsers);
  }),

  http.get('/api/users/:id', async ({ params }) => {
    await delay(100);
    const user = mockUsers.find(u => u.id === params.id);
    if (!user) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(user);
  }),

  http.patch('/api/users/:id', async ({ params, request }) => {
    await delay(200);
    const body = await request.json() as Partial<User>;
    const index = mockUsers.findIndex(u => u.id === params.id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    mockUsers[index] = { ...mockUsers[index], ...body };
    return HttpResponse.json(mockUsers[index]);
  }),

  // BUG:BZ-066 - Permission check only on frontend
  // DELETE endpoint has no authorization check — any user (including viewers)
  // can delete team members via direct API call. The UI hides the button for
  // viewers, but the endpoint itself doesn't verify the caller's role.
  http.delete('/api/users/:id', async ({ params }) => {
    await delay(200);
    // No role/permission check here — anyone can delete
    mockUsers = mockUsers.filter(u => u.id !== params.id);

    if (typeof window !== 'undefined') {
      window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
      if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-066')) {
        window.__PERCEPTR_TEST_BUGS__.push({
          bugId: 'BZ-066',
          timestamp: Date.now(),
          description: 'Permission check only on frontend — DELETE endpoint has no auth check',
          page: 'Team'
        });
      }
    }

    return HttpResponse.json({ success: true });
  }),

  http.post('/api/users/invite', async ({ request }) => {
    await delay(300);
    const body = await request.json() as { email: string; role: Role };

    const newUser: User = {
      id: generateId(),
      email: body.email,
      name: body.email.split('@')[0],
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(body.email)}`,
      role: body.role,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    mockUsers.push(newUser);
    return HttpResponse.json(newUser);
  }),

  http.patch('/api/users/:id/role', async ({ params, request }) => {
    await delay(200);
    const body = await request.json() as { role: Role };
    const index = mockUsers.findIndex(u => u.id === params.id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    mockUsers[index] = { ...mockUsers[index], role: body.role };
    return HttpResponse.json(mockUsers[index]);
  }),

  // ============ PROJECT ENDPOINTS ============

  http.get('/api/projects', async ({ request }) => {
    await delay(300);
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const sortBy = url.searchParams.get('sortBy') || 'updatedAt';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    let filtered = [...mockProjects];

    if (status) {
      filtered = filtered.filter(p => p.status === status);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.description.toLowerCase().includes(searchLower)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      const aVal = a[sortBy as keyof Project];
      const bVal = b[sortBy as keyof Project];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return 0;
    });

    // Paginate
    const start = (page - 1) * limit;
    const paginatedProjects = filtered.slice(start, start + limit);

    return HttpResponse.json(paginatedProjects, {
      headers: {
        'X-Total-Count': filtered.length.toString(),
        'X-Total-Pages': Math.ceil(filtered.length / limit).toString(),
      },
    });
  }),

  http.get('/api/projects/:id', async ({ params }) => {
    await delay(200);
    const project = mockProjects.find(p => p.id === params.id);
    if (!project) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(project);
  }),

  http.post('/api/projects', async ({ request }) => {
    await delay(300);
    const body = await request.json() as Partial<Project>;

    const newProject: Project = {
      id: generateId(),
      name: body.name || 'New Project',
      description: body.description || '',
      status: body.status || 'active',
      ownerId: authenticatedUser?.id || currentUser.id,
      color: body.color || '#3B82F6',
      icon: body.icon || '📊',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dueDate: body.dueDate || null,
      progress: 0,
      taskCount: 0,
      completedTaskCount: 0,
    };

    mockProjects.push(newProject);
    return HttpResponse.json(newProject, { status: 201 });
  }),

  http.patch('/api/projects/:id', async ({ params, request }) => {
    await delay(200);
    const body = await request.json() as Partial<Project>;
    const index = mockProjects.findIndex(p => p.id === params.id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    mockProjects[index] = {
      ...mockProjects[index],
      ...body,
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json(mockProjects[index]);
  }),

  http.delete('/api/projects/:id', async ({ params }) => {
    await delay(200);
    mockProjects = mockProjects.filter(p => p.id !== params.id);
    mockTasks = mockTasks.filter(t => t.projectId !== params.id);
    return HttpResponse.json({ success: true });
  }),

  // ============ TASK ENDPOINTS ============

  http.get('/api/projects/:projectId/tasks', async ({ params }) => {
    await delay(200);
    const projectTasks = mockTasks.filter(t => t.projectId === params.projectId);
    return HttpResponse.json(projectTasks);
  }),

  http.get('/api/tasks', async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const projectId = url.searchParams.get('projectId');
    const status = url.searchParams.get('status');
    const assigneeId = url.searchParams.get('assigneeId');

    let filtered = [...mockTasks];

    if (projectId) {
      filtered = filtered.filter(t => t.projectId === projectId);
    }
    if (status) {
      filtered = filtered.filter(t => t.status === status);
    }
    if (assigneeId) {
      filtered = filtered.filter(t => t.assigneeId === assigneeId);
    }

    return HttpResponse.json(filtered);
  }),

  http.get('/api/tasks/:id', async ({ params }) => {
    await delay(100);
    const task = mockTasks.find(t => t.id === params.id);
    if (!task) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(task);
  }),

  http.post('/api/tasks', async ({ request }) => {
    await delay(200);
    const body = await request.json() as Partial<Task>;

    const newTask: Task = {
      id: generateId(),
      title: body.title || 'New Task',
      description: body.description || '',
      status: body.status || 'todo',
      priority: body.priority || 'medium',
      assigneeId: body.assigneeId || null,
      projectId: body.projectId || '',
      dueDate: body.dueDate || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: body.tags || [],
    };

    mockTasks.push(newTask);

    // Update project task count
    const projectIndex = mockProjects.findIndex(p => p.id === newTask.projectId);
    if (projectIndex !== -1) {
      mockProjects[projectIndex].taskCount++;
    }

    return HttpResponse.json(newTask, { status: 201 });
  }),

  http.patch('/api/tasks/:id', async ({ params, request }) => {
    await delay(150);
    const body = await request.json() as Partial<Task>;
    const index = mockTasks.findIndex(t => t.id === params.id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    const oldStatus = mockTasks[index].status;

    mockTasks[index] = {
      ...mockTasks[index],
      ...body,
      updatedAt: new Date().toISOString(),
    };

    // Update project completed count if status changed
    if (body.status && body.status !== oldStatus) {
      const projectIndex = mockProjects.findIndex(p => p.id === mockTasks[index].projectId);
      if (projectIndex !== -1) {
        if (body.status === 'done' && oldStatus !== 'done') {
          mockProjects[projectIndex].completedTaskCount++;
        } else if (oldStatus === 'done' && body.status !== 'done') {
          mockProjects[projectIndex].completedTaskCount--;
        }
        mockProjects[projectIndex].progress = Math.round(
          (mockProjects[projectIndex].completedTaskCount / mockProjects[projectIndex].taskCount) * 100
        );
      }
    }

    return HttpResponse.json(mockTasks[index]);
  }),

  http.delete('/api/tasks/:id', async ({ params }) => {
    await delay(150);
    const task = mockTasks.find(t => t.id === params.id);
    if (task) {
      const projectIndex = mockProjects.findIndex(p => p.id === task.projectId);
      if (projectIndex !== -1) {
        mockProjects[projectIndex].taskCount--;
        if (task.status === 'done') {
          mockProjects[projectIndex].completedTaskCount--;
        }
      }
    }
    mockTasks = mockTasks.filter(t => t.id !== params.id);
    return HttpResponse.json({ success: true });
  }),

  // ============ NOTIFICATION ENDPOINTS ============

  http.get('/api/notifications', async () => {
    await delay(200);
    const userNotifications = mockNotifications.slice(0, 50); // Return latest 50
    return HttpResponse.json(userNotifications);
  }),

  http.post('/api/notifications/:id/read', async ({ params }) => {
    await delay(100);
    const index = mockNotifications.findIndex(n => n.id === params.id);
    if (index !== -1) {
      mockNotifications[index].read = true;
    }
    return HttpResponse.json({ success: true });
  }),

  http.post('/api/notifications/read-all', async () => {
    await delay(200);
    mockNotifications = mockNotifications.map(n => ({ ...n, read: true }));
    return HttpResponse.json({ success: true });
  }),

  http.delete('/api/notifications/:id', async ({ params }) => {
    await delay(100);
    mockNotifications = mockNotifications.filter(n => n.id !== params.id);
    return HttpResponse.json({ success: true });
  }),

  http.patch('/api/notifications/preferences', async ({ request }) => {
    await delay(200);
    const body = await request.json();
    return HttpResponse.json(body);
  }),

  // ============ FEED ENDPOINT (Infinite Scroll) ============

  http.get('/api/feed', async ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '0');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    // BUG:BZ-091 - Simulate intermittent API failure on page 5
    // After the error, the infinite scroll listener is removed
    if (page === 4) {
      await delay(500);
      return new HttpResponse(null, { status: 500 });
    }

    await delay(400);

    const totalPages = 8;
    const feedTitles = [
      'Sprint retrospective summary', 'New deployment pipeline ready',
      'Customer feedback analysis Q4', 'API rate limit changes',
      'Database migration complete', 'Security patch released',
      'Performance benchmarks updated', 'Team standup notes',
      'Release candidate review', 'Infrastructure cost report',
    ];
    const categories = ['Engineering', 'Product', 'Design', 'Marketing', 'Operations'];

    const items = Array.from({ length: limit }, (_, i) => ({
      id: `feed-${page}-${i}`,
      title: feedTitles[(page * limit + i) % feedTitles.length],
      body: `Detailed update content for page ${page + 1}, item ${i + 1}. This contains relevant project information and status updates.`,
      category: categories[Math.floor(Math.random() * categories.length)],
      createdAt: new Date(Date.now() - (page * limit + i) * 300000).toISOString(),
    }));

    return HttpResponse.json({
      items,
      hasMore: page < totalPages - 1,
      page,
      totalPages,
    });
  }),

  // ============ ORDER ENDPOINT (Retry/Duplicates) ============

  http.post('/api/orders', async ({ request }) => {
    const body = await request.json() as { product: string; quantity: number; total: number };

    // BUG:BZ-090 - Simulate flaky network: first attempt takes very long (client may time out)
    // Subsequent retries get a fast response, but the first attempt may have already succeeded
    const orderCount = ((globalThis as Record<string, unknown>).__orderAttemptCount as number) || 0;
    (globalThis as Record<string, unknown>).__orderAttemptCount = orderCount + 1;

    if (orderCount % 4 === 0) {
      // First attempt: slow response simulating a timeout scenario
      await delay(2000);
    } else {
      await delay(200);
    }

    const order = {
      id: generateId(),
      product: body.product,
      quantity: body.quantity,
      total: body.total,
      status: 'confirmed' as const,
      createdAt: new Date().toISOString(),
    };

    return HttpResponse.json(order, { status: 201 });
  }),

  // ============ NOTES ENDPOINT (Auto-save) ============

  http.post('/api/notes/save', async ({ request }) => {
    await delay(300);
    const body = await request.json() as { title: string; content: string };
    return HttpResponse.json({
      success: true,
      savedAt: new Date().toISOString(),
      title: body.title,
    });
  }),

  // ============ RESOURCE ENDPOINTS (Optimistic Delete / Batch) ============

  // BUG:BZ-096 - Resource delete with cascade (related items are permanently removed)
  http.delete('/api/resources/:id', async () => {
    await delay(300);
    // Simulate cascade delete of related records (comments, attachments, links)
    // Once deleted, these relations cannot be restored by re-creating the parent
    return HttpResponse.json({ success: true, cascadeDeleted: true });
  }),

  // BUG:BZ-096 - Resource re-creation (undo) — item restored but without relations
  http.post('/api/resources', async ({ request }) => {
    await delay(400);
    const body = await request.json() as { id: string; name: string; type: string; originalRelatedItems: number };

    // BUG:BZ-096 - Server recreates the item but related records were cascade-deleted
    // and cannot be restored. relatedItems returns 0 instead of the original count.
    return HttpResponse.json({
      id: body.id,
      name: body.name,
      type: body.type,
      relatedItems: 0, // Cascade-deleted, can't restore
      createdAt: new Date().toISOString(),
    }, { status: 201 });
  }),

  // BUG:BZ-097 - Batch delete with partial failure
  http.post('/api/resources/batch-delete', async ({ request }) => {
    await delay(500);
    const body = await request.json() as { ids: string[] };

    // BUG:BZ-097 - Items with 'restricted' permission fail to delete
    // but the response structure doesn't make this obvious to the client
    const deleted: string[] = [];
    const failed: { id: string; reason: string }[] = [];

    for (const id of body.ids) {
      // Items with even-numbered suffixes (batch-2, batch-4, etc.) or "restricted" items
      // fail due to "insufficient permissions"
      const num = parseInt(id.split('-')[1] || '0');
      if (num === 2 || num === 5 || num === 7 || num === 10) {
        failed.push({ id, reason: 'Insufficient permissions' });
      } else {
        deleted.push(id);
      }
    }

    // Return 200 with both deleted and failed arrays
    // The client only checks the status code and shows "success"
    return HttpResponse.json({
      deleted,
      failed,
      total: body.ids.length,
    });
  }),

  // BUG:BZ-099 - Cached metrics endpoint (returns new API format)
  http.get('/api/cached-metrics', async () => {
    await delay(350);

    // New API format (v2.5.0) — uses different field names than what the
    // "cached" client JS (v2.3.1) expects
    return HttpResponse.json({
      apiVersion: 'v2.5.0',
      // New format uses 'metrics' array with 'label', 'value', 'percentChange'
      // Old cached JS expects 'stats' array with 'name', 'count', 'delta'
      metrics: [
        { label: 'Active Users', value: 12847, percentChange: 8.3 },
        { label: 'API Requests', value: 584920, percentChange: -2.1 },
        { label: 'Error Rate', value: 0.42, percentChange: -15.7 },
        { label: 'Avg Response', value: 234, percentChange: 3.2 },
      ],
      updatedAt: new Date().toISOString(),
    });
  }),

  // ============ SEARCH ENDPOINT ============

  http.get('/api/search', async ({ request }) => {
    await delay(300);
    const url = new URL(request.url);
    const query = url.searchParams.get('q')?.toLowerCase() || '';
    const type = url.searchParams.get('type');

    const results: { type: string; items: (Project | Task | User)[] }[] = [];

    if (!type || type === 'projects') {
      const projectResults = mockProjects.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
      ).slice(0, 10);
      if (projectResults.length > 0) {
        results.push({ type: 'projects', items: projectResults });
      }
    }

    if (!type || type === 'tasks') {
      const taskResults = mockTasks.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query)
      ).slice(0, 10);
      if (taskResults.length > 0) {
        results.push({ type: 'tasks', items: taskResults });
      }
    }

    if (!type || type === 'users') {
      const userResults = mockUsers.filter(u =>
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query)
      ).slice(0, 10);
      if (userResults.length > 0) {
        results.push({ type: 'users', items: userResults });
      }
    }

    return HttpResponse.json(results);
  }),
];
