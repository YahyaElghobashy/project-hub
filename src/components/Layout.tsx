import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { usePerceptr } from '../contexts/PerceptrContext';
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
  const { identify } = usePerceptr();
  const redirectCountRef = useRef(0);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // BUG:BZ-027 - Route guard flashes protected content before redirect
  // Auth check is deferred by a short timeout, allowing the protected dashboard
  // content to render for ~200ms before the redirect to login fires.
  // Should check auth synchronously before rendering, but the async check
  // creates a visible flash of sensitive content.
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Simulate async auth verification (e.g., token validation against server)
    const timer = setTimeout(() => {
      setAuthChecked(true);
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  // BUG:BZ-030 - Concurrent route transitions cause white screen
  // Rapidly clicking between nav items increments a transition counter.
  // When multiple transitions overlap (counter > 1), the component sets an error
  // state that renders a blank fallback and never recovers.
  const transitionCountRef = useRef(0);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [routeTransitionError, setRouteTransitionError] = useState(false);

  useEffect(() => {
    transitionCountRef.current += 1;
    const currentCount = transitionCountRef.current;

    // Clear previous transition timer
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
    }

    // If more than 2 rapid transitions overlap, trigger the white screen bug
    if (currentCount > 2) {
      setRouteTransitionError(true);
      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-030')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-030',
            timestamp: Date.now(),
            description: 'Concurrent route transitions caused white screen - overlapping navigations triggered error state',
            page: 'Navigation/Global'
          });
        }
      }
    }

    // Reset the counter after transitions settle (300ms debounce)
    transitionTimerRef.current = setTimeout(() => {
      transitionCountRef.current = 0;
    }, 300);

    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
    };
  }, [location.pathname]);

  // BUG:BZ-025 - Infinite redirect loop on expired session
  // Auth guard checks for expired token and redirects to /login, but login page
  // detects the stale token and redirects back, creating an infinite loop
  // BUG:BZ-027 - Route guard flashes protected content before redirect
  // The auth check waits for authChecked (async verification), so protected content
  // renders for ~200ms before the redirect fires. This exposes sensitive dashboard
  // data briefly to unauthenticated users.
  useEffect(() => {
    if (!authChecked) return; // Wait for async auth check — content flashes during this window
    if (!isAuthenticated) {
      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-027')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-027',
            timestamp: Date.now(),
            description: 'Protected route content flashed for ~200ms before auth redirect',
            page: 'Navigation/Global'
          });
        }
      }
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
  }, [isAuthenticated, authChecked, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
    }
  }, [isAuthenticated, fetchNotifications]);

  // Identify user with Perceptr SDK when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      identify(user.id, {
        email: user.email,
        name: user.name,
        role: user.role,
      });
    }
  }, [isAuthenticated, user, identify]);

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

  // BUG:BZ-031 - URL state and app state diverge after popstate
  // Stores the filter state when navigating away but doesn't restore it from
  // URL params when the user presses back. The popstate listener updates the URL
  // but fails to sync back to the app's filter state, so UI shows defaults
  // while URL still has ?status=active etc.
  const [appFilterState, setAppFilterState] = useState<Record<string, string>>({});

  useEffect(() => {
    const handlePopState = () => {
      // This handler intentionally does NOT sync URL params back to appFilterState.
      // The URL will have params like ?status=active but appFilterState stays empty,
      // causing the UI to show "All" while the URL shows filtered state.
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.toString()) {
        if (typeof window !== 'undefined') {
          window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
          if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-031')) {
            window.__PERCEPTR_TEST_BUGS__.push({
              bugId: 'BZ-031',
              timestamp: Date.now(),
              description: 'URL state and app state diverged after popstate - URL has params but UI shows defaults',
              page: 'Navigation/Global'
            });
          }
        }
      }
      // Bug: should call setAppFilterState with parsed URL params, but doesn't
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Expose setAppFilterState so pages can update filters
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__setAppFilterState = setAppFilterState;
    return () => {
      delete (window as unknown as Record<string, unknown>).__setAppFilterState;
    };
  }, []);

  // BUG:BZ-032 - Analytics pageview fires twice on route change
  // The analytics tracker is wired to both the React Router location change
  // AND a popstate listener, causing double pageview events on every navigation
  useEffect(() => {
    // First fire: React Router location change triggers this effect
    const trackPageview = (url: string) => {
      const analyticsEvent = {
        type: 'pageview',
        url,
        timestamp: Date.now()
      };
      // Push to a global analytics queue (simulating a real analytics SDK)
      (window as unknown as Record<string, unknown[]>).__ANALYTICS_QUEUE__ =
        (window as unknown as Record<string, unknown[]>).__ANALYTICS_QUEUE__ || [];
      (window as unknown as Record<string, unknown[]>).__ANALYTICS_QUEUE__.push(analyticsEvent);
    };

    trackPageview(location.pathname);

    // Second fire: Also attach a popstate listener that fires on the same navigation
    // This causes double-counting of pageviews (~40% analytics inflation)
    const handlePopStateAnalytics = () => {
      trackPageview(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopStateAnalytics);

    if (typeof window !== 'undefined') {
      window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
      if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-032')) {
        window.__PERCEPTR_TEST_BUGS__.push({
          bugId: 'BZ-032',
          timestamp: Date.now(),
          description: 'Analytics pageview fires twice per route change - location effect + popstate listener',
          page: 'Navigation/Global'
        });
      }
    }

    return () => {
      window.removeEventListener('popstate', handlePopStateAnalytics);
    };
  }, [location.pathname]);

  // BUG:BZ-033 - Scroll position not restored on back navigation
  // The main content area scrolls to top on every route change, but never saves
  // or restores the previous scroll position. Pressing back after scrolling
  // down a long page returns the user to the top.
  const mainContentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Always scroll to top on route change — never preserves or restores position
    if (mainContentRef.current) {
      mainContentRef.current.scrollTop = 0;
    }

    if (typeof window !== 'undefined') {
      window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
      if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-033')) {
        window.__PERCEPTR_TEST_BUGS__.push({
          bugId: 'BZ-033',
          timestamp: Date.now(),
          description: 'Scroll position not restored on back navigation - always resets to top',
          page: 'Navigation/Global'
        });
      }
    }
  }, [location.pathname]);

  // BUG:BZ-035 - Navigation cancel doesn't abort pending requests
  // When the user navigates away before a page data fetch completes, the stale
  // response still writes to the shared pageData state, overwriting the new page's data.
  // Should use AbortController to cancel in-flight requests on navigation, but doesn't.
  const [pageData, setPageData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchPageData = async () => {
      const currentPath = location.pathname;
      // Simulate a network request with variable latency per route
      const delay = currentPath.includes('dashboard') ? 1500
        : currentPath.includes('projects') ? 2000
        : currentPath.includes('team') ? 1200
        : 800;

      await new Promise(resolve => setTimeout(resolve, delay));

      // Bug: does NOT check if the navigation has changed since the fetch started.
      // A proper implementation would use AbortController or check `cancelled`.
      // Instead, we only check the local `cancelled` flag for cleanup but never set it,
      // so stale data always overwrites the current page's data.
      if (!cancelled) {
        setPageData({ route: currentPath, fetchedAt: Date.now() });

        // Detect when stale data overwrites: if by the time we set data, the path has changed
        if (currentPath !== window.location.pathname.replace(/\/$/, '')) {
          if (typeof window !== 'undefined') {
            window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
            if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-035')) {
              window.__PERCEPTR_TEST_BUGS__.push({
                bugId: 'BZ-035',
                timestamp: Date.now(),
                description: 'Navigation cancel did not abort pending request - stale data overwrote new page data',
                page: 'Navigation/Global'
              });
            }
          }
        }
      }
    };

    fetchPageData();

    // Bug: cleanup sets cancelled = true but fetch doesn't use AbortController,
    // so the async operation still completes and calls setPageData.
    // The `cancelled` variable is captured in closure but the check above
    // uses a separate code path that doesn't properly gate the state update.
    return () => {
      // This looks correct but the fetch completion callback above doesn't
      // actually honor this flag consistently due to the async timing
      cancelled = false; // Bug: should be `cancelled = true` to properly cancel
    };
  }, [location.pathname]);

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

  // BUG:BZ-077 - Print Stylesheet Missing
  // No @media print styles are defined, so printing the page includes the full
  // app chrome: sidebar, navigation bar, footer, notification panel, and all
  // interactive elements. Only the main content should print, but everything does.
  useEffect(() => {
    const handleBeforePrint = () => {
      // The app has no print stylesheet — sidebar, topbar, and all chrome elements
      // will be included in the printed output. This is detected when the user
      // triggers Ctrl+P / Cmd+P or window.print().
      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-077')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-077',
            timestamp: Date.now(),
            description: 'Print stylesheet missing - full app chrome (sidebar, nav, footer) prints instead of clean content',
            page: 'Visual/Layout'
          });
        }
      }
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    return () => window.removeEventListener('beforeprint', handleBeforePrint);
  }, []);

  // BUG:BZ-080 - Focus indicator invisible
  // CSS globally removes outline on :focus but no custom focus indicator is added.
  // Keyboard users can't see which element is focused. Log when Tab key is used.
  useEffect(() => {
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (typeof window !== 'undefined') {
          window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
          if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-080')) {
            window.__PERCEPTR_TEST_BUGS__.push({
              bugId: 'BZ-080',
              timestamp: Date.now(),
              description: 'Focus indicator invisible - outline:none applied globally without custom focus style',
              page: 'Visual/Layout'
            });
          }
        }
      }
    };

    window.addEventListener('keydown', handleTabKey);
    return () => window.removeEventListener('keydown', handleTabKey);
  }, []);

  // BUG:BZ-075 - Sticky header covers content on anchor link scroll
  // Anchor link scroll-to uses element.scrollIntoView() without accounting for the
  // fixed 64px header. The target element scrolls to the very top of the viewport,
  // hidden behind the sticky header. Should use scroll-margin-top or manual offset.
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href^="#"]');
      if (anchor) {
        const href = anchor.getAttribute('href');
        if (href && href.startsWith('#')) {
          e.preventDefault();
          const elementId = href.slice(1);
          const element = document.getElementById(elementId);
          if (element) {
            // Bug: scrollIntoView doesn't account for the 64px fixed header
            // The content scrolls right to the top of the viewport, hidden under the header
            // Should use: element.scrollIntoView({ behavior: 'smooth' }) with CSS scroll-margin-top: 64px
            // or manually calculate: window.scrollTo({ top: element.offsetTop - 64, behavior: 'smooth' })
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });

            if (typeof window !== 'undefined') {
              window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
              if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-075')) {
                window.__PERCEPTR_TEST_BUGS__.push({
                  bugId: 'BZ-075',
                  timestamp: Date.now(),
                  description: 'Sticky header covers content on scroll - anchor link does not offset for 64px fixed header',
                  page: 'Visual/Layout'
                });
              }
            }
          }
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);
    return () => document.removeEventListener('click', handleAnchorClick);
  }, []);

  const handleMenuClick = () => {
    if (window.innerWidth < 1024) {
      setIsMobileSidebarOpen(!isMobileSidebarOpen);
    } else {
      setIsSidebarCollapsed(!isSidebarCollapsed);
    }
  };

  // BUG:BZ-034 - Dynamic route segments not decoded
  // When the URL has encoded characters like %20, they're passed through as-is
  // to the page title context. Missing decodeURIComponent means "My%20Project"
  // is displayed instead of "My Project"
  const routeSegments = location.pathname.split('/').filter(Boolean);
  const currentPageTitle = routeSegments[routeSegments.length - 1] || '';
  // Bug: Should call decodeURIComponent(currentPageTitle) but doesn't
  // This raw title is exposed for child components to use for page headers

  useEffect(() => {
    (window as unknown as Record<string, unknown>).__currentPageTitle = currentPageTitle;
    if (currentPageTitle !== decodeURIComponent(currentPageTitle)) {
      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-034')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-034',
            timestamp: Date.now(),
            description: 'Dynamic route segments not decoded - URL-encoded characters shown raw in titles',
            page: 'Navigation/Global'
          });
        }
      }
    }
  }, [currentPageTitle]);

  if (!user) {
    // If not authenticated, let auth guard useEffect handle the redirect instead of spinning forever
    if (authChecked && !isAuthenticated) {
      return null;
    }
    return (
      <div data-bug-id="BZ-025" className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // BUG:BZ-030 - White screen on concurrent route transitions
  if (routeTransitionError) {
    return (
      <div data-bug-id="BZ-030" className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="animate-spin h-8 w-8 border-4 border-zinc-300 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    // BUG:BZ-027 - Protected content renders before auth check completes
    // BUG:BZ-077 - Print stylesheet missing (no @media print rules to hide app chrome)
    // BUG:BZ-080 - Focus indicator invisible (CSS removes outline globally)
    <div data-bug-id="BZ-027" data-bug-id-077="BZ-077" data-bug-id-080="BZ-080" className="min-h-screen flex bg-zinc-50 dark:bg-zinc-950">
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

        {/* BUG:BZ-028 - Breadcrumb trail doesn't match actual path */}
        {/* Breadcrumbs are derived from a hardcoded mapping instead of the actual URL,
            so they show incorrect hierarchy for many routes. E.g., /settings shows
            "Home > Projects > Settings" even though it's a top-level route. */}
        <nav data-bug-id="BZ-028" className="px-4 lg:px-6 py-2 text-sm text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-700/50 bg-white dark:bg-zinc-800" aria-label="Breadcrumb">
          {(() => {
            // Bug: Breadcrumb mapping is hardcoded and doesn't match URL hierarchy
            // Should derive breadcrumbs from the actual route segments, but instead
            // uses a static lookup that returns wrong parent paths
            const breadcrumbMap: Record<string, string[]> = {
              '/dashboard': ['Home', 'Dashboard'],
              '/projects': ['Home', 'Projects'],
              '/team': ['Home', 'Projects', 'Team'],           // Wrong: Team is not under Projects
              '/settings': ['Home', 'Projects', 'Settings'],   // Wrong: Settings is not under Projects
              '/search': ['Home', 'Dashboard', 'Search'],      // Wrong: Search is not under Dashboard
            };

            // Find matching route (use prefix match for nested routes)
            const matchedPath = Object.keys(breadcrumbMap).find(path =>
              location.pathname.startsWith(path)
            ) || '/dashboard';

            const crumbs = breadcrumbMap[matchedPath] || ['Home'];

            // Log the bug when breadcrumbs don't match the actual URL hierarchy
            const actualSegments = location.pathname.split('/').filter(Boolean);
            const expectedParent = actualSegments[0] || 'dashboard';
            const breadcrumbParent = (crumbs[1] || '').toLowerCase();
            if (breadcrumbParent && breadcrumbParent !== expectedParent && crumbs.length > 2) {
              if (typeof window !== 'undefined') {
                window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
                if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-028')) {
                  window.__PERCEPTR_TEST_BUGS__.push({
                    bugId: 'BZ-028',
                    timestamp: Date.now(),
                    description: 'Breadcrumb trail does not match actual URL path - hardcoded mapping shows wrong hierarchy',
                    page: 'Navigation/Global'
                  });
                }
              }
            }

            return (
              <ol className="flex items-center gap-1">
                {crumbs.map((crumb, idx) => (
                  <li key={idx} className="flex items-center">
                    {idx > 0 && (
                      <ChevronRight className="w-4 h-4 mx-1 text-zinc-300 dark:text-zinc-600" />
                    )}
                    <span className={idx === crumbs.length - 1 ? 'text-zinc-900 dark:text-zinc-200 font-medium' : ''}>
                      {crumb}
                    </span>
                  </li>
                ))}
              </ol>
            );
          })()}
        </nav>

        {/* BUG:BZ-024 - Query params stripped on navigation */}
        {/* BUG:BZ-033 - Scroll position not restored on back navigation */}
        <main ref={mainContentRef} className="flex-1 overflow-y-auto" data-bug-id="BZ-024">
          {/* BUG:BZ-029 - Filter changes pollute browser history */}
          <div data-bug-id="BZ-029" className="h-full">
            {/* BUG:BZ-031 - URL/app state diverge after popstate */}
            <div data-bug-id="BZ-031">
              {/* BUG:BZ-032 - Analytics pageview fires twice */}
              <div data-bug-id="BZ-032">
                {/* BUG:BZ-034 - Dynamic route segments not decoded */}
                <div data-bug-id="BZ-034">
                  {/* BUG:BZ-033 - Scroll position reset on every navigation */}
                  <div data-bug-id="BZ-033">
                    {/* BUG:BZ-035 - Stale fetch data not aborted on navigation */}
                    <div data-bug-id="BZ-035">
                      <Outlet context={{ appFilterState, pageTitle: currentPageTitle, pageData }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <NotificationPanel />
    </div>
  );
}
