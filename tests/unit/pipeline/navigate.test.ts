import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import { BrowserManager } from '../../../src/browser.js';
import { parseConfig } from '../../../src/config.js';
import { navigateTo } from '../../../src/pipeline/navigate.js';

describe('navigate', () => {
  let manager: BrowserManager;

  afterEach(async () => {
    if (manager) await manager.shutdown();
  });

  it('loads a page and returns metadata', async () => {
    manager = new BrowserManager(parseConfig({}));
    const page = await manager.acquirePage();
    const fixture = `file://${path.resolve('tests/fixtures/static-page.html')}`;

    const result = await navigateTo(page, fixture, parseConfig({}));

    expect(result.title).toBe('Test Page');
    expect(result.techStack).toBeInstanceOf(Array);

    await manager.releasePage(page);
  });
});
