"use client";

import { useEffect, useRef } from "react";

type UseTicketScannerFocusArgs = {
  enabled?: boolean;
  onScan: (code: string) => void;
};

export function useTicketScannerFocus({ enabled = true, onScan }: UseTicketScannerFocusArgs) {
  const scannerInputRef = useRef<HTMLInputElement>(null);
  const bufferRef = useRef("");
  const firstKeystrokeAtRef = useRef<number | null>(null);

  const isEditableTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    if (target === scannerInputRef.current) {
      return false;
    }
    const tag = target.tagName.toLowerCase();
    return (
      target.isContentEditable ||
      tag === "input" ||
      tag === "textarea" ||
      tag === "select"
    );
  };

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const focusInput = () => {
      const activeElement = document.activeElement;
      if (isEditableTarget(activeElement)) {
        return;
      }
      if (activeElement !== scannerInputRef.current) {
        scannerInputRef.current?.focus();
      }
    };

    focusInput();
    const interval = window.setInterval(focusInput, 1200);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        bufferRef.current = "";
        firstKeystrokeAtRef.current = null;
        return;
      }

      const key = event.key;
      if (key === "Enter") {
        const code = bufferRef.current.trim();
        const startedAt = firstKeystrokeAtRef.current;
        const durationMs = startedAt ? Date.now() - startedAt : Number.MAX_SAFE_INTEGER;
        bufferRef.current = "";
        firstKeystrokeAtRef.current = null;
        if (code.length > 0) {
          // Scanner wedge emulates fast bursts; ignore slow/manual typing + Enter.
          const isLikelyScanner = code.length >= 4 && durationMs <= 1200;
          if (isLikelyScanner) {
            onScan(code);
          }
        }
        return;
      }

      if (key.length === 1) {
        if (!firstKeystrokeAtRef.current) {
          firstKeystrokeAtRef.current = Date.now();
        }
        bufferRef.current += key;
      }

      if (key === "Backspace") {
        bufferRef.current = bufferRef.current.slice(0, -1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, onScan]);

  return { scannerInputRef, isScannerActive: enabled };
}
