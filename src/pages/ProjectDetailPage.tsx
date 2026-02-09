import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjectStore } from '../store/projectStore';
import { useTeamStore } from '../store/teamStore';
import { Button } from '../components/Button';
import { Badge, getStatusVariant, getPriorityVariant } from '../components/Badge';
import { Avatar } from '../components/Avatar';
import { Modal } from '../components/Modal';
import { Input } from '../components/Input';
import { KanbanBoard } from '../components/KanbanBoard';
import type { Task } from '../types';

type Tab = 'board' | 'settings';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    currentProject,
    tasks,
    fetchProject,
    fetchTasks,
    updateProject,
    deleteProject,
    createTask,
    isLoading,
  } = useProjectStore();
  const { members, fetchMembers } = useTeamStore();

  const [activeTab, setActiveTab] = useState<Tab>('board');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as Task['priority'],
  });

  useEffect(() => {
    if (id) {
      fetchProject(id);
      fetchTasks(id);
      fetchMembers();
    }
  }, [id, fetchProject, fetchTasks, fetchMembers]);

  const handleCreateTask = async () => {
    if (!newTask.title.trim() || !id) return;
    await createTask({
      ...newTask,
      projectId: id,
      status: 'todo',
    });
    setNewTask({ title: '', description: '', priority: 'medium' });
    setIsTaskModalOpen(false);
  };

  const handleDeleteProject = async () => {
    if (!id) return;
    await deleteProject(id);
    navigate('/projects');
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  if (isLoading || !currentProject) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const owner = members.find((m) => m.id === currentProject.ownerId);

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/projects')}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                style={{ backgroundColor: `${currentProject.color}20`, color: currentProject.color }}
              >
                {currentProject.icon}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {currentProject.name}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={getStatusVariant(currentProject.status)} dot>
                    {currentProject.status.replace('_', ' ')}
                  </Badge>
                  {owner && (
                    <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                      <span>by</span>
                      <Avatar src={owner.avatar} name={owner.name} size="xs" />
                      <span>{owner.name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <p className="mt-2 text-gray-600 dark:text-gray-400 max-w-2xl">
              {currentProject.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsTaskModalOpen(true)}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Task
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('board')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'board'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Board
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'settings'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Settings
        </button>
      </div>

      {/* Content */}
      {activeTab === 'board' && (
        <KanbanBoard tasks={tasks} onTaskClick={handleTaskClick} />
      )}

      {activeTab === 'settings' && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Project Settings
            </h2>
            <div className="space-y-4">
              <Input
                label="Project Name"
                value={currentProject.name}
                onChange={(e) => updateProject(currentProject.id, { name: e.target.value })}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={currentProject.description}
                  onChange={(e) => updateProject(currentProject.id, { description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={currentProject.status}
                  onChange={(e) => updateProject(currentProject.id, { status: e.target.value as typeof currentProject.status })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-900 p-6">
            <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
              Danger Zone
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Once you delete a project, there is no going back. Please be certain.
            </p>
            <Button variant="danger" onClick={() => setIsDeleteModalOpen(true)}>
              Delete Project
            </Button>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      <Modal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        title="Create New Task"
      >
        <div className="space-y-4">
          <Input
            label="Task Title"
            placeholder="Enter task title"
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              placeholder="Enter task description"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Priority
            </label>
            <select
              value={newTask.priority}
              onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as Task['priority'] })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsTaskModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTask} disabled={!newTask.title.trim()}>
              Create Task
            </Button>
          </div>
        </div>
      </Modal>

      {/* Task Detail Modal */}
      <Modal
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        title={selectedTask?.title}
        size="lg"
      >
        {selectedTask && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={getStatusVariant(selectedTask.status)}>
                {selectedTask.status.replace('_', ' ')}
              </Badge>
              <Badge variant={getPriorityVariant(selectedTask.priority)}>
                {selectedTask.priority}
              </Badge>
            </div>
            <p className="text-gray-600 dark:text-gray-400">{selectedTask.description}</p>
            {selectedTask.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedTask.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {selectedTask.dueDate && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Due: {new Date(selectedTask.dueDate).toLocaleDateString()}
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Project"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Are you sure you want to delete "{currentProject.name}"? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteProject}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
