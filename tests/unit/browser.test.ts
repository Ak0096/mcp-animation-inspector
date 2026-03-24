import { describe, it, expect, afterEach } from 'vitest';
import { BrowserManager } from '../../src/browser.js';
import { parseConfig } from '../../src/config.js';

describe('BrowserManager', () => {
  let manager: BrowserManager;

  afterEach(async () => {
    if (manager) await manager.shutdown();
  });

  it('acquires and releases a page', async () => {
    manager = new BrowserManager(parseConfig({}));
    const page = await manager.acquirePage();
    expect(page).toBeDefined();
    expect(page.isClosed()).toBe(false);
    await manager.releasePage(page);
  });

  it('enforces max concurrent pages', async () => {
    // Use short queue timeout so the 4th acquire rejects before the test's own 500ms sentinel
    manager = new BrowserManager(parseConfig({}), 200);
    const pages = await Promise.all([
      manager.acquirePage(),
      manager.acquirePage(),
      manager.acquirePage(),
    ]);
    expect(pages).toHaveLength(3);

    // 4th should queue and be rejected by BrowserManager's own timeout (200ms)
    const timeoutPromise = Promise.race([
      manager.acquirePage(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 500)
      ),
    ]);
    await expect(timeoutPromise).rejects.toThrow();

    // Release one, 4th should now succeed
    await manager.releasePage(pages[0]!);
    const page4 = await manager.acquirePage();
    expect(page4).toBeDefined();

    await manager.releasePage(pages[1]!);
    await manager.releasePage(pages[2]!);
    await manager.releasePage(page4);
  });

  it('shuts down cleanly', async () => {
    manager = new BrowserManager(parseConfig({}));
    const page = await manager.acquirePage();
    await manager.releasePage(page);
    await manager.shutdown();
    // After shutdown, acquiring should relaunch
    const page2 = await manager.acquirePage();
    expect(page2).toBeDefined();
    await manager.releasePage(page2);
  });
});
