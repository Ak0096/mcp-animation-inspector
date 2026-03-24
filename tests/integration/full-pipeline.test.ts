import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import { parseConfig } from '../../src/config.js';
import { BrowserManager } from '../../src/browser.js';
import { inspectAnimation } from '../../src/tools/inspect-animation.js';

describe('Full Pipeline Integration', () => {
  let browserManager: BrowserManager;

  afterEach(async () => {
    if (browserManager) await browserManager.shutdown();
  });

  it('inspects a page with CSS animations', async () => {
    const config = parseConfig({});
    browserManager = new BrowserManager(config);
    const fixture = `file://${path.resolve('tests/fixtures/css-animations.html')}`;

    const report = await inspectAnimation(fixture, browserManager, config);

    expect(report.schemaVersion).toBe('1.0.0');
    expect(report.url).toBe(fixture);
    expect(report.inventory.length).toBeGreaterThan(0);
    expect(report.frames.length).toBeGreaterThan(0);
    expect(report.meta.errors).toEqual([]);
  });

  it('returns empty inventory for static pages', async () => {
    const config = parseConfig({});
    browserManager = new BrowserManager(config);
    const fixture = `file://${path.resolve('tests/fixtures/static-page.html')}`;

    const report = await inspectAnimation(fixture, browserManager, config);

    expect(report.inventory).toEqual([]);
    // Should still have scroll frames
    expect(report.scrollFrames?.length).toBeGreaterThanOrEqual(1);
  });
});
