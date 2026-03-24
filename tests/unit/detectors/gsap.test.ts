import { describe, it, expect, afterEach } from 'vitest';
import { BrowserManager } from '../../../src/browser.js';
import { parseConfig } from '../../../src/config.js';
import { gsapDetector } from '../../../src/detectors/gsap.js';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

const fixturesDir = resolve(process.cwd(), 'tests/fixtures');

describe('gsapDetector', () => {
  let manager: BrowserManager;

  afterEach(async () => {
    if (manager) await manager.shutdown();
  });

  it('detects GSAP on gsap-page fixture (requires network for CDN)', async () => {
    manager = new BrowserManager(parseConfig({ waitForNetworkIdle: false }));
    const page = await manager.acquirePage();
    try {
      const url = pathToFileURL(resolve(fixturesDir, 'gsap-page.html')).href;
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
      const detected = await gsapDetector.detect(page);
      expect(detected).toBe(true);
    } finally {
      await manager.releasePage(page);
    }
  });

  it('returns false on a static page with no GSAP', async () => {
    manager = new BrowserManager(parseConfig({}));
    const page = await manager.acquirePage();
    try {
      const url = pathToFileURL(resolve(fixturesDir, 'static-page.html')).href;
      await page.goto(url);
      const detected = await gsapDetector.detect(page);
      expect(detected).toBe(false);
    } finally {
      await manager.releasePage(page);
    }
  });
});
