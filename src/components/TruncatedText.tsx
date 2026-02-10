import { useEffect, useRef } from 'react';

interface TruncatedTextProps {
  text: string;
  maxLength?: number;
  className?: string;
  as?: 'span' | 'p' | 'div';
}

// BUG:BZ-074 - Text truncation hides critical information
// Truncates text to maxLength characters with ellipsis but provides no tooltip
// to show the full text. Important suffixes like "(YTD)" or "(Quarterly)" get
// cut off, completely changing the meaning of the displayed metric.
export function TruncatedText({
  text,
  maxLength = 15,
  className = '',
  as: Tag = 'span',
}: TruncatedTextProps) {
  const elementRef = useRef<HTMLElement>(null);

  const isTruncated = text.length > maxLength;
  const displayText = isTruncated ? text.slice(0, maxLength) + '…' : text;

  // Log when critical text gets truncated (text with parenthetical suffixes)
  useEffect(() => {
    if (isTruncated && /\(.*\)/.test(text)) {
      if (typeof window !== 'undefined') {
        window.__PERCEPTR_TEST_BUGS__ = window.__PERCEPTR_TEST_BUGS__ || [];
        if (!window.__PERCEPTR_TEST_BUGS__.find(b => b.bugId === 'BZ-074')) {
          window.__PERCEPTR_TEST_BUGS__.push({
            bugId: 'BZ-074',
            timestamp: Date.now(),
            description: 'Text truncation hides critical suffix - no tooltip to show full text',
            page: 'Visual/Layout'
          });
        }
      }
    }
  }, [text, isTruncated]);

  return (
    // No title attribute or tooltip — truncated text has no way to reveal the full content
    <Tag
      ref={elementRef as React.Ref<HTMLElement>}
      data-bug-id="BZ-074"
      className={`${className}`}
    >
      {displayText}
    </Tag>
  );
}
