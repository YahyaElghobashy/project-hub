import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../store/projectStore';
import { useTeamStore } from '../store/teamStore';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Table, Pagination } from '../components/Table';
import { Badge, getStatusVariant } from '../components/Badge';
import { Avatar } from '../components/Avatar';
import { Modal } from '../components/Modal';
import type { Project } from '../types';

export function ProjectsPage() {
  const navigate = useNavigate();
  const { projects, fetchProjects, createProject, isLoading } = useProjectStore();
  const { members, fetchMembers } = useTeamStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const itemsPerPage = 10;

  useEffect(() => {
    fetchProjects();
    fetchMembers();
  }, [fetchProjects, fetchMembers]);

  const getOwner = (ownerId: string) => {
    return members.find((m) => m.id === ownerId);
  };

  // Derive a "priority" from progress for filtering purposes
  const getProjectPriority = (project: Project): string => {
    if (project.progress < 25) return 'high';
    if (project.progress < 50) return 'medium';
    return 'low';
  };

  // BUG:BZ-043 - Filter logic uses OR instead of AND when multiple filters are active
  const filteredProjects = projects.filter((project) => {
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
  }, []);

  // BUG:BZ-041 - Table key forces remount on page change, resetting sort
  const [tableKey, setTableKey] = useState(0);

  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const paginatedProjects = filteredProjects.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) return;
    await createProject(newProject);
    setNewProject({ name: '', description: '' });
    setIsCreateModalOpen(false);
  };

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

  const allVisibleSelected = paginatedProjects.length > 0 && paginatedProjects.every((p) => selectedIds.has(p.id));

  const columns = [
    {
      key: 'select',
      header: '',
      width: '40px',
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
      render: (project: Project) => (
        <Badge variant={getStatusVariant(project.status)} dot>
          {project.status.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'ownerId',
      header: 'Owner',
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
      render: (project: Project) => (
        <div className="flex items-center gap-2">
          <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${project.progress}%`, backgroundColor: project.color }}
            />
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">{project.progress}%</span>
        </div>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Last Updated',
      sortable: true,
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
  ];

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
          }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700" data-bug-id="BZ-041">
        <div className="flex items-center px-4 py-2 border-b border-gray-200 dark:border-gray-700">
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
        </div>
        <Table
          key={tableKey}
          data={paginatedProjects}
          columns={columns}
          keyExtractor={(project) => project.id}
          onRowClick={(project) => navigate(`/projects/${project.id}`)}
          isLoading={isLoading}
          emptyMessage="No projects found"
        />
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        )}
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
