import { useEffect, useState } from 'react';
import { useTeamStore } from '../store/teamStore';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import type { Role } from '../types';

export function TeamPage() {
  const { members, fetchMembers, inviteMember, updateMemberRole, removeMember, isLoading } = useTeamStore();

  const [search, setSearch] = useState('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('member');
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

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
    <div className="p-6 lg:p-8">
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
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
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

                <div className="flex items-center gap-4 ml-14 sm:ml-0">
                  <select
                    value={member.role}
                    onChange={(e) => updateMemberRole(member.id, e.target.value as Role)}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>

                  <Badge variant={getRoleBadgeVariant(member.role)}>
                    {member.role}
                  </Badge>

                  <button
                    onClick={() => setMemberToRemove(member.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
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
        <div className="space-y-4">
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
