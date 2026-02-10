import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjectStore } from '../store/projectStore';
import { useTeamStore } from '../store/teamStore';
import { useNotificationStore } from '../store/notificationStore';
import { Button } from '../components/Button';
import { Badge, getStatusVariant, getPriorityVariant } from '../components/Badge';
import { Avatar } from '../components/Avatar';
import { Modal } from '../components/Modal';
import { Input } from '../components/Input';
import { KanbanBoard } from '../components/KanbanBoard';
import { getProjectIcon } from '../utils/iconMap';
import { ChevronLeft, Bell, Search, ClipboardCopy, Plus, Undo2, Redo2, X, Check, Settings, LayoutDashboard, Trash2, ArrowLeft } from 'lucide-react';
import type { Task } from '../types';

type Tab = 'board' | 'settings';

// BUG:BZ-109 - Fuzzy search algorithm that breaks on exact matches
// The scoring function penalizes consecutive matches too heavily,
// causing full exact words to score lower than partial matches
function fuzzyMatch(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  if (q.length === 0) return 0;

  let score = 0;
  let qIdx = 0;
  let consecutiveMatches = 0;

  for (let tIdx = 0; tIdx < t.length && qIdx < q.length; tIdx++) {
    if (t[tIdx] === q[qIdx]) {
      qIdx++;
      consecutiveMatches++;
      // BUG:BZ-109 - Consecutive match penalty increases quadratically
      // This makes longer exact matches score LOWER than short partial ones
      score += 10 - (consecutiveMatches * consecutiveMatches * 0.8);
    } else {
      consecutiveMatches = 0;
    }
  }

  // All characters must be found
  if (qIdx < q.length) return -1;

  return score;
}

// BUG:BZ-106 - Simulated version tracking for collaborative editing
interface EditVersion {
  field: string;
  value: string;
  editedBy: string;
  version: number;
  timestamp: number;
}

// BUG:BZ-019 - Autocomplete race condition: fast typing causes selection from stale result set
interface AssigneeResult {
  id: string;
  name: string;
  avatar: string;
}

// BUG:BZ-102 - Undo stack pushes every keystroke instead of logical chunks
interface UndoEntry {
  value: string;
  timestamp: number;
}

