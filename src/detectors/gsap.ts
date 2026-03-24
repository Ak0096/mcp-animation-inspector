import type { Page } from 'playwright';
import type { AnimationDetector } from './types.js';
import type { AnimationInfo } from '../types/index.js';

export const gsapDetector: AnimationDetector = {
  name: 'gsap',

  async detect(page: Page): Promise<boolean> {
    return page.evaluate(() => 'gsap' in window);
  },

  async extract(page: Page): Promise<AnimationInfo[]> {
    return page.evaluate(() => {
      const win = (window as unknown) as Record<string, unknown>;
      if (!win.gsap) return [];
      const gsap = win.gsap as {
        version: string;
        globalTimeline: {
          getChildren: (nested: boolean, tweens: boolean, timelines: boolean) => Array<{
            targets: () => Element[];
            duration: () => number;
            delay: () => number;
            vars?: Record<string, unknown>;
          }>;
        };
      };

      const tweens = gsap.globalTimeline.getChildren(true, true, false);
      const results: AnimationInfo[] = [];

      for (const tween of tweens) {
        const targets = tween.targets();
        for (const target of targets) {
          if (!(target instanceof Element)) continue;

          const id = target.id ? `#${target.id}` : '';
          const cls = target.classList?.length
            ? `.${Array.from(target.classList).slice(0, 2).join('.')}`
            : '';
          const selector = `${target.tagName.toLowerCase()}${id}${cls}`;

          const properties = tween.vars
            ? Object.keys(tween.vars).filter(
                (k) => !['duration', 'delay', 'ease', 'onComplete', 'onStart', 'stagger'].includes(k)
              )
            : [];

          results.push({
            triggers: ['load'],
            selector,
            properties,
            triggerDetails: [`gsap tween, duration: ${tween.duration()}s`],
            confidence: 0.95,
          });
        }
      }

      // ScrollTrigger detection
      const ST = win.ScrollTrigger as
        | { getAll: () => Array<{ trigger?: Element; start: number; end: number }> }
        | undefined;
      if (ST) {
        for (const st of ST.getAll()) {
          if (!st.trigger) continue;
          const el = st.trigger;
          const id = el.id ? `#${el.id}` : '';
          const cls = el.classList?.length
            ? `.${Array.from(el.classList).slice(0, 2).join('.')}`
            : '';
          const selector = `${el.tagName.toLowerCase()}${id}${cls}`;

          // Check if this selector already added via tween detection
          if (results.some((r) => r.selector === selector)) {
            const existing = results.find((r) => r.selector === selector)!;
            if (!existing.triggers.includes('scroll')) {
              existing.triggers.push('scroll');
              existing.triggerDetails.push(`ScrollTrigger: ${st.start}-${st.end}`);
            }
            continue;
          }

          results.push({
            triggers: ['scroll', 'viewport'],
            selector,
            properties: ['transform', 'opacity'],
            triggerDetails: [
              `ScrollTrigger: ${st.start}-${st.end}`,
              'viewport-enter',
            ],
            confidence: 0.9,
          });
        }
      }

      return results;
    });
  },
};
