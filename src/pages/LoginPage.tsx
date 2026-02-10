import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Zap, AtSign, Lock } from 'lucide-react';

// BUG:BZ-003 - Overly aggressive sanitizer strips special characters from password
function sanitizeInput(value: string): string {
  // Intended to prevent XSS, but regex is too aggressive — strips valid password characters
  return value.replace(/[^a-zA-Z0-9]/g, '');
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithSSO, isLoading } = useAuthStore();
  const formRef = useRef<HTMLFormElement>(null);
  const submitCountRef = useRef(0);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // BUG:BZ-056 - Check localStorage for stale session on mount and auto-redirect
  useEffect(() => {
    const storedSession = localStorage.getItem('projecthub_session');
    if (storedSession) {
      try {
        const session = JSON.parse(storedSession);
        if (session.token) {
          // BUG:BZ-056 - Auto-redirect to dashboard using stale token from localStorage
          // The logout function doesn't clear this, so refreshing login page redirects back
          if (typeof window !== 'undefined') {
            window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
            if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-056')) {
              window.__PERCEPTR_TEST_BUGS__.push({
                bugId: 'BZ-056',
                timestamp: Date.now(),
                description: 'Logout does not clear localStorage - stale session auto-redirects',
                page: 'Login'
              });
            }
          }
          navigate('/dashboard');
          return;
        }
      } catch {
        // Invalid JSON in storage, ignore
      }
    }

    // BUG:BZ-065 - Check for persisted SSO session and auto-re-authenticate
    // After SSO logout, the local session is cleared but the SSO cookie remains,
    // so reopening the app automatically logs the user back in
    const ssoSession = localStorage.getItem('projecthub_sso_session');
    if (ssoSession) {
      try {
        const session = JSON.parse(ssoSession);
        if (session.token && session.provider) {
          if (typeof window !== 'undefined') {
            window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
            if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-065')) {
              window.__PERCEPTR_TEST_BUGS__.push({
                bugId: 'BZ-065',
                timestamp: Date.now(),
                description: 'SSO user auto-re-authenticated after logout — IdP session cookie was not cleared',
                page: 'Remaining Auth'
              });
            }
          }
          // Auto-re-authenticate using the persisted SSO cookie
          loginWithSSO(session.provider).then(() => navigate('/dashboard'));
        }
      } catch {
        // Invalid SSO session, ignore
      }
    }
  }, [navigate, loginWithSSO]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    // BUG:BZ-008 - Track submission count to detect double submit
    submitCountRef.current += 1;
    const currentSubmit = submitCountRef.current;

    try {
      await login(email, password);
      // Store session in localStorage (used by BZ-056 stale session check)
      localStorage.setItem('projecthub_session', JSON.stringify({
        token: 'auth_token_' + Date.now(),
        email,
      }));
      navigate('/dashboard');
    } catch {
      setError('Invalid email or password');
    }

    // BUG:BZ-008 - Log duplicate submission if more than one submit fired
    if (currentSubmit > 1) {
      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-008')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-008',
            timestamp: Date.now(),
            description: 'Form submits twice on Enter key press',
            page: 'Login'
          });
        }
      }
    }
  };

  // BUG:BZ-008 - Separate keydown listener for Enter also triggers submit, causing duplicate submissions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && formRef.current) {
        // This fires in addition to the form's native onSubmit, causing a double submit
        formRef.current.requestSubmit();
      }
    };

    const form = formRef.current;
    form?.addEventListener('keydown', handleKeyDown);
    return () => {
      form?.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl mb-4">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Welcome back</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">Sign in to your ProjectHub account</p>
        </div>

        {/* Form */}
        {/* BUG:BZ-070 - Rate limiting on login only checks successful attempts, not failed ones */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6" data-bug-id="BZ-070">
          {/* BUG:BZ-008 - Form has both keydown Enter listener and onSubmit, causing double submissions */}
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" data-bug-id="BZ-008">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg">
                {error}
              </div>
            )}

            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<AtSign className="w-5 h-5" />}
            />

            {/* BUG:BZ-003 - Password field sanitizer strips special characters */}
            <div data-bug-id="BZ-003">
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  // BUG:BZ-003 - sanitizeInput strips @, !, #, $, etc. from passwords
                  const sanitized = sanitizeInput(e.target.value);
                  setPassword(sanitized);

                  // Log when special characters are actually stripped
                  if (sanitized !== e.target.value) {
                    if (typeof window !== 'undefined') {
                      window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
                      if (!window.__PERCEPTR_TEST_BUGS__.find((b: { bugId: string }) => b.bugId === 'BZ-003')) {
                        window.__PERCEPTR_TEST_BUGS__.push({
                          bugId: 'BZ-003',
                          timestamp: Date.now(),
                          description: 'Password field strips special characters via aggressive sanitizer',
                          page: 'Login'
                        });
                      }
                    }
                  }
                }}
                leftIcon={<Lock className="w-5 h-5" />}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 border-zinc-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Remember me</span>
              </label>
              <a href="#" className="text-sm text-blue-600 hover:underline">
                Forgot password?
              </a>
            </div>

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Sign in
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-zinc-800 text-zinc-500">Or continue with</span>
            </div>
          </div>

          {/* BUG:BZ-065 - SSO login buttons — store SSO session that persists after logout */}
          <div className="grid grid-cols-2 gap-3" data-bug-id="BZ-065">
            <Button
              variant="outline"
              type="button"
              onClick={async () => {
                try {
                  await loginWithSSO('google');
                  localStorage.setItem('projecthub_session', JSON.stringify({
                    token: 'sso_google_' + Date.now(),
                    email: 'sso-google@example.com',
                  }));
                  navigate('/dashboard');
                } catch {
                  setError('Google sign-in failed');
                }
              }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={async () => {
                try {
                  await loginWithSSO('github');
                  localStorage.setItem('projecthub_session', JSON.stringify({
                    token: 'sso_github_' + Date.now(),
                    email: 'sso-github@example.com',
                  }));
                  navigate('/dashboard');
                } catch {
                  setError('GitHub sign-in failed');
                }
              }}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              GitHub
            </Button>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Don't have an account?{' '}
          <Link to="/signup" className="text-blue-600 hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