const AVAILABLE_TAGS = ['frontend', 'backend', 'design', 'bug', 'feature', 'documentation', 'testing', 'infrastructure', 'security', 'performance'];

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

  // BUG:BZ-011 - Multi-step form wizard state
  const [wizardStep, setWizardStep] = useState(1);
  const [step1Data, setStep1Data] = useState({ title: '', priority: 'medium' as Task['priority'] });
  const [step2Data, setStep2Data] = useState({ description: '', assigneeId: '' });
  const [step3Data, setStep3Data] = useState({ tags: [] as string[], dueDate: '' });

  // BUG:BZ-019 - Assignee autocomplete state
  const [assigneeQuery, setAssigneeQuery] = useState('');
  const [assigneeResults, setAssigneeResults] = useState<AssigneeResult[]>([]);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const assigneeSearchVersion = useRef(0);

  // BUG:BZ-102 - Undo/redo stack for task description
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([{ value: '', timestamp: Date.now() }]);
  const [undoIndex, setUndoIndex] = useState(0);
  const isUndoRedo = useRef(false);

  // BUG:BZ-104 - Selected tags for task creation
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  // BUG:BZ-111 - Clipboard API fails silently
  // "Copy to clipboard" button uses navigator.clipboard.writeText() without
  // permission check. In HTTP or iframe contexts, it silently fails but shows success toast.
  const [showCopiedToast, setShowCopiedToast] = useState(false);

  // BUG:BZ-113 - Resize Observer layout thrashing state
  const resizablePanelRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState<number | null>(null);

  // BUG:BZ-114 - Custom color picker state (context menu not disabled)
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState(currentProject?.color || '#6366f1');
  const PROJECT_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899'];

  // BUG:BZ-106 - Collaborative edit conflict tracking
  const editVersions = useRef<Record<string, EditVersion>>({});
  const [lastSavedBy, setLastSavedBy] = useState<string | null>(null);
  const [showConflictToast, setShowConflictToast] = useState(false);

  // BUG:BZ-107 - Notification panel state for project activity
  const { notifications, fetchNotifications, markAllAsRead, unreadCount } = useNotificationStore();
  const [showActivityPanel, setShowActivityPanel] = useState(false);
  const activityPanelRef = useRef<HTMLDivElement>(null);

  // BUG:BZ-109 - Command palette for quick task/action search
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const commandInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) {
      fetchProject(id);
      fetchTasks(id);
      fetchMembers();
    }
  }, [id, fetchProject, fetchTasks, fetchMembers]);

  // BUG:BZ-106 - Simulate collaborative editing with version tracking
  // When user edits a project field, simulate another user editing concurrently
  const handleCollaborativeEdit = useCallback((field: string, value: string) => {
    if (!currentProject || !id) return;

    const currentVersion = editVersions.current[field]?.version || 0;
    const newVersion = currentVersion + 1;

    // Record the current user's edit
    editVersions.current[field] = {
      field,
      value,
      editedBy: 'current-user',
      version: newVersion,
      timestamp: Date.now(),
    };

    // BUG:BZ-106 - Simulate a concurrent edit from another user after a short delay
    // The "other user's" edit arrives and silently overwrites without conflict warning
    if (newVersion > 1 && newVersion % 3 === 0) {
      setTimeout(() => {
        const simulatedValue = field === 'name'
          ? `${value} (updated)`
          : `${value}\n\n[Last updated by another team member]`;

        editVersions.current[field] = {
          field,
          value: simulatedValue,
          editedBy: 'other-user',
          version: newVersion + 1,
          timestamp: Date.now(),
        };

        // Silently overwrite with "other user's" edit — no conflict warning
        updateProject(id, { [field]: simulatedValue });
        setLastSavedBy('Sarah Chen');

        // BUG:BZ-106 - Log bug trigger
        if (typeof window !== 'undefined') {
          window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
          if (!window.__PERCEPTR_TEST_BUGS__.find((b: any) => b.bugId === 'BZ-106')) {
            window.__PERCEPTR_TEST_BUGS__.push({
              bugId: 'BZ-106',
              timestamp: Date.now(),
              description: 'Collaborative edit conflict not resolved - last write wins silently',
              page: 'Project Detail'
            });
          }
        }

        // Show a subtle "saved" indicator that doesn't mention the conflict
        setShowConflictToast(true);
        setTimeout(() => setShowConflictToast(false), 2000);
      }, 1500);
    }

    // Send the current user's edit
    updateProject(id, { [field]: value });
  }, [currentProject, id, updateProject]);

  // BUG:BZ-107 - Fetch and immediately mark notifications as read when activity panel opens
  useEffect(() => {
    if (showActivityPanel) {
      // BUG:BZ-107 - Fetching notifications AND marking them all as read
      // in the same action — user hasn't actually viewed/scrolled through them
      fetchNotifications().then(() => {
        // Mark all as read immediately on fetch, not when user actually views them
        markAllAsRead();

        // Log bug trigger
        if (typeof window !== 'undefined') {
          window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
          if (!window.__PERCEPTR_TEST_BUGS__.find((b: any) => b.bugId === 'BZ-107')) {
            window.__PERCEPTR_TEST_BUGS__.push({
              bugId: 'BZ-107',
              timestamp: Date.now(),
              description: 'Notifications marked as read on fetch, not on actual view',
              page: 'Project Detail'
            });
          }
        }
      });
    }
  }, [showActivityPanel, fetchNotifications, markAllAsRead]);

  // BUG:BZ-113 - ResizeObserver creates layout thrashing loop
  // The observer reads the element's width, then sets an inline style that changes the width,
  // which triggers the observer again. This creates a tight feedback loop that causes
  // continuous layout recalculations and degrades performance to ~10fps during resizing.
  useEffect(() => {
    const el = resizablePanelRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        // BUG:BZ-113 - Reading the width and immediately setting a new width
        // based on it triggers another resize observation, creating a thrashing loop.
        // The rounding ensures it oscillates: e.g. 399.5 → 400 → 400.5 → 401 → ...
        const adjustedWidth = Math.round(width / 2) * 2 + (width % 2 < 1 ? 1 : 0);
        setPanelWidth(adjustedWidth);

        if (typeof window !== 'undefined') {
          window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
          if (!window.__PERCEPTR_TEST_BUGS__.find((b: any) => b.bugId === 'BZ-113')) {
            window.__PERCEPTR_TEST_BUGS__.push({
              bugId: 'BZ-113',
              timestamp: Date.now(),
              description: 'ResizeObserver creates layout thrashing - observation triggers resize which re-triggers observer',
              page: 'Complex Interactions'
            });
          }
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [activeTab]);

  // BUG:BZ-109 - Command palette keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        // Only intercept on this page if we have focus context
        if (document.activeElement?.closest('[data-page="project-detail"]')) {
          e.preventDefault();
          setShowCommandPalette(true);
          setCommandQuery('');
        }
      }
      if (e.key === 'Escape' && showCommandPalette) {
        setShowCommandPalette(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCommandPalette]);

  // Focus command input when palette opens
  useEffect(() => {
    if (showCommandPalette && commandInputRef.current) {
      commandInputRef.current.focus();
    }
  }, [showCommandPalette]);

  // BUG:BZ-109 - Command palette items and filtered results
  const commandPaletteItems = useMemo(() => [
    { id: 'add-task', label: 'Add New Task', action: () => { openTaskModal(); setShowCommandPalette(false); }, icon: <Plus className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', action: () => { setActiveTab('settings'); setShowCommandPalette(false); }, icon: <Settings className="w-4 h-4" /> },
    { id: 'board', label: 'Board View', action: () => { setActiveTab('board'); setShowCommandPalette(false); }, icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'delete-project', label: 'Delete Project', action: () => { setIsDeleteModalOpen(true); setShowCommandPalette(false); }, icon: <Trash2 className="w-4 h-4" /> },
    { id: 'back-to-projects', label: 'Back to Projects', action: () => { navigate('/projects'); }, icon: <ArrowLeft className="w-4 h-4" /> },
    { id: 'activity', label: 'Activity', action: () => { setShowActivityPanel(true); setShowCommandPalette(false); }, icon: <Bell className="w-4 h-4" /> },
  ], [navigate]);

  // BUG:BZ-109 - Filter using the broken fuzzy match algorithm
  const filteredCommands = useMemo(() => {
    if (!commandQuery.trim()) return commandPaletteItems;

    const results = commandPaletteItems
      .map(item => ({ ...item, score: fuzzyMatch(commandQuery, item.label) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    // BUG:BZ-109 - Log when search returns empty for a query that should match
    if (results.length === 0 && commandQuery.length > 3) {
      const hasPartialMatch = commandPaletteItems.some(item =>
        item.label.toLowerCase().includes(commandQuery.toLowerCase())
      );
      if (hasPartialMatch) {
        if (typeof window !== 'undefined') {
          window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
          if (!window.__PERCEPTR_TEST_BUGS__.find((b: any) => b.bugId === 'BZ-109')) {
            window.__PERCEPTR_TEST_BUGS__.push({
              bugId: 'BZ-109',
              timestamp: Date.now(),
              description: 'Command palette fuzzy search returns no results for exact match',
              page: 'Project Detail'
            });
          }
        }
      }
    }

    return results;
  }, [commandQuery, commandPaletteItems]);

  // BUG:BZ-019 - Autocomplete search with race condition
  const searchAssignees = useCallback((query: string) => {
    assigneeSearchVersion.current += 1;
    const currentVersion = assigneeSearchVersion.current;

    // Simulate async search with variable delay
    const delay = query.length < 3 ? 300 : 100;
    setTimeout(() => {
      // BUG:BZ-019 - Don't check if version is still current before updating results
      // This means old slow results can overwrite newer fast results
      const filtered = members.filter(m =>
        m.name.toLowerCase().includes(query.toLowerCase())
      ).map(m => ({ id: m.id, name: m.name, avatar: m.avatar }));

      // Bug: We update results without checking if this is still the latest query
      // A shorter query (e.g. "ac") is slower (300ms) and overwrites faster results for "acme"
      if (currentVersion < assigneeSearchVersion.current) {
        // This check looks correct but is actually insufficient —
        // there's a timing window where both versions match
        return;
      }
      setAssigneeResults(filtered);

      // BUG:BZ-019 - Log bug trigger
      if (assigneeSearchVersion.current > 1 && currentVersion !== assigneeSearchVersion.current) {
        if (typeof window !== 'undefined') {
          window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
          if (!window.__PERCEPTR_TEST_BUGS__.find((b: any) => b.bugId === 'BZ-019')) {
            window.__PERCEPTR_TEST_BUGS__.push({
              bugId: 'BZ-019',
              timestamp: Date.now(),
              description: 'Autocomplete race condition selects wrong item',
              page: 'Project Detail'
            });
          }
        }
      }
    }, delay);
  }, [members]);

  const handleAssigneeSelect = (assignee: AssigneeResult) => {
    setStep2Data(prev => ({ ...prev, assigneeId: assignee.id }));
    setAssigneeQuery(assignee.name);
    setShowAssigneeDropdown(false);

    // BUG:BZ-019 - Log when user selects from potentially stale results
    if (assigneeSearchVersion.current > 1) {
      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find((b: any) => b.bugId === 'BZ-019')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-019',
            timestamp: Date.now(),
            description: 'Autocomplete race condition selects wrong item',
            page: 'Project Detail'
          });
        }
      }
    }
  };

  // BUG:BZ-102 - Push every keystroke to undo stack
  const handleDescriptionChange = (value: string) => {
    if (isUndoRedo.current) {
      isUndoRedo.current = false;
      return;
    }

    setStep2Data(prev => ({ ...prev, description: value }));

    // BUG:BZ-102 - Every single keystroke pushes to undo stack
    // Should be debounced or grouped by logical chunks
    const newEntry: UndoEntry = { value, timestamp: Date.now() };
    setUndoStack(prev => {
      const truncated = prev.slice(0, undoIndex + 1);
      return [...truncated, newEntry];
    });
    setUndoIndex(prev => prev + 1);

    // Log bug trigger when stack gets large
    if (undoStack.length > 50) {
      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find((b: any) => b.bugId === 'BZ-102')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-102',
            timestamp: Date.now(),
            description: 'Undo/redo stack overflow - every keystroke creates an entry',
            page: 'Project Detail'
          });
        }
      }
    }
  };

  const handleUndo = () => {
    if (undoIndex > 0) {
      isUndoRedo.current = true;
      const newIndex = undoIndex - 1;
      setUndoIndex(newIndex);
      setStep2Data(prev => ({ ...prev, description: undoStack[newIndex].value }));
    }
  };

  const handleRedo = () => {
    if (undoIndex < undoStack.length - 1) {
      isUndoRedo.current = true;
      const newIndex = undoIndex + 1;
      setUndoIndex(newIndex);
      setStep2Data(prev => ({ ...prev, description: undoStack[newIndex].value }));
    }
  };

  // BUG:BZ-102 - Handle keyboard shortcuts for undo/redo
  const handleDescriptionKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
    }
  };

  // BUG:BZ-011 - Multi-step wizard navigation
  const handleWizardNext = () => {
    if (wizardStep < 3) {
      setWizardStep(wizardStep + 1);
    }
  };

  // BUG:BZ-011 - Going back clears step 2 data from state but DOM still shows stale values
  const handleWizardBack = () => {
    if (wizardStep > 1) {
      // BUG:BZ-011 - Clear step 2 data when navigating back through it
      // This looks like an intentional "reset" but it destroys data
      // The DOM still shows the old values because React hasn't re-rendered the inputs yet
      if (wizardStep === 3) {
        setStep2Data({ description: '', assigneeId: '' });
        setAssigneeQuery('');

        if (typeof window !== 'undefined') {
          window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
          if (!window.__PERCEPTR_TEST_BUGS__.find((b: any) => b.bugId === 'BZ-011')) {
            window.__PERCEPTR_TEST_BUGS__.push({
              bugId: 'BZ-011',
              timestamp: Date.now(),
              description: 'Multi-step form loses step 2 data on back navigation',
              page: 'Project Detail'
            });
          }
        }
      }
      setWizardStep(wizardStep - 1);
    }
  };

  const handleCreateTask = async () => {
    if (!step1Data.title.trim() || !id) return;
    await createTask({
      title: step1Data.title,
      description: step2Data.description,
      priority: step1Data.priority,
      assigneeId: step2Data.assigneeId || null,
      projectId: id,
      status: 'todo',
      tags: selectedTags,
      dueDate: step3Data.dueDate || null,
    });
    // Reset wizard
    setStep1Data({ title: '', priority: 'medium' });
    setStep2Data({ description: '', assigneeId: '' });
    setStep3Data({ tags: [], dueDate: '' });
    setSelectedTags([]);
    setAssigneeQuery('');
    setWizardStep(1);
    setUndoStack([{ value: '', timestamp: Date.now() }]);
    setUndoIndex(0);
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

  // BUG:BZ-111 - Copy project link to clipboard without checking permissions
  // Uses navigator.clipboard.writeText() which can silently fail in:
  // - Non-HTTPS contexts
  // - Iframe sandboxes without clipboard-write permission
  // - When the page doesn't have focus
  // Shows "Copied!" toast regardless of success or failure
  const handleCopyProjectLink = useCallback(() => {
    const projectUrl = `${window.location.origin}/projects/${id}`;

    // BUG:BZ-111 - No permission check, no error handling
    // navigator.clipboard.writeText() returns a Promise but we don't await/catch it
    navigator.clipboard.writeText(projectUrl);

    // Always show success toast, even if the clipboard write failed silently
    setShowCopiedToast(true);
    setTimeout(() => setShowCopiedToast(false), 2000);

    // Log bug trigger
    if (typeof window !== 'undefined') {
      window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
      if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-111')) {
        window.__PERCEPTR_TEST_BUGS__.push({
          bugId: 'BZ-111',
          timestamp: Date.now(),
          description: 'Clipboard API fails silently - "Copied!" toast shown but clipboard may be unchanged',
          page: 'Complex Interactions',
        });
      }
    }
  }, [id]);

  // BUG:BZ-104 - Add tag to selection (but remove handler is broken)
  const handleTagAdd = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags(prev => [...prev, tag]);
    }
    setShowTagDropdown(false);
  };

  const openTaskModal = () => {
    setWizardStep(1);
    setStep1Data({ title: '', priority: 'medium' });
    setStep2Data({ description: '', assigneeId: '' });
    setStep3Data({ tags: [], dueDate: '' });
    setSelectedTags([]);
    setAssigneeQuery('');
    setUndoStack([{ value: '', timestamp: Date.now() }]);
    setUndoIndex(0);
    setIsTaskModalOpen(true);
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
    <div className="p-6 lg:p-8" data-page="project-detail">
      {/* BUG:BZ-106 - Conflict toast that only shows "Saved" without mentioning another user overwrote */}
      {showConflictToast && (
        <div data-bug-id="BZ-106" className="fixed top-4 right-4 z-50 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2">
          <Check className="w-4 h-4" />
          {lastSavedBy ? `Saved by ${lastSavedBy}` : 'Saved'}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/projects')}
            className="p-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                style={{ backgroundColor: `${currentProject.color}20`, color: currentProject.color }}
              >
                {getProjectIcon(currentProject.icon)}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                  {currentProject.name}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={getStatusVariant(currentProject.status)} dot>
                    {currentProject.status.replace('_', ' ')}
                  </Badge>
                  {owner && (
                    <div className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
                      <span>by</span>
                      <Avatar src={owner.avatar} name={owner.name} size="xs" />
                      <span>{owner.name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400 max-w-2xl">
              {currentProject.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* BUG:BZ-105 - Tooltip blocks click target */}
          {/* The tooltip on this button appears directly over the button text/icon area,
              so clicking dismisses the tooltip instead of triggering the button action */}
          <div data-bug-id="BZ-105" className="relative group">
            <Button variant="outline" onClick={() => {
              setShowActivityPanel(!showActivityPanel);
            }}>
              <div className="relative">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-[8px] text-white flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              Activity
            </Button>
            {/* BUG:BZ-105 - Tooltip positioned to overlap the button click area */}
            {/* The tooltip's bottom edge sits directly over the button, intercepting click events.
                On hover, user sees tooltip, moves to click, tooltip captures the mousedown instead. */}
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-0 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto bg-zinc-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap z-50 transition-opacity duration-150"
              onClick={(e) => {
                // BUG:BZ-105 - Tooltip intercepts the click, consuming it
                e.stopPropagation();

                if (typeof window !== 'undefined') {
                  window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
                  if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-105')) {
                    window.__PERCEPTR_TEST_BUGS__.push({
                      bugId: 'BZ-105',
                      timestamp: Date.now(),
                      description: 'Tooltip blocks click target - click dismisses tooltip instead of triggering button',
                      page: 'Complex Interactions',
                    });
                  }
                }
              }}
            >
              View project activity and notifications
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-2 h-2 bg-zinc-900 rotate-45" />
            </div>
          </div>
          {/* BUG:BZ-109 - Command palette trigger button */}
          <Button variant="outline" onClick={() => { setShowCommandPalette(true); setCommandQuery(''); }}>
            <Search className="w-5 h-5" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden sm:inline-flex ml-1 px-1.5 py-0.5 text-xs bg-zinc-100 dark:bg-zinc-700 rounded">⌘K</kbd>
          </Button>
          {/* BUG:BZ-111 - Copy project link button that uses clipboard API without permission check */}
          <div data-bug-id="BZ-111" className="relative">
            <Button variant="outline" onClick={handleCopyProjectLink}>
              <ClipboardCopy className="w-5 h-5" />
              Copy Link
            </Button>
            {showCopiedToast && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap z-50">
                Copied!
              </div>
            )}
          </div>
          <Button variant="outline" onClick={openTaskModal}>
            <Plus className="w-5 h-5" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-zinc-200 dark:border-zinc-700">
        <button
          onClick={() => setActiveTab('board')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'board'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          Board
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'settings'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
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
          {/* BUG:BZ-106 - Project settings with collaborative editing that silently overwrites */}
          <div data-bug-id="BZ-106" className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Project Settings
              </h2>
              {lastSavedBy && (
                <span className="text-xs text-zinc-400">
                  Last edited by {lastSavedBy}
                </span>
              )}
            </div>
            <div className="space-y-4">
              <Input
                label="Project Name"
                value={currentProject.name}
                onChange={(e) => handleCollaborativeEdit('name', e.target.value)}
              />
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Description
                </label>
                <textarea
                  value={currentProject.description}
                  onChange={(e) => handleCollaborativeEdit('description', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Status
                </label>
                <select
                  value={currentProject.status}
                  onChange={(e) => updateProject(currentProject.id, { status: e.target.value as typeof currentProject.status })}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
          </div>

          {/* BUG:BZ-113 - Resizable widget panel with layout thrashing ResizeObserver */}
          <div
            data-bug-id="BZ-113"
            ref={resizablePanelRef}
            className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 overflow-hidden resize-x"
            style={{
              resize: 'horizontal',
              minWidth: '300px',
              maxWidth: '100%',
              // BUG:BZ-113 - Setting width from the ResizeObserver callback causes the
              // observer to fire again, creating a layout thrashing feedback loop
              ...(panelWidth !== null ? { width: `${panelWidth}px` } : {}),
            }}
          >
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              Widget Layout
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
              Drag the right edge to resize this panel. Widget cards will adjust responsively.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {['Tasks Overview', 'Sprint Progress', 'Team Velocity', 'Burn Down'].map((widget) => (
                <div key={widget} className="p-3 bg-zinc-50 dark:bg-zinc-700/30 rounded-lg border border-zinc-100 dark:border-zinc-600">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{widget}</p>
                  <p className="text-xs text-zinc-400 mt-1">Enabled</p>
                </div>
              ))}
            </div>
            {panelWidth !== null && (
              <p className="text-xs text-zinc-400 mt-3">Panel width: {panelWidth}px</p>
            )}
          </div>

          {/* BUG:BZ-114 - Custom color picker where right-click shows browser context menu */}
          <div
            data-bug-id="BZ-114"
            className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6"
          >
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              Project Color
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
              Choose a color for this project. Right-click a swatch for more options.
            </p>
            <div className="flex flex-wrap gap-3">
              {PROJECT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`w-10 h-10 rounded-lg border-2 transition-all hover:scale-110 ${
                    customColor === color
                      ? 'border-zinc-900 dark:border-white ring-2 ring-offset-2 ring-blue-500'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    setCustomColor(color);
                    if (id) updateProject(id, { color });
                  }}
                  // BUG:BZ-114 - Missing onContextMenu={e => e.preventDefault()}
                  // Right-clicking on these color swatches shows the browser's default context menu
                  // instead of being suppressed or showing a custom menu.
                  // The UI text says "Right-click for more options" but no custom menu is implemented.
                  onContextMenu={() => {
                    // BUG:BZ-114 - Should preventDefault() here to suppress browser context menu
                    // and show a custom context menu instead. Instead, does nothing,
                    // so both the browser default menu appears.

                    if (typeof window !== 'undefined') {
                      window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
                      if (!window.__PERCEPTR_TEST_BUGS__.find((b: any) => b.bugId === 'BZ-114')) {
                        window.__PERCEPTR_TEST_BUGS__.push({
                          bugId: 'BZ-114',
                          timestamp: Date.now(),
                          description: 'Context menu not disabled on custom UI - browser default context menu shown instead of custom menu',
                          page: 'Complex Interactions'
                        });
                      }
                    }
                  }}
                >
                  {customColor === color && (
                    <Check className="w-5 h-5 mx-auto text-white drop-shadow" strokeWidth={3} />
                  )}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="w-6 h-6 rounded" style={{ backgroundColor: customColor }} />
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{customColor}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-800 rounded-lg border border-red-200 dark:border-red-900 p-6">
            <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
              Danger Zone
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Once you delete a project, there is no going back. Please be certain.
            </p>
            <Button variant="danger" onClick={() => setIsDeleteModalOpen(true)}>
              Delete Project
            </Button>
          </div>
        </div>
      )}

      {/* Create Task Modal - Multi-step wizard */}
      <Modal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        title="Create New Task"
        size="lg"
      >
        {/* BUG:BZ-011 - Multi-step wizard form that loses step 2 data on back navigation */}
        <div data-bug-id="BZ-011">
          {/* Progress indicator */}
          <div className="flex items-center justify-between mb-6">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step <= wizardStep
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-200 dark:bg-zinc-600 text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  {step}
                </div>
                <span className={`ml-2 text-sm ${
                  step <= wizardStep ? 'text-blue-600 font-medium' : 'text-zinc-400'
                }`}>
                  {step === 1 ? 'Basic Info' : step === 2 ? 'Details' : 'Tags & Date'}
                </span>
                {step < 3 && (
                  <div className={`w-12 h-0.5 mx-2 ${
                    step < wizardStep ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-600'
                  }`} />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Basic Info */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <Input
                label="Task Title"
                placeholder="Enter task title"
                value={step1Data.title}
                onChange={(e) => setStep1Data({ ...step1Data, title: e.target.value })}
              />
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Priority
                </label>
                <select
                  value={step1Data.priority}
                  onChange={(e) => setStep1Data({ ...step1Data, priority: e.target.value as Task['priority'] })}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 2: Details (Description + Assignee) */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              {/* BUG:BZ-102 - Description with per-keystroke undo stack */}
              <div data-bug-id="BZ-102">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Description
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={undoIndex <= 0}
                      className="p-1 text-zinc-400 hover:text-zinc-600 disabled:opacity-30 rounded"
                      title="Undo (Ctrl+Z)"
                    >
                      <Undo2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleRedo}
                      disabled={undoIndex >= undoStack.length - 1}
                      className="p-1 text-zinc-400 hover:text-zinc-600 disabled:opacity-30 rounded"
                      title="Redo (Ctrl+Shift+Z)"
                    >
                      <Redo2 className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-zinc-400 ml-1">
                      {undoIndex}/{undoStack.length - 1}
                    </span>
                  </div>
                </div>
                <textarea
                  placeholder="Enter task description"
                  value={step2Data.description}
                  onChange={(e) => handleDescriptionChange(e.target.value)}
                  onKeyDown={handleDescriptionKeyDown}
                  rows={4}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* BUG:BZ-019 - Assignee autocomplete with race condition */}
              <div data-bug-id="BZ-019" className="relative">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Assignee
                </label>
                <Input
                  placeholder="Search for a team member..."
                  value={assigneeQuery}
                  onChange={(e) => {
                    const query = e.target.value;
                    setAssigneeQuery(query);
                    if (query.length > 0) {
                      searchAssignees(query);
                      setShowAssigneeDropdown(true);
                    } else {
                      setAssigneeResults([]);
                      setShowAssigneeDropdown(false);
                      setStep2Data(prev => ({ ...prev, assigneeId: '' }));
                    }
                  }}
                  onFocus={() => {
                    if (assigneeQuery.length > 0 && assigneeResults.length > 0) {
                      setShowAssigneeDropdown(true);
                    }
                  }}
                  onBlur={() => {
                    // Delay to allow click on dropdown item
                    setTimeout(() => setShowAssigneeDropdown(false), 200);
                  }}
                />
                {showAssigneeDropdown && assigneeResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {assigneeResults.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-600 text-sm"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleAssigneeSelect(result);
                        }}
                      >
                        <Avatar src={result.avatar} name={result.name} size="xs" />
                        <span className="text-zinc-900 dark:text-white">{result.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Tags & Due Date */}
          {wizardStep === 3 && (
            <div className="space-y-4">
              {/* BUG:BZ-104 - Multi-select tag dropdown where remove (X) button has no handler */}
              <div data-bug-id="BZ-104">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Tags
                </label>
                {/* Selected tags display */}
                {selectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full"
                      >
                        {tag}
                        {/* BUG:BZ-104 - Remove button exists but onClick handler does nothing */}
                        <button
                          type="button"
                          className="ml-0.5 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200"
                          onClick={() => {
                            // BUG:BZ-104 - Handler looks like it should remove the tag but doesn't
                            // The console.log makes it look like it's "doing something"
                            console.debug('tag:remove', tag);

                            if (typeof window !== 'undefined') {
                              window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
                              if (!window.__PERCEPTR_TEST_BUGS__.find((b: any) => b.bugId === 'BZ-104')) {
                                window.__PERCEPTR_TEST_BUGS__.push({
                                  bugId: 'BZ-104',
                                  timestamp: Date.now(),
                                  description: 'Multi-select dropdown cannot deselect - remove button has no effect',
                                  page: 'Project Detail'
                                });
                              }
                            }
                          }}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTagDropdown(!showTagDropdown)}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {selectedTags.length === 0 ? 'Select tags...' : `${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''} selected`}
                  </button>
                  {showTagDropdown && (
                    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {AVAILABLE_TAGS.filter(t => !selectedTags.includes(t)).map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-600 text-sm text-zinc-900 dark:text-white"
                          onClick={() => handleTagAdd(tag)}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Input
                label="Due Date"
                type="date"
                value={step3Data.dueDate}
                onChange={(e) => setStep3Data({ ...step3Data, dueDate: e.target.value })}
              />
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between pt-6">
            <div>
              {wizardStep > 1 && (
                <Button variant="outline" onClick={handleWizardBack}>
                  Back
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setIsTaskModalOpen(false)}>
                Cancel
              </Button>
              {wizardStep < 3 ? (
                <Button onClick={handleWizardNext} disabled={wizardStep === 1 && !step1Data.title.trim()}>
                  Next
                </Button>
              ) : (
                <Button onClick={handleCreateTask} disabled={!step1Data.title.trim()}>
                  Create Task
                </Button>
              )}
            </div>
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
            <p className="text-zinc-600 dark:text-zinc-400">{selectedTask.description}</p>
            {selectedTask.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedTask.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 text-xs bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {selectedTask.dueDate && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
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
          <p className="text-zinc-600 dark:text-zinc-400">
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

      {/* BUG:BZ-107 - Activity panel that marks all notifications as read on open, not on view */}
      {showActivityPanel && (
        <div className="fixed inset-0 z-40" onClick={() => setShowActivityPanel(false)}>
          <div className="absolute inset-0 bg-black/20" />
          <div
            data-bug-id="BZ-107"
            ref={activityPanelRef}
            className="absolute right-0 top-0 h-full w-96 bg-white dark:bg-zinc-800 shadow-xl border-l border-zinc-200 dark:border-zinc-700 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Project Activity</h3>
              <button
                onClick={() => setShowActivityPanel(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {notifications.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
                  No recent activity
                </p>
              ) : (
                notifications
                  .filter(n => n.linkTo?.includes(id || ''))
                  .concat(notifications.filter(n => !n.linkTo?.includes(id || '')).slice(0, 5))
                  .slice(0, 10)
                  .map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 rounded-lg text-sm ${
                        notification.read
                          ? 'bg-zinc-50 dark:bg-zinc-700/50'
                          : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800'
                      }`}
                    >
                      <p className="font-medium text-zinc-900 dark:text-white">
                        {notification.title}
                      </p>
                      <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* BUG:BZ-109 - Command palette with broken fuzzy matching */}
      {showCommandPalette && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-24"
          onClick={() => setShowCommandPalette(false)}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            data-bug-id="BZ-109"
            className="relative w-full max-w-lg bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
              <Search className="w-5 h-5 text-zinc-400" />
              <input
                ref={commandInputRef}
                type="text"
                placeholder="Search actions..."
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setShowCommandPalette(false);
                  if (e.key === 'Enter' && filteredCommands.length > 0) {
                    filteredCommands[0].action();
                  }
                }}
                className="flex-1 bg-transparent text-zinc-900 dark:text-white text-sm placeholder-zinc-400 focus:outline-none"
              />
              <kbd className="px-1.5 py-0.5 text-xs bg-zinc-100 dark:bg-zinc-700 text-zinc-500 rounded">ESC</kbd>
            </div>
            <div className="max-h-64 overflow-y-auto py-2">
              {filteredCommands.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-zinc-500">
                  No results found
                </div>
              ) : (
                filteredCommands.map((item) => (
                  <button
                    key={item.id}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 text-sm"
                    onClick={item.action}
                  >
                    <span className="w-6 flex items-center justify-center">{item.icon}</span>
                    <span className="text-zinc-900 dark:text-white">{item.label}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
