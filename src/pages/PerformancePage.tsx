import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useAuthStore } from '../store/authStore';
import { Globe, Database, Zap, Search as SearchIcon, Mail, Lock, BarChart3 } from 'lucide-react';

// BUG:BZ-118 - Bundle includes unused libraries
// Importing the entire lodash library (70KB+ gzipped) just to use _.capitalize
// on a single label. Should use a native implementation or import only the
// specific function: import capitalize from 'lodash/capitalize'
import _ from 'lodash';

// BUG:BZ-122 - Date Library Locale Import Bloats Bundle
// Importing moment.js with ALL locales (~500KB) just to format a few timestamps.
// The app only uses English but moment's default import pulls in all 100+ locales
// because of dynamic require() usage. Should use date-fns or dayjs instead.
import moment from 'moment';
import 'moment/min/locales';

// ---------- Preferences (used by several UI elements) ----------
interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  compactMode: boolean;
  refreshInterval: number;
  visibleMetrics: string[];
  defaultTimeRange: '1h' | '6h' | '24h' | '7d';
  showServiceHealth: boolean;
  showErrorLogs: boolean;
  chartAnimations: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  compactMode: false,
  refreshInterval: 5000,
  visibleMetrics: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'],
  defaultTimeRange: '24h',
  showServiceHealth: true,
  showErrorLogs: true,
  chartAnimations: true,
};

// BUG:BZ-121 - localStorage Parsed on Every Render
// This function is called in the component body (not memoized) causing
// JSON.parse(localStorage.getItem('preferences')) to execute on every
// single render cycle. With 60fps re-renders, this adds ~40ms per frame.
function getPreferences(): UserPreferences {
  try {
    const stored = localStorage.getItem('projecthub_preferences');
    if (stored) {
      return JSON.parse(stored) as UserPreferences;
    }
  } catch {
    // Silently fall back to defaults
  }
  return DEFAULT_PREFERENCES;
}

// ---------- Types ----------
interface PerformanceMetric {
  id: string;
  label: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'flat';
  change: number;
}

interface ResponseTimeEntry {
  endpoint: string;
  method: string;
  p50: number;
  p95: number;
  p99: number;
  requestsPerMin: number;
}

interface ErrorLogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info';
  message: string;
  service: string;
  count: number;
}

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  latency: number;
  icon: React.ReactNode;
}

// ---------- Realistic mock data ----------
const generateMetrics = (): PerformanceMetric[] => [
  { id: 'm1', label: 'Avg Response Time', value: 142, unit: 'ms', trend: 'down', change: -8.3 },
  { id: 'm2', label: 'Requests / Min', value: 1284, unit: 'rpm', trend: 'up', change: 12.1 },
  { id: 'm3', label: 'Error Rate', value: 0.42, unit: '%', trend: 'down', change: -0.15 },
  { id: 'm4', label: 'CPU Usage', value: 67, unit: '%', trend: 'up', change: 3.2 },
  { id: 'm5', label: 'Memory Usage', value: 4.2, unit: 'GB', trend: 'up', change: 0.3 },
  { id: 'm6', label: 'Active Users', value: 342, unit: '', trend: 'up', change: 18 },
];

const generateResponseTimes = (): ResponseTimeEntry[] => [
  { endpoint: '/api/projects', method: 'GET', p50: 45, p95: 120, p99: 340, requestsPerMin: 312 },
  { endpoint: '/api/tasks', method: 'GET', p50: 62, p95: 180, p99: 520, requestsPerMin: 485 },
  { endpoint: '/api/users', method: 'GET', p50: 28, p95: 65, p99: 140, requestsPerMin: 156 },
  { endpoint: '/api/tasks', method: 'POST', p50: 88, p95: 210, p99: 680, requestsPerMin: 94 },
  { endpoint: '/api/projects/:id', method: 'PATCH', p50: 72, p95: 190, p99: 510, requestsPerMin: 67 },
  { endpoint: '/api/search', method: 'GET', p50: 120, p95: 340, p99: 890, requestsPerMin: 203 },
  { endpoint: '/api/notifications', method: 'GET', p50: 35, p95: 80, p99: 160, requestsPerMin: 178 },
  { endpoint: '/api/analytics', method: 'GET', p50: 210, p95: 560, p99: 1200, requestsPerMin: 42 },
];

