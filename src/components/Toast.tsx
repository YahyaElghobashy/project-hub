import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { Check, X, AlertTriangle, Info } from 'lucide-react';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (type: ToastMessage['type'], message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Return a no-op toast if used outside provider
    return {
      showToast: (_type: ToastMessage['type'], _message: string, _duration?: number) => {}
    };
  }
  return context;
}

const toastIconMap = {
  success: <Check className="w-5 h-5 text-green-500" />,
  error: <X className="w-5 h-5 text-red-500" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
  info: <Info className="w-5 h-5 text-blue-500" />,
};

// BUG:BZ-073 - Dark mode misses components — Toast uses hardcoded light-theme colors
// instead of dark: variants. In dark mode, toasts appear as bright white elements
// on the dark background, creating a jarring visual mismatch.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((type: ToastMessage['type'], message: string, duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts(prev => [...prev, { id, type, message, duration }]);

    // BUG:BZ-073 - Log when toast appears while dark mode is active
    if (typeof window !== 'undefined' && document.documentElement.classList.contains('dark')) {
      window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
      if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-073')) {
        window.__PERCEPTR_TEST_BUGS__.push({
          bugId: 'BZ-073',
          timestamp: Date.now(),
          description: 'Toast notification uses light theme colors in dark mode - jarring white element on dark UI',
          page: 'Visual/Layout'
        });
      }
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" data-bug-id="BZ-073">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, toast.duration || 4000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  return (
    // BUG:BZ-073 - Hardcoded bg-white, text-gray-900, border-gray-200 — no dark: variants
    // This creates a bright white toast on dark backgrounds when dark mode is active
    <div
      className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[300px] max-w-md animate-in slide-in-from-right fade-in duration-300"
      role="alert"
    >
      {toastIconMap[toast.type]}
      <p className="flex-1 text-sm text-gray-900">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="p-1 text-gray-400 hover:text-gray-600 rounded"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
