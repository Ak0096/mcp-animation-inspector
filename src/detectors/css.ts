import type { Page } from 'playwright';
import type { AnimationDetector } from './types.js';
import type { AnimationInfo } from '../types/index.js';

const MIN_DURATION_MS = 200;

export const cssDetector: AnimationDetector = {
  name: 'css',

  async detect(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      for (const el of elements) {
        const style = window.getComputedStyle(el);
        if (style.animationName !== 'none') return true;
        if (
          style.transitionProperty !== 'none' &&
          style.transitionDuration !== '0s'
        )
          return true;
      }
      return false;
    });
  },

  async extract(page: Page): Promise<AnimationInfo[]> {
    return page.evaluate((minDuration) => {
      const results: AnimationInfo[] = [];
      const elements = document.querySelectorAll('*');

      for (const el of elements) {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        // Skip invisible elements
        if (rect.width === 0 || rect.height === 0) continue;
        if (style.display === 'none' || style.visibility === 'hidden') continue;

        const hasAnimation = style.animationName !== 'none';
        const hasTransition =
          style.transitionProperty !== 'none' &&
          style.transitionDuration !== '0s';

        if (!hasAnimation && !hasTransition) continue;

        // Parse duration — filter short transitions
        const durationStr = hasAnimation
          ? style.animationDuration
          : style.transitionDuration;
        const durationMs = parseFloat(durationStr) * (durationStr.includes('ms') ? 1 : 1000);
        if (durationMs < minDuration) continue;

        const id = el.id ? `#${el.id}` : '';
        const cls = el.classList.length
          ? `.${Array.from(el.classList).slice(0, 2).join('.')}`
          : '';
        const selector = `${el.tagName.toLowerCase()}${id}${cls}`;

        const properties = hasAnimation
          ? [style.animationName]
          : style.transitionProperty.split(',').map((p: string) => p.trim());

        results.push({
          triggers: hasAnimation ? ['load'] : ['hover'],
          selector,
          properties,
          triggerDetails: hasAnimation
            ? [`animation: ${style.animationName}`]
            : [`transition: ${style.transitionProperty}`],
          confidence: 0.8,
        });
      }

      return results;
    }, MIN_DURATION_MS);
  },
};
