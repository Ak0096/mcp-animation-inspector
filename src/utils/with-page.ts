import type { Page } from 'playwright';
import type { Config } from '../config.js';
import type { BrowserManager } from '../browser.js';
import { withTimeout } from './with-timeout.js';

export async function withPage<T>(
  browserManager: BrowserManager,
  config: Config,
  label: string,
  fn: (page: Page) => Promise<T>,
): Promise<T> {
  const page = await browserManager.acquirePage();
  try {
    // Allow extra headroom: navigation fallback + loader dismiss can consume significant time
    const pageTimeout = Math.floor(config.timeout * 2);
    return await withTimeout(() => fn(page), pageTimeout, label);
  } finally {
    await browserManager.releasePage(page);
  }
}
