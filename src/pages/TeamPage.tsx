import { useEffect, useState, useRef, useCallback } from 'react';
import { useTeamStore } from '../store/teamStore';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { UserPlus, Search, Trash2 } from 'lucide-react';
import type { Role } from '../types';

// BUG:BZ-068 - Invite link works after revocation due to cached validation
// The invite token validation uses a cache layer that doesn't get cleared when
// an invite is revoked. Cached approvals persist for up to 24 hours.
const INVITE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedInviteValidation {
  token: string;
  email: string;
  validatedAt: number;
  isValid: boolean;
}

// Simulates a cached validation layer — entries remain valid even after
// the underlying token is deleted from the database
const inviteValidationCache: Map<string, CachedInviteValidation> = new Map();

function validateInviteToken(token: string): { valid: boolean; cached: boolean } {
  // Check cache first (bug: cache is not invalidated on revocation)
  const cached = inviteValidationCache.get(token);
  if (cached && (Date.now() - cached.validatedAt) < INVITE_CACHE_TTL_MS) {
    return { valid: cached.isValid, cached: true };
  }

  // If not in cache, check "database" (in a real app, this would be an API call)
  // After revocation, the token won't be in the DB, so this returns false
  // But cached entries still return true above
  return { valid: false, cached: false };
}

// BUG:BZ-069 - Password change doesn't invalidate other sessions
// When user changes password, only the current session token is refreshed.
// Other active sessions (on other devices/browsers) remain valid because
// the session invalidation only clears the local token, not server-side sessions.
interface ActiveSession {
  sessionId: string;
  device: string;
  lastActive: string;
  isCurrent: boolean;
}