const generateErrorLogs = (): ErrorLogEntry[] => [
  { id: 'e1', timestamp: new Date(Date.now() - 120000).toISOString(), level: 'error', message: 'Connection timeout to database replica-02', service: 'api-gateway', count: 3 },
  { id: 'e2', timestamp: new Date(Date.now() - 300000).toISOString(), level: 'warn', message: 'Rate limit approaching for tenant acme-corp', service: 'rate-limiter', count: 12 },
  { id: 'e3', timestamp: new Date(Date.now() - 450000).toISOString(), level: 'error', message: 'Failed to serialize response for /api/analytics', service: 'analytics-svc', count: 7 },
  { id: 'e4', timestamp: new Date(Date.now() - 600000).toISOString(), level: 'info', message: 'Cache invalidation completed for project index', service: 'cache-layer', count: 1 },
  { id: 'e5', timestamp: new Date(Date.now() - 900000).toISOString(), level: 'warn', message: 'Slow query detected: tasks JOIN projects (>500ms)', service: 'query-monitor', count: 5 },
  { id: 'e6', timestamp: new Date(Date.now() - 1200000).toISOString(), level: 'error', message: 'WebSocket connection dropped for 23 clients', service: 'ws-gateway', count: 2 },
  { id: 'e7', timestamp: new Date(Date.now() - 1500000).toISOString(), level: 'warn', message: 'Memory usage above 85% threshold on worker-04', service: 'infra-monitor', count: 8 },
  { id: 'e8', timestamp: new Date(Date.now() - 1800000).toISOString(), level: 'info', message: 'Auto-scaling triggered: 3 → 5 instances', service: 'orchestrator', count: 1 },
];

const serviceHealthData: ServiceHealth[] = [
  { name: 'API Gateway', status: 'healthy', uptime: 99.98, latency: 12, icon: <Globe className="w-5 h-5" /> },
  { name: 'Database Primary', status: 'healthy', uptime: 99.99, latency: 3, icon: <Database className="w-5 h-5" /> },
  { name: 'Cache Layer', status: 'healthy', uptime: 99.95, latency: 1, icon: <Zap className="w-5 h-5" /> },
  { name: 'Search Index', status: 'degraded', uptime: 99.82, latency: 45, icon: <SearchIcon className="w-5 h-5" /> },
  { name: 'Queue Worker', status: 'healthy', uptime: 99.97, latency: 8, icon: <Mail className="w-5 h-5" /> },
  { name: 'CDN', status: 'healthy', uptime: 100.0, latency: 5, icon: <Globe className="w-5 h-5" /> },
  { name: 'Auth Service', status: 'healthy', uptime: 99.99, latency: 15, icon: <Lock className="w-5 h-5" /> },
  { name: 'Analytics Pipeline', status: 'degraded', uptime: 98.50, latency: 120, icon: <BarChart3 className="w-5 h-5" /> },
];

// BUG:BZ-117 - Image Not Lazy Loaded Below Fold
// Generate 50 team member avatar URLs — all loaded eagerly on page load
// even though only ~3-6 are visible above the fold in the "Top Contributors" section
const teamAvatarUrls = Array.from({ length: 50 }, (_, i) => ({
  id: `avatar-${i}`,
  name: `Team Member ${i + 1}`,
  url: `https://api.dicebear.com/7.x/avataaars/svg?seed=perf-member-${i}&size=200`,
  contributions: Math.floor(Math.random() * 120) + 5,
  role: ['Engineer', 'Designer', 'PM', 'QA', 'DevOps'][i % 5],
}));

