import { useEffect, useRef, useState } from 'react';

interface StatItem {
  label: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
}

interface StatsGridProps {
  items: StatItem[];
  title?: string;
}

// BUG:BZ-081 - CSS Grid Gap Causes Pixel Overflow
// Grid uses grid-template-columns: repeat(3, 33.33%) plus gap: 16px.
// Total width = 3 * 33.33% + 2 * 16px = 99.99% + 32px > 100% of the container.
// This causes a subtle horizontal overflow/scrollbar at certain viewport widths.
// Should use repeat(3, 1fr) or calc() to account for the gap.
export function StatsGrid({ items, title }: StatsGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Detect when the grid overflows its container
    const checkOverflow = () => {
      const el = containerRef.current;
      if (el && el.scrollWidth > el.clientWidth) {
        if (typeof window !== 'undefined') {
          window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
          if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-081')) {
            window.__PERCEPTR_TEST_BUGS__.push({
              bugId: 'BZ-081',
              timestamp: Date.now(),
              description: 'CSS Grid with 33.33% columns + gap causes horizontal overflow at certain viewport widths',
              page: 'Visual/Layout'
            });
          }
        }
      }
    };

    // Check after render and on resize
    const timer = setTimeout(checkOverflow, 100);
    window.addEventListener('resize', checkOverflow);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkOverflow);
    };
  }, []);

  return (
    <div data-bug-id="BZ-081" className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      {title && (
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h2>
      )}
      {/* BUG:BZ-081 - Grid columns use percentage widths (33.33%) instead of 1fr,
          and the gap property adds extra space between columns. The total width becomes
          3 * 33.33% + 2 * 16px gap = ~100% + 32px, overflowing the container.
          This creates a subtle horizontal scrollbar at specific viewport widths. */}
      <div
        ref={containerRef}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 33.33%)',
          gap: '16px',
        }}
      >
        {items.map((item, index) => (
          <div
            key={index}
            className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg"
          >
            <p className="text-sm text-gray-500 dark:text-gray-400">{item.label}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{item.value}</p>
            <p className={`text-xs mt-1 ${
              item.changeType === 'positive' ? 'text-green-600' :
              item.changeType === 'negative' ? 'text-red-600' :
              'text-gray-500 dark:text-gray-400'
            }`}>
              {item.change}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// BUG:BZ-083 - Container Query Fallback Missing
// Uses CSS Container Queries for responsive stat cards. In browsers that don't
// support container queries (Safari 15, Firefox ESR), the cards render at their
// minimum size (100px) because the container query conditions are never met
// and no fallback styles are provided.
export function ResponsiveStatCards({ items }: { items: StatItem[] }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [containerQuerySupported] = useState(() => {
    if (typeof window === 'undefined') return true;
    return typeof CSS !== 'undefined' && CSS.supports('container-type', 'inline-size');
  });

  useEffect(() => {
    // Detect if container queries are not supported and log the bug
    if (!containerQuerySupported) {
      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-083')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-083',
            timestamp: Date.now(),
            description: 'Container queries not supported - cards render at minimum 100px size with no fallback layout',
            page: 'Visual/Layout'
          });
        }
      }
    }

    // Also detect if the cards rendered too small (fallback missing)
    const timer = setTimeout(() => {
      const cards = wrapperRef.current?.querySelectorAll('[data-stat-card]');
      if (cards) {
        cards.forEach((card) => {
          const rect = card.getBoundingClientRect();
          if (rect.width <= 100) {
            if (typeof window !== 'undefined') {
              window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
              if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-083')) {
                window.__PERCEPTR_TEST_BUGS__.push({
                  bugId: 'BZ-083',
                  timestamp: Date.now(),
                  description: 'Container query fallback missing - stat cards rendered at minimum size (100px)',
                  page: 'Visual/Layout'
                });
              }
            }
          }
        });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [containerQuerySupported]);

  return (
    // BUG:BZ-083 - The wrapper uses container-type: inline-size for container queries.
    // The stat cards inside use @container queries (via inline styles) to adjust their
    // layout. In browsers without support, the cards only get min-width: 100px and
    // no proper fallback dimensions, rendering them tiny and unusable.
    <div
      ref={wrapperRef}
      data-bug-id="BZ-083"
      style={{
        containerType: 'inline-size',
        containerName: 'stats-wrapper',
      }}
      className="mt-4"
    >
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((item, index) => (
          <div
            key={index}
            data-stat-card
            style={{
              // Cards rely on container queries for sizing; without support,
              // they fall back to this small min-width with no max/flex sizing
              minWidth: '100px',
            }}
            className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-600"
          >
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.label}</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">{item.value}</p>
            <p className={`text-xs mt-0.5 ${
              item.changeType === 'positive' ? 'text-green-600' :
              item.changeType === 'negative' ? 'text-red-600' :
              'text-gray-500 dark:text-gray-400'
            }`}>
              {item.change}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Default weekly stats data for the dashboard
export const weeklyStats = [
  { label: 'Tasks Completed', value: '47', change: '+12 from last week', changeType: 'positive' as const },
  { label: 'Hours Logged', value: '182h', change: '+8h from last week', changeType: 'positive' as const },
  { label: 'Code Reviews', value: '23', change: '-3 from last week', changeType: 'negative' as const },
  { label: 'Deployments', value: '8', change: 'Same as last week', changeType: 'neutral' as const },
  { label: 'Bug Reports', value: '14', change: '+5 from last week', changeType: 'negative' as const },
  { label: 'Team Velocity', value: '92%', change: '+4% from last week', changeType: 'positive' as const },
];
