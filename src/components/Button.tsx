import { ButtonHTMLAttributes, forwardRef, useRef, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
  secondary: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 focus:ring-zinc-500 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600',
  outline: 'border border-zinc-300 text-zinc-700 hover:bg-zinc-50 focus:ring-zinc-500 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800',
  ghost: 'text-zinc-700 hover:bg-zinc-100 focus:ring-zinc-500 dark:text-zinc-300 dark:hover:bg-zinc-800',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

// BUG:BZ-082 - SVG Icons Inherit Wrong Color in Context
// SVG icons use currentColor and the button changes color on hover.
// The icon wrapper manually sets color via JS on mouseenter/mouseleave,
// but uses requestAnimationFrame which delays the color update by one frame.
// This creates a visible flicker where the icon briefly shows the old color
// before catching up to the button's new hover color.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      className = '',
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const iconWrapperRef = useRef<HTMLSpanElement>(null);
    const buttonInternalRef = useRef<HTMLButtonElement>(null);

    // BUG:BZ-082 - Manually sync icon color on hover with a one-frame delay
    // Instead of letting CSS handle currentColor inheritance naturally, this
    // reads the computed color and applies it via style after a rAF, causing
    // the icon to lag behind the button's color transition by one render frame.
    const syncIconColor = useCallback(() => {
      const btn = buttonInternalRef.current;
      const iconWrapper = iconWrapperRef.current;
      if (!btn || !iconWrapper) return;

      // Read the button's current computed color
      const computedColor = getComputedStyle(btn).color;

      // Apply it to the icon wrapper after a frame delay — this creates the flicker
      requestAnimationFrame(() => {
        if (iconWrapper) {
          iconWrapper.style.color = computedColor;
        }
      });
    }, []);

    useEffect(() => {
      const btn = buttonInternalRef.current;
      if (!btn || (!leftIcon && !rightIcon)) return;

      const handleMouseEnter = () => {
        syncIconColor();
        if (typeof window !== 'undefined') {
          window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
          if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-082')) {
            window.__PERCEPTR_TEST_BUGS__.push({
              bugId: 'BZ-082',
              timestamp: Date.now(),
              description: 'SVG icon color lags by one frame on button hover due to rAF-delayed color sync',
              page: 'Visual/Layout'
            });
          }
        }
      };
      const handleMouseLeave = () => syncIconColor();

      btn.addEventListener('mouseenter', handleMouseEnter);
      btn.addEventListener('mouseleave', handleMouseLeave);
      return () => {
        btn.removeEventListener('mouseenter', handleMouseEnter);
        btn.removeEventListener('mouseleave', handleMouseLeave);
      };
    }, [leftIcon, rightIcon, syncIconColor]);

    // Merge refs: forward ref + internal ref
    const mergedRef = (node: HTMLButtonElement | null) => {
      buttonInternalRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
      }
    };

    return (
      <button
        ref={mergedRef}
        data-bug-id="BZ-082"
        className={`
          inline-flex items-center justify-center gap-2 font-medium rounded-lg
          transition-colors duration-200
          focus:outline-none focus:ring-2 focus:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="animate-spin h-4 w-4" />
        ) : leftIcon ? (
          // BUG:BZ-082 - Icon wrapper with manually synced color that lags by one frame
          <span ref={iconWrapperRef} className="inline-flex" style={{ transition: 'color 0ms' }}>
            {leftIcon}
          </span>
        ) : null}
        {children}
        {rightIcon && !isLoading ? (
          <span ref={!leftIcon ? iconWrapperRef : undefined} className="inline-flex" style={{ transition: 'color 0ms' }}>
            {rightIcon}
          </span>
        ) : null}
      </button>
    );
  }
);

Button.displayName = 'Button';
