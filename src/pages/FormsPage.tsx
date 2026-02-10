import { useState, useRef, useCallback, useEffect } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useToast } from '../components/Toast';

type FormSection = 'checkout' | 'upload' | 'editor' | 'pricing';

// ——————————————————————————————————————————————————————————
// Checkout Form — BZ-006 (Tab Key Skips Fields) & BZ-007 (Autofill Breaks Layout)
// ——————————————————————————————————————————————————————————

interface FloatingInputProps {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  tabIndex?: number;
}

// BUG:BZ-007 - Autofill Breaks Layout
// Floating label relies on :focus and value-length checks via onFocus/onBlur
// to position the label. Browser autofill populates the field without triggering
// React's onChange or focus events, so the label stays in the "placeholder"
// position and overlaps the autofilled text.
function FloatingInput({ label, name, type = 'text', autoComplete, value, onChange, tabIndex }: FloatingInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // The label should float up when the field has a value OR is focused.
  // However, we only check React state (isFocused + value.length),
  // which doesn't detect browser autofill that bypasses React events.
  const shouldFloat = isFocused || value.length > 0;

  const handleAutofillDetect = useCallback(() => {
    // BUG:BZ-007 - This detection runs on animation-start which some browsers
    // fire for autofill, but the label position is already calculated by then.
    // The re-render from this setState happens too late — the overlapping label
    // has already been painted for a visible frame.
    if (inputRef.current && inputRef.current.value && inputRef.current.value !== value) {
      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-007')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-007',
            timestamp: Date.now(),
            description: 'Autofill populated field but floating label did not animate up - labels overlap autofilled values',
            page: 'Remaining Forms'
          });
        }
      }
    }
  }, [value]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    // Listen for the autofill animation event (Chrome fires this)
    input.addEventListener('animationstart', handleAutofillDetect);
    return () => input.removeEventListener('animationstart', handleAutofillDetect);
  }, [handleAutofillDetect]);

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type={type}
        name={name}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        tabIndex={tabIndex}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={`
          peer w-full px-3 pt-5 pb-2 text-sm border rounded-lg
          bg-white dark:bg-gray-800
          border-gray-300 dark:border-gray-600
          text-gray-900 dark:text-gray-100
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          placeholder-transparent
        `}
        placeholder={label}
      />
      {/* BUG:BZ-007 - Label positioning relies on React state (shouldFloat),
          not on the :not(:placeholder-shown) CSS pseudo-class.
          Autofill sets the value natively without React knowing,
          so shouldFloat stays false and the label covers the text. */}
      <label
        className={`
          absolute left-3 transition-all duration-200 pointer-events-none
          ${shouldFloat
            ? 'top-1 text-xs text-blue-600 dark:text-blue-400'
            : 'top-3.5 text-sm text-gray-400 dark:text-gray-500'
          }
        `}
      >
        {label}
      </label>
    </div>
  );
}

function CheckoutForm() {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
  });

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const missing = Object.entries(formData).filter(([, v]) => !v.trim());
    if (missing.length > 0) {
      showToast('error', `Please fill in: ${missing.map(([k]) => k).join(', ')}`);
      return;
    }
    showToast('success', 'Checkout information saved!');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* BUG:BZ-006 - Tab Key Skips Input Fields
          tabIndex is incorrectly set: First Name (1) → Zip Code (2) → Last Name (3) etc.
          Tab order goes from First Name straight to Zip Code, skipping 4 fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-bug-id="BZ-006">
        <FloatingInput
          label="First Name"
          name="firstName"
          autoComplete="given-name"
          value={formData.firstName}
          onChange={handleChange('firstName')}
          // BUG:BZ-006 - tabIndex 1 is correct for first field
          tabIndex={1}
        />
        <FloatingInput
          label="Last Name"
          name="lastName"
          autoComplete="family-name"
          value={formData.lastName}
          onChange={handleChange('lastName')}
          // BUG:BZ-006 - Should be tabIndex 2, but is set to 3 so it's skipped
          tabIndex={3}
        />
      </div>

      <div data-bug-id="BZ-007">
        <FloatingInput
          label="Street Address"
          name="address"
          autoComplete="street-address"
          value={formData.address}
          onChange={handleChange('address')}
          // BUG:BZ-006 - Should be tabIndex 3, but is set to 4
          tabIndex={4}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FloatingInput
          label="City"
          name="city"
          autoComplete="address-level2"
          value={formData.city}
          onChange={handleChange('city')}
          // BUG:BZ-006 - Should be tabIndex 4, but is set to 5
          tabIndex={5}
        />
        <FloatingInput
          label="State"
          name="state"
          autoComplete="address-level1"
          value={formData.state}
          onChange={handleChange('state')}
          // BUG:BZ-006 - Should be tabIndex 5, but is set to 6
          tabIndex={6}
        />
        <FloatingInput
          label="Zip Code"
          name="zipCode"
          autoComplete="postal-code"
          value={formData.zipCode}
          onChange={handleChange('zipCode')}
          // BUG:BZ-006 - Should be tabIndex 6, but is set to 2 — Tab jumps here from First Name
          tabIndex={2}
        />
      </div>

      <Button type="submit" className="w-full">
        Save Shipping Info
      </Button>
    </form>
  );
}

