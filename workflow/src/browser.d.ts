// Declare the browser global provided by webextension-polyfill at runtime.
// @types/webextension-polyfill uses `export =` (not `declare global`), so we
// must re-export it as an ambient global here.
import type Browser from 'webextension-polyfill';

declare global {
  const browser: typeof Browser;
}
