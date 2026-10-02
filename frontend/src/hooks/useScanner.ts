import { useEffect, useRef, useCallback } from 'react';

interface UseScannerOptions {
  onScan: (code: string) => void;
  enabled?: boolean;
  minLength?: number;
  maxLength?: number;
  debounceMs?: number;
}

/**
 * Hook für USB-Handscanner.
 * Scanner verhält sich wie eine Tastatur: sendet Zeichen + Enter.
 * Wir sammeln Zeichen in einem Buffer und lösen bei Enter aus.
 */
export function useScanner({
  onScan,
  enabled = true,
  minLength = 3,
  maxLength = 200,
  debounceMs = 100,
}: UseScannerOptions) {
  const bufferRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    const code = bufferRef.current.trim();
    bufferRef.current = '';
    if (code.length >= minLength && code.length <= maxLength) {
      onScan(code);
    }
  }, [onScan, minLength, maxLength]);

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === 'Enter') {
        if (timerRef.current) clearTimeout(timerRef.current);
        flush();
        return;
      }

      // Only collect printable characters
      if (e.key.length === 1) {
        bufferRef.current += e.key;

        // Reset buffer after inactivity
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          bufferRef.current = '';
        }, debounceMs);
      }
    };

    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, flush, debounceMs]);
}
