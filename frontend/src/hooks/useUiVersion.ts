import { useCallback, useSyncExternalStore } from 'react';

export type UiVersion = 'classic' | 'modern';
const STORAGE_KEY = 'ui';
const listeners = new Set<() => void>();

function read(): UiVersion {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'modern' ? 'modern' : 'classic';
  } catch {
    return 'classic';
  }
}

function apply(version: UiVersion) {
  document.documentElement.dataset['ui'] = version;
}

function setVersion(version: UiVersion) {
  try {
    localStorage.setItem(STORAGE_KEY, version);
  } catch {
    // nicht speicherbar (z.B. privates Fenster): gilt nur bis zum Neuladen
  }
  apply(version);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Feature-Schalter für das Design: "classic" (Standard) oder "modern". Die Wahl gilt pro Browser;
// index.html setzt data-ui schon vor dem ersten Rendern, damit nichts aufblitzt.
export function useUiVersion() {
  const version = useSyncExternalStore(subscribe, read, () => 'classic' as UiVersion);
  const toggle = useCallback(() => setVersion(read() === 'modern' ? 'classic' : 'modern'), []);
  return { version, isModern: version === 'modern', toggle };
}
