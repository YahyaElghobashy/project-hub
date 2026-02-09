import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Avatar } from '../components/Avatar';
import { Card } from '../components/Card';

type Tab = 'profile' | 'notifications' | 'integrations' | 'appearance';

export function SettingsPage() {
  const { user, updateProfile } = useAuthStore();
  const { preferences, updatePreferences } = useNotificationStore();

  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isDark, setIsDark] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
  }, []);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await updateProfile({ name, email });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDarkMode = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    if (newIsDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
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
            <Card>
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
                <Input
                  label="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Input
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <div className="pt-4">
                  <Button onClick={handleSaveProfile} isLoading={isSaving}>
                    Save Changes
                  </Button>
                </div>
              </div>
            </Card>
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

          {/* Appearance Tab */}
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
                  <div className="flex gap-4">
                    <button
                      onClick={() => { setIsDark(false); document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }}
                      className={`
                        flex-1 p-4 rounded-lg border-2 transition-colors
                        ${!isDark ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}
                      `}
                    >
                      <div className="w-full h-20 bg-white rounded-lg border border-gray-200 mb-2" />
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Light</p>
                    </button>
                    <button
                      onClick={() => { setIsDark(true); document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); }}
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
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
