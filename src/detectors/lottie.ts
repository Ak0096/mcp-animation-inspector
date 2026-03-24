import type { Page } from 'playwright';
import type { AnimationDetector } from './types.js';
import type { AnimationInfo } from '../types/index.js';

export const lottieDetector: AnimationDetector = {
  name: 'lottie',

  async detect(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      return (
        'lottie' in window ||
        'bodymovin' in window ||
        !!document.querySelector('lottie-player, dotlottie-player')
      );
    });
  },

  async extract(page: Page): Promise<AnimationInfo[]> {
    return page.evaluate(() => {
      const { buildSelector } = (window as any).__mcp;

      const results: AnimationInfo[] = [];

      // Custom elements
      const players = document.querySelectorAll('lottie-player, dotlottie-player');
      for (const el of players) {
        const id = el.id ? `#${el.id}` : '';
        const selector = `${el.tagName.toLowerCase()}${id}`;

        results.push({
          triggers: ['load', 'loop'],
          selector,
          properties: ['lottie-animation'],
          triggerDetails: ['lottie-player element'],
          confidence: 0.95,
        });
      }

      // Programmatic instances via lottie.getRegisteredAnimations()
      const win = window as unknown as Record<string, unknown>;
      const lottieLib = (win.lottie ?? win.bodymovin) as {
        getRegisteredAnimations?: () => Array<{
          wrapper?: Element;
          animationData?: { nm?: string };
        }>;
      } | undefined;

      if (lottieLib?.getRegisteredAnimations) {
        for (const anim of lottieLib.getRegisteredAnimations()) {
          if (!anim.wrapper || !(anim.wrapper instanceof Element)) continue;
          const el = anim.wrapper;

          // Skip if already found as custom element
          const tag = el.tagName.toLowerCase();
          if (tag === 'lottie-player' || tag === 'dotlottie-player') continue;

          const selector = buildSelector(el);

          results.push({
            triggers: ['load', 'loop'],
            selector,
            properties: ['lottie-animation'],
            triggerDetails: [
              'lottie programmatic instance',
              anim.animationData?.nm ? `name: ${anim.animationData.nm}` : '',
            ].filter(Boolean),
            confidence: 0.9,
          });
        }
      }

      // Elements with lottie-related attributes
      const lottieEls = document.querySelectorAll('[data-animation-path], .lottie');
      for (const el of lottieEls) {
        const tag = el.tagName.toLowerCase();
        if (tag === 'lottie-player' || tag === 'dotlottie-player') continue;

        const selector = buildSelector(el);

        // Skip if already in results
        if (results.some(r => r.selector === selector)) continue;

        results.push({
          triggers: ['load'],
          selector,
          properties: ['lottie-animation'],
          triggerDetails: ['lottie target element'],
          confidence: 0.7,
        });
      }

      return results;
    });
  },
};