// ---------- Sub-components ----------

function MetricCard({ metric }: { metric: PerformanceMetric }) {
  const trendColor = metric.trend === 'down' && metric.label.includes('Error')
    ? 'text-green-600'
    : metric.trend === 'down' && metric.label.includes('Response')
    ? 'text-green-600'
    : metric.trend === 'up' && (metric.label.includes('Error') || metric.label.includes('CPU') || metric.label.includes('Memory'))
    ? 'text-red-600'
    : metric.trend === 'up'
    ? 'text-green-600'
    : 'text-zinc-500';

  const trendIcon = metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→';

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 border border-zinc-200 dark:border-zinc-700 shadow-sm">
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {/* BUG:BZ-118 - Uses lodash _.capitalize just for this one label formatting */}
        {_.capitalize(metric.label)}
      </p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-zinc-900 dark:text-white">
          {metric.value.toLocaleString()}
        </span>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">{metric.unit}</span>
      </div>
      <div className={`mt-1 text-sm ${trendColor} flex items-center gap-1`}>
        <span>{trendIcon}</span>
        <span>{Math.abs(metric.change)}{typeof metric.change === 'number' && metric.unit === '%' ? 'pp' : metric.unit === 'ms' ? 'ms' : '%'}</span>
        <span className="text-zinc-400 dark:text-zinc-500 ml-1">vs last week</span>
      </div>
    </div>
  );
}

// BUG:BZ-098 - Memory Leak from Unmounted Component Subscription
// This component subscribes to a simulated "metrics stream" on mount but
// never cleans up the subscription when unmounting. Each mount creates a new
// subscription that continues running in the background.
function LiveMetricsStream({ onUpdate }: { onUpdate: (data: { timestamp: number; value: number }) => void }) {
  // BUG:BZ-098 - No cleanup on unmount — subscription leaks
  useEffect(() => {
    const streamId = Math.random().toString(36).substring(7);
    let isActive = true;

    // Simulated data stream subscription
    const subscription = setInterval(() => {
      if (isActive) {
        onUpdate({
          timestamp: Date.now(),
          value: Math.random() * 100 + 50,
        });
      }
    }, 2000);

    // Simulate registering with a global subscription manager
    const existingStreams = (window as any).__PERF_STREAMS__ || [];
    existingStreams.push(streamId);
    (window as any).__PERF_STREAMS__ = existingStreams;

    if (typeof window !== 'undefined') {
      window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
      if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-098')) {
        window.__PERCEPTR_TEST_BUGS__.push({
          bugId: 'BZ-098',
          timestamp: Date.now(),
          description: 'Memory leak from unmounted component subscription - no cleanup on unmount',
          page: 'Performance'
        });
      }
    }

    // BUG: Missing cleanup — should return () => { clearInterval(subscription); isActive = false; }
    // The interval and subscription keep running after the component unmounts
    void subscription;
    void isActive;
  }, [onUpdate]);

  return null;
}

