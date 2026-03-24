import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import { BrowserManager } from '../../../src/browser.js';
import { parseConfig } from '../../../src/config.js';
import { captureFrames } from '../../../src/pipeline/capture.js';
import type { AnimationInventory } from '../../../src/types/index.js';

describe('capture', () => {
  let manager: BrowserManager;

  afterEach(async () => {
    if (manager) await manager.shutdown();
  });

  it('captures scroll position screenshots', async () => {
    manager = new BrowserManager(parseConfig({}));
    const page = await manager.acquirePage();
    const fixture = `file://${path.resolve('tests/fixtures/css-animations.html')}`;
    await page.goto(fixture, { waitUntil: 'networkidle' });

    const result = await captureFrames(page, [], parseConfig({}));

    // Should have scroll screenshots
    expect(result.scrollFrames.length).toBeGreaterThan(0);
    expect(result.scrollFrames[0]!.image).toBeTruthy();
    expect(result.scrollFrames[0]!.label).toContain('scroll');

    await manager.releasePage(page);
  });

  it('captures element hover states', async () => {
    manager = new BrowserManager(parseConfig({}));
    const page = await manager.acquirePage();
    const fixture = `file://${path.resolve('tests/fixtures/css-animations.html')}`;
    await page.goto(fixture, { waitUntil: 'networkidle' });

    const inventory: AnimationInventory[] = [
      {
        detector: 'css',
        triggers: ['hover'],
        selector: '.hover-box',
        properties: ['transform'],
        triggerDetails: ['transition: transform'],
        confidence: 0.8,
      },
    ];

    const result = await captureFrames(page, inventory, parseConfig({}));

    expect(result.animationFrames.length).toBeGreaterThan(0);
    expect(result.animationFrames[0]!.frames.length).toBeGreaterThan(0);

    await manager.releasePage(page);
  });
});
