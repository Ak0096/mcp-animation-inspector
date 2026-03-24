import type { Page } from 'playwright';
import type { AnimationInventory, AnimationCode } from '../types/index.js';

export async function extractAnimationCode(
  page: Page,
  inventory: AnimationInventory[],
): Promise<AnimationCode[]> {
  const results: AnimationCode[] = [];

  for (const anim of inventory) {
    try {
      const code = await extractForAnimation(page, anim);
      if (code) results.push(code);
    } catch {
      // Best-effort — skip failed extractions
    }
  }

  return results;
}

async function extractForAnimation(
  page: Page,
  anim: AnimationInventory,
): Promise<AnimationCode | null> {
  const extracted = await page.evaluate((selector: string) => {
    const el = document.querySelector(selector);
    if (!el) return null;

    const style = window.getComputedStyle(el);

    // CSS data
    const css: {
      keyframes?: string;
      transitions?: string;
      computedStyles?: Record<string, string>;
    } = {};

    if (style.animationName !== 'none') {
      css.computedStyles = {
        animationName: style.animationName,
        animationDuration: style.animationDuration,
        animationTimingFunction: style.animationTimingFunction,
        animationDelay: style.animationDelay,
        animationIterationCount: style.animationIterationCount,
        animationDirection: style.animationDirection,
        animationFillMode: style.animationFillMode,
      };

      // Try to find @keyframes definition
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules ?? [])) {
            if (
              rule instanceof CSSKeyframesRule &&
              rule.name === style.animationName
            ) {
              css.keyframes = rule.cssText;
            }
          }
        } catch {
          // Cross-origin stylesheet
        }
      }
    }

    if (
      style.transitionProperty !== 'none' &&
      style.transitionDuration !== '0s'
    ) {
      css.transitions = style.transition;
    }

    // Timing data
    const durationStr = style.animationDuration || style.transitionDuration;
    const durationMs =
      parseFloat(durationStr) *
      (durationStr.includes('ms') ? 1 : 1000);
    const delayStr = style.animationDelay || style.transitionDelay;
    const delayMs =
      parseFloat(delayStr) * (delayStr.includes('ms') ? 1 : 1000);
    const easing =
      style.animationTimingFunction || style.transitionTimingFunction;
    const iterCount = style.animationIterationCount;

    return {
      css,
      timing: {
        duration: isNaN(durationMs) ? undefined : durationMs,
        delay: isNaN(delayMs) || delayMs === 0 ? undefined : delayMs,
        easing: easing || undefined,
        repeat:
          iterCount === 'infinite'
            ? 'infinite'
            : iterCount
              ? parseInt(iterCount, 10)
              : undefined,
      },
    };
  }, anim.selector);

  if (!extracted) return null;

  // GSAP-specific extraction
  let js: AnimationCode['js'] | undefined;
  if (anim.detector === 'gsap') {
    js = await extractGsapConfig(page, anim.selector);
  }

  return {
    animation: anim,
    css:
      Object.keys(extracted.css).length > 0 ? extracted.css : undefined,
    js,
    timing: {
      duration: extracted.timing.duration,
      delay: extracted.timing.delay,
      easing: extracted.timing.easing,
      repeat: extracted.timing.repeat as number | 'infinite' | undefined,
    },
  };
}

async function extractGsapConfig(
  page: Page,
  selector: string,
): Promise<AnimationCode['js'] | undefined> {
  return page.evaluate((sel: string) => {
    const win = (window as unknown) as Record<string, unknown>;
    if (!win.gsap) return undefined;
    const gsap = win.gsap as {
      globalTimeline: {
        getChildren: (
          nested: boolean,
          tweens: boolean,
          timelines: boolean,
        ) => Array<{
          targets: () => Element[];
          duration: () => number;
          delay: () => number;
          vars?: Record<string, unknown>;
        }>;
      };
    };

    const el = document.querySelector(sel);
    if (!el) return undefined;

    const tweens = gsap.globalTimeline.getChildren(true, true, false);
    for (const tween of tweens) {
      const targets = tween.targets();
      if (targets.includes(el)) {
        const vars = { ...tween.vars };
        // Remove callback functions
        for (const key of Object.keys(vars)) {
          if (typeof vars[key] === 'function') delete vars[key];
        }
        return {
          library: 'gsap' as const,
          config: vars,
          rawSnippet: `gsap.to("${sel}", ${JSON.stringify(vars)})`,
        };
      }
    }

    return undefined;
  }, selector);
}
