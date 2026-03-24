import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { Config } from './config.js';
import { applyStealthScripts } from './utils/stealth.js';

const MAX_CONCURRENT_PAGES = 3;
const MAX_QUEUE_DEPTH = 10;
const QUEUE_TIMEOUT_MS = 15_000;

interface QueuedRequest {
  resolve: (page: Page) => void;
  reject: (error: Error) => void;
}

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private activePages = new Set<Page>();
  private queue: QueuedRequest[] = [];
  private config: Config;
  private queueTimeoutMs: number;

  constructor(config: Config, queueTimeoutMs = QUEUE_TIMEOUT_MS) {
    this.config = config;
    this.queueTimeoutMs = queueTimeoutMs;
  }

  private async ensureBrowser(): Promise<BrowserContext> {
    if (this.context && this.browser?.isConnected()) {
      return this.context;
    }

    // Crash recovery — clean up if browser died
    this.browser = null;
    this.context = null;
    this.activePages.clear();

    this.browser = await chromium.launch({
      headless: this.config.headless,
      executablePath: process.env.BROWSER_PATH || undefined,
    });

    this.context = await this.browser.newContext({
      viewport: this.config.viewport,
      userAgent:
        this.config.userAgent ??
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      reducedMotion: this.config.prefersReducedMotion
        ? 'reduce'
        : 'no-preference',
    });

    await applyStealthScripts(this.context);

    this.browser.on('disconnected', () => {
      this.browser = null;
      this.context = null;
      this.activePages.clear();
    });

    return this.context;
  }

  async acquirePage(): Promise<Page> {
    if (this.activePages.size < MAX_CONCURRENT_PAGES) {
      const context = await this.ensureBrowser();
      const page = await context.newPage();
      this.activePages.add(page);
      return page;
    }

    if (this.queue.length >= MAX_QUEUE_DEPTH) {
      throw new Error('Server busy: page pool and queue are full');
    }

    return new Promise<Page>((resolve, reject) => {
      const entry: QueuedRequest = { resolve, reject };
      this.queue.push(entry);

      const timer = setTimeout(() => {
        const idx = this.queue.indexOf(entry);
        if (idx !== -1) {
          this.queue.splice(idx, 1);
          reject(new Error('Server busy: queue timeout exceeded'));
        }
      }, this.queueTimeoutMs);

      const originalResolve = entry.resolve;
      entry.resolve = (page: Page) => {
        clearTimeout(timer);
        originalResolve(page);
      };
    });
  }

  async releasePage(page: Page): Promise<void> {
    this.activePages.delete(page);
    if (!page.isClosed()) {
      await page.close().catch(() => {});
    }

    // Serve queued request
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      try {
        const context = await this.ensureBrowser();
        const newPage = await context.newPage();
        this.activePages.add(newPage);
        next.resolve(newPage);
      } catch (err) {
        next.reject(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }

  async shutdown(): Promise<void> {
    for (const page of this.activePages) {
      await page.close().catch(() => {});
    }
    this.activePages.clear();
    this.queue.forEach((q) => q.reject(new Error('Server shutting down')));
    this.queue = [];
    await this.browser?.close().catch(() => {});
    this.browser = null;
    this.context = null;
  }
}
