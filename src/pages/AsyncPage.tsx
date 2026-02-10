import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Input } from '../components/Input';

// ============ TYPES ============

interface ActivityItem {
  id: string;
  user: string;
  action: string;
  target: string;
  timestamp: string;
}

interface Order {
  id: string;
  product: string;
  quantity: number;
  total: number;
  status: 'pending' | 'confirmed' | 'failed';
  createdAt: string;
}

interface FeedItem {
  id: string;
  title: string;
  body: string;
  category: string;
  createdAt: string;
}

interface LiveEvent {
  id: string;
  type: 'update' | 'alert' | 'message';
  content: string;
  channel: string;
  receivedAt: string;
}

// ============ MOCK DATA GENERATORS ============

const userNames = ['Sarah Chen', 'Mike Johnson', 'Emily Davis', 'James Wilson', 'Priya Patel', 'Alex Thompson', 'Rachel Kim', 'David Martinez'];
const actions = ['updated', 'created', 'commented on', 'completed', 'assigned', 'closed', 'reopened', 'reviewed'];
const targets = ['Task: API Integration', 'Project: Dashboard Redesign', 'Issue: Login Bug', 'PR: Feature Branch', 'Doc: Architecture Guide', 'Sprint: Q1 Planning', 'Ticket: Performance Fix'];

const generateActivity = (count: number): ActivityItem[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `act-${Date.now()}-${i}`,
    user: userNames[Math.floor(Math.random() * userNames.length)],
    action: actions[Math.floor(Math.random() * actions.length)],
    target: targets[Math.floor(Math.random() * targets.length)],
    timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
  }));

const feedCategories = ['Engineering', 'Product', 'Design', 'Marketing', 'Operations'];
const feedTitles = [
  'Sprint retrospective summary',
  'New deployment pipeline ready',
  'Customer feedback analysis Q4',
  'API rate limit changes',
  'Database migration complete',
  'Security patch released',
  'Performance benchmarks updated',
  'Team standup notes',
  'Release candidate review',
  'Infrastructure cost report',
  'Feature flag rollout plan',
  'Code review guidelines updated',
  'Incident postmortem published',
  'Analytics dashboard redesigned',
  'Onboarding flow improvements',
];

const generateFeedPage = (page: number, pageSize: number): FeedItem[] =>
  Array.from({ length: pageSize }, (_, i) => ({
    id: `feed-${page}-${i}`,
    title: feedTitles[(page * pageSize + i) % feedTitles.length],
    body: `This is a detailed description of the feed item. It contains relevant information about recent changes and updates to the project. Page ${page}, Item ${i + 1}.`,
    category: feedCategories[Math.floor(Math.random() * feedCategories.length)],
    createdAt: new Date(Date.now() - (page * pageSize + i) * 300000).toISOString(),
  }));

// ============ PAGE COMPONENT ============

export function AsyncPage() {
  const navigate = useNavigate();

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Activity & Updates</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Real-time activity feed, orders, and collaborative editing
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BZ-089: Stale Data After Background Tab */}
        <StaleDataFeed />

        {/* BZ-090: Retry Logic Creates Duplicates */}
        <OrderSubmission />
      </div>

      {/* BZ-091: Infinite Scroll Stops Working After Error */}
      <div className="mt-6">
        <InfiniteScrollFeed />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* BZ-092: Debounced Save Loses Last Edit */}
        <AutoSaveEditor />

        {/* BZ-095: WebSocket Reconnect Loses Subscription */}
        <LiveUpdatesPanel />
      </div>
    </div>
  );
}

// ============ BZ-089: STALE DATA AFTER BACKGROUND TAB ============

