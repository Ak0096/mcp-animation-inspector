import { describe, it, expect, afterEach } from 'vitest';
import { BrowserManager } from '../../../src/browser.js';
import { parseConfig } from '../../../src/config.js';
import { cssDetector } from '../../../src/detectors/css.js';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { parseDurationMs } from '../../../src/utils/browser-fns.js';

const fixturesDir = resolve(process.cwd(), 'tests/fixtures');

describe('cssDetector', () => {
  let manager: BrowserManager;

  afterEach(async () => {
    if (manager) await manager.shutdown();
  });

  it('detects CSS animations on css-animations fixture', async () => {
    manager = new BrowserManager(parseConfig({}));
    const page = await manager.acquirePage();
    try {
      const url = pathToFileURL(resolve(fixturesDir, 'css-animations.html')).href;
      await page.goto(url);
      const detected = await cssDetector.detect(page);
      expect(detected).toBe(true);
    } finally {
      await manager.releasePage(page);
    }
  });

  it('extracts animated-box from css-animations fixture', async () => {
    manager = new BrowserManager(parseConfig({}));
    const page = await manager.acquirePage();
    try {
      const url = pathToFileURL(resolve(fixturesDir, 'css-animations.html')).href;
      await page.goto(url);
      const animations = await cssDetector.extract(page);
      const selectors = animations.map((a) => a.selector);
      expect(selectors.some((s) => s.includes('animated-box'))).toBe(true);
    } finally {
      await manager.releasePage(page);
    }
  });

  it('filters out short transitions (<200ms)', async () => {
    manager = new BrowserManager(parseConfig({}));
    const page = await manager.acquirePage();
    try {
      const url = pathToFileURL(resolve(fixturesDir, 'css-animations.html')).href;
      await page.goto(url);
      const animations = await cssDetector.extract(page);
      const selectors = animations.map((a) => a.selector);
      // .short-transition has 0.05s (50ms) transition — must be filtered out
      expect(selectors.some((s) => s.includes('short-transition'))).toBe(false);
    } finally {
      await manager.releasePage(page);
    }
  });

  it('returns false on a static page with no animations', async () => {
    manager = new BrowserManager(parseConfig({}));
    const page = await manager.acquirePage();
    try {
      const url = pathToFileURL(resolve(fixturesDir, 'static-page.html')).href;
      await page.goto(url);
      const detected = await cssDetector.detect(page);
      expect(detected).toBe(false);
    } finally {
      await manager.releasePage(page);
    }
  });
});

describe('CSS duration parsing', () => {
  it('parses seconds correctly', () => {
    expect(parseDurationMs('0.5s')).toBe(500);
  });

  it('parses milliseconds correctly', () => {
    expect(parseDurationMs('200ms')).toBe(200);
  });

  it('parses mixed comma-separated values (takes max)', () => {
    expect(parseDurationMs('0.5s, 200ms')).toBe(500);
  });

  it('handles multiple second values', () => {
    expect(parseDurationMs('1s, 2s')).toBe(2000);
  });

  it('handles zero duration', () => {
    expect(parseDurationMs('0s')).toBe(0);
  });

  it('handles invalid values', () => {
    expect(parseDurationMs('invalid')).toBe(0);
  });
});
