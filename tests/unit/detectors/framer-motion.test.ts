import { describe, it, expect, afterEach } from 'vitest';
import { BrowserManager } from '../../../src/browser.js';
import { parseConfig } from '../../../src/config.js';
import { framerMotionDetector } from '../../../src/detectors/framer-motion.js';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

const fixturesDir = resolve(process.cwd(), 'tests/fixtures');

describe('framerMotionDetector', () => {
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
      expect(await framerMotionDetector.detect(page)).toBe(false);
    } finally {
      await manager.releasePage(page);
    }
  });

  it('returns empty array for non-framer page', async () => {
    manager = new BrowserManager(parseConfig({}));
    const page = await manager.acquirePage();
    try {
      const url = pathToFileURL(resolve(fixturesDir, 'static-page.html')).href;
      await page.goto(url);
      const result = await framerMotionDetector.extract(page);
      expect(result).toEqual([]);
    } finally {
      await manager.releasePage(page);
    }
  });
});
