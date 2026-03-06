function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.has(key) ? values.get(key) ?? null : null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(String(key), String(value));
    }
  };
}

function installStorage(target: Window & typeof globalThis) {
  const storage = createMemoryStorage();
  Object.defineProperty(target, 'localStorage', {
    configurable: true,
    enumerable: true,
    value: storage,
    writable: true
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    enumerable: true,
    value: storage,
    writable: true
  });
}

if (typeof window !== 'undefined') {
  const current = window.localStorage as Partial<Storage> | undefined;
  if (
    !current ||
    typeof current.getItem !== 'function' ||
    typeof current.setItem !== 'function' ||
    typeof current.removeItem !== 'function' ||
    typeof current.clear !== 'function'
  ) {
    installStorage(window);
  }
}
