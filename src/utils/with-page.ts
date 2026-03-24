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
    return await withTimeout(() => fn(page), config.timeout, label);
  } finally {
    await browserManager.releasePage(page);
  }
}
