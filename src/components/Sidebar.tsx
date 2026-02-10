import { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Users, TrendingUp, Activity, FileText, Settings, Zap, X } from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { path: '/projects', label: 'Projects', icon: <FolderKanban className="w-5 h-5" /> },
  { path: '/team', label: 'Team', icon: <Users className="w-5 h-5" /> },
  { path: '/performance', label: 'Performance', icon: <TrendingUp className="w-5 h-5" /> },
  { path: '/activity', label: 'Activity', icon: <Activity className="w-5 h-5" /> },
  { path: '/forms', label: 'Forms', icon: <FileText className="w-5 h-5" /> },
  { path: '/settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
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
          bg-white dark:bg-zinc-800
          border-r border-zinc-200 dark:border-zinc-700
          transition-all duration-150 ease-in-out
          ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
          ${isMobileOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            {!isCollapsed && (
              <span className="text-lg font-bold text-zinc-900 dark:text-white">ProjectHub</span>
            )}
          </div>
          <button
            onClick={onMobileClose}
            className="lg:hidden p-1 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <X className="w-5 h-5" />
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
                  transition-colors duration-150
                  ${isCollapsed ? 'justify-center' : ''}
                  ${
                    isItemActive
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
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
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-700">
            <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-700/50 rounded-lg">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Storage Used</p>
              <div className="mt-2 h-1.5 bg-zinc-200 dark:bg-zinc-600 rounded-full overflow-hidden">
                <div className="h-full w-3/4 bg-blue-600 rounded-full" />
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">7.5 GB of 10 GB</p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
