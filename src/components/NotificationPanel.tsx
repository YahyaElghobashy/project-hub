import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../store/notificationStore';
import { Avatar } from './Avatar';
import { X, Bell } from 'lucide-react';

export function NotificationPanel() {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const {
    notifications,
    isPanelOpen,
    closePanel,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotificationStore();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closePanel();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closePanel();
      }
    };

    if (isPanelOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isPanelOpen, closePanel]);

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    markAsRead(notification.id);
    if (notification.linkTo) {
      navigate(notification.linkTo);
    }
    closePanel();
  };

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
    <>
      {/* Overlay */}
      <div
        className={`
          fixed inset-0 bg-black/20 z-40 transition-opacity
          ${isPanelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`
          fixed top-0 right-0 h-full w-full sm:w-96
          bg-white dark:bg-zinc-800
          shadow-md z-50
          transform transition-transform duration-150 ease-in-out
          ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Notifications</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={markAllAsRead}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Mark all read
            </button>
            <button
              onClick={closePanel}
              className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="overflow-y-auto h-[calc(100%-64px)]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="w-12 h-12 text-zinc-300 dark:text-zinc-600" />
              <p className="mt-4 text-zinc-500 dark:text-zinc-400">No notifications yet</p>
            </div>
          ) : (
            notifications.slice(0, 30).map((notification) => (
              <div
                key={notification.id}
                className={`
                  group flex gap-3 px-4 py-3 cursor-pointer
                  hover:bg-zinc-50 dark:hover:bg-zinc-700/50
                  border-b border-zinc-100 dark:border-zinc-700/50
                  ${!notification.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}
                `}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex-shrink-0">
                  {notification.metadata.actorAvatar ? (
                    <Avatar
                      src={notification.metadata.actorAvatar}
                      name={notification.metadata.actorName}
                      size="sm"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-zinc-200 dark:bg-zinc-600 rounded-full flex items-center justify-center">
                      <Bell className="w-4 h-4 text-zinc-500" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-900 dark:text-white">
                    {notification.message}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {formatTime(notification.createdAt)}
                  </p>
                </div>

                <div className="flex-shrink-0 flex items-start gap-1">
                  {!notification.read && (
                    <span className="w-2 h-2 mt-2 bg-blue-600 rounded-full" />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notification.id);
                    }}
                    className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