// BUG:BZ-089 - Stale Data After Background Tab
// Data is fetched once on mount but never refetched when the user returns
// from a background tab. No visibilitychange listener to refresh data.
function StaleDataFeed() {
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  // Fetch activity data — only runs on mount, never on tab focus
  const fetchActivity = useCallback(() => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setActivity(generateActivity(8));
      setLastFetched(new Date());
      setLoading(false);
    }, 600);
  }, []);

  useEffect(() => {
    fetchActivity();
    // BUG:BZ-089 - No visibilitychange listener to refetch when tab becomes visible
    // Should add: document.addEventListener('visibilitychange', handleVisibilityChange)
    // where handleVisibilityChange calls fetchActivity() when document.visibilityState === 'visible'

    if (typeof window !== 'undefined') {
      window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
      if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-089')) {
        window.__PERCEPTR_TEST_BUGS__.push({
          bugId: 'BZ-089',
          timestamp: Date.now(),
          description: 'No refetch on tab visibility change — data stays stale after returning from background tab',
          page: 'Async/Loading',
        });
      }
    }
  }, [fetchActivity]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${Math.floor(diffMins / 60)}h ago`;
  };

  return (
    <div data-bug-id="BZ-089">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
          {lastFetched && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Updated {formatTime(lastFetched.toISOString())}
            </span>
          )}
        </div>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-6 w-6 border-4 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {activity.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30"
              >
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-xs font-medium text-blue-600 dark:text-blue-400 flex-shrink-0">
                  {item.user.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white">
                    <span className="font-medium">{item.user}</span>{' '}
                    <span className="text-gray-500 dark:text-gray-400">{item.action}</span>{' '}
                    <span className="text-blue-600 dark:text-blue-400">{item.target}</span>
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {formatTime(item.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ============ BZ-090: RETRY LOGIC CREATES DUPLICATES ============

// BUG:BZ-090 - Retry Logic Creates Duplicates
// Auto-retry on network error doesn't check if the first attempt actually succeeded.
// The client times out before receiving the server's 200 response, then retries,
// creating duplicate orders.
function OrderSubmission() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [product, setProduct] = useState('Widget Pro');
  const [quantity, setQuantity] = useState(1);
  const retryCountRef = useRef(0);

  const submitOrder = useCallback(async () => {
    setIsSubmitting(true);
    retryCountRef.current = 0;

    const orderData = {
      product,
      quantity,
      total: quantity * 29.99,
    };

    // BUG:BZ-090 - Retry logic that doesn't use idempotency keys
    // Each retry generates a new order on the server because there's no
    // deduplication mechanism. The first request may succeed on the server
    // but the client times out, leading to retries that create duplicates.
    const attemptSubmit = async (attempt: number): Promise<Order> => {
      try {
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        retryCountRef.current = attempt;
        // Retry up to 3 times on failure — but no idempotency key means
        // each retry creates a separate order if the server processed the request
        if (attempt < 3) {
          // Small delay before retry
          await new Promise(resolve => setTimeout(resolve, 500));
          return attemptSubmit(attempt + 1);
        }
        throw error;
      }
    };

    try {
      const result = await attemptSubmit(0);
      setOrders(prev => [result, ...prev]);

      // Log bug when retries occurred (duplicates were likely created)
      if (retryCountRef.current > 0) {
        if (typeof window !== 'undefined') {
          window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
          if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-090')) {
            window.__PERCEPTR_TEST_BUGS__.push({
              bugId: 'BZ-090',
              timestamp: Date.now(),
              description: `Retry logic created potential duplicates: ${retryCountRef.current + 1} attempts without idempotency key`,
              page: 'Async/Loading',
            });
          }
        }
      }
    } catch {
      // Even on final failure, previous retries may have created orders server-side
      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-090')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-090',
            timestamp: Date.now(),
            description: 'Retry logic creates duplicates — no idempotency key on order submission',
            page: 'Async/Loading',
          });
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [product, quantity]);

  return (
    <div data-bug-id="BZ-090">
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Submit Order</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Product
            </label>
            <select
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Widget Pro">Widget Pro — $29.99</option>
              <option value="Widget Basic">Widget Basic — $14.99</option>
              <option value="Widget Enterprise">Widget Enterprise — $99.99</option>
            </select>
          </div>
          <div>
            <Input
              label="Quantity"
              type="number"
              value={quantity.toString()}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Total: ${(quantity * 29.99).toFixed(2)}
            </span>
            <Button onClick={submitOrder} isLoading={isSubmitting}>
              Place Order
            </Button>
          </div>
        </div>

        {orders.length > 0 && (
          <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recent Orders</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg text-sm"
                >
                  <span className="text-gray-900 dark:text-white">{order.product} x{order.quantity}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">${order.total.toFixed(2)}</span>
                    <Badge variant={order.status === 'confirmed' ? 'success' : order.status === 'pending' ? 'warning' : 'error'}>
                      {order.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ============ BZ-091: INFINITE SCROLL STOPS WORKING AFTER ERROR ============

// BUG:BZ-091 - Infinite Scroll Stops Working After Error
// When a page load fails, the error is swallowed, hasMore remains true,
// but the scroll listener is removed. The user can never load more items.
function InfiniteScrollFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollListenerAttached = useRef(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const loadPage = useCallback(async (pageNum: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    try {
      const response = await fetch(`/api/feed?page=${pageNum}&limit=10`);

      if (!response.ok) {
        throw new Error('Feed loading failed');
      }

      const data = await response.json();
      setItems(prev => [...prev, ...data.items]);
      setPage(pageNum);
      setHasMore(data.hasMore);
    } catch {
      // BUG:BZ-091 - Error is swallowed silently.
      // hasMore stays true but we remove the scroll listener.
      // The user cannot load more content even after network recovery.
      scrollListenerAttached.current = false;

      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-091')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-091',
            timestamp: Date.now(),
            description: 'Infinite scroll stops after error — scroll listener removed, hasMore still true, no retry UI',
            page: 'Async/Loading',
          });
        }
      }
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadPage(0);
  }, [loadPage]);

  // Scroll handler — removed permanently on error
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // BUG: Once scrollListenerAttached is false (after error), this check
      // prevents any further page loads, even if the network recovers
      if (!scrollListenerAttached.current || loadingRef.current || !hasMore) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollTop + clientHeight >= scrollHeight - 100) {
        loadPage(page + 1);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [page, hasMore, loadPage]);

  return (
    <div data-bug-id="BZ-091">
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Updates Feed</h2>
        <div
          ref={containerRef}
          className="max-h-96 overflow-y-auto space-y-3 pr-1"
        >
          {items.map((item) => (
            <div
              key={item.id}
              className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">{item.title}</h3>
                <Badge variant="default">{item.category}</Badge>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{item.body}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {new Date(item.createdAt).toLocaleTimeString()}
              </p>
            </div>
          ))}
          {loading && (
            <div className="flex justify-center py-4">
              <div className="animate-spin h-5 w-5 border-3 border-blue-600 border-t-transparent rounded-full" />
            </div>
          )}
          {!hasMore && items.length > 0 && (
            <p className="text-center text-sm text-gray-400 py-2">No more updates</p>
          )}
          {items.length === 0 && !loading && (
            <p className="text-center text-sm text-gray-400 py-8">No updates yet</p>
          )}
        </div>
      </Card>
    </div>
  );
}

// ============ BZ-092: DEBOUNCED SAVE LOSES LAST EDIT ============

// BUG:BZ-092 - Debounced Save Loses Last Edit
// Auto-save is debounced at 2 seconds. If the user edits and navigates away
// within the debounce window, the timer is cancelled by the cleanup function
// and the last edit is never saved.
function AutoSaveEditor() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('Project Architecture Notes');
  const [content, setContent] = useState(
    'This document outlines the key architectural decisions for our platform.\n\n' +
    '1. Microservices vs Monolith: We chose a modular monolith...\n' +
    '2. Database: PostgreSQL for transactional data...\n' +
    '3. Caching: Redis for session management...'
  );
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [lastSavedContent, setLastSavedContent] = useState(content);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Simulate saving to API
  const saveToServer = useCallback(async (text: string) => {
    setSaveStatus('saving');
    try {
      await fetch('/api/notes/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content: text }),
      });
      setSaveStatus('saved');
      setLastSavedContent(text);
    } catch {
      setSaveStatus('unsaved');
    }
  }, [title]);

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    setSaveStatus('unsaved');

    // BUG:BZ-092 - Cancel existing debounce timer and start a new one
    // If the user navigates away before this timer fires, the edit is lost
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      saveToServer(newContent);
    }, 2000);
  }, [saveToServer]);

  // Cleanup on unmount — cancels pending debounce, losing unsaved edits
  useEffect(() => {
    return () => {
      // BUG: This cleanup cancels the debounce timer without flushing the save.
      // Should call saveToServer(content) synchronously before clearing the timer.
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-092')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-092',
            timestamp: Date.now(),
            description: 'Debounced auto-save cancelled on unmount — last edit lost when navigating away',
            page: 'Async/Loading',
          });
        }
      }
    };
  }, []);

  const hasUnsavedChanges = content !== lastSavedContent;

  return (
    <div data-bug-id="BZ-092">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Notes</h2>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full ${
              saveStatus === 'saved'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : saveStatus === 'saving'
                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
            }`}>
              {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved changes'}
            </span>
          </div>
        </div>
        <div className="space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="block w-full text-lg font-medium text-gray-900 dark:text-white bg-transparent border-0 border-b border-gray-200 dark:border-gray-700 px-0 py-2 focus:outline-none focus:border-blue-500"
            placeholder="Document title..."
          />
          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            rows={8}
            className="block w-full text-sm text-gray-700 dark:text-gray-300 bg-transparent border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            placeholder="Start writing..."
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Auto-saves after 2 seconds of inactivity
          </p>
          {hasUnsavedChanges && (
            <button
              onClick={() => navigate('/dashboard')}
              className="text-xs text-blue-600 hover:underline"
            >
              Navigate away (unsaved changes will be lost)
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}

// ============ BZ-095: WEBSOCKET RECONNECT LOSES SUBSCRIPTION ============

// BUG:BZ-095 - WebSocket Reconnect Loses Subscription
// Simulates a WebSocket connection that auto-reconnects after disconnect
// but doesn't re-subscribe to channels. New events stop arriving.
function LiveUpdatesPanel() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const [subscribedChannel, setSubscribedChannel] = useState('project-updates');
  const wsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSubscribedRef = useRef(false);
  const reconnectCountRef = useRef(0);

  // Simulate WebSocket event stream
  const startEventStream = useCallback(() => {
    if (wsIntervalRef.current) {
      clearInterval(wsIntervalRef.current);
    }

    wsIntervalRef.current = setInterval(() => {
      // BUG:BZ-095 - After reconnect, isSubscribedRef is still false
      // because resubscription never happens. Events are silently dropped.
      if (!isSubscribedRef.current) {
        return; // Not subscribed — events are lost
      }

      const eventTypes: LiveEvent['type'][] = ['update', 'alert', 'message'];
      const contents = [
        'Task "API Gateway" moved to Done',
        'New comment on PR #234',
        'Build #891 passed all tests',
        'Deployment to staging complete',
        'Sprint velocity updated',
        'New team member joined #general',
      ];

      const newEvent: LiveEvent = {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
        content: contents[Math.floor(Math.random() * contents.length)],
        channel: subscribedChannel,
        receivedAt: new Date().toISOString(),
      };

      setEvents(prev => [newEvent, ...prev].slice(0, 20));
    }, 3000);
  }, [subscribedChannel]);

  // Simulate initial connection + subscription
  const connect = useCallback(() => {
    setConnectionStatus('connected');
    isSubscribedRef.current = true;
    startEventStream();
  }, [startEventStream]);

  // Simulate disconnect (network blip)
  const simulateDisconnect = useCallback(() => {
    setConnectionStatus('disconnected');
    isSubscribedRef.current = false;
    if (wsIntervalRef.current) {
      clearInterval(wsIntervalRef.current);
      wsIntervalRef.current = null;
    }

    // Auto-reconnect after 2 seconds
    setTimeout(() => {
      setConnectionStatus('reconnecting');
      setTimeout(() => {
        reconnectCountRef.current++;
        setConnectionStatus('connected');
        // BUG:BZ-095 - Reconnect re-establishes the connection (starts event stream)
        // but does NOT re-subscribe to the channel.
        // isSubscribedRef.current remains false, so events are silently dropped.
        startEventStream();

        if (typeof window !== 'undefined') {
          window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
          if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-095')) {
            window.__PERCEPTR_TEST_BUGS__.push({
              bugId: 'BZ-095',
              timestamp: Date.now(),
              description: 'WebSocket reconnect establishes connection but does not re-subscribe to channel — events silently dropped',
              page: 'Async/Loading',
            });
          }
        }
      }, 1000);
    }, 2000);
  }, [startEventStream]);

  // Initial connect on mount
  useEffect(() => {
    connect();
    return () => {
      if (wsIntervalRef.current) {
        clearInterval(wsIntervalRef.current);
      }
    };
  }, [connect]);

  return (
    <div data-bug-id="BZ-095">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Live Updates</h2>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500' :
              connectionStatus === 'reconnecting' ? 'bg-yellow-500 animate-pulse' :
              'bg-red-500'
            }`} />
            <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
              {connectionStatus}
            </span>
            {reconnectCountRef.current > 0 && (
              <span className="text-xs text-gray-400">
                (reconnected {reconnectCountRef.current}x)
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <select
            value={subscribedChannel}
            onChange={(e) => setSubscribedChannel(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="project-updates">Project Updates</option>
            <option value="team-chat">Team Chat</option>
            <option value="deploy-notifications">Deploy Notifications</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={simulateDisconnect}
            disabled={connectionStatus !== 'connected'}
          >
            Simulate Disconnect
          </Button>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-4">
              {connectionStatus === 'connected' ? 'Waiting for events...' : 'Disconnected — no events'}
            </p>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/30"
              >
                <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                  event.type === 'alert'
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                    : event.type === 'message'
                    ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                    : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                  {event.type === 'alert' ? '!' : event.type === 'message' ? 'M' : 'U'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white">{event.content}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(event.receivedAt).toLocaleTimeString()} · #{event.channel}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
