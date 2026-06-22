import React, { useEffect, useRef, useLayoutEffect } from 'react';

interface AutoGrowingTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  // any additional custom props
}

export const AutoGrowingTextarea = React.forwardRef<HTMLTextAreaElement, AutoGrowingTextareaProps>(
  ({ className = '', onChange, value, ...props }, ref) => {
    const localRef = useRef<HTMLTextAreaElement | null>(null);
    const textareaRef = (ref as React.MutableRefObject<HTMLTextAreaElement | null>) || localRef;

    const adjustHeight = () => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      // Save cursor position before any DOM manipulation
      const { selectionStart, selectionEnd } = textarea;

      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;

      // Restore cursor position after DOM manipulation
      // (browser may move it when height changes)
      if (document.activeElement === textarea) {
        textarea.selectionStart = selectionStart;
        textarea.selectionEnd = selectionEnd;
      }
    };

    // useLayoutEffect runs synchronously after DOM mutations, before paint —
    // this prevents the cursor jump caused by async height updates
    useLayoutEffect(() => {
      adjustHeight();
    }, [value]);

    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          if (onChange) onChange(e);
          adjustHeight();
        }}
        className={`resize-none overflow-hidden ${className}`}
        {...props}
      />
    );
  }
);

AutoGrowingTextarea.displayName = 'AutoGrowingTextarea';
