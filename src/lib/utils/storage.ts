/**
 * Safe localStorage wrapper that protects against SecurityError / DOMException
 * in privacy-focused browsers like Brave, Safari Private Mode, and strict iframe contexts,
 * while safely supporting Node test environments where global.localStorage is mocked.
 */
function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined') {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
      return (globalThis as any).localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      const storage = getStorage();
      if (!storage) return null;
      return storage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      const storage = getStorage();
      if (!storage) return;
      storage.setItem(key, value);
    } catch {}
  },

  removeItem(key: string): void {
    try {
      const storage = getStorage();
      if (!storage) return;
      storage.removeItem(key);
    } catch {}
  }
};
