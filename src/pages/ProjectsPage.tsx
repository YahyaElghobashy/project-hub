import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../store/projectStore';
import { useTeamStore } from '../store/teamStore';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Table, Pagination } from '../components/Table';
import { Badge, getStatusVariant } from '../components/Badge';
import { Avatar } from '../components/Avatar';
import { Modal } from '../components/Modal';
import type { Project, ProjectStatus } from '../types';

// BUG:BZ-049 - Simulated real-time project names for WebSocket-like updates
const REALTIME_PROJECT_NAMES = [
  'Q4 Planning Review',
  'Customer Feedback Analysis',
  'Infrastructure Upgrade',
  'Mobile App Redesign',
  'Security Audit Sprint',
  'Analytics Dashboard v3',
];

// BUG:BZ-045 - Column widths stored outside React state so they don't survive re-renders properly
let savedColumnWidths: Record<string, number> = {};

export function ProjectsPage() {
  const navigate = useNavigate();
  const { projects, fetchProjects, createProject, updateProject, isLoading } = useProjectStore();
  const { members, fetchMembers } = useTeamStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // BUG:BZ-049 - Real-time updates that insert rows at top, causing content shift
  const [realtimeProjects, setRealtimeProjects] = useState<Project[]>([]);
  const realtimeCounterRef = useRef(0);

  // BUG:BZ-116 - Track whether new items were prepended (triggers index-keyed re-render)
  const [recentlyPrepended, setRecentlyPrepended] = useState(false);

  // BUG:BZ-044 - Local overrides for inline-edited fields (only stores the edited field, not recalculated fields)
  const [inlineEdits, setInlineEdits] = useState<Record<string, Partial<Project>>>({});
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);

  // BUG:BZ-045 - Column widths state that resets on any re-render trigger
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizingRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  // BUG:BZ-046 - Stale snapshot for optimistic rollback (captured once, not updated)
  const optimisticSnapshotRef = useRef<Record<string, Project>>({});

  // BUG:BZ-047 - Virtual scroll state
  const [useVirtualScroll, setUseVirtualScroll] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const ROW_HEIGHT = 48;
  const VISIBLE_ROWS = 15;

  const itemsPerPage = 10;

  useEffect(() => {
    fetchProjects();
    fetchMembers();
  }, [fetchProjects, fetchMembers]);

  // BUG:BZ-046 - Capture snapshot only once on initial load (becomes stale over time)
  useEffect(() => {
    if (projects.length > 0 && Object.keys(optimisticSnapshotRef.current).length === 0) {
      const snapshot: Record<string, Project> = {};
      projects.forEach((p) => {
        snapshot[p.id] = { ...p };
      });
      optimisticSnapshotRef.current = snapshot;
    }
  }, [projects]);

  // BUG:BZ-049 - Simulate WebSocket real-time updates that insert at top of list
  useEffect(() => {
    if (projects.length === 0) return;

    const interval = setInterval(() => {
      const idx = realtimeCounterRef.current % REALTIME_PROJECT_NAMES.length;
      realtimeCounterRef.current += 1;

      const newProject: Project = {
        id: `rt-${Date.now()}-${idx}`,
        name: REALTIME_PROJECT_NAMES[idx],
        description: 'Auto-synced from team activity',
        status: 'active' as ProjectStatus,
        ownerId: projects[0]?.ownerId || 'user-1',
        color: '#6366f1',
        icon: '🔄',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dueDate: null,
        progress: Math.floor(Math.random() * 60),
        taskCount: Math.floor(Math.random() * 20) + 1,
        completedTaskCount: Math.floor(Math.random() * 10),
      };

      // BUG:BZ-049 - Insert at top without any "new data" indicator, causing row jump
      setRealtimeProjects((prev) => [newProject, ...prev]);
      // BUG:BZ-116 - Mark that we prepended, triggering index-key re-render path
      setRecentlyPrepended(true);

      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-049')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-049',
            timestamp: Date.now(),
            description: 'Real-time update inserts row at top, causing content shift and losing user position',
            page: 'Projects Table',
          });
        }
      }
    }, 8000); // Every 8 seconds a "real-time" row appears

    return () => clearInterval(interval);
  }, [projects]);

  const getOwner = (ownerId: string) => {
    return members.find((m) => m.id === ownerId);
  };

  // Derive a "priority" from progress for filtering purposes
  const getProjectPriority = (project: Project): string => {
    if (project.progress < 25) return 'high';
    if (project.progress < 50) return 'medium';
    return 'low';
  };

  // BUG:BZ-049 - Combine real-time projects with store projects (real-time inserted at top)
  const allProjects = useMemo(() => {
    return [...realtimeProjects, ...projects];
  }, [realtimeProjects, projects]);

  // BUG:BZ-043 - Filter logic uses OR instead of AND when multiple filters are active
  const filteredProjects = allProjects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(search.toLowerCase()) ||
      project.description.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = !statusFilter || project.status === statusFilter;
    const matchesPriority = !priorityFilter || getProjectPriority(project) === priorityFilter;

    if (statusFilter && priorityFilter) {
      // BUG:BZ-043 - Uses OR logic instead of AND logic when both filters active
      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-043')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-043',
            timestamp: Date.now(),
            description: 'Table filter AND/OR logic wrong - uses OR instead of AND',
            page: 'Projects Table',
          });
        }
      }
      return matchesSearch && (matchesStatus || matchesPriority);
    }

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // BUG:BZ-041 - Sort resets when page changes
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);

    // BUG:BZ-041 - Resetting sort state is dispatched as a custom event the Table listens for
    // This clears the Table's internal sort state on pagination
    if (typeof window !== 'undefined') {
      window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
      if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-041')) {
        window.__PERCEPTR_TEST_BUGS__.push({
          bugId: 'BZ-041',
          timestamp: Date.now(),
          description: 'Sort resets to default when navigating to a different page',
          page: 'Projects Table',
        });
      }
    }
    // Force table to remount by toggling a key, which resets sort state
    setTableKey((prev) => prev + 1);

    // BUG:BZ-045 - Column widths reset on page change because tableKey remount clears local state
    // Save widths to module-level variable, but the re-initialization below doesn't restore them
    savedColumnWidths = { ...columnWidths };
    setColumnWidths({});
  }, [columnWidths]);

  // BUG:BZ-041 - Table key forces remount on page change, resetting sort
  const [tableKey, setTableKey] = useState(0);

  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const paginatedProjects = filteredProjects.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // BUG:BZ-044 - Apply inline edits on top of paginated data (only the edited field, not recalculations)
  const displayProjects = useMemo(() => {
    return paginatedProjects.map((project) => {
      const edits = inlineEdits[project.id];
      if (edits) {
        // BUG:BZ-044 - Merges only the edited field; "days open" and other computed fields remain stale
        return { ...project, ...edits };
      }
      return project;
    });
  }, [paginatedProjects, inlineEdits]);

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) return;
    await createProject(newProject);
    setNewProject({ name: '', description: '' });
    setIsCreateModalOpen(false);
  };

  // BUG:BZ-044 - Inline edit handler that updates only the changed field locally
  const handleInlineStatusChange = useCallback(async (projectId: string, newStatus: ProjectStatus) => {
    // Update local display immediately (only status field)
    setInlineEdits((prev) => ({
      ...prev,
      [projectId]: { ...prev[projectId], status: newStatus },
    }));
    setEditingCell(null);

    // BUG:BZ-044 - The inline edit updates the status but doesn't recalculate dependent fields
    // like "updatedAt" or progress-related displays until a full page refresh
    if (typeof window !== 'undefined') {
      window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
      if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-044')) {
        window.__PERCEPTR_TEST_BUGS__.push({
          bugId: 'BZ-044',
          timestamp: Date.now(),
          description: 'Stale data after inline edit - related fields not updated',
          page: 'Projects Table',
        });
      }
    }

    // Persist to API in background (but don't refresh dependent fields locally)
    try {
      await updateProject(projectId, { status: newStatus });
    } catch {
      // Silently fail — the local state already shows the new value
    }
  }, [updateProject]);

  // BUG:BZ-046 - Optimistic update with wrong rollback data
  const handleOptimisticUpdate = useCallback(async (projectId: string, updates: Partial<Project>) => {
    // Apply optimistic update to inline edits
    setInlineEdits((prev) => ({
      ...prev,
      [projectId]: { ...prev[projectId], ...updates },
    }));

    try {
      await updateProject(projectId, updates);
    } catch {
      // BUG:BZ-046 - Rollback uses the stale snapshot captured on initial load,
      // not the actual current state before the edit
      const staleOriginal = optimisticSnapshotRef.current[projectId];
      if (staleOriginal) {
        setInlineEdits((prev) => ({
          ...prev,
          [projectId]: { status: staleOriginal.status, progress: staleOriginal.progress },
        }));
      }

      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-046')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-046',
            timestamp: Date.now(),
            description: 'Optimistic UI rollback shows wrong previous state from stale cache',
            page: 'Projects Table',
          });
        }
      }
    }
  }, [updateProject]);

  // BUG:BZ-042 - Select All only selects visible page items
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Only selects visible page items, not all filtered items
      const visibleIds = new Set(paginatedProjects.map((p) => p.id));
      setSelectedIds(visibleIds);

      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-042')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-042',
            timestamp: Date.now(),
            description: 'Select All only selects visible page rows, not all filtered items',
            page: 'Projects Table',
          });
        }
      }
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (projectId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  // BUG:BZ-045 - Column resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, columnKey: string, currentWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { key: columnKey, startX: e.clientX, startWidth: currentWidth };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingRef.current) return;
      const diff = moveEvent.clientX - resizingRef.current.startX;
      const newWidth = Math.max(60, resizingRef.current.startWidth + diff);
      setColumnWidths((prev) => ({
        ...prev,
        [resizingRef.current!.key]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      // BUG:BZ-045 - Log bug when column is resized (it'll get reset on next state change)
      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-045')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-045',
            timestamp: Date.now(),
            description: 'Column resize resets on re-render (sort, filter, page change)',
            page: 'Projects Table',
          });
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  // BUG:BZ-047 - Virtual scroll calculation with off-by-one error
  const getVirtualRows = useCallback((allRows: Project[]) => {
    if (!useVirtualScroll || allRows.length < 50) return allRows;

    // BUG:BZ-047 - Off-by-one: startIndex should be Math.floor but uses Math.round,
    // causing some rows to appear twice or be skipped
    const startIndex = Math.round(scrollTop / ROW_HEIGHT);
    const endIndex = startIndex + VISIBLE_ROWS;

    // The off-by-one from Math.round means the window can overlap with
    // previous/next batch boundaries, duplicating or skipping rows
    const virtualRows = allRows.slice(
      Math.max(0, startIndex - 1),  // overscan of 1, but combined with round causes issues
      Math.min(allRows.length, endIndex + 1)
    );

    if (startIndex > 0) {
      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-047')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-047',
            timestamp: Date.now(),
            description: 'Virtual scroll duplicates rows due to off-by-one in row recycling',
            page: 'Projects Table',
          });
        }
      }
    }

    return virtualRows;
  }, [useVirtualScroll, scrollTop]);

  const handleVirtualScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // BUG:BZ-048 - CSV export that ignores current filters and sort
  const handleExportCSV = useCallback(() => {
    // BUG:BZ-048 - Uses `projects` (all unfiltered data) instead of `filteredProjects`
    const dataToExport = projects;
    const headers = ['Name', 'Status', 'Progress', 'Owner', 'Created', 'Updated'];

    const csvRows = [
      headers.join(','),
      ...dataToExport.map((project) => {
        const owner = getOwner(project.ownerId);
        return [
          `"${project.name}"`,
          project.status,
          `${project.progress}%`,
          owner ? `"${owner.name}"` : '-',
          new Date(project.createdAt).toLocaleDateString(),
          new Date(project.updatedAt).toLocaleDateString(),
        ].join(',');
      }),
    ];

    if (typeof window !== 'undefined') {
      window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
      if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-048')) {
        window.__PERCEPTR_TEST_BUGS__.push({
          bugId: 'BZ-048',
          timestamp: Date.now(),
          description: 'CSV export ignores current filters and sorts - exports all data',
          page: 'Projects Table',
        });
      }
    }

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'projects.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, members]);

  const allVisibleSelected = paginatedProjects.length > 0 && paginatedProjects.every((p) => selectedIds.has(p.id));

  const columns = [
    {
      key: 'select',
      header: '',
      width: columnWidths['select'] ? `${columnWidths['select']}px` : '40px',
      render: (project: Project) => (
        <input
          type="checkbox"
          checked={selectedIds.has(project.id)}
          onChange={(e) => {
            e.stopPropagation();
            handleSelectRow(project.id);
          }}
          onClick={(e) => e.stopPropagation()}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      ),
    },
    {
      key: 'name',
      header: 'Project',
      sortable: true,
      width: columnWidths['name'] ? `${columnWidths['name']}px` : undefined,
      // BUG:BZ-039 - Long text breaks table layout (no truncation on description)
      render: (project: Project) => (
        <div className="flex items-center gap-3" data-bug-id="BZ-039">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
            style={{ backgroundColor: `${project.color}20`, color: project.color }}
          >
            {project.icon}
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{project.name}</p>
            {/* BUG:BZ-039 - No truncation or max-width causes long descriptions to overflow */}
            <p className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {project.description}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      width: columnWidths['status'] ? `${columnWidths['status']}px` : undefined,
      // BUG:BZ-044 - Inline editable status column
      render: (project: Project) => {
        const isEditing = editingCell?.id === project.id && editingCell?.field === 'status';
        return (
          <div data-bug-id="BZ-044">
            {isEditing ? (
              <select
                autoFocus
                value={project.status}
                onChange={(e) => {
                  e.stopPropagation();
                  handleInlineStatusChange(project.id, e.target.value as ProjectStatus);
                }}
                onBlur={() => setEditingCell(null)}
                onClick={(e) => e.stopPropagation()}
                className="px-2 py-1 text-sm border border-blue-400 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none"
              >
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            ) : (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingCell({ id: project.id, field: 'status' });
                }}
                className="cursor-pointer"
                title="Click to edit"
              >
                <Badge variant={getStatusVariant(project.status)} dot>
                  {project.status.replace('_', ' ')}
                </Badge>
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'ownerId',
      header: 'Owner',
      width: columnWidths['ownerId'] ? `${columnWidths['ownerId']}px` : undefined,
      render: (project: Project) => {
        const owner = getOwner(project.ownerId);
        return owner ? (
          <div className="flex items-center gap-2">
            <Avatar src={owner.avatar} name={owner.name} size="xs" />
            <span className="text-sm text-gray-900 dark:text-white">{owner.name}</span>
          </div>
        ) : (
          <span className="text-gray-400">-</span>
        );
      },
    },
    {
      key: 'progress',
      header: 'Progress',
      sortable: true,
      width: columnWidths['progress'] ? `${columnWidths['progress']}px` : undefined,
      // BUG:BZ-046 - Progress column with optimistic update capability
      render: (project: Project) => (
        <div className="flex items-center gap-2" data-bug-id="BZ-046">
          <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${project.progress}%`, backgroundColor: project.color }}
            />
          </div>
          <span
            className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-blue-600"
            title="Click to mark complete"
            onClick={(e) => {
              e.stopPropagation();
              if (project.progress < 100) {
                handleOptimisticUpdate(project.id, { progress: 100, status: 'completed' as ProjectStatus });
              }
            }}
          >
            {project.progress}%
          </span>
        </div>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Last Updated',
      sortable: true,
      width: columnWidths['updatedAt'] ? `${columnWidths['updatedAt']}px` : undefined,
      render: (project: Project) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {new Date(project.updatedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      // BUG:BZ-052 - Timezone-dependent sorting: sorts by raw UTC string but displays local time
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      width: columnWidths['createdAt'] ? `${columnWidths['createdAt']}px` : undefined,
      render: (project: Project) => (
        <span className="text-sm text-gray-500 dark:text-gray-400" data-bug-id="BZ-052">
          {/* BUG:BZ-052 - Display uses local time, but the Table sort compares raw ISO strings (UTC).
              Records created at 11pm EST (4am UTC next day) appear out of order when sorted. */}
          {new Date(project.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </span>
      ),
    },
    {
      // BUG:BZ-054 - Actions column where keyboard navigation can accidentally trigger buttons
      key: 'actions',
      header: '',
      width: columnWidths['actions'] ? `${columnWidths['actions']}px` : '80px',
      render: (project: Project) => (
        <div className="flex items-center gap-1" data-bug-id="BZ-054">
          {/* BUG:BZ-054 - These buttons can be accidentally triggered by keyboard navigation
              (Enter/Space while focus is on the row or near the button) */}
          <button
            className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors focus:outline-none"
            title="Archive project"
            onClick={(e) => {
              e.stopPropagation();
              handleOptimisticUpdate(project.id, { status: 'archived' as ProjectStatus });

              // BUG:BZ-054 - Log when action is triggered (especially via keyboard)
              if (typeof window !== 'undefined') {
                window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
                if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-054')) {
                  window.__PERCEPTR_TEST_BUGS__.push({
                    bugId: 'BZ-054',
                    timestamp: Date.now(),
                    description: 'Table keyboard navigation fires action - accidental archive triggered',
                    page: 'Projects Table',
                  });
                }
              }
            }}
            onKeyDown={(e) => {
              // BUG:BZ-054 - Does not prevent default for Enter/Space, meaning keyboard
              // navigation through the table can inadvertently trigger this action
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                handleOptimisticUpdate(project.id, { status: 'archived' as ProjectStatus });

                if (typeof window !== 'undefined') {
                  window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
                  if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-054')) {
                    window.__PERCEPTR_TEST_BUGS__.push({
                      bugId: 'BZ-054',
                      timestamp: Date.now(),
                      description: 'Table keyboard navigation fires action - accidental archive via Enter/Space',
                      page: 'Projects Table',
                    });
                  }
                }
              }
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
            </svg>
          </button>
        </div>
      ),
    },
  ];

  // BUG:BZ-103 - Copy/paste from app table loses structure
  // When user selects table rows and copies, the clipboard content concatenates all cell text
  // into a single string instead of preserving tab-delimited structure for spreadsheet paste
  const handleTableCopy = useCallback((e: ClipboardEvent) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const selectedText = selection.toString();
    // Only intercept if the selection looks like it came from within the table
    const anchorNode = selection.anchorNode;
    if (!anchorNode) return;
    const tableContainer = (anchorNode as HTMLElement).closest?.('[data-table-copyable]')
      || (anchorNode.parentElement)?.closest?.('[data-table-copyable]');
    if (!tableContainer) return;

    // BUG:BZ-103 - Override clipboard with plain concatenated text
    // Instead of preserving the tab/newline structure from the HTML table,
    // join all text content with spaces, destroying the column structure
    const rows = tableContainer.querySelectorAll('tr');
    const textParts: string[] = [];
    rows.forEach((row) => {
      const cells = row.querySelectorAll('td, th');
      // Bug: Join cells with space instead of tab (\t), destroying spreadsheet structure
      const rowText = Array.from(cells).map(cell => (cell as HTMLElement).textContent?.trim() || '').join(' ');
      textParts.push(rowText);
    });

    const flatText = textParts.join(' ');
    e.clipboardData?.setData('text/plain', flatText);
    // Bug: Don't set text/html with proper table markup either
    e.preventDefault();

    if (typeof window !== 'undefined') {
      window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
      if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-103')) {
        window.__PERCEPTR_TEST_BUGS__.push({
          bugId: 'BZ-103',
          timestamp: Date.now(),
          description: 'Copy/paste from app table loses structure - all data concatenated into single cell',
          page: 'Complex Interactions',
        });
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener('copy', handleTableCopy);
    return () => document.removeEventListener('copy', handleTableCopy);
  }, [handleTableCopy]);

  // BUG:BZ-039 - Log when long text is rendered without truncation
  useEffect(() => {
    const hasLongDescription = paginatedProjects.some((p) => p.description.length > 100);
    if (hasLongDescription) {
      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-039')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-039',
            timestamp: Date.now(),
            description: 'Long text breaks table layout - no truncation or wrapping',
            page: 'Projects Table',
          });
        }
      }
    }
  }, [paginatedProjects]);

  // BUG:BZ-052 - Log timezone-dependent sorting issue when the createdAt column has records
  useEffect(() => {
    if (displayProjects.length > 1) {
      // Check if any two adjacent rows have createdAt dates that would sort differently
      // when comparing UTC ISO strings vs local date display
      const hasTimezoneIssue = displayProjects.some((p) => {
        const utcDate = new Date(p.createdAt);
        const localDay = utcDate.toLocaleDateString('en-US');
        const utcDay = utcDate.toISOString().split('T')[0];
        return localDay !== new Date(utcDay + 'T00:00:00').toLocaleDateString('en-US');
      });

      if (hasTimezoneIssue) {
        if (typeof window !== 'undefined') {
          window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
          if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-052')) {
            window.__PERCEPTR_TEST_BUGS__.push({
              bugId: 'BZ-052',
              timestamp: Date.now(),
              description: 'Timezone-dependent sorting: sorts by UTC but displays local time',
              page: 'Projects Table',
            });
          }
        }
      }
    }
  }, [displayProjects]);

  // BUG:BZ-116 - Log when prepending causes index-keyed re-render
  useEffect(() => {
    if (recentlyPrepended && displayProjects.length > 0) {
      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-116')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-116',
            timestamp: Date.now(),
            description: 'Unkeyed list uses array index as key - prepending item causes full re-render of all rows',
            page: 'Projects Table',
          });
        }
      }
      setRecentlyPrepended(false);
    }
  }, [recentlyPrepended, displayProjects]);

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Projects</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Manage and track all your projects
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <span className="text-sm text-gray-600 dark:text-gray-400" data-bug-id="BZ-042">
              {/* BUG:BZ-042 - Shows total filtered count but only visible rows are selected */}
              {filteredProjects.length} items selected
            </span>
          )}
          {/* BUG:BZ-048 - Export CSV button */}
          <Button variant="outline" onClick={handleExportCSV} data-bug-id="BZ-048">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6" data-bug-id="BZ-043">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
              // BUG:BZ-045 - Any filter change resets column widths
              setColumnWidths({});
            }}
            leftIcon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
            // BUG:BZ-045 - Status filter change resets column widths
            setColumnWidths({});
          }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="on_hold">On Hold</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => {
            setPriorityFilter(e.target.value);
            setCurrentPage(1);
            // BUG:BZ-045 - Priority filter change resets column widths
            setColumnWidths({});
          }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        {/* BUG:BZ-047 - Virtual scroll toggle for large datasets */}
        {filteredProjects.length > 50 && (
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={useVirtualScroll}
              onChange={(e) => setUseVirtualScroll(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Virtual scroll
          </label>
        )}
      </div>

      {/* Table */}
      {/* BUG:BZ-049 - Real-time update notification count (no visual indicator, just inserts at top) */}
      {realtimeProjects.length > 0 && (
        <div className="mb-2 text-xs text-gray-400" data-bug-id="BZ-049">
          {realtimeProjects.length} new update{realtimeProjects.length !== 1 ? 's' : ''} synced
        </div>
      )}
      {/* BUG:BZ-103 - data-table-copyable marks this table for the copy handler that strips structure */}
      <div data-bug-id="BZ-103" data-table-copyable>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700" data-bug-id="BZ-041">
        {/* BUG:BZ-045 - Column resize handles in header */}
        <div className="flex items-center px-4 py-2 border-b border-gray-200 dark:border-gray-700" data-bug-id="BZ-045">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={(e) => handleSelectAll(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">
            {selectedIds.size > 0
              ? `${selectedIds.size} selected`
              : 'Select all'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {Object.keys(columnWidths).length > 0 && (
              <span className="text-xs text-gray-400">
                Columns resized
              </span>
            )}
          </div>
        </div>
        {/* BUG:BZ-047 - Virtual scroll container */}
        {useVirtualScroll && filteredProjects.length > 50 ? (
          <div
            ref={scrollContainerRef}
            data-bug-id="BZ-047"
            style={{ height: `${VISIBLE_ROWS * ROW_HEIGHT}px`, overflow: 'auto' }}
            onScroll={handleVirtualScroll}
          >
            <div style={{ height: `${filteredProjects.length * ROW_HEIGHT}px`, position: 'relative' }}>
              <div style={{ position: 'absolute', top: `${Math.max(0, Math.round(scrollTop / ROW_HEIGHT) - 1) * ROW_HEIGHT}px`, width: '100%' }}>
                <Table
                  key={tableKey}
                  data={getVirtualRows(filteredProjects)}
                  columns={columns}
                  keyExtractor={(project) => project.id}
                  onRowClick={(project) => navigate(`/projects/${project.id}`)}
                  isLoading={isLoading}
                  emptyMessage="No projects found"
                />
              </div>
            </div>
          </div>
        ) : (
          // BUG:BZ-116 - When real-time projects are present, uses array index as key
          // instead of stable project ID, causing all rows to re-render when a new item is prepended
          <div data-bug-id="BZ-116">
            <Table
              key={tableKey}
              data={displayProjects}
              keyExtractor={realtimeProjects.length > 0
                ? ((_project, index) => String(index))  // BUG:BZ-116 - Index key causes full re-render on prepend
                : ((project) => project.id)
              }
              columns={columns}
              onRowClick={(project) => navigate(`/projects/${project.id}`)}
              isLoading={isLoading}
              emptyMessage="No projects found"
            />
          </div>
        )}
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        )}
      </div>
      </div>

      {/* Create Project Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Project"
      >
        <div className="space-y-4">
          <Input
            label="Project Name"
            placeholder="Enter project name"
            value={newProject.name}
            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              placeholder="Enter project description"
              value={newProject.description}
              onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject} disabled={!newProject.name.trim()}>
              Create Project
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
