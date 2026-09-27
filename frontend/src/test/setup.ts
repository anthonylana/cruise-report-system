// Runs before every test file (see test.setupFiles in vite.config.ts).
import '@testing-library/jest-dom/vitest'; // adds toBeInTheDocument(), toBeDisabled()...
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  // RTL only auto-cleans when globals are enabled; we disabled them, so do it here.
  cleanup();
  vi.unstubAllGlobals(); // undo vi.stubGlobal("fetch", ...) from each test
});
