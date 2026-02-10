import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { NotificationPanel } from './NotificationPanel';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();
  const { fetchNotifications } = useNotificationStore();
  const redirectCountRef = useRef(0);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // BUG:BZ-025 - Infinite redirect loop on expired session
  // Auth guard checks for expired token and redirects to /login, but login page
  // detects the stale token and redirects back, creating an infinite loop
  useEffect(() => {
    if (!isAuthenticated) {
      const session = localStorage.getItem('projecthub_session');
      if (session) {
        try {
          const parsed = JSON.parse(session);
          // Token exists but session is expired — keep redirecting to login
          // Login page will detect the token and redirect back here (BZ-056),
          // creating an infinite loop until the browser kills the tab
          if (parsed.token && parsed.expired) {
            redirectCountRef.current += 1;
            if (redirectCountRef.current <= 5) {
              if (typeof window !== 'undefined') {
                window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
                if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-025')) {
                  window.__PERCEPTR_TEST_BUGS__.push({
                    bugId: 'BZ-025',
                    timestamp: Date.now(),
                    description: 'Infinite redirect loop between auth guard and login page on expired session',
                    page: 'Navigation/Global'
                  });
                }
              }
              navigate('/login');
              return;
            }
          }
        } catch {
          // Invalid JSON, fall through to normal redirect
        }
      }
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
    }
  }, [isAuthenticated, fetchNotifications]);

  // BUG:BZ-024 - Deep link loses query parameters on client-side navigation
  // When navigating internally, replace the current history entry without query params
  // This means pressing back after navigating away restores the URL without params
  useEffect(() => {
    if (location.search) {
      // Replaces the current history entry with one that strips query params
      // Initial load works fine, but after any internal navigation + back,
      // the query params are gone
      const strippedUrl = location.pathname;
      window.history.replaceState(window.history.state, '', strippedUrl);

      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-024')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-024',
            timestamp: Date.now(),
            description: 'Query parameters stripped from URL on client-side navigation',
            page: 'Navigation/Global'
          });
        }
      }
    }
  }, [location.pathname, location.search]);

  // BUG:BZ-029 - Browser history polluted by filter changes
  // Every filter change pushes a new history entry instead of replacing.
  // User has to press back N times (once per filter change) to leave the page.
  const pushFilterState = useCallback((filterKey: string, filterValue: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set(filterKey, filterValue);
    // Should use replaceState, but uses pushState — pollutes history
    window.history.pushState({ filter: true, key: filterKey, value: filterValue }, '', url.toString());

    if (typeof window !== 'undefined') {
      window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
      if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-029')) {
        window.__PERCEPTR_TEST_BUGS__.push({
          bugId: 'BZ-029',
          timestamp: Date.now(),
          description: 'Filter changes push history entries instead of replacing - back button undoes filters one at a time',
          page: 'Navigation/Global'
        });
      }
    }
  }, []);

  // Expose pushFilterState globally so filter components can use it
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__pushFilterState = pushFilterState;
    return () => {
      delete (window as unknown as Record<string, unknown>).__pushFilterState;
    };
  }, [pushFilterState]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        navigate('/search');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const handleMenuClick = () => {
    if (window.innerWidth < 1024) {
      setIsMobileSidebarOpen(!isMobileSidebarOpen);
    } else {
      setIsSidebarCollapsed(!isSidebarCollapsed);
    }
  };

  if (!user) {
    return (
      <div data-bug-id="BZ-025" className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          onMenuClick={handleMenuClick}
          isSidebarCollapsed={isSidebarCollapsed}
        />

        {/* BUG:BZ-024 - Query params stripped on navigation */}
        <main className="flex-1 overflow-y-auto" data-bug-id="BZ-024">
          {/* BUG:BZ-029 - Filter changes pollute browser history */}
          <div data-bug-id="BZ-029" className="h-full">
            <Outlet />
          </div>
        </main>
      </div>

      <NotificationPanel />
    </div>
  );
}
