import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { Avatar } from './Avatar';
import { Menu, ChevronsRight, ChevronsLeft, Search, Bell, ChevronDown, Settings, LogOut } from 'lucide-react';

interface TopBarProps {
  onMenuClick: () => void;
  isSidebarCollapsed: boolean;
}

export function TopBar({ onMenuClick, isSidebarCollapsed }: TopBarProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { unreadCount, togglePanel } = useNotificationStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // BUG:BZ-075 - Fixed header is 64px tall but anchor scroll doesn't offset for it
  return (
    <header data-bug-id="BZ-075" className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        {/* BUG:BZ-078 - Responsive breakpoint gap: hamburger hidden at md (768px) but
            sidebar only shows at lg (1024px), leaving a gap at 768-1023px where
            neither the hamburger nor the sidebar is visible */}
        <button
          onClick={onMenuClick}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 md:hidden"
        >
          <Menu className="w-6 h-6" />
        </button>

        <button
          onClick={onMenuClick}
          className="hidden lg:flex p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isSidebarCollapsed ? (
            <ChevronsRight className="w-5 h-5" />
          ) : (
            <ChevronsLeft className="w-5 h-5" />
          )}
        </button>

        <button
          onClick={() => navigate('/search')}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <Search className="w-4 h-4" />
          <span>Search...</span>
          <kbd className="hidden md:inline-flex px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 rounded">⌘K</kbd>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={togglePanel}
          className="relative p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <Bell className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 text-xs font-medium text-white bg-red-500 rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <div className="relative group">
          <button className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <Avatar src={user?.avatar} name={user?.name} size="sm" />
            <span className="hidden md:block text-sm font-medium text-gray-700 dark:text-gray-200">
              {user?.name}
            </span>
            <ChevronDown className="hidden md:block w-4 h-4 text-gray-500" />
          </button>

          <div className="absolute right-0 mt-2 w-48 py-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
            </div>
            <button
              onClick={() => navigate('/settings')}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
