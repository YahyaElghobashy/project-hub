import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Avatar } from '../components/Avatar';
import { Card } from '../components/Card';
import { ThemeToggle } from '../components/ThemeToggle';

type Tab = 'profile' | 'notifications' | 'integrations' | 'appearance';

// BUG:BZ-004 - Country dropdown off-by-one: displayed label and stored value are offset by 1
const countries = [
  { label: 'United States', value: 'US' },
  { label: 'United Kingdom', value: 'GB' },
  { label: 'Canada', value: 'CA' },
  { label: 'Australia', value: 'AU' },
  { label: 'Germany', value: 'DE' },
  { label: 'France', value: 'FR' },
  { label: 'Japan', value: 'JP' },
  { label: 'Brazil', value: 'BR' },
];

export function SettingsPage() {
  const { user, updateProfile } = useAuthStore();
  const { preferences, updatePreferences } = useNotificationStore();

  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isDark, setIsDark] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('US');
  const [startDate, setStartDate] = useState('');
  const [storedStartDate, setStoredStartDate] = useState('');
  const [bio, setBio] = useState('');
  const [hasReferralCode, setHasReferralCode] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [budgetInput, setBudgetInput] = useState('');
  const [parsedBudget, setParsedBudget] = useState<number | null>(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [saveError, setSaveError] = useState('');
  const [teamActivity, setTeamActivity] = useState<{ user: string; action: string; time: string }[]>([]);
  const [activityLoaded, setActivityLoaded] = useState(false);
  const scrolledToHash = useRef(false);

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
  }, []);

  // BUG:BZ-064 - Fetch CSRF token on mount
  useEffect(() => {
    fetch('/api/auth/csrf-token')
      .then(res => res.json())
      .then(data => setCsrfToken(data.token))
      .catch(() => {});
  }, []);

  // BUG:BZ-064 - Auto-refresh session after idle period
  // This rotates the server-side CSRF token but does NOT re-fetch it for the client,
  // so the client's stored csrfToken becomes stale
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      fetch('/api/auth/refresh-session', { method: 'POST' })
        .catch(() => {});
      // NOTE: Does NOT call setCsrfToken — token is now stale
    }, 15000); // Refreshes every 15 seconds
    return () => clearInterval(refreshInterval);
  }, []);

  // BUG:BZ-026 - Hash fragment navigation scrolls to wrong position
  // Scrolls to anchor BEFORE dynamic content above finishes loading,
  // so the target section shifts down after the scroll completes
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && !scrolledToHash.current) {
      scrolledToHash.current = true;
      // Scroll immediately — before teamActivity loads and pushes content down
      const targetEl = document.querySelector(hash);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth' });

        if (typeof window !== 'undefined') {
          window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
          if (!window.__PERCEPTR_TEST_BUGS__.find((b: any) => b.bugId === 'BZ-026')) {
            window.__PERCEPTR_TEST_BUGS__.push({
              bugId: 'BZ-026',
              timestamp: Date.now(),
              description: 'Hash fragment scroll executes before dynamic content loads — lands on wrong section',
              page: 'Remaining Auth'
            });
          }
        }
      }
    }
  }, []);

  // Dynamic content that loads AFTER the hash scroll, pushing sections below it down
  useEffect(() => {
    if (activeTab === 'profile') {
      const timer = setTimeout(() => {
        setTeamActivity([
          { user: 'Sarah Chen', action: 'updated profile settings', time: '2 min ago' },
          { user: 'Marcus Johnson', action: 'changed notification preferences', time: '15 min ago' },
          { user: 'Aiko Tanaka', action: 'connected Slack integration', time: '1 hour ago' },
          { user: 'Diego Rivera', action: 'changed team permissions', time: '2 hours ago' },
          { user: 'Emma Wilson', action: 'updated billing information', time: '3 hours ago' },
          { user: 'Liam Patel', action: 'reset API token', time: '5 hours ago' },
        ]);
        setActivityLoaded(true);
      }, 800); // Loads after scroll has already happened
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  // BUG:BZ-017 - Form data encoding mangles Unicode names (diacritics, CJK, etc.)
  // Uses encodeURIComponent + unescape to "sanitize" — this converts UTF-8 to Latin-1, creating mojibake
  const sanitizeFormValue = (value: string): string => {
    // This is a common encoding mistake: converting UTF-8 through URI encoding
    // then unescaping as Latin-1, which corrupts non-ASCII characters
    try {
      return unescape(encodeURIComponent(value));
    } catch {
      return value;
    }
  };

  // BUG:BZ-064 - CSRF token mismatch after idle — form submission fails with 403
  // but the error handler shows "Network Error" instead of the real issue
  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      // Name displayed in UI stays correct (from 'name' state), but the value
      // sent to the API is mangled through the encoding conversion
      const encodedName = sanitizeFormValue(name);

      // Log bug when non-ASCII characters are present and get mangled
      if (encodedName !== name) {
        if (typeof window !== 'undefined') {
          window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
          if (!window.__PERCEPTR_TEST_BUGS__.find((b: any) => b.bugId === 'BZ-017')) {
            window.__PERCEPTR_TEST_BUGS__.push({
              bugId: 'BZ-017',
              timestamp: Date.now(),
              description: 'Unicode name mangled during form data encoding — mojibake stored in database',
              page: 'Settings'
            });
          }
        }
      }

      // BUG:BZ-064 - Include the (potentially stale) CSRF token in the request
      const response = await fetch(`/api/users/${user?.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ name: encodedName, email }),
      });

      if (!response.ok) {
        // BUG:BZ-064 - Error handler shows "Network Error" for all failures,
        // masking the real 403 CSRF mismatch error
        throw new Error('Network Error');
      }

      const updatedUser = await response.json();
      useAuthStore.getState().setUser(updatedUser);
    } catch (err: any) {
      // BUG:BZ-064 - Always shows misleading "Network Error" instead of the actual
      // CSRF token mismatch error, making it very hard to debug
      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find((b: any) => b.bugId === 'BZ-064')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-064',
            timestamp: Date.now(),
            description: 'CSRF token mismatch after session refresh — 403 error shown as Network Error',
            page: 'Remaining Auth'
          });
        }
      }
      setSaveError(err.message || 'Network Error');
    } finally {
      setIsSaving(false);
    }
  };

  // BUG:BZ-084 - FOUC on theme toggle — removes old class immediately but defers
  // applying new class, causing a single frame of un-styled content (white flash)
  const toggleDarkMode = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    // Remove the current theme class immediately
    document.documentElement.classList.remove('dark');
    if (newIsDark) {
      // Defer adding 'dark' by two animation frames, causing a white flash
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.documentElement.classList.add('dark');
        });
      });
    }
    localStorage.setItem('theme', newIsDark ? 'dark' : 'light');

    if (typeof window !== 'undefined') {
      window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
      if (!window.__PERCEPTR_TEST_BUGS__.find((b: any) => b.bugId === 'BZ-084')) {
        window.__PERCEPTR_TEST_BUGS__.push({
          bugId: 'BZ-084',
          timestamp: Date.now(),
          description: 'Theme toggle causes FOUC - class removed before new class applied, creating white flash',
          page: 'Visual/Layout'
        });
      }
    }
  };

  // BUG:BZ-004 - Dropdown handler stores value from wrong index (off by one)
  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedIndex = e.target.selectedIndex;
    // Off-by-one: use next index's value instead of selected index
    const storedValue = countries[Math.min(selectedIndex + 1, countries.length - 1)]?.value || countries[selectedIndex].value;
    setSelectedCountry(storedValue);

    if (typeof window !== 'undefined') {
      window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
      if (!window.__PERCEPTR_TEST_BUGS__.find((b: any) => b.bugId === 'BZ-004')) {
        window.__PERCEPTR_TEST_BUGS__.push({
          bugId: 'BZ-004',
          timestamp: Date.now(),
          description: 'Dropdown stores value offset by one index from displayed label',
          page: 'Settings'
        });
      }
    }
  };

  // BUG:BZ-005 - Date picker stores previous day due to UTC conversion
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateStr = e.target.value;
    setStartDate(dateStr);
    // Convert to Date object then back — this introduces the off-by-one day bug
    // new Date('2024-01-15') creates midnight UTC, toISOString gives correct date,
    // but using toLocaleDateString with the date object subtracts a day in negative UTC offsets
    if (dateStr) {
      const date = new Date(dateStr);
      // Store as ISO string — converting via toISOString without timezone adjustment
      // causes the date to shift back by one day for users in positive UTC offsets
      const isoDate = new Date(date.getTime()).toISOString().split('T')[0];
      setStoredStartDate(isoDate);

      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find((b: any) => b.bugId === 'BZ-005')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-005',
            timestamp: Date.now(),
            description: 'Date picker stores previous day due to UTC conversion bug',
            page: 'Settings'
          });
        }
      }
    }
  };

  // BUG:BZ-016 - European locale number parsing truncates at comma
  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setBudgetInput(raw);
    // Parse using parseFloat which stops at first non-numeric char (comma in European format)
    const parsed = parseFloat(raw);
    setParsedBudget(isNaN(parsed) ? null : parsed);

    if (raw.includes(',') && !isNaN(parsed)) {
      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find((b: any) => b.bugId === 'BZ-016')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-016',
            timestamp: Date.now(),
            description: 'European locale number format silently truncated at comma',
            page: 'Settings'
          });
        }
      }
    }
  };

  const tabs = [
    { id: 'profile' as Tab, label: 'Profile', icon: '👤' },
    { id: 'notifications' as Tab, label: 'Notifications', icon: '🔔' },
    { id: 'integrations' as Tab, label: 'Integrations', icon: '🔗' },
    { id: 'appearance' as Tab, label: 'Appearance', icon: '🎨' },
  ];

  const integrations = [
    {
      id: 'slack',
      name: 'Slack',
      description: 'Get notifications in your Slack workspace',
      connected: false,
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
        </svg>
      ),
    },
    {
      id: 'github',
      name: 'GitHub',
      description: 'Link repositories and track issues',
      connected: true,
      icon: (
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
          <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      id: 'jira',
      name: 'Jira',
      description: 'Sync tasks and track progress',
      connected: false,
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <nav className="lg:w-48 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap
                transition-colors duration-200
                ${
                  activeTab === tab.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 max-w-2xl">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* BUG:BZ-026 - Quick section links using hash fragments */}
              <div data-bug-id="BZ-026" className="flex gap-3 flex-wrap">
                <a
                  href="#profile-info"
                  onClick={(e) => {
                    e.preventDefault();
                    document.querySelector('#profile-info')?.scrollIntoView({ behavior: 'smooth' });

                    if (typeof window !== 'undefined') {
                      window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
                      if (!window.__PERCEPTR_TEST_BUGS__.find((b: any) => b.bugId === 'BZ-026')) {
                        window.__PERCEPTR_TEST_BUGS__.push({
                          bugId: 'BZ-026',
                          timestamp: Date.now(),
                          description: 'Hash fragment scroll executes before dynamic content loads — lands on wrong section',
                          page: 'Remaining Auth'
                        });
                      }
                    }
                  }}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Profile Info
                </a>
                <a
                  href="#billing"
                  onClick={(e) => {
                    e.preventDefault();
                    // BUG:BZ-026 - Scrolls to #billing immediately, but the team activity section
                    // above may still be loading, which will push #billing further down the page
                    document.querySelector('#billing')?.scrollIntoView({ behavior: 'smooth' });

                    if (typeof window !== 'undefined') {
                      window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
                      if (!window.__PERCEPTR_TEST_BUGS__.find((b: any) => b.bugId === 'BZ-026')) {
                        window.__PERCEPTR_TEST_BUGS__.push({
                          bugId: 'BZ-026',
                          timestamp: Date.now(),
                          description: 'Hash fragment scroll executes before dynamic content loads — lands on wrong section',
                          page: 'Remaining Auth'
                        });
                      }
                    }
                  }}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Billing & Referral
                </a>
                <a
                  href="#danger-zone"
                  onClick={(e) => {
                    e.preventDefault();
                    document.querySelector('#danger-zone')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Danger Zone
                </a>
              </div>

              <Card>
                <div id="profile-info">
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                  Profile Information
                </h2>
                <div className="flex items-center gap-4 mb-6">
                  <Avatar src={user?.avatar} name={user?.name} size="xl" />
                  <div>
                    <Button variant="outline" size="sm">
                      Change Avatar
                    </Button>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      JPG, PNG or GIF. Max 2MB.
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  {/* BUG:BZ-017 - Unicode names mangled during form encoding on save */}
                  <div data-bug-id="BZ-017">
                    <Input
                      label="Full Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <Input
                    label="Email Address"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />

                  {/* BUG:BZ-004 - Country dropdown stores wrong value (off by one index) */}
                  <div data-bug-id="BZ-004" className="w-full">
                    <label
                      htmlFor="country"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Country
                    </label>
                    <select
                      id="country"
                      value={selectedCountry}
                      onChange={handleCountryChange}
                      className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {countries.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Selected value: {selectedCountry}
                    </p>
                  </div>

                  {/* BUG:BZ-005 - Date picker stores previous day due to UTC conversion */}
                  <div data-bug-id="BZ-005" className="w-full">
                    <label
                      htmlFor="start-date"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Start Date
                    </label>
                    <input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={handleDateChange}
                      className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {storedStartDate && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Stored as: {storedStartDate}
                      </p>
                    )}
                  </div>

                  {/* BUG:BZ-009 - Textarea with fixed height and overflow hidden */}
                  <div data-bug-id="BZ-009" className="w-full">
                    <label
                      htmlFor="bio"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Bio
                    </label>
                    <textarea
                      id="bio"
                      value={bio}
                      onChange={(e) => {
                        setBio(e.target.value);
                        // Log bug when content exceeds visible area
                        if (e.target.value.length > 200) {
                          if (typeof window !== 'undefined') {
                            window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
                            if (!window.__PERCEPTR_TEST_BUGS__.find((b: any) => b.bugId === 'BZ-009')) {
                              window.__PERCEPTR_TEST_BUGS__.push({
                                bugId: 'BZ-009',
                                timestamp: Date.now(),
                                description: 'Textarea content overflows with no scroll — text hidden below fold',
                                page: 'Settings'
                              });
                            }
                          }
                        }
                      }}
                      placeholder="Tell us about yourself..."
                      rows={3}
                      style={{ height: '80px', overflow: 'hidden', resize: 'none' }}
                      className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Brief description for your profile. Max 500 characters.
                    </p>
                  </div>

                  {/* BUG:BZ-064 - CSRF token mismatch after session refresh shows misleading error */}
                  <div className="pt-4" data-bug-id="BZ-064">
                    {saveError && (
                      <div className="mb-3 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg">
                        {saveError}
                      </div>
                    )}
                    <Button onClick={() => { setSaveError(''); handleSaveProfile(); }} isLoading={isSaving}>
                      Save Changes
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Team Activity — loads dynamically after delay, pushing content below it */}
              {activityLoaded && teamActivity.length > 0 && (
                <Card>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Recent Team Activity
                  </h2>
                  <div className="space-y-3">
                    {teamActivity.map((activity, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-medium text-blue-600 dark:text-blue-400">
                            {activity.user.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <p className="text-sm text-gray-900 dark:text-white">
                              <span className="font-medium">{activity.user}</span>{' '}
                              {activity.action}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{activity.time}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Billing & Referral Section */}
              <Card>
                <div id="billing"></div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                  Billing & Referral
                </h2>
                <div className="space-y-4">
                  {/* BUG:BZ-016 - Locale-specific number parsing silently fails */}
                  <div data-bug-id="BZ-016" className="w-full">
                    <label
                      htmlFor="budget"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Monthly Budget
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 text-sm">$</span>
                      <input
                        id="budget"
                        type="text"
                        value={budgetInput}
                        onChange={handleBudgetChange}
                        placeholder="1,234.56"
                        className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 pl-7 pr-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    {parsedBudget !== null && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Parsed value: ${parsedBudget.toFixed(2)}
                      </p>
                    )}
                  </div>

                  {/* BUG:BZ-015 - Conditional referral code field doesn't clear when hidden */}
                  <div data-bug-id="BZ-015">
                    <label className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          I have a referral code
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Apply a referral code for a discount
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={hasReferralCode}
                        onChange={(e) => {
                          setHasReferralCode(e.target.checked);
                          // BUG: Does NOT clear referralCode when unchecked
                          // The referral code stays in state and gets submitted
                        }}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </label>
                    {hasReferralCode && (
                      <div className="mt-3">
                        <Input
                          label="Referral Code"
                          value={referralCode}
                          onChange={(e) => setReferralCode(e.target.value)}
                          placeholder="Enter your referral code"
                        />
                      </div>
                    )}
                    {/* Hidden field always submits the referral code value */}
                    <input type="hidden" name="referralCode" value={referralCode} />
                  </div>

                  <div className="pt-4">
                    <Button
                      onClick={() => {
                        // The payload always includes referralCode even when toggle is off
                        const payload = {
                          budget: parsedBudget,
                          referralCode: referralCode, // BUG: should check hasReferralCode
                          country: selectedCountry,
                          startDate: storedStartDate,
                          bio,
                        };
                        console.log('Submitting billing settings:', payload);

                        // Log BZ-015 when referral code is submitted while toggle is off
                        if (!hasReferralCode && referralCode) {
                          if (typeof window !== 'undefined') {
                            window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
                            if (!window.__PERCEPTR_TEST_BUGS__.find((b: any) => b.bugId === 'BZ-015')) {
                              window.__PERCEPTR_TEST_BUGS__.push({
                                bugId: 'BZ-015',
                                timestamp: Date.now(),
                                description: 'Hidden referral code field still submitted in payload after toggle off',
                                page: 'Settings'
                              });
                            }
                          }
                        }
                      }}
                    >
                      Save Billing Settings
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Danger Zone — target for hash fragment scroll */}
              <Card>
                <div id="danger-zone"></div>
                <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4">
                  Danger Zone
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Irreversible and destructive actions for your account.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border border-red-200 dark:border-red-800 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Delete Account</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Permanently delete your account and all data</p>
                    </div>
                    <Button variant="outline" size="sm" className="text-red-600 border-red-300 hover:bg-red-50">
                      Delete Account
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-3 border border-red-200 dark:border-red-800 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Export Data</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Download all your data before deletion</p>
                    </div>
                    <Button variant="outline" size="sm">
                      Export
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Notification Preferences
              </h2>
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    Notification Channels
                  </h3>
                  <div className="space-y-3">
                    {[
                      { key: 'email', label: 'Email notifications', description: 'Receive updates via email' },
                      { key: 'push', label: 'Push notifications', description: 'Browser push notifications' },
                      { key: 'inApp', label: 'In-app notifications', description: 'Notifications in the app' },
                    ].map((item) => (
                      <label key={item.key} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {item.label}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {item.description}
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={preferences[item.key as keyof typeof preferences] as boolean}
                          onChange={(e) => updatePreferences({ [item.key]: e.target.checked })}
                          className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    Notification Types
                  </h3>
                  <div className="space-y-3">
                    {[
                      { key: 'taskAssigned', label: 'Task assigned to me' },
                      { key: 'taskCompleted', label: 'Task completed' },
                      { key: 'taskDueSoon', label: 'Task due soon' },
                      { key: 'comments', label: 'New comments' },
                      { key: 'mentions', label: 'Mentions' },
                    ].map((item) => (
                      <label key={item.key} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
                        <input
                          type="checkbox"
                          checked={preferences[item.key as keyof typeof preferences] as boolean}
                          onChange={(e) => updatePreferences({ [item.key]: e.target.checked })}
                          className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Integrations Tab */}
          {activeTab === 'integrations' && (
            <div className="space-y-4">
              <Card className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Connected Apps
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Connect your favorite tools to streamline your workflow
                </p>
              </Card>
              {integrations.map((integration) => (
                <Card key={integration.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-gray-700 dark:text-gray-300">{integration.icon}</div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {integration.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {integration.description}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant={integration.connected ? 'outline' : 'primary'}
                    size="sm"
                  >
                    {integration.connected ? 'Disconnect' : 'Connect'}
                  </Button>
                </Card>
              ))}
            </div>
          )}

          {/* Appearance Tab — BZ-084: FOUC on theme toggle */}
          {activeTab === 'appearance' && (
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Appearance
              </h2>
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    Theme
                  </h3>
                  {/* BUG:BZ-084 - Both the card buttons and the toggle use toggleDarkMode
                      which removes the class before applying, causing FOUC */}
                  <div data-bug-id="BZ-084" className="flex gap-4">
                    <button
                      onClick={() => { if (isDark) toggleDarkMode(); }}
                      className={`
                        flex-1 p-4 rounded-lg border-2 transition-colors
                        ${!isDark ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}
                      `}
                    >
                      <div className="w-full h-20 bg-white rounded-lg border border-gray-200 mb-2" />
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Light</p>
                    </button>
                    <button
                      onClick={() => { if (!isDark) toggleDarkMode(); }}
                      className={`
                        flex-1 p-4 rounded-lg border-2 transition-colors
                        ${isDark ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}
                      `}
                    >
                      <div className="w-full h-20 bg-gray-900 rounded-lg border border-gray-700 mb-2" />
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Dark</p>
                    </button>
                  </div>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Dark Mode</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Toggle dark mode on or off</p>
                    </div>
                    <ThemeToggle />
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
