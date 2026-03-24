import type { Page } from 'playwright';
import type { AnimationDetector } from './types.js';
import type { AnimationInfo } from '../types/index.js';

export const webglDetector: AnimationDetector = {
  name: 'webgl',

  async detect(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      const win = window as unknown as Record<string, unknown>;
      if (win.THREE || win.PIXI || win.BABYLON || win.p5) return true;

      const canvases = document.querySelectorAll('canvas');
      for (const canvas of canvases) {
        if (canvas.getAttribute('data-engine')) return true;
        if (canvas.width > 1 && canvas.height > 1) return true;
      }
      return false;
    });
  },

  async extract(page: Page): Promise<AnimationInfo[]> {
    return page.evaluate(() => {
      const { buildSelector } = (window as any).__mcp;

      const results: AnimationInfo[] = [];
      const win = window as unknown as Record<string, unknown>;
      const canvases = document.querySelectorAll('canvas');

      for (let i = 0; i < canvases.length; i++) {
        const canvas = canvases[i]!;
        if (canvas.width <= 1 || canvas.height <= 1) continue;

        const base = buildSelector(canvas);
        const selector = (canvas.id || canvas.classList?.length) ? base : `canvas:nth-of-type(${i + 1})`;

        let library = 'WebGL';
        if (win.THREE) library = 'Three.js';
        else if (win.PIXI) library = 'PixiJS';
        else if (win.BABYLON) library = 'Babylon.js';
        else if (win.p5) library = 'p5.js';

        results.push({
          triggers: ['load', 'loop'],
          selector,
          properties: ['webgl-render'],
          triggerDetails: [`${library} canvas: ${canvas.width}x${canvas.height}`],
          confidence: 0.85,
        });
      }

      return results;
    });
  },
};
