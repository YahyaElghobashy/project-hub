import { useState, useEffect } from 'react';
import type { Task, TaskStatus } from '../types';
import { Badge, getPriorityVariant } from './Badge';
import { Avatar } from './Avatar';
import { useProjectStore } from '../store/projectStore';
import { useTeamStore } from '../store/teamStore';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
}

const columns: { id: TaskStatus; title: string; color: string }[] = [
  { id: 'todo', title: 'To Do', color: 'bg-zinc-400' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-blue-500' },
  { id: 'done', title: 'Done', color: 'bg-green-500' },
];

// BUG:BZ-101 - Kanban board uses HTML5 Drag and Drop API only, no touch fallback
export function KanbanBoard({ tasks, onTaskClick }: KanbanBoardProps) {
  const { updateTaskStatus } = useProjectStore();
  const { members } = useTeamStore();
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  // BUG:BZ-101 - Detect touch device but don't provide fallback
  useEffect(() => {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) {
      // BUG:BZ-101 - Log that touch device has no drag-and-drop support
      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find((b: any) => b.bugId === 'BZ-101')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-101',
            timestamp: Date.now(),
            description: 'Drag-and-drop does not work on touch devices - no fallback provided',
            page: 'Project Detail'
          });
        }
      }
    }
  }, []);

  const getTasksByStatus = (status: TaskStatus) => {
    return tasks.filter((task) => task.status === status);
  };

  const getAssignee = (assigneeId: string | null) => {
    if (!assigneeId) return null;
    return members.find((m) => m.id === assigneeId);
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (draggedTask && draggedTask.status !== status) {
      await updateTaskStatus(draggedTask.id, status);
    }
    setDraggedTask(null);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  return (
    // BUG:BZ-101 - Only HTML5 drag-and-drop, no touch support
    <div data-bug-id="BZ-101" className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((column) => (
        <div
          key={column.id}
          className={`
            flex-shrink-0 w-80 flex flex-col
            bg-zinc-100 dark:bg-zinc-800/50 rounded-lg
            transition-colors duration-200
            ${dragOverColumn === column.id ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}
          `}
          onDragOver={(e) => handleDragOver(e, column.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, column.id)}
        >
          {/* Column Header */}
          <div className="flex items-center gap-2 px-3 py-3">
            <span className={`w-2 h-2 rounded-full ${column.color}`} />
            <h3 className="font-medium text-zinc-900 dark:text-white">{column.title}</h3>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {getTasksByStatus(column.id).length}
            </span>
          </div>

          {/* Tasks */}
          <div className="flex-1 px-2 pb-2 space-y-2 min-h-[200px]">
            {getTasksByStatus(column.id).map((task) => {
              const assignee = getAssignee(task.assigneeId);

              return (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onTaskClick?.(task)}
                  className={`
                    bg-white dark:bg-zinc-700 rounded-lg p-3 shadow-sm
                    border border-zinc-200 dark:border-zinc-600
                    cursor-pointer hover:shadow-md transition-shadow
                    ${draggedTask?.id === task.id ? 'opacity-50' : ''}
                  `}
                >
                  <h4 className="text-sm font-medium text-zinc-900 dark:text-white mb-2">
                    {task.title}
                  </h4>

                  {task.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {task.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 text-xs bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <Badge variant={getPriorityVariant(task.priority)} size="sm">
                      {task.priority}
                    </Badge>

                    <div className="flex items-center gap-2">
                      {task.dueDate && (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {new Date(task.dueDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      )}
                      {assignee && (
                        <Avatar src={assignee.avatar} name={assignee.name} size="xs" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {getTasksByStatus(column.id).length === 0 && (
              <div className="flex items-center justify-center h-24 text-sm text-zinc-400 dark:text-zinc-500">
                No tasks
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
