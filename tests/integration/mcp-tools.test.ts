import { describe, it, expect, afterEach } from 'vitest';
import { BrowserManager } from '../../src/browser.js';
import { parseConfig } from '../../src/config.js';
import { discoverAnimationsTool } from '../../src/tools/discover-animations.js';
import { getPageStructureTool } from '../../src/tools/get-page-structure.js';
import { getPageContentTool } from '../../src/tools/get-page-content.js';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

const fixturesDir = resolve(process.cwd(), 'tests/fixtures');

describe('MCP tools integration', () => {
  let manager: BrowserManager;

  afterEach(async () => {
    if (manager) await manager.shutdown();
  });

  it('discover_animations returns inventory for CSS animations page', async () => {
    manager = new BrowserManager(parseConfig({}));
    const config = parseConfig({});
    const url = pathToFileURL(resolve(fixturesDir, 'css-animations.html')).href;

    const { inventory, techStack } = await discoverAnimationsTool(url, manager, config);

    expect(Array.isArray(inventory)).toBe(true);
    expect(inventory.length).toBeGreaterThan(0);

    const selectors = inventory.map((item) => item.selector);
    expect(selectors.some((s) => s.includes('animated-box'))).toBe(true);

    expect(Array.isArray(techStack)).toBe(true);
  });

  it('get_page_structure returns valid PageStructure for CSS animations page', async () => {
    manager = new BrowserManager(parseConfig({}));
    const config = parseConfig({});
    const url = pathToFileURL(resolve(fixturesDir, 'css-animations.html')).href;

    const structure = await getPageStructureTool(url, manager, config);

    expect(structure).toBeDefined();
    expect(typeof structure.title).toBe('string');
    expect(Array.isArray(structure.sections)).toBe(true);
    expect(Array.isArray(structure.interactiveElements)).toBe(true);
    expect(Array.isArray(structure.landmarks)).toBe(true);
  });

  it('discover_animations returns empty inventory for static page', async () => {
    manager = new BrowserManager(parseConfig({}));
    const config = parseConfig({});
    const url = pathToFileURL(resolve(fixturesDir, 'static-page.html')).href;

    const { inventory } = await discoverAnimationsTool(url, manager, config);

    expect(Array.isArray(inventory)).toBe(true);
    expect(inventory.length).toBe(0);
  });

  it('get_page_structure title matches fixture title', async () => {
    manager = new BrowserManager(parseConfig({}));
    const config = parseConfig({});
    const url = pathToFileURL(resolve(fixturesDir, 'static-page.html')).href;

    const structure = await getPageStructureTool(url, manager, config);

    expect(structure.title).toBe('Test Page');
  });

  it('get_page_content returns text content for static page', async () => {
    manager = new BrowserManager(parseConfig({}));
    const config = parseConfig({});
    const url = pathToFileURL(resolve(fixturesDir, 'static-page.html')).href;

    const result = await getPageContentTool(url, manager, config, {
      format: 'text',
      maxLength: 50000,
    });

    expect(result.url).toBe(url);
    expect(result.title).toBe('Test Page');
    expect(result.format).toBe('text');
    expect(typeof result.text).toBe('string');
    expect(result.text!.length).toBeGreaterThan(0);
    expect(result.html).toBeUndefined();
    expect(result.meta.truncated).toBe(false);
  });

  it('get_page_content returns html content when format is html', async () => {
    manager = new BrowserManager(parseConfig({}));
    const config = parseConfig({});
    const url = pathToFileURL(resolve(fixturesDir, 'static-page.html')).href;

    const result = await getPageContentTool(url, manager, config, {
      format: 'html',
      maxLength: 50000,
    });

    expect(result.format).toBe('html');
    expect(typeof result.html).toBe('string');
    expect(result.html).toContain('<');
    expect(result.text).toBeUndefined();
  });

  it('get_page_content returns both formats when format is both', async () => {
    manager = new BrowserManager(parseConfig({}));
    const config = parseConfig({});
    const url = pathToFileURL(resolve(fixturesDir, 'static-page.html')).href;

    const result = await getPageContentTool(url, manager, config, {
      format: 'both',
      maxLength: 50000,
    });

    expect(result.format).toBe('both');
    expect(typeof result.html).toBe('string');
    expect(typeof result.text).toBe('string');
  });

  it('get_page_content truncates content when max_length is small', async () => {
    manager = new BrowserManager(parseConfig({}));
    const config = parseConfig({});
    const url = pathToFileURL(resolve(fixturesDir, 'css-animations.html')).href;

    const result = await getPageContentTool(url, manager, config, {
      format: 'html',
      maxLength: 100,
    });

    expect(result.html!.length).toBeLessThanOrEqual(100);
    expect(result.meta.truncated).toBe(true);
  });
});
