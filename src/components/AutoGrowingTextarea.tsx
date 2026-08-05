import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';

interface AutoGrowingTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  // any additional custom props
}

export const AutoGrowingTextarea = React.forwardRef<HTMLTextAreaElement, AutoGrowingTextareaProps>(
  ({ className = '', onChange, value, ...props }, ref) => {
    const localRef = useRef<HTMLTextAreaElement | null>(null);
    const textareaRef = (ref as React.MutableRefObject<HTMLTextAreaElement | null>) || localRef;
    const prevLengthRef = useRef<number>(0);

    const adjustHeight = () => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      // If browser supports CSS field-sizing: content natively, no JS height adjustment is needed
      if (typeof CSS !== 'undefined' && CSS.supports && CSS.supports('field-sizing', 'content')) {
        return;
      }

      const currentLength = (value ?? textarea.value ?? '').toString().length;
      const lengthDecreased = currentLength < prevLengthRef.current;
      prevLengthRef.current = currentLength;

      // Reset height to 'auto' only when text shrank or if height hasn't been set yet.
      // Unconditionally setting height = 'auto' on every keystroke causes DOM thrashing
      // and breaks Android IME (Gboard) active composition / cursor selection.
      if (lengthDecreased || !textarea.style.height) {
        textarea.style.height = 'auto';
      }

      const targetHeight = textarea.scrollHeight;
      if (targetHeight > 0 && textarea.clientHeight !== targetHeight) {
        textarea.style.height = `${targetHeight}px`;
      }
    };

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

interface BufferedAutoGrowingTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  debounceMs?: number;
}

export const BufferedAutoGrowingTextarea = React.forwardRef<HTMLTextAreaElement, BufferedAutoGrowingTextareaProps>(
  ({ value: externalValue = '', onSave, onBlur, onFocus, debounceMs = 400, ...props }, ref) => {
    const [localValue, setLocalValue] = useState(externalValue);
    const isFocusedRef = useRef(false);
    const debounceTimerRef = useRef<any>(null);

    useEffect(() => {
      if (!isFocusedRef.current) {
        setLocalValue(externalValue);
      }
    }, [externalValue]);

    const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      isFocusedRef.current = true;
      if (onFocus) onFocus(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      isFocusedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (localValue !== externalValue) {
        onSave(localValue);
      }
      if (onBlur) onBlur(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setLocalValue(val);

      if (debounceMs > 0) {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          if (val !== externalValue) {
            onSave(val);
          }
        }, debounceMs);
      }
    };

    return (
      <AutoGrowingTextarea
        ref={ref}
        value={localValue}
        onFocus={handleFocus}
        onChange={handleChange}
        onBlur={handleBlur}
        {...props}
      />
    );
  }
);

BufferedAutoGrowingTextarea.displayName = 'BufferedAutoGrowingTextarea';
