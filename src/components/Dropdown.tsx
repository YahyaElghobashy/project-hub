import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface DropdownOption {
  label: string;
  value: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

// BUG:BZ-072 - Dropdown z-index is lower than modal overlay.
// The dropdown menu renders with z-30, but modals use z-50 for their overlay.
// When this dropdown is used inside a modal, the options list appears behind
// the modal overlay due to stacking context issues.
export function Dropdown({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  label,
  className = '',
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);

    // BUG:BZ-072 - Log when dropdown opens inside a modal context
    if (!isOpen) {
      const isInsideModal = dropdownRef.current?.closest('[class*="z-50"]');
      if (isInsideModal) {
        if (typeof window !== 'undefined') {
          window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
          if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-072')) {
            window.__PERCEPTR_TEST_BUGS__.push({
              bugId: 'BZ-072',
              timestamp: Date.now(),
              description: 'Dropdown renders behind modal overlay due to z-index stacking context',
              page: 'Visual/Layout'
            });
          }
        }
      }
    }
  };

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} data-bug-id="BZ-072" className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-sm bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded-lg hover:border-zinc-400 dark:hover:border-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 transition-colors"
      >
        <span className={selectedOption ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-500'}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-lg shadow-md z-30 max-h-60 overflow-y-auto"
        >
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`
                w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-600 transition-colors
                ${option.value === value
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'text-zinc-900 dark:text-white'
                }
              `}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