function generateSessionId(): string {
  return `sess_${Math.random().toString(36).substr(2, 12)}`;
}

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

  // BZ-068 — Invite link management state
  const [inviteLinks, setInviteLinks] = useState<Array<{ token: string; email: string; createdAt: number; revoked: boolean }>>([]);
  const [showInviteLinks, setShowInviteLinks] = useState(false);

  // BZ-069 — Password change and session management state
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);
  const [activeSessions] = useState<ActiveSession[]>(() => [
    { sessionId: generateSessionId(), device: 'Chrome on macOS (this device)', lastActive: new Date().toISOString(), isCurrent: true },
    { sessionId: generateSessionId(), device: 'Safari on iPhone', lastActive: new Date(Date.now() - 3600000).toISOString(), isCurrent: false },
    { sessionId: generateSessionId(), device: 'Firefox on Windows', lastActive: new Date(Date.now() - 7200000).toISOString(), isCurrent: false },
  ]);

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

  // BUG:BZ-068 - Generate invite link and cache the validation result
  const handleGenerateInviteLink = useCallback((email: string) => {
    const token = `inv_${Math.random().toString(36).substr(2, 16)}`;
    const link = { token, email, createdAt: Date.now(), revoked: false };
    setInviteLinks(prev => [...prev, link]);

    // Cache the token validation (this is the bug — cache isn't cleared on revoke)
    inviteValidationCache.set(token, {
      token,
      email,
      validatedAt: Date.now(),
      isValid: true,
    });

    return token;
  }, []);

  // BUG:BZ-068 - Revoke invite link: marks as revoked in DB but doesn't clear cache
  const handleRevokeInvite = useCallback((token: string) => {
    setInviteLinks(prev =>
      prev.map(link =>
        link.token === token ? { ...link, revoked: true } : link
      )
    );

    // BUG: We mark the invite as revoked in the "database" (local state),
    // but we do NOT remove it from inviteValidationCache.
    // The cached validation still returns { valid: true } for up to 24 hours.
    // In production, this would be: DELETE FROM invites WHERE token = ?
    // But the Redis/memcached layer still has the cached approval.

    // Verify the bug: the cached validation still says valid
    const result = validateInviteToken(token);
    if (result.valid && result.cached) {
      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-068')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-068',
            timestamp: Date.now(),
            description: 'Revoked invite link still valid due to cached validation layer',
            page: 'Team'
          });
        }
      }
    }
  }, []);

  // BUG:BZ-069 - Password change handler that doesn't invalidate other sessions
  const handlePasswordChange = useCallback(async () => {
    if (!currentPassword || !newPassword) return;

    // Simulate API call to change password
    try {
      await new Promise(resolve => setTimeout(resolve, 500));

      // "Successfully" change password — but only refresh current session token.
      // BUG: We do NOT invalidate other active sessions on the server.
      // In a secure implementation, changing password should revoke all other
      // session tokens, forcing re-authentication on other devices.
      const currentSession = activeSessions.find(s => s.isCurrent);
      if (currentSession) {
        // Only update the current session's token
        localStorage.setItem('projecthub_session_token', `new_token_${Date.now()}`);
      }

      // BUG: Other sessions (activeSessions where isCurrent === false)
      // remain completely valid. No server-side session invalidation occurs.
      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-069')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-069',
            timestamp: Date.now(),
            description: 'Password change did not invalidate other active sessions',
            page: 'Team'
          });
        }
      }

      setPasswordChangeSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setPasswordChangeSuccess(false), 3000);
    } catch {
      // Handle error silently
    }
  }, [currentPassword, newPassword, activeSessions]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;

    // Generate an invite link token when inviting
    handleGenerateInviteLink(inviteEmail);

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
          <UserPlus className="w-5 h-5" />
          Invite Member
        </Button>
      </div>

      {/* Search */}
      <div className="max-w-md mb-6">
        <Input
          placeholder="Search members..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="w-5 h-5" />}
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
                      <Trash2 className="w-5 h-5" />
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

      {/* BUG:BZ-068 - Invite Links Management — cached validation persists after revocation */}
      <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700" data-bug-id="BZ-068">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Pending Invite Links</h3>
          <button
            onClick={() => setShowInviteLinks(!showInviteLinks)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {showInviteLinks ? 'Hide' : 'Show'} ({inviteLinks.length})
          </button>
        </div>
        {showInviteLinks && (
          <div className="space-y-2">
            {inviteLinks.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No invite links generated yet. Invite a member to create one.
              </p>
            ) : (
              inviteLinks.map((link) => (
                <div
                  key={link.token}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {link.email}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                      /join?token={link.token}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {link.revoked ? (
                      <Badge variant="error">Revoked</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                    {!link.revoked && (
                      <button
                        onClick={() => handleRevokeInvite(link.token)}
                        className="text-xs text-red-600 dark:text-red-400 hover:underline"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* BUG:BZ-069 - Security section — password change doesn't invalidate other sessions */}
      <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700" data-bug-id="BZ-069">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Security</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Manage your password and active sessions
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowSecurityModal(true)}>
            Change Password
          </Button>
        </div>
        <div className="mt-3">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Active Sessions</p>
          <div className="space-y-2">
            {activeSessions.map((session) => (
              <div key={session.sessionId} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${session.isCurrent ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="text-gray-700 dark:text-gray-300">{session.device}</span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {session.isCurrent ? 'Current' : formatDate(session.lastActive)}
                </span>
              </div>
            ))}
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

      {/* BUG:BZ-069 - Password change modal — doesn't invalidate other sessions */}
      <Modal
        isOpen={showSecurityModal}
        onClose={() => {
          setShowSecurityModal(false);
          setCurrentPassword('');
          setNewPassword('');
          setPasswordChangeSuccess(false);
        }}
        title="Change Password"
        size="sm"
      >
        <div className="space-y-4">
          {passwordChangeSuccess && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-sm">
              Password changed successfully. You may need to sign in again on other devices.
            </div>
          )}
          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
          />
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            For security, other active sessions should be signed out after changing your password.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowSecurityModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handlePasswordChange}
              disabled={!currentPassword || !newPassword}
            >
              Update Password
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
