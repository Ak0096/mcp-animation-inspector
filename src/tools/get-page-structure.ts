import type { Config } from '../config.js';
import type { BrowserManager } from '../browser.js';
import type { PageStructure } from '../types/index.js';
import { navigateTo } from '../pipeline/navigate.js';
import { withPage } from '../utils/with-page.js';

export async function getPageStructureTool(
  url: string,
  browserManager: BrowserManager,
  config: Config,
): Promise<PageStructure> {
  return withPage(browserManager, config, 'page-structure', async (page) => {
    await navigateTo(page, url, config);

    return page.evaluate((): PageStructure => {
      const { buildSelector } = (window as any).__mcp;
      const title: string = document.title;

      const sections = Array.from(document.querySelectorAll(
        'header, main, section, footer, article, aside, nav',
      )).slice(0, 50).map((el: Element) => {
        return {
          selector: buildSelector(el),
          tag: el.tagName.toLowerCase(),
          text: el.querySelector('h1, h2, h3')?.textContent?.trim()?.slice(0, 80),
          children: el.children.length,
        };
      });

      const interactiveElements = Array.from(document.querySelectorAll(
        'a[href], button, input, select, textarea, [role="button"]',
      ))
        .slice(0, 50)
        .map((el: Element) => {
          const id: string = el.id ? `#${el.id}` : '';
          return {
            selector: `${el.tagName.toLowerCase()}${id}`,
            type: el.tagName.toLowerCase(),
            text: el.textContent?.trim()?.slice(0, 50),
          };
        });

      const landmarks = Array.from(document.querySelectorAll('[role]')).slice(0, 100).map((el: Element) => ({
        role: el.getAttribute('role') ?? '',
        selector: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`,
        label: el.getAttribute('aria-label') ?? undefined,
      }));

      return { title, sections, interactiveElements, landmarks };
    });
  });
}
