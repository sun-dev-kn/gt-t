import '@testing-library/jest-dom';

// Mock browser extension API
const storage: Record<string, unknown> = {};

(globalThis as Record<string, unknown>).browser = {
  storage: {
    local: {
      get: async (keys: string | string[]) => {
        if (typeof keys === 'string') return { [keys]: storage[keys] };
        return Object.fromEntries(keys.map((k) => [k, storage[k]]));
      },
      set: async (items: Record<string, unknown>) => {
        Object.assign(storage, items);
      },
      remove: async (keys: string | string[]) => {
        const ks = typeof keys === 'string' ? [keys] : keys;
        ks.forEach((k) => delete storage[k]);
      },
    },
  },
  runtime: {
    getURL: (path: string) => `moz-extension://test-id/${path}`,
  },
};

beforeEach(() => {
  Object.keys(storage).forEach((k) => delete storage[k]);
});
