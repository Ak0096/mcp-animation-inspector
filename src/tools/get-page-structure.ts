import type { Config } from '../config.js';
import type { BrowserManager } from '../browser.js';
import type { PageStructure } from '../types/index.js';
import { navigateTo } from '../pipeline/navigate.js';

export async function getPageStructureTool(
  url: string,
  browserManager: BrowserManager,
  config: Config,
): Promise<PageStructure> {
  const page = await browserManager.acquirePage();

  try {
    await navigateTo(page, url, config);

    return page.evaluate((): PageStructure => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const doc = (globalThis as any).document as {
        title: string;
        querySelectorAll: (s: string) => ArrayLike<any>;
      };

      const title: string = doc.title;

      const sections = Array.from(doc.querySelectorAll(
        'header, main, section, footer, article, aside, nav',
      )).map((el: any) => {
        const id: string = el.id ? `#${el.id}` : '';
        const cls: string = el.classList?.length
          ? `.${Array.from(el.classList as any[]).slice(0, 2).join('.')}`
          : '';
        return {
          selector: `${el.tagName.toLowerCase()}${id}${cls}`,
          tag: el.tagName.toLowerCase() as string,
          text: el.querySelector('h1, h2, h3')?.textContent?.trim()?.slice(0, 80) as string | undefined,
          children: el.children.length as number,
        };
      });

      const interactiveElements = Array.from(doc.querySelectorAll(
        'a[href], button, input, select, textarea, [role="button"]',
      ))
        .slice(0, 50)
        .map((el: any) => {
          const id: string = el.id ? `#${el.id}` : '';
          return {
            selector: `${el.tagName.toLowerCase()}${id}`,
            type: el.tagName.toLowerCase() as string,
            text: el.textContent?.trim()?.slice(0, 50) as string | undefined,
          };
        });

      const landmarks = Array.from(doc.querySelectorAll('[role]')).map((el: any) => ({
        role: (el.getAttribute('role') ?? '') as string,
        selector: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`,
        label: (el.getAttribute('aria-label') ?? undefined) as string | undefined,
      }));
      /* eslint-enable @typescript-eslint/no-explicit-any */

      return { title, sections, interactiveElements, landmarks };
    });
  } finally {
    await browserManager.releasePage(page);
  }
}
