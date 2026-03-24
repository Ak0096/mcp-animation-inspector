import type { Page } from 'playwright';
import type { Config } from '../config.js';
import { dismissCookieBanners } from '../utils/cookies.js';

export interface NavigationResult {
  title: string;
  techStack: string[];
}

export async function navigateTo(
  page: Page,
  url: string,
  config: Config,
): Promise<NavigationResult> {
  await page.goto(url, {
    waitUntil: config.waitForNetworkIdle ? 'networkidle' : 'domcontentloaded',
    timeout: config.timeout,
  });

  if (config.dismissCookieBanners) {
    await dismissCookieBanners(page);
  }

  // CAPTCHA detection — fail fast with clear error
  const hasCaptcha = await page.evaluate(() => {
    return (
      !!document.querySelector('iframe[src*="recaptcha"]') ||
      !!document.querySelector('iframe[src*="hcaptcha"]') ||
      !!document.querySelector('#cf-challenge-running') ||
      !!document.querySelector('.cf-turnstile') ||
      !!document.querySelector('[data-sitekey]')
    );
  });
  if (hasCaptcha) {
    throw new Error('Site blocked by CAPTCHA — cannot inspect animations');
  }

  const title = await page.title();
  const techStack = await detectTechStack(page);

  return { title, techStack };
}

async function detectTechStack(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const win = window as Record<string, unknown>;
    const stack: string[] = [];

    if (win.gsap) {
      const gsap = win.gsap as { version?: string };
      stack.push(`GSAP${gsap.version ? ` ${gsap.version}` : ''}`);
    }
    if (win.ScrollTrigger) stack.push('ScrollTrigger');
    if (win.__lenis || win.lenis) stack.push('Lenis');
    if (win.THREE) stack.push('Three.js');
    if (win.lottie || win.bodymovin) stack.push('Lottie');
    if (document.querySelector('[data-framer-component-type]')) stack.push('Framer Motion');
    if (document.querySelector('[data-scroll-container]')) stack.push('Locomotive Scroll');
    if ('startViewTransition' in document) stack.push('View Transitions API');
    if (win.barba || document.querySelector('[data-barba]')) stack.push('Barba.js');
    if (win.swup || document.querySelector('[data-swup]')) stack.push('Swup');

    return stack;
  });
}