function ResponseTimeTable({ data }: { data: ResponseTimeEntry[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-700">
            <th className="text-left py-3 px-4 font-medium text-zinc-500 dark:text-zinc-400">Endpoint</th>
            <th className="text-left py-3 px-4 font-medium text-zinc-500 dark:text-zinc-400">Method</th>
            <th className="text-right py-3 px-4 font-medium text-zinc-500 dark:text-zinc-400">P50</th>
            <th className="text-right py-3 px-4 font-medium text-zinc-500 dark:text-zinc-400">P95</th>
            <th className="text-right py-3 px-4 font-medium text-zinc-500 dark:text-zinc-400">P99</th>
            <th className="text-right py-3 px-4 font-medium text-zinc-500 dark:text-zinc-400">Req/min</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
              <td className="py-3 px-4 font-mono text-zinc-900 dark:text-zinc-100">{row.endpoint}</td>
              <td className="py-3 px-4">
                <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                  row.method === 'GET' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                  row.method === 'POST' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                }`}>{row.method}</span>
              </td>
              <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">{row.p50}ms</td>
              <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">{row.p95}ms</td>
              <td className={`py-3 px-4 text-right font-mono ${row.p99 > 500 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-zinc-700 dark:text-zinc-300'}`}>{row.p99}ms</td>
              <td className="py-3 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">{row.requestsPerMin}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ErrorLogList({ logs, formatTime }: { logs: ErrorLogEntry[]; formatTime?: (iso: string) => string }) {
  const levelStyles = {
    error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    warn: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  };

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-700/30 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors">
          <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded mt-0.5 ${levelStyles[log.level]}`}>
            {log.level.toUpperCase()}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-zinc-900 dark:text-zinc-100 font-mono truncate">{log.message}</p>
            <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              <span>{log.service}</span>
              <span>·</span>
              <span>{formatTime ? formatTime(log.timestamp) : new Date(log.timestamp).toLocaleTimeString()}</span>
              {log.count > 1 && (
                <>
                  <span>·</span>
                  <span className="text-orange-600 dark:text-orange-400">{log.count}× occurrences</span>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Main Page Component ----------
export function PerformancePage() {
  const { projects } = useProjectStore();
  const { user } = useAuthStore();
  const [metrics] = useState(generateMetrics);
  const [responseTimes] = useState(generateResponseTimes);
  const [errorLogs] = useState(generateErrorLogs);
  const [liveValue, setLiveValue] = useState<number>(0);
  const [pollingData, setPollingData] = useState<{ timestamp: number; count: number }[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');
  const renderCountRef = useRef(0);
  const [alertCount, setAlertCount] = useState(0);

  // BUG:BZ-121 - localStorage Parsed on Every Render
  // getPreferences() calls JSON.parse(localStorage.getItem(...)) in the component
  // body — NOT inside a useMemo or useState initializer. This runs on every render
  // cycle, adding unnecessary parsing overhead on each frame.
  const preferences = getPreferences();

  // Log BZ-121 when preferences are parsed on render (after first render)
  if (renderCountRef.current > 0 && typeof window !== 'undefined') {
    window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
    if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-121')) {
      window.__PERCEPTR_TEST_BUGS__.push({
        bugId: 'BZ-121',
        timestamp: Date.now(),
        description: 'localStorage parsed on every render cycle via JSON.parse - should be cached/memoized',
        page: 'Performance'
      });
    }
  }

  // BUG:BZ-123 - Console.log Left in Production
  // Developer left a console.log that dumps the full user object (including
  // sensitive data like tokens) on every render. This is both a performance
  // drag and a security concern.
  // eslint-disable-next-line no-console
  console.log('PerformancePage user context:', user, { preferences, selectedTimeRange });
  if (typeof window !== 'undefined') {
    window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
    if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-123')) {
      window.__PERCEPTR_TEST_BUGS__.push({
        bugId: 'BZ-123',
        timestamp: Date.now(),
        description: 'console.log left in production code - logs user data including tokens on every render',
        page: 'Performance'
      });
    }
  }

  // BUG:BZ-124 - useEffect Runs on Every Render
  // Missing dependency array causes this effect to run on every render.
  // It fetches "alert" data from the API, then sets state, which triggers
  // a re-render, which triggers the effect again — creating an infinite loop
  // only throttled by React batching.
  useEffect(() => {
    fetch('/api/performance/alerts')
      .then(res => res.ok ? res.json() : { count: Math.floor(Math.random() * 5) + 1 })
      .catch(() => ({ count: Math.floor(Math.random() * 5) + 1 }))
      .then(data => {
        setAlertCount(data.count ?? 0);
      });

    if (typeof window !== 'undefined') {
      window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
      if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-124')) {
        window.__PERCEPTR_TEST_BUGS__.push({
          bugId: 'BZ-124',
          timestamp: Date.now(),
          description: 'useEffect without dependency array - fetches API on every render causing infinite loop',
          page: 'Performance'
        });
      }
    }
  }); // BUG: Missing dependency array — should be useEffect(() => { ... }, [])

  // BUG:BZ-100 - Event Listener Leak Causes Exponential Slowdown
  // Each render adds a new window resize listener without removing the previous one.
  // After many re-renders, there are dozens of listeners all firing on every resize,
  // causing the browser to hang when the window is resized.
  const [containerWidth, setContainerWidth] = useState(window.innerWidth);

  // BUG:BZ-100 - Missing cleanup and no dependency array causes listener to be added on every render
  renderCountRef.current += 1;
  useEffect(() => {
    const handleResize = () => {
      setContainerWidth(window.innerWidth);
    };
    // Adds a new listener every render but never removes the old one
    window.addEventListener('resize', handleResize);

    if (renderCountRef.current > 1) {
      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-100')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-100',
            timestamp: Date.now(),
            description: 'Event listener leak - resize listener added on every render without removing previous',
            page: 'Performance'
          });
        }
      }
    }

    // BUG: No cleanup function returned — listener never removed
  });

  // BUG:BZ-093 - Polling Interval Stacks
  // Dashboard-style polling that doesn't clear the interval on component unmount.
  // When the component unmounts and remounts (e.g., tab switch), a new interval is
  // created without stopping the old one. After 5 switches, there are 5 concurrent polls.
  useEffect(() => {
    // Simulated polling for real-time metrics data
    const pollMetrics = () => {
      setPollingData(prev => [
        ...prev.slice(-19),
        { timestamp: Date.now(), count: Math.floor(Math.random() * 500) + 800 }
      ]);
    };

    // BUG:BZ-093 - setInterval created but never cleared on unmount
    const intervalId = setInterval(pollMetrics, 5000);
    pollMetrics(); // Initial fetch

    if (typeof window !== 'undefined') {
      window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
      if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-093')) {
        window.__PERCEPTR_TEST_BUGS__.push({
          bugId: 'BZ-093',
          timestamp: Date.now(),
          description: 'Polling interval stacks - interval not cleared on unmount, duplicates accumulate',
          page: 'Performance'
        });
      }
    }

    // BUG: Should return () => clearInterval(intervalId) but doesn't
    void intervalId;
  }, []);

  const handleStreamUpdate = useCallback((data: { timestamp: number; value: number }) => {
    setLiveValue(data.value);
  }, []);

  // BUG:BZ-122 - Uses moment.js (with all locales imported) for trivial relative time formatting
  // that could be done with a simple function or lightweight library like dayjs (~2KB vs ~500KB)
  const timeAgo = (iso: string) => {
    return moment(iso).fromNow();
  };

  return (
    // BUG:BZ-125 - Font Loading Causes Invisible Text
    // The 'InterDisplay' font uses font-display: block, which makes ALL text on
    // this page invisible until the font file downloads. On slow 3G connections,
    // text can be invisible for 3+ seconds while images and backgrounds load fine.
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950" style={{ fontFamily: "'InterDisplay', system-ui, sans-serif" }} data-bug-id="BZ-125">
      {(() => {
        if (typeof window !== 'undefined') {
          window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
          if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-125')) {
            window.__PERCEPTR_TEST_BUGS__.push({
              bugId: 'BZ-125',
              timestamp: Date.now(),
              description: 'Custom font uses font-display: block causing invisible text on slow connections until font loads',
              page: 'Performance'
            });
          }
        }
        return null;
      })()}

      {/* BUG:BZ-098 - Memory leak component — subscribes on mount, never unsubscribes */}
      <div data-bug-id="BZ-098">
        <LiveMetricsStream onUpdate={handleStreamUpdate} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        {/* BUG:BZ-121 - preferences object parsed from localStorage on every render */}
        <div className="flex items-center justify-between mb-8" data-bug-id="BZ-121">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Performance Monitoring</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Real-time system health and performance metrics
              {preferences.compactMode && ' (compact)'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Live — {liveValue > 0 ? `${liveValue.toFixed(0)} req/s` : 'connecting...'}
            </div>
            <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
              {(['1h', '6h', '24h', '7d'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setSelectedTimeRange(range)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedTimeRange === range
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* BUG:BZ-122 - moment.js with ALL locales imported for trivial time formatting */}
        {/* Last updated timestamp using moment.js (500KB+ with all locales) */}
        <div className="flex items-center justify-end mb-2 text-xs text-zinc-400 dark:text-zinc-500" data-bug-id="BZ-122">
          <span>Last synced: {moment().subtract(2, 'minutes').fromNow()}</span>
          <span className="mx-2">·</span>
          <span>Next refresh: {moment().add(preferences.refreshInterval / 1000, 'seconds').format('HH:mm:ss')}</span>
          {(() => {
            if (typeof window !== 'undefined') {
              window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
              if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-122')) {
                window.__PERCEPTR_TEST_BUGS__.push({
                  bugId: 'BZ-122',
                  timestamp: Date.now(),
                  description: 'moment.js imported with ALL locales (~500KB) for trivial date formatting that could use native APIs',
                  page: 'Performance'
                });
              }
            }
            return null;
          })()}
        </div>

        {/* BUG:BZ-093 - Polling interval stacks — this section uses data from the buggy polling */}
        {/* Summary Metrics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8" data-bug-id="BZ-093">
          {metrics.map(metric => (
            <MetricCard key={metric.id} metric={metric} />
          ))}
        </div>

        {/* Service Health */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm mb-8">
          <div className="p-5 border-b border-zinc-200 dark:border-zinc-700">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Service Health</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-zinc-200 dark:bg-zinc-700">
            {serviceHealthData.map(service => (
              <div key={service.name} className="bg-white dark:bg-zinc-800 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-zinc-600 dark:text-zinc-300">{service.icon}</span>
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{service.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    service.status === 'healthy' ? 'bg-green-500' :
                    service.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  <span className={`text-xs font-medium ${
                    service.status === 'healthy' ? 'text-green-600 dark:text-green-400' :
                    service.status === 'degraded' ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                  <span>{service.uptime}% uptime</span>
                  <span>{service.latency}ms</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* BUG:BZ-100 - Event listener leak — containerWidth is read here, causing re-renders */}
        {/* Response Time & Throughput Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8" data-bug-id="BZ-100">
          <div className="lg:col-span-2 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Response Times</h2>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                Viewport: {containerWidth}px
              </span>
            </div>
            <div className="p-2">
              <ResponseTimeTable data={responseTimes} />
            </div>
          </div>

          {/* Throughput Chart Placeholder */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-700">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Throughput</h2>
            </div>
            <div className="p-5">
              <div className="space-y-3">
                {pollingData.slice(-8).map((d, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 w-16 font-mono">
                      {new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <div className="flex-1 h-4 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min((d.count / 1300) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-zinc-600 dark:text-zinc-300 w-12 text-right">{d.count}</span>
                  </div>
                ))}
                {pollingData.length === 0 && (
                  <div className="text-center py-8 text-zinc-400 dark:text-zinc-500 text-sm">
                    Waiting for data...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* BUG:BZ-124 - useEffect without dependency array fires fetchAlerts on every render */}
        {/* Alert Summary — driven by the buggy useEffect that re-fetches every render */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm mb-8" data-bug-id="BZ-124">
          <div className="p-5 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Active Alerts</h2>
            <span className="text-xs px-2 py-1 bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 rounded-full font-medium">
              {alertCount} active
            </span>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-red-500 rounded-full" />
                <span>Critical: {Math.max(0, alertCount - 2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-yellow-500 rounded-full" />
                <span>Warning: {Math.min(alertCount, 2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-500 rounded-full" />
                <span>Info: 0</span>
              </div>
            </div>
          </div>
        </div>

        {/* BUG:BZ-123 - console.log left in production, data logged on every render */}
        {/* Error Logs */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm mb-8" data-bug-id="BZ-123">
          <div className="p-5 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Recent Errors & Warnings</h2>
            <span className="text-xs px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 rounded-full font-medium">
              {errorLogs.filter(l => l.level === 'error').length} errors
            </span>
          </div>
          <div className="p-5">
            <ErrorLogList logs={errorLogs} formatTime={timeAgo} />
          </div>
        </div>

        {/* BUG:BZ-117 - Image Not Lazy Loaded Below Fold */}
        {/* Top Contributors — loads ALL 50 avatars eagerly even though only ~6 are visible */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm mb-8" data-bug-id="BZ-117">
          <div className="p-5 border-b border-zinc-200 dark:border-zinc-700">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Top Contributors — Performance Impact</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Team members ranked by code contributions affecting performance metrics</p>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
              {teamAvatarUrls.map((member) => (
                <div key={member.id} className="flex flex-col items-center text-center p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors">
                  {/* BUG:BZ-117 - All 50 images load eagerly — no loading="lazy" attribute */}
                  {/* On throttled network, initial page load takes 12+ seconds because all */}
                  {/* 50 high-res avatar images are downloaded simultaneously */}
                  <img
                    src={member.url}
                    alt={member.name}
                    width={64}
                    height={64}
                    className="w-16 h-16 rounded-full border-2 border-zinc-200 dark:border-zinc-600"
                  />
                  <span className="mt-2 text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate w-full">{member.name}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{member.role}</span>
                  <span className="text-xs font-mono text-blue-600 dark:text-blue-400">{member.contributions} commits</span>
                </div>
              ))}
            </div>
            {/* Log BZ-117 when all images start loading at once */}
            {(() => {
              if (typeof window !== 'undefined') {
                window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
                if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-117')) {
                  window.__PERCEPTR_TEST_BUGS__.push({
                    bugId: 'BZ-117',
                    timestamp: Date.now(),
                    description: 'All 50 team avatar images load eagerly without lazy loading - blocks initial render on slow networks',
                    page: 'Performance'
                  });
                }
              }
              return null;
            })()}
          </div>
        </div>

        {/* BUG:BZ-118 - Full lodash imported for one _.capitalize call */}
        {/* Project Health Overview */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm" data-bug-id="BZ-118">
          <div className="p-5 border-b border-zinc-200 dark:border-zinc-700">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Project Health Overview</h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(projects.length > 0 ? projects.slice(0, 9) : [
                { id: 'ph1', name: 'Website Redesign', status: 'active', progress: 72 },
                { id: 'ph2', name: 'Mobile App v2.0', status: 'active', progress: 48 },
                { id: 'ph3', name: 'API Integration', status: 'on_hold', progress: 91 },
                { id: 'ph4', name: 'Analytics Platform', status: 'active', progress: 35 },
                { id: 'ph5', name: 'Customer Portal', status: 'completed', progress: 100 },
                { id: 'ph6', name: 'Cloud Migration', status: 'active', progress: 63 },
              ]).map((project) => (
                <div key={project.id} className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {project.name}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      project.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      project.status === 'completed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {/* BUG:BZ-118 - lodash used here for trivial string formatting */}
                      {_.startCase(project.status.replace('_', ' '))}
                    </span>
                  </div>
                  <div className="h-2 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 block">{project.progress}% complete</span>
                </div>
              ))}
            </div>
            {(() => {
              if (typeof window !== 'undefined') {
                window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
                if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-118')) {
                  window.__PERCEPTR_TEST_BUGS__.push({
                    bugId: 'BZ-118',
                    timestamp: Date.now(),
                    description: 'Full lodash library (~70KB gzipped) imported for trivial _.capitalize and _.startCase usage',
                    page: 'Performance'
                  });
                }
              }
              return null;
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
