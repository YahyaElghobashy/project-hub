import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

declare global {
  interface Window {
    __PERCEPTR_TEST_BUGS__: Array<{
      bugId: string;
      timestamp: number;
      description: string;
      page: string;
    }>;
  }
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
}

const sizeStyles = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // BUG:BZ-021 - Opening modal pushes a history entry; browser back closes modal AND navigates away
  useEffect(() => {
    if (isOpen) {
      window.history.pushState({ modal: true }, '');

      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-021')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-021',
            timestamp: Date.now(),
            description: 'Modal pushes history entry - back button navigates away instead of just closing',
            page: 'Navigation/Global'
          });
        }
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  // BUG:BZ-071 - Modal overflow hidden on mobile — content uses max-height with overflow-hidden
  // instead of overflow-auto, so on small viewports the bottom content and buttons are cut off
  const logMobileOverflow = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 640) {
      window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
      if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-071')) {
        window.__PERCEPTR_TEST_BUGS__.push({
          bugId: 'BZ-071',
          timestamp: Date.now(),
          description: 'Modal content overflow hidden on mobile - bottom buttons unreachable',
          page: 'Visual/Layout'
        });
      }
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      logMobileOverflow();
    }
  }, [isOpen, logMobileOverflow]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={overlayRef}
      data-bug-id="BZ-021"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      {/* BUG:BZ-071 - Modal uses max-h-[80vh] with overflow-hidden instead of overflow-auto.
          On mobile viewports (375px), long modal content extends below the visible area
          with no scroll, making confirm buttons unreachable. */}
      <div
        data-bug-id="BZ-071"
        className={`
          w-full ${sizeStyles[size]}
          max-h-[80vh] overflow-hidden
          bg-white dark:bg-zinc-800
          rounded-xl shadow-md
          transform transition-all
          animate-in fade-in zoom-in-95 duration-150
        `}
      >
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
            {title && (
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{title}</h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
