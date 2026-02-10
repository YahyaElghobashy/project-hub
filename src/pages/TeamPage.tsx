import { useEffect, useState, useRef, useCallback } from 'react';
import { useTeamStore } from '../store/teamStore';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import type { Role } from '../types';

// BUG:BZ-059 - Session expires without warning after 30 minutes
// No refresh mechanism or warning dialog — user loses form data on silent redirect
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export function TeamPage() {
  const { members, fetchMembers, inviteMember, updateMemberRole, removeMember, isLoading } = useTeamStore();
  const { user: currentUser } = useAuthStore();

  const [search, setSearch] = useState('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('member');
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);

  // BUG:BZ-067 - JWT payload contains stale permissions after role change
  // Cache the current user's role from the initial JWT/session load.
  // When the user's role is updated in the admin panel, this cached value
  // is never refreshed — permissions remain stale until token expires.
  const [cachedUserRole] = useState<Role>(() => {
    const session = localStorage.getItem('projecthub_session');
    if (session) {
      try {
        const parsed = JSON.parse(session);
        return parsed.role || currentUser?.role || 'member';
      } catch {
        return currentUser?.role || 'member';
      }
    }
    return currentUser?.role || 'member';
  });

  // BUG:BZ-063 - Token refresh race condition
  // Track whether a token refresh is in progress to prevent concurrent refreshes
  const isRefreshing = useRef(false);
  const refreshPromise = useRef<Promise<boolean> | null>(null);

  // Simulate token refresh — only the first concurrent call succeeds
  const refreshToken = useCallback(async (): Promise<boolean> => {
    if (refreshPromise.current) {
      // Second concurrent refresh uses the same promise but it will fail
      // because the token was already rotated by the first refresh
      return refreshPromise.current;
    }

    refreshPromise.current = new Promise<boolean>((resolve) => {
      if (isRefreshing.current) {
        // BUG: Second refresh fails because token was already rotated
        setTimeout(() => resolve(false), 100);
        return;
      }
      isRefreshing.current = true;
      setTimeout(() => {
        isRefreshing.current = false;
        refreshPromise.current = null;
        resolve(true);
      }, 200);
    });

    return refreshPromise.current;
  }, []);

  // BUG:BZ-063 - When multiple API calls detect expired token simultaneously,
  // they each trigger refresh. First succeeds, second fails with 401.
  const fetchWithTokenRefresh = useCallback(async (url: string, options?: RequestInit) => {
    const response = await fetch(url, options);

    if (response.status === 401) {
      const refreshed = await refreshToken();
      if (!refreshed) {
        // BUG: Second concurrent call fails here
        if (typeof window !== 'undefined') {
          window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
          if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-063')) {
            window.__PERCEPTR_TEST_BUGS__.push({
              bugId: 'BZ-063',
              timestamp: Date.now(),
              description: 'Token refresh race condition — concurrent refresh failed',
              page: 'Team'
            });
          }
        }
        throw new Error('Token refresh failed');
      }
      // Retry with new token
      return fetch(url, options);
    }

    return response;
  }, [refreshToken]);

  // BUG:BZ-059 - Session timer that silently expires without any warning
  useEffect(() => {
    const sessionStart = Date.now();
    const checkInterval = setInterval(() => {
      const elapsed = Date.now() - sessionStart;
      if (elapsed >= SESSION_TIMEOUT_MS) {
        // Session expired — no warning shown, just redirect
        if (typeof window !== 'undefined') {
          window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
          if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-059')) {
            window.__PERCEPTR_TEST_BUGS__.push({
              bugId: 'BZ-059',
              timestamp: Date.now(),
              description: 'Session expired without warning — form data lost',
              page: 'Team'
            });
          }
        }
        clearInterval(checkInterval);
        window.location.href = '/login';
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkInterval);
  }, []);

  // BUG:BZ-062 - Multi-tab session conflict
  // Store current session info in localStorage; other tabs may overwrite it
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('projecthub_active_session', JSON.stringify({
        userId: currentUser.id,
        role: currentUser.role,
        name: currentUser.name,
        timestamp: Date.now(),
      }));
    }

    // Listen for storage events from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'projecthub_active_session' && e.newValue) {
        try {
          const otherSession = JSON.parse(e.newValue);
          // BUG: UI still shows current user's admin context, but localStorage
          // now has the other tab's user. API calls will use the new session token
          // from the other tab, causing a mismatch between UI and API identity.
          if (otherSession.userId !== currentUser?.id) {
            if (typeof window !== 'undefined') {
              window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
              if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-062')) {
                window.__PERCEPTR_TEST_BUGS__.push({
                  bugId: 'BZ-062',
                  timestamp: Date.now(),
                  description: 'Multi-tab session conflict — UI shows one user, API uses another',
                  page: 'Team'
                });
              }
            }
          }
        } catch {
          // Ignore parse errors
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [currentUser]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // BUG:BZ-063 - Simulate concurrent API calls on mount that may race on token refresh
  useEffect(() => {
    // Fire multiple concurrent requests that could trigger simultaneous token refreshes
    const loadTeamData = async () => {
      try {
        await Promise.all([
          fetchWithTokenRefresh('/api/users'),
          fetchWithTokenRefresh('/api/users'),
          fetchWithTokenRefresh('/api/users'),
        ]);
      } catch {
        // Some requests may fail due to race condition in token refresh
      }
    };
    loadTeamData();
  }, [fetchWithTokenRefresh]);

  const filteredMembers = members.filter((member) =>
    member.name.toLowerCase().includes(search.toLowerCase()) ||
    member.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    await inviteMember(inviteEmail, inviteRole);
    setInviteEmail('');
    setInviteRole('member');
    setIsInviteModalOpen(false);
  };

  const handleRemove = async () => {
    if (!memberToRemove) return;
    await removeMember(memberToRemove);
    setMemberToRemove(null);
  };

  // BUG:BZ-067 - Role change updates the member list but NOT the cached JWT payload
  // The permissions encoded in the session token remain stale
  const handleRoleChange = (memberId: string, newRole: Role) => {
    updateMemberRole(memberId, newRole);

    // Update UI state for the member in the list (this works correctly)
    // However, if this user IS the current user, the JWT/session payload
    // still contains the OLD role — cachedUserRole is never updated
    if (memberId === currentUser?.id) {
      // BUG: We update the member list but cachedUserRole remains stale
      // The session token still grants old permissions until it expires
      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-067')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-067',
            timestamp: Date.now(),
            description: 'JWT payload contains stale permissions — role change not reflected in token',
            page: 'Team'
          });
        }
      }
    }
  };

  // BUG:BZ-066 - Permission check only on frontend
  // Delete button hidden for viewers, but the API endpoint has no auth check
  const canManageMembers = cachedUserRole === 'admin' || cachedUserRole === 'member';

  const getRoleBadgeVariant = (role: Role) => {
    switch (role) {
      case 'admin':
        return 'info';
      case 'member':
        return 'default';
      case 'viewer':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    // BUG:BZ-059 - Session expiry wrapper
    <div className="p-6 lg:p-8" data-bug-id="BZ-059">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team Members</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Manage your team and their roles
          </p>
        </div>
        <Button onClick={() => setIsInviteModalOpen(true)}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Invite Member
        </Button>
      </div>

      {/* Search */}
      <div className="max-w-md mb-6">
        <Input
          placeholder="Search members..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
        />
      </div>

      {/* Members List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700" data-bug-id="BZ-062">
          {filteredMembers.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              No team members found
            </div>
          ) : (
            filteredMembers.map((member) => (
              <div
                key={member.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <div className="flex items-center gap-4">
                  <Avatar src={member.avatar} name={member.name} size="md" />
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{member.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{member.email}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Joined {formatDate(member.createdAt)}
                    </p>
                  </div>
                </div>

                {/* BUG:BZ-067 - Role dropdown updates member list but JWT payload keeps stale permissions */}
                <div className="flex items-center gap-4 ml-14 sm:ml-0" data-bug-id="BZ-067">
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.id, e.target.value as Role)}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>

                  <Badge variant={getRoleBadgeVariant(member.role)}>
                    {member.role}
                  </Badge>

                  {/* BUG:BZ-066 - Permission check only on frontend — delete button hidden
                      for viewers but API endpoint /api/users/:id DELETE has no auth check.
                      Anyone with the URL can still delete members via direct API call. */}
                  {canManageMembers && (
                    <button
                      data-bug-id="BZ-066"
                      onClick={() => setMemberToRemove(member.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Role Legend */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Role Permissions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Badge variant="info" className="mb-2">Admin</Badge>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Full access to all features, can manage team members and billing
            </p>
          </div>
          <div>
            <Badge variant="default" className="mb-2">Member</Badge>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Can create and edit projects, manage tasks, and collaborate
            </p>
          </div>
          <div>
            <Badge variant="warning" className="mb-2">Viewer</Badge>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Read-only access to projects and tasks, cannot make changes
            </p>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Invite Team Member"
      >
        {/* BUG:BZ-063 - Token refresh race condition wrapper */}
        <div className="space-y-4" data-bug-id="BZ-063">
          <Input
            label="Email Address"
            type="email"
            placeholder="colleague@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsInviteModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={!inviteEmail.trim()}>
              Send Invite
            </Button>
          </div>
        </div>
      </Modal>

      {/* Remove Confirmation Modal */}
      <Modal
        isOpen={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        title="Remove Member"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Are you sure you want to remove this member from the team? They will lose access to all projects.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setMemberToRemove(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleRemove}>
              Remove
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
