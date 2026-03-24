import { describe, it, expect } from 'vitest';
import { parseConfig, type Config } from '../../src/config.js';

describe('parseConfig', () => {
  it('returns defaults when no overrides provided', () => {
    const config = parseConfig({});
    expect(config.headless).toBe(true);
    expect(config.viewport).toEqual({ width: 1440, height: 900 });
    expect(config.timeout).toBe(30_000);
    expect(config.waitForNetworkIdle).toBe(true);
    expect(config.scrollPositions).toEqual([0, 25, 50, 75, 100]);
    expect(config.maxFramesPerAnimation).toBe(5);
    expect(config.maxTotalFrames).toBe(20);
    expect(config.elementCrop).toBe(true);
    expect(config.dismissCookieBanners).toBe(true);
    expect(config.captureHoverStates).toBe(true);
    expect(config.captureClickStates).toBe(false);
    expect(config.imageFormat).toBe('jpeg');
    expect(config.imageQuality).toBe(75);
    expect(config.enabledDetectors).toBe('all');
    expect(config.autoDescribe).toBe(false);
    expect(config.descriptionModel).toBe('claude-sonnet-4-6');
    expect(config.transport).toBe('stdio');
    expect(config.httpPort).toBe(3100);
    expect(config.prefersReducedMotion).toBe(false);
    expect(config.userAgent).toBeNull();
    expect(config.anthropicApiKey).toBeNull();
  });

  it('merges partial overrides with defaults', () => {
    const config = parseConfig({ headless: false, timeout: 60_000 });
    expect(config.headless).toBe(false);
    expect(config.timeout).toBe(60_000);
    expect(config.viewport).toEqual({ width: 1440, height: 900 });
  });

  it('reads ANTHROPIC_API_KEY from env', () => {
    const original = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'sk-test-123';
    const config = parseConfig({});
    expect(config.anthropicApiKey).toBe('sk-test-123');
    if (original) {
      process.env.ANTHROPIC_API_KEY = original;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it('rejects invalid config values', () => {
    expect(() => parseConfig({ timeout: -1 })).toThrow();
    expect(() => parseConfig({ imageQuality: 200 })).toThrow();
    expect(() => parseConfig({ transport: 'websocket' as 'stdio' })).toThrow();
  });
});
