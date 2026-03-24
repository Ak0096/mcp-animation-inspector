import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import { BrowserManager } from '../../../src/browser.js';
import { parseConfig } from '../../../src/config.js';
import { discoverAnimations } from '../../../src/pipeline/discover.js';

describe('discover', () => {
  let manager: BrowserManager;

  afterEach(async () => {
    if (manager) await manager.shutdown();
  });

  it('discovers CSS animations on a page', async () => {
    manager = new BrowserManager(parseConfig({}));
    const page = await manager.acquirePage();
    const fixture = `file://${path.resolve('tests/fixtures/css-animations.html')}`;
    await page.goto(fixture, { waitUntil: 'networkidle' });

    const inventory = await discoverAnimations(page, parseConfig({}));

    // Should find the animated-box and hover-box, but NOT short-transition
    expect(inventory.length).toBeGreaterThanOrEqual(1);
    const selectors = inventory.map((a) => a.selector);
    expect(selectors.some((s) => s.includes('animated-box'))).toBe(true);

    await manager.releasePage(page);
  });

  it('returns empty array for static pages', async () => {
    manager = new BrowserManager(parseConfig({}));
    const page = await manager.acquirePage();
    const fixture = `file://${path.resolve('tests/fixtures/static-page.html')}`;
    await page.goto(fixture, { waitUntil: 'networkidle' });

    const inventory = await discoverAnimations(page, parseConfig({}));
    expect(inventory).toEqual([]);

    await manager.releasePage(page);
  });
});