// ——————————————————————————————————————————————————————————
// File Upload — BZ-012 (Upload Shows Success but File Is Empty)
// ——————————————————————————————————————————————————————————

function FileUploadForm() {
  const { showToast } = useToast();
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: number } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  // BUG:BZ-012 - Store the file reference in a local variable scoped to the handler
  // instead of a ref. When the delayed upload starts, the reference may have been
  // garbage collected (or in our simulation, we clear it after the selection).
  const fileDataRef = useRef<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile({ name: file.name, size: file.size });

    // BUG:BZ-012 - Store the file object initially
    fileDataRef.current = file;

    // BUG:BZ-012 - Simulate garbage collection / reference loss:
    // After a short delay (simulating async processing), clear the file reference.
    // The file input value is also cleared for "security" (common practice).
    // When the upload actually starts later, fileDataRef.current is null.
    setTimeout(() => {
      // "Reset the input for re-selection" — common pattern that breaks the file reference
      e.target.value = '';
      // The file object may be GC'd since the input no longer holds it,
      // and we stored metadata but not the actual blob
      fileDataRef.current = null;
    }, 100);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      showToast('error', 'Please select a file first');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    // BUG:BZ-012 - Build FormData with the file reference, which is now null
    const formData = new FormData();
    const fileToUpload = fileDataRef.current;

    if (fileToUpload) {
      formData.append('file', fileToUpload);
    } else {
      // File reference is gone — append an empty blob with the original filename
      // This creates a 0-byte upload that the server accepts
      formData.append('file', new Blob([]), selectedFile.name);
    }

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 2500));
    clearInterval(progressInterval);
    setUploadProgress(100);

    // BUG:BZ-012 - Log the bug when a 0-byte file is "uploaded"
    if (!fileToUpload) {
      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-012')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-012',
            timestamp: Date.now(),
            description: 'File upload shows success but file is empty — file reference was garbage collected before async upload started',
            page: 'Remaining Forms'
          });
        }
      }
    }

    // Show success regardless — this is the bug, UI says success
    showToast('success', `"${selectedFile.name}" uploaded successfully!`);

    setIsUploading(false);
    setSelectedFile(null);
    setUploadProgress(0);
  };

  return (
    <div className="space-y-4" data-bug-id="BZ-012">
      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Drag and drop a file, or click to browse
        </p>
        <input
          type="file"
          onChange={handleFileSelect}
          className="mt-4 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 dark:file:bg-blue-900/20 dark:file:text-blue-400"
        />
      </div>

      {selectedFile && (
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{selectedFile.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <Button
            onClick={handleUpload}
            isLoading={isUploading}
            size="sm"
          >
            Upload
          </Button>
        </div>
      )}

      {isUploading && (
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ——————————————————————————————————————————————————————————
// Rich Text Editor — BZ-013 (Strips Formatting on Paste)
// ——————————————————————————————————————————————————————————

function RichTextEditor() {
  const { showToast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);

  const execCommand = (command: string) => {
    document.execCommand(command, false);
    editorRef.current?.focus();
    // Update toolbar state
    setIsBold(document.queryCommandState('bold'));
    setIsItalic(document.queryCommandState('italic'));
    setIsUnderline(document.queryCommandState('underline'));
  };

  const handleSelectionChange = () => {
    setIsBold(document.queryCommandState('bold'));
    setIsItalic(document.queryCommandState('italic'));
    setIsUnderline(document.queryCommandState('underline'));
  };

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  // BUG:BZ-013 - Rich Text Editor Strips Formatting on Paste
  // The paste handler intercepts paste events and inserts plain text only,
  // stripping all bold/italic/links/formatting from pasted content.
  // Typed formatting works fine (via execCommand), but pasted rich content
  // from Google Docs, Word, etc. is silently reduced to plain text.
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();

    // BUG:BZ-013 - Get plain text instead of HTML — strips all formatting
    // Should use e.clipboardData.getData('text/html') to preserve formatting,
    // but uses 'text/plain' which discards bold, italic, links, lists, etc.
    const plainText = e.clipboardData.getData('text/plain');

    // Check if the clipboard had HTML content (i.e., formatting was stripped)
    const htmlContent = e.clipboardData.getData('text/html');
    if (htmlContent && htmlContent !== plainText) {
      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-013')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-013',
            timestamp: Date.now(),
            description: 'Rich text editor strips all formatting on paste — HTML content reduced to plain text',
            page: 'Remaining Forms'
          });
        }
      }
    }

    // Insert as plain text, losing all formatting
    document.execCommand('insertText', false, plainText);
  }, []);

  const handleSave = () => {
    const content = editorRef.current?.innerHTML || '';
    if (!content.trim() || content === '<br>') {
      showToast('error', 'Please enter some content before saving');
      return;
    }
    showToast('success', 'Content saved successfully!');
  };

  return (
    <div className="space-y-2" data-bug-id="BZ-013">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-t-lg border border-b-0 border-gray-300 dark:border-gray-600">
        <button
          type="button"
          onClick={() => execCommand('bold')}
          className={`p-2 rounded text-sm font-bold ${isBold ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => execCommand('italic')}
          className={`p-2 rounded text-sm italic ${isItalic ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
        >
          I
        </button>
        <button
          type="button"
          onClick={() => execCommand('underline')}
          className={`p-2 rounded text-sm underline ${isUnderline ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
        >
          U
        </button>
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
        <button
          type="button"
          onClick={() => execCommand('insertUnorderedList')}
          className="p-2 rounded text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => execCommand('insertOrderedList')}
          className="p-2 rounded text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Editor area */}
      <div
        ref={editorRef}
        contentEditable
        onPaste={handlePaste}
        className="min-h-[200px] p-4 border border-gray-300 dark:border-gray-600 rounded-b-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 prose prose-sm max-w-none"
        role="textbox"
        aria-multiline="true"
        aria-label="Rich text editor"
      />

      <div className="flex justify-between items-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Tip: Use the toolbar above to format text, or paste content from other applications.
        </p>
        <Button onClick={handleSave} size="sm">
          Save Content
        </Button>
      </div>
    </div>
  );
}

// ——————————————————————————————————————————————————————————
// Currency / Pricing Form — BZ-014 (Currency Input Allows Invalid States)
// ——————————————————————————————————————————————————————————

function PricingForm() {
  const { showToast } = useToast();
  const [items, setItems] = useState([
    { id: 1, name: 'Basic Plan', price: '29.99' },
    { id: 2, name: 'Pro Plan', price: '79.99' },
    { id: 3, name: 'Enterprise Plan', price: '199.99' },
  ]);

  // BUG:BZ-014 - Currency Input Allows Invalid States
  // Price validation only checks for empty and negative values,
  // but does NOT check for multiple decimal points.
  // A value like "1234.56.78" passes validation and is saved as-is.
  const validatePrice = (price: string): boolean => {
    if (!price.trim()) return false;
    // Strip the dollar sign and commas for validation
    const cleaned = price.replace(/[$,]/g, '');
    // Only check if it's a negative number or non-numeric start
    if (cleaned.startsWith('-')) return false;
    // BUG:BZ-014 - This regex allows multiple decimal points
    // Should use /^\d+(\.\d{0,2})?$/ to enforce single decimal
    // Instead uses a loose check that just looks for digits and dots
    if (!/^[\d.]+$/.test(cleaned)) return false;
    return true;
  };

  const handlePriceChange = (id: number, newPrice: string) => {
    // Allow typing freely — only strip non-price characters
    const filtered = newPrice.replace(/[^0-9.$,]/g, '');
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, price: filtered } : item
    ));
  };

  const handleSave = () => {
    const invalidItems = items.filter(item => !validatePrice(item.price));
    if (invalidItems.length > 0) {
      showToast('error', `Invalid price for: ${invalidItems.map(i => i.name).join(', ')}`);
      return;
    }

    // BUG:BZ-014 - Check for the multiple decimal bug
    const hasMultipleDecimals = items.some(item => {
      const dotCount = (item.price.match(/\./g) || []).length;
      return dotCount > 1;
    });

    if (hasMultipleDecimals) {
      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-014')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-014',
            timestamp: Date.now(),
            description: 'Currency input accepted value with multiple decimals — breaks downstream calculations',
            page: 'Remaining Forms'
          });
        }
      }
    }

    // Calculate total — will produce NaN or wrong values with multiple decimals
    const total = items.reduce((sum, item) => {
      const parsed = parseFloat(item.price.replace(/[$,]/g, ''));
      return sum + (isNaN(parsed) ? 0 : parsed);
    }, 0);

    showToast('success', `Pricing saved! Monthly total: $${total.toFixed(2)}`);
  };

  return (
    <div className="space-y-4" data-bug-id="BZ-014">
      {items.map(item => (
        <div key={item.id} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Monthly subscription</p>
          </div>
          <div className="relative w-40">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              type="text"
              value={item.price}
              onChange={(e) => handlePriceChange(item.id, e.target.value)}
              className="w-full pl-7 pr-3 py-2 text-sm text-right border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Monthly Total</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            ${items.reduce((sum, item) => {
              const parsed = parseFloat(item.price.replace(/[$,]/g, ''));
              return sum + (isNaN(parsed) ? 0 : parsed);
            }, 0).toFixed(2)}
          </p>
        </div>
        <Button onClick={handleSave}>
          Save Pricing
        </Button>
      </div>
    </div>
  );
}

// ——————————————————————————————————————————————————————————
// Main Page Component
// ——————————————————————————————————————————————————————————

export function FormsPage() {
  const [activeSection, setActiveSection] = useState<FormSection>('checkout');

  // BUG:BZ-006 - Log when user tabs through the checkout form and encounters the skip
  useEffect(() => {
    const handleTabNavigation = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && activeSection === 'checkout') {
        const active = document.activeElement as HTMLInputElement;
        if (active?.name === 'firstName') {
          // Next tab press will go to Zip Code (tabIndex 2) instead of Last Name (tabIndex 3)
          requestAnimationFrame(() => {
            const nextFocused = document.activeElement as HTMLInputElement;
            if (nextFocused?.name === 'zipCode') {
              if (typeof window !== 'undefined') {
                window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
                if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-006')) {
                  window.__PERCEPTR_TEST_BUGS__.push({
                    bugId: 'BZ-006',
                    timestamp: Date.now(),
                    description: 'Tab key skipped fields — jumped from First Name to Zip Code due to incorrect tabindex order',
                    page: 'Remaining Forms'
                  });
                }
              }
            }
          });
        }
      }
    };

    window.addEventListener('keydown', handleTabNavigation);
    return () => window.removeEventListener('keydown', handleTabNavigation);
  }, [activeSection]);

  const sections: { id: FormSection; label: string; icon: React.ReactNode }[] = [
    {
      id: 'checkout',
      label: 'Checkout',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
        </svg>
      ),
    },
    {
      id: 'upload',
      label: 'File Upload',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      ),
    },
    {
      id: 'editor',
      label: 'Rich Editor',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
    },
    {
      id: 'pricing',
      label: 'Pricing',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Forms & Inputs</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage checkout, file uploads, content editing, and pricing configuration.
        </p>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-0">
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`
              flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
              ${activeSection === section.id
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }
            `}
          >
            {section.icon}
            {section.label}
          </button>
        ))}
      </div>

      {/* Section content */}
      <Card padding="lg">
        {activeSection === 'checkout' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Shipping Information</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Enter your shipping details for checkout.
            </p>
            <CheckoutForm />
          </div>
        )}

        {activeSection === 'upload' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Upload Attachments</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Upload project files, documents, and attachments.
            </p>
            <FileUploadForm />
          </div>
        )}

        {activeSection === 'editor' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Content Editor</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Write and format project descriptions, notes, and documentation.
            </p>
            <RichTextEditor />
          </div>
        )}

        {activeSection === 'pricing' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Plan Pricing</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Configure pricing for subscription plans.
            </p>
            <PricingForm />
          </div>
        )}
      </Card>
    </div>
  );
}
