import type { Page } from 'playwright';
import type { AnimationDetector } from './types.js';
import type { AnimationInfo } from '../types/index.js';

const MIN_DURATION_MS = 200;

export const cssDetector: AnimationDetector = {
  name: 'css',

  async detect(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      if (document.getAnimations().length > 0) return true;
      const elements = document.querySelectorAll('*');
      for (const el of elements) {
        const style = window.getComputedStyle(el);
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
      const { buildSelector, parseDurationMs } = (window as any).__mcp;

      const results: AnimationInfo[] = [];
      const seen = new Set<Element>();

      // Phase 1: Use getAnimations() for active CSS animations/transitions
      for (const anim of document.getAnimations()) {
        const effect = anim.effect;
        if (!(effect instanceof KeyframeEffect)) continue;
        const el = effect.target;
        if (!el || !(el instanceof Element) || seen.has(el)) continue;

        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;

        const isAnimation = style.animationName !== 'none';
        const durationStr = isAnimation ? style.animationDuration : style.transitionDuration;
        const durationMs = parseDurationMs(durationStr);
        if (durationMs < minDuration) continue;

        seen.add(el);

        const selector = buildSelector(el);

        const properties = isAnimation
          ? [style.animationName]
          : style.transitionProperty.split(',').map((p: string) => p.trim());

        results.push({
          triggers: isAnimation ? ['load'] : ['hover'],
          selector,
          properties,
          triggerDetails: isAnimation
            ? [`animation: ${style.animationName}`]
            : [`transition: ${style.transitionProperty}`],
          confidence: 0.8,
        });
      }

      // Phase 2: Fallback scan for transition-property declarations not yet triggered
      const elements = document.querySelectorAll('*');
      for (const el of elements) {
        if (seen.has(el)) continue;

        const style = window.getComputedStyle(el);
        const hasTransition =
          style.transitionProperty !== 'none' &&
          style.transitionDuration !== '0s';

        if (!hasTransition) continue;

        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (style.display === 'none' || style.visibility === 'hidden') continue;

        const durationMs = parseDurationMs(style.transitionDuration);
        if (durationMs < minDuration) continue;

        const selector = buildSelector(el);

        results.push({
          triggers: ['hover'],
          selector,
          properties: style.transitionProperty.split(',').map((p: string) => p.trim()),
          triggerDetails: [`transition: ${style.transitionProperty}`],
          confidence: 0.8,
        });
      }

      return results;
    }, MIN_DURATION_MS);
  },
};
