import type { Page } from 'playwright';
import type { AnimationDetector } from './types.js';
import type { AnimationInfo } from '../types/index.js';

export const webglDetector: AnimationDetector = {
  name: 'webgl',

  async detect(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      for (const canvas of canvases) {
        const gl =
          canvas.getContext('webgl') ||
          canvas.getContext('webgl2') ||
          canvas.getContext('experimental-webgl');
        if (gl) return true;
      }
      return false;
    });
  },

  async extract(page: Page): Promise<AnimationInfo[]> {
    return page.evaluate(() => {
      const results: AnimationInfo[] = [];
      const canvases = document.querySelectorAll('canvas');

      for (let i = 0; i < canvases.length; i++) {
        const canvas = canvases[i]!;
        const gl =
          canvas.getContext('webgl') ||
          canvas.getContext('webgl2') ||
          canvas.getContext('experimental-webgl');
        if (!gl) continue;

        const id = canvas.id ? `#${canvas.id}` : '';
        const cls = canvas.classList?.length
          ? `.${Array.from(canvas.classList).slice(0, 2).join('.')}`
          : '';
        const selector = `canvas${id}${cls}` || `canvas:nth-of-type(${i + 1})`;

        const isThreeJs = 'THREE' in window;
        const library = isThreeJs ? 'Three.js' : 'WebGL';

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
