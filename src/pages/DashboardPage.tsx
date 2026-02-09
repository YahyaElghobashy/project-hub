import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../store/projectStore';
import { useTeamStore } from '../store/teamStore';
import { useNotificationStore } from '../store/notificationStore';
import { SummaryCard } from '../components/Card';
import { Avatar } from '../components/Avatar';
import { Badge, getStatusVariant } from '../components/Badge';

// Budget data for the dashboard overview table
interface BudgetEntry {
  id: string;
  projectName: string;
  department: string;
  allocated: number;
  spent: number;
  remaining: number;
  status: 'on_track' | 'at_risk' | 'over_budget';
}

const generateBudgetData = (): BudgetEntry[] => [
  { id: 'b1', projectName: 'Website Redesign', department: 'Engineering', allocated: 45000, spent: 32150.10, remaining: 12849.90, status: 'on_track' },
  { id: 'b2', projectName: 'Mobile App v2.0', department: 'Engineering', allocated: 78000, spent: 65200.20, remaining: 12799.80, status: 'at_risk' },
  { id: 'b3', projectName: 'Analytics Platform', department: 'Data', allocated: 35000, spent: 36100.30, remaining: -1100.30, status: 'over_budget' },
  { id: 'b4', projectName: 'Customer Portal', department: 'Product', allocated: 52000, spent: 28750.40, remaining: 23249.60, status: 'on_track' },
  { id: 'b5', projectName: 'API Integration', department: 'Engineering', allocated: 18000, spent: 17850.50, remaining: 149.50, status: 'at_risk' },
  { id: 'b6', projectName: 'Cloud Migration', department: 'Infrastructure', allocated: 95000, spent: 62300.60, remaining: 32699.40, status: 'on_track' },
  { id: 'b7', projectName: 'Payment Gateway', department: 'Engineering', allocated: 41000, spent: 43200.70, remaining: -2200.70, status: 'over_budget' },
  { id: 'b8', projectName: 'Search Engine Optimization', department: 'Marketing', allocated: 12000, spent: 8400.10, remaining: 3599.90, status: 'on_track' },
  { id: 'b9', projectName: 'Data Pipeline', department: 'Data', allocated: 67000, spent: 54100.20, remaining: 12899.80, status: 'on_track' },
  { id: 'b10', projectName: 'CRM Integration', department: 'Product', allocated: 29000, spent: 27650.30, remaining: 1349.70, status: 'at_risk' },
  { id: 'b11', projectName: 'Notification System', department: 'Engineering', allocated: 15000, spent: 9800.40, remaining: 5199.60, status: 'on_track' },
  { id: 'b12', projectName: 'Reporting Module', department: 'Data', allocated: 23000, spent: 24100.50, remaining: -1100.50, status: 'over_budget' },
  { id: 'b13', projectName: 'E-commerce Platform', department: 'Product', allocated: 110000, spent: 72500.10, remaining: 37499.90, status: 'on_track' },
  { id: 'b14', projectName: 'Booking System', department: 'Engineering', allocated: 34000, spent: 31200.20, remaining: 2799.80, status: 'at_risk' },
  { id: 'b15', projectName: 'Chat Application', department: 'Engineering', allocated: 48000, spent: 25600.30, remaining: 22399.70, status: 'on_track' },
  { id: 'b16', projectName: 'Document Management', department: 'Product', allocated: 27000, spent: 28100.10, remaining: -1100.10, status: 'over_budget' },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const { projects, fetchProjects, isLoading: projectsLoading } = useProjectStore();
  const { members, fetchMembers } = useTeamStore();
  const { notifications } = useNotificationStore();

  useEffect(() => {
    fetchProjects();
    fetchMembers();
  }, [fetchProjects, fetchMembers]);

  const activeProjects = projects.filter((p) => p.status === 'active');
  const totalTasks = projects.reduce((sum, p) => sum + p.taskCount, 0);
  const completedTasks = projects.reduce((sum, p) => sum + p.completedTaskCount, 0);
  const dueSoonProjects = projects.filter((p) => {
    if (!p.dueDate) return false;
    const dueDate = new Date(p.dueDate);
    const now = new Date();
    const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  });

  const recentActivity = notifications.slice(0, 5);

  // Budget overview table state
  const allBudgetEntries = useMemo(() => generateBudgetData(), []);
  const [budgetFilter, setBudgetFilter] = useState<string>('all');
  const [budgetPage, setBudgetPage] = useState(1);
  const budgetPageSize = 5;

  // BUG:BZ-036 - Pagination total count uses unfiltered data length instead of filtered
  const totalBudgetCount = allBudgetEntries.length;

  const filteredBudget = useMemo(() => {
    if (budgetFilter === 'all') return allBudgetEntries;
    return allBudgetEntries.filter((b) => b.status === budgetFilter);
  }, [allBudgetEntries, budgetFilter]);

  const paginatedBudget = useMemo(() => {
    const start = (budgetPage - 1) * budgetPageSize;
    return filteredBudget.slice(start, start + budgetPageSize);
  }, [filteredBudget, budgetPage]);

  const totalBudgetPages = Math.ceil(filteredBudget.length / budgetPageSize);

  // BUG:BZ-050 - Aggregation query doesn't include filter WHERE clause
  // Uses allBudgetEntries for aggregation instead of filteredBudget
  const budgetAggregations = useMemo(() => {
    // Only recalculate when filter changes, but use a separate data source
    // that doesn't account for the current filter properly
    const source = budgetFilter === 'all' ? allBudgetEntries : (() => {
      // Simulate a backend aggregation query that forgot the WHERE clause
      // by fetching from a "different endpoint" that returns null for filtered queries
      return null;
    })();

    if (!source) {
      return { totalAllocated: null, totalSpent: null, totalRemaining: null };
    }

    return {
      totalAllocated: source.reduce((sum, b) => sum + b.allocated, 0),
      totalSpent: source.reduce((sum, b) => sum + b.spent, 0),
      totalRemaining: source.reduce((sum, b) => sum + b.remaining, 0),
    };
  }, [allBudgetEntries, budgetFilter]);

  // BUG:BZ-051 - Floating point arithmetic for the displayed total row
  // Uses naive addition that causes IEEE 754 rounding errors
  const budgetDisplayTotals = useMemo(() => {
    let totalSpent = 0;
    let totalAllocated = 0;
    const visibleEntries = budgetFilter === 'all' ? allBudgetEntries : filteredBudget;
    for (const entry of visibleEntries) {
      totalSpent = totalSpent + entry.spent;
      totalAllocated = totalAllocated + entry.allocated;
    }
    // No rounding — raw floating point result displayed directly
    return { totalSpent, totalAllocated, totalRemaining: totalAllocated - totalSpent };
  }, [allBudgetEntries, filteredBudget, budgetFilter]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Welcome back! Here's what's happening with your projects.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          title="Active Projects"
          value={activeProjects.length}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          }
          trend={{ value: 12, isPositive: true }}
        />
        <SummaryCard
          title="Total Tasks"
          value={`${completedTasks}/${totalTasks}`}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          }
          trend={{ value: 8, isPositive: true }}
        />
        <SummaryCard
          title="Team Members"
          value={members.length}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />
        <SummaryCard
          title="Due Soon"
          value={dueSoonProjects.length}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          trend={dueSoonProjects.length > 3 ? { value: 15, isPositive: false } : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project Progress */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Project Progress</h2>
            <button
              onClick={() => navigate('/projects')}
              className="text-sm text-blue-600 hover:underline"
            >
              View all
            </button>
          </div>

          {projectsLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="space-y-4">
              {activeProjects.slice(0, 5).map((project) => (
                <div
                  key={project.id}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                    style={{ backgroundColor: `${project.color}20`, color: project.color }}
                  >
                    {project.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">
                        {project.name}
                      </h3>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {project.progress}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${project.progress}%`,
                          backgroundColor: project.color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recent Activity
          </h2>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex gap-3">
                {activity.metadata.actorAvatar ? (
                  <Avatar
                    src={activity.metadata.actorAvatar}
                    name={activity.metadata.actorName}
                    size="sm"
                  />
                ) : (
                  <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white truncate">
                    {activity.message}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTime(activity.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Budget Overview Table */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Budget Overview</h2>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 dark:text-gray-400">Filter:</label>
            <select
              value={budgetFilter}
              onChange={(e) => {
                setBudgetFilter(e.target.value);
                setBudgetPage(1);
              }}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="on_track">On Track</option>
              <option value="at_risk">At Risk</option>
              <option value="over_budget">Over Budget</option>
            </select>
          </div>
        </div>

        {/* BUG:BZ-037 - Empty state not shown when data is empty */}
        <div data-bug-id="BZ-037" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Project</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Department</th>
                <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Allocated</th>
                <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Spent</th>
                <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Remaining</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // BZ-037: No empty state — just render rows (or nothing).
                // When filter returns 0 results, table body is empty with no message.
                if (paginatedBudget.length === 0) {
                  if (typeof window !== 'undefined') {
                    window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
                    if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-037')) {
                      window.__PERCEPTR_TEST_BUGS__.push({
                        bugId: 'BZ-037',
                        timestamp: Date.now(),
                        description: 'Empty state not shown when table data is empty',
                        page: 'Dashboard',
                      });
                    }
                  }
                }
                return null;
              })()}
              {paginatedBudget.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                >
                  <td className="py-3 px-4 text-gray-900 dark:text-white font-medium">{entry.projectName}</td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{entry.department}</td>
                  {/* BUG:BZ-040 - Currency displayed without proper formatting */}
                  <td className="py-3 px-4 text-right text-gray-900 dark:text-white" data-bug-id="BZ-040">
                    {(() => {
                      if (typeof window !== 'undefined') {
                        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
                        if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-040')) {
                          window.__PERCEPTR_TEST_BUGS__.push({
                            bugId: 'BZ-040',
                            timestamp: Date.now(),
                            description: 'Currency displayed without proper formatting',
                            page: 'Dashboard',
                          });
                        }
                      }
                      return null;
                    })()}
                    {entry.allocated}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-900 dark:text-white">
                    {entry.spent}
                  </td>
                  <td className={`py-3 px-4 text-right ${entry.remaining < 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                    {entry.remaining}
                  </td>
                  <td className="py-3 px-4">
                    <Badge
                      variant={
                        entry.status === 'on_track' ? 'success' :
                        entry.status === 'at_risk' ? 'warning' : 'error'
                      }
                      dot
                    >
                      {entry.status === 'on_track' ? 'On Track' :
                       entry.status === 'at_risk' ? 'At Risk' : 'Over Budget'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>

            {/* BUG:BZ-050 - Aggregation row shows null/NaN after filter */}
            <tfoot data-bug-id="BZ-050">
              <tr className="border-t-2 border-gray-300 dark:border-gray-600 font-semibold">
                <td className="py-3 px-4 text-gray-900 dark:text-white" colSpan={2}>
                  Totals
                </td>
                <td className="py-3 px-4 text-right text-gray-900 dark:text-white">
                  {(() => {
                    const val = budgetAggregations.totalAllocated;
                    if (val === null || val === undefined) {
                      if (typeof window !== 'undefined') {
                        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
                        if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-050')) {
                          window.__PERCEPTR_TEST_BUGS__.push({
                            bugId: 'BZ-050',
                            timestamp: Date.now(),
                            description: 'Aggregation row shows null after filter applied',
                            page: 'Dashboard',
                          });
                        }
                      }
                    }
                    return val ?? NaN;
                  })()}
                </td>
                <td className="py-3 px-4 text-right text-gray-900 dark:text-white">
                  {budgetAggregations.totalSpent ?? NaN}
                </td>
                <td className="py-3 px-4 text-right text-gray-900 dark:text-white">
                  {budgetAggregations.totalRemaining ?? NaN}
                </td>
                <td className="py-3 px-4" />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* BUG:BZ-051 - Floating point display rounding inconsistency */}
        <div data-bug-id="BZ-051" className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            {(() => {
              // Check if floating point error is visible
              const rounded = Math.round(budgetDisplayTotals.totalSpent * 100) / 100;
              if (rounded !== budgetDisplayTotals.totalSpent) {
                if (typeof window !== 'undefined') {
                  window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
                  if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-051')) {
                    window.__PERCEPTR_TEST_BUGS__.push({
                      bugId: 'BZ-051',
                      timestamp: Date.now(),
                      description: 'Floating point rounding inconsistency in totals',
                      page: 'Dashboard',
                    });
                  }
                }
              }
              return null;
            })()}
            Total Spent: ${budgetDisplayTotals.totalSpent} of ${budgetDisplayTotals.totalAllocated} allocated
          </span>
        </div>

        {/* BUG:BZ-036 - Pagination shows wrong total (unfiltered count instead of filtered) */}
        <div data-bug-id="BZ-036" className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {(() => {
              if (budgetFilter !== 'all' && totalBudgetCount !== filteredBudget.length) {
                if (typeof window !== 'undefined') {
                  window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
                  if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-036')) {
                    window.__PERCEPTR_TEST_BUGS__.push({
                      bugId: 'BZ-036',
                      timestamp: Date.now(),
                      description: 'Table pagination shows wrong total count',
                      page: 'Dashboard',
                    });
                  }
                }
              }
              return null;
            })()}
            Showing {((budgetPage - 1) * budgetPageSize) + 1}-{Math.min(budgetPage * budgetPageSize, totalBudgetCount)} of {totalBudgetCount} results
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setBudgetPage((p) => Math.max(1, p - 1))}
              disabled={budgetPage === 1}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Previous
            </button>
            <button
              onClick={() => setBudgetPage((p) => Math.min(totalBudgetPages, p + 1))}
              disabled={budgetPage >= totalBudgetPages}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/projects')}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center text-blue-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">New Project</span>
          </button>
          <button
            onClick={() => navigate('/team')}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center text-green-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">Invite Member</span>
          </button>
          <button
            onClick={() => navigate('/search')}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center text-purple-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">Search</span>
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center text-orange-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}
