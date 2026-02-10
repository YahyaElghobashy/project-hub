import { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

interface SidebarProps {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

const navItems = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    path: '/projects',
    label: 'Projects',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    path: '/team',
    label: 'Team',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export function Sidebar({ isCollapsed, isMobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();

  // BUG:BZ-023 - Active tab is set on mount and never updates on route change
  // useState initializer only runs once, so activeTab stays as the initial pathname
  const [activeTab] = useState(location.pathname);

  // BUG:BZ-078 - Responsive breakpoint gap at exactly 768px
  // At 768px (iPad portrait), neither mobile layout nor desktop layout applies properly.
  // Mobile hamburger menu is hidden at md (768px+), but desktop sidebar only shows at lg (1024px).
  // This leaves a 768-1023px gap where the sidebar is invisible and the hamburger is hidden.
  useEffect(() => {
    const checkBreakpointGap = () => {
      const width = window.innerWidth;
      // At exactly 768px-1023px, the sidebar is translated off-screen (mobile default)
      // but the hamburger menu button is also hidden (it's only shown below lg)
      // The lg:static and lg:translate-x-0 only kick in at 1024px+
      if (width >= 768 && width < 1024 && !isMobileOpen) {
        if (typeof window !== 'undefined') {
          window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
          if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-078')) {
            window.__PERCEPTR_TEST_BUGS__.push({
              bugId: 'BZ-078',
              timestamp: Date.now(),
              description: 'Responsive breakpoint gap at 768px - navigation inaccessible between md and lg breakpoints',
              page: 'Visual/Layout'
            });
          }
        }
      }
    };

    checkBreakpointGap();
    window.addEventListener('resize', checkBreakpointGap);
    return () => window.removeEventListener('resize', checkBreakpointGap);
  }, [isMobileOpen]);

  // BUG:BZ-079 - Animation Janks on Low-End Devices
  // Uses JavaScript-based animation (setInterval + left property) instead of
  // CSS transforms for the sidebar slide. Modifying `left` triggers layout
  // recalculation on every frame, causing jank on low-end mobile devices.
  // Should use CSS transform: translateX() with will-change for GPU acceleration.
  const sidebarRef = useRef<HTMLElement>(null);
  const animationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar || window.innerWidth >= 1024) return;

    // Cancel any ongoing animation
    if (animationRef.current) {
      clearInterval(animationRef.current);
      animationRef.current = null;
    }

    const targetLeft = isMobileOpen ? 0 : -256;
    let currentLeft = parseInt(sidebar.style.left || (isMobileOpen ? '-256' : '0'), 10);

    // JS-based animation using setInterval — triggers layout thrashing on every tick
    // Each frame recalculates layout because `left` is a layout-triggering property
    animationRef.current = setInterval(() => {
      const diff = targetLeft - currentLeft;
      if (Math.abs(diff) < 2) {
        currentLeft = targetLeft;
        sidebar.style.left = `${currentLeft}px`;
        if (animationRef.current) {
          clearInterval(animationRef.current);
          animationRef.current = null;
        }
        return;
      }

      // Easing step — reads offsetHeight (forces layout) then writes left (forces another)
      const _forceLayout = sidebar.offsetHeight;
      currentLeft += diff * 0.15;
      sidebar.style.left = `${currentLeft}px`;
      void _forceLayout; // prevent unused warning
    }, 16);

    if (typeof window !== 'undefined') {
      window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
      if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-079')) {
        window.__PERCEPTR_TEST_BUGS__.push({
          bugId: 'BZ-079',
          timestamp: Date.now(),
          description: 'Sidebar animation uses JS setInterval + left property instead of CSS transforms - janky on low-end devices',
          page: 'Visual/Layout'
        });
      }
    }

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isMobileOpen]);

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* BUG:BZ-078 - Responsive breakpoint gap: The sidebar uses lg: (1024px) for desktop
          visibility, but the mobile hamburger menu is hidden at md: (768px+). At exactly
          768px-1023px, the sidebar is off-screen and the hamburger is gone, leaving no
          way to access navigation. Should use consistent breakpoints. */}
      {/* BUG:BZ-079 - Sidebar animation uses JS-based left property changes
          instead of GPU-accelerated CSS transforms. No will-change or transform3d
          hint, causing layout thrashing and choppy animation on mobile. */}
      <aside
        ref={sidebarRef}
        data-bug-id="BZ-078"
        data-bug-id-079="BZ-079"
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          flex flex-col
          bg-white dark:bg-gray-800
          border-r border-gray-200 dark:border-gray-700
          transition-all duration-300 ease-in-out
          ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
          ${isMobileOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            {!isCollapsed && (
              <span className="text-lg font-bold text-gray-900 dark:text-white">ProjectHub</span>
            )}
          </div>
          <button
            onClick={onMobileClose}
            className="lg:hidden p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* BUG:BZ-023 - Active nav highlight uses stale activeTab state set on mount, never updates on route change */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" data-bug-id="BZ-023">
          {navItems.map((item) => {
            // BUG:BZ-023 - Uses stale activeTab (set once on mount) instead of current location
            const isItemActive = activeTab.startsWith(item.path);
            if (isItemActive && !location.pathname.startsWith(item.path)) {
              // Active highlight doesn't match actual route — log the bug
              if (typeof window !== 'undefined') {
                window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
                if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-023')) {
                  window.__PERCEPTR_TEST_BUGS__.push({
                    bugId: 'BZ-023',
                    timestamp: Date.now(),
                    description: 'Active nav highlight stuck on wrong tab - set on mount, never updates',
                    page: 'Navigation/Global'
                  });
                }
              }
            }
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onMobileClose}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg
                  transition-colors duration-200
                  ${isCollapsed ? 'justify-center' : ''}
                  ${
                    isItemActive
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
                title={isCollapsed ? item.label : undefined}
              >
                {item.icon}
                {!isCollapsed && <span className="font-medium">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        {!isCollapsed && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Storage Used</p>
              <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <div className="h-full w-3/4 bg-blue-600 rounded-full" />
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">7.5 GB of 10 GB</p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
