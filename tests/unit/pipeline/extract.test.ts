import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import { BrowserManager } from '../../../src/browser.js';
import { parseConfig } from '../../../src/config.js';
import { extractAnimationCode } from '../../../src/pipeline/extract.js';
import type { AnimationInventory } from '../../../src/types/index.js';

describe('extract', () => {
  let manager: BrowserManager;

  afterEach(async () => {
    if (manager) await manager.shutdown();
  });

  it('extracts CSS animation code', async () => {
    manager = new BrowserManager(parseConfig({}));
    const page = await manager.acquirePage();
    const fixture = `file://${path.resolve('tests/fixtures/css-animations.html')}`;
    await page.goto(fixture, { waitUntil: 'networkidle' });

    const inventory: AnimationInventory[] = [
      {
        detector: 'css',
        triggers: ['load'],
        selector: '.animated-box',
        properties: ['fadeIn'],
        triggerDetails: ['animation: fadeIn'],
        confidence: 0.8,
      },
    ];

    const result = await extractAnimationCode(page, inventory);

    expect(result.length).toBe(1);
    expect(result[0]!.css).toBeDefined();
    expect(result[0]!.timing.duration).toBeGreaterThan(0);

    await manager.releasePage(page);
  });
});
