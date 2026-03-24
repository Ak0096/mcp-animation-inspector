import { describe, it, expect, afterEach } from 'vitest';
import { BrowserManager } from '../../../src/browser.js';
import { parseConfig } from '../../../src/config.js';
import { webglDetector } from '../../../src/detectors/webgl.js';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

const fixturesDir = resolve(process.cwd(), 'tests/fixtures');

describe('webglDetector', () => {
  let manager: BrowserManager;

  afterEach(async () => {
    if (manager) await manager.shutdown();
  });

  it('returns false for static page', async () => {
    manager = new BrowserManager(parseConfig({}));
    const page = await manager.acquirePage();
    try {
      const url = pathToFileURL(resolve(fixturesDir, 'static-page.html')).href;
      await page.goto(url);
      expect(await webglDetector.detect(page)).toBe(false);
    } finally {
      await manager.releasePage(page);
    }
  });

  it('returns empty array for non-webgl page', async () => {
    manager = new BrowserManager(parseConfig({}));
    const page = await manager.acquirePage();
    try {
      const url = pathToFileURL(resolve(fixturesDir, 'static-page.html')).href;
      await page.goto(url);
      const result = await webglDetector.extract(page);
      expect(result).toEqual([]);
    } finally {
      await manager.releasePage(page);
    }
  });
});
