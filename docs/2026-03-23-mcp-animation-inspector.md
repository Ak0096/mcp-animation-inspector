# MCP Animation Inspector — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an open-source MCP server that gives AI coding assistants the ability to "see" and understand website animations via Playwright browser automation, pluggable detectors, and frame capture.

**Architecture:** Pipeline-based MCP server with 6 stages (Navigate → Discover → Capture → Extract → Describe → Report), each exposed as individual MCP tools plus a full-pipeline tool. Singleton browser with page pool for resource management.

**Tech Stack:** TypeScript (strict), @modelcontextprotocol/sdk v1.x, Playwright, Zod, tsup, Vitest, @anthropic-ai/sdk (optional)

**Spec:** `docs/superpowers/specs/2026-03-23-mcp-animation-inspector-design.md`

**Repo:** `/home/ak96/Documents/Project/mcp-animation-inspector`

---

## File Structure

```
mcp-animation-inspector/
├── src/
│   ├── index.ts                 // Entry point — shebang, CLI arg parsing, server start
│   ├── server.ts                // McpServer setup, tool registration, transport selection
│   ├── config.ts                // Zod config schema, defaults, env parsing, CLI merging
│   ├── browser.ts               // Singleton BrowserManager — page pool, crash recovery, cleanup
│   │
│   ├── types/
│   │   ├── inventory.ts         // AnimationInventory, AnimationInfo
│   │   ├── frames.ts            // Frame, FrameSet
│   │   ├── code.ts              // AnimationCode
│   │   ├── report.ts            // InspectionReport, PageStructure
│   │   └── index.ts             // Re-exports
│   │
│   ├── detectors/
│   │   ├── types.ts             // AnimationDetector interface
│   │   ├── css.ts               // CSS transitions, keyframes (>200ms, visible only)
│   │   ├── gsap.ts              // GSAP timelines, tweens, ScrollTrigger
│   │   ├── framer-motion.ts     // data-framer-*, __framer__ globals
│   │   ├── lottie.ts            // lottie-player elements, window.lottie
│   │   ├── webgl.ts             // Canvas + WebGL context + rAF observation
│   │   ├── scroll-library.ts    // Lenis, Locomotive
│   │   ├── cursor.ts            // cursor:none + absolute positioned elements
│   │   ├── page-transition.ts   // View Transitions API, Barba.js, Swup
│   │   └── index.ts             // Auto-register all detectors, export registry
│   │
│   ├── pipeline/
│   │   ├── navigate.ts          // Page load, network idle, cookie dismissal, tech detection
│   │   ├── discover.ts          // Run detectors, build AnimationInventory[]
│   │   ├── capture.ts           // Scroll screenshots, hover states, element crops
│   │   ├── extract.ts           // CSS rules, JS configs, timing data
│   │   ├── describe.ts          // Optional Claude Vision API call
│   │   └── report.ts            // Combine stages into InspectionReport
│   │
│   ├── tools/
│   │   ├── inspect-animation.ts       // Full pipeline tool
│   │   ├── discover-animations.ts     // Discover-only tool
│   │   ├── capture-frames.ts          // Capture-only tool
│   │   ├── extract-animation-code.ts  // Extract-only tool
│   │   ├── describe-animations.ts     // Describe-only tool
│   │   └── get-page-structure.ts      // DOM structure tool
│   │
│   └── utils/
│       ├── cookies.ts           // Cookie banner dismissal logic
│       ├── stealth.ts           // Browser stealth init scripts
│       ├── selectors.ts         // Shared buildSelector(el) utility used by all detectors
│       └── logger.ts            // Debug logger (enabled via DEBUG=mcp-animation-inspector)
│
├── tests/
│   ├── fixtures/
│   │   ├── css-animations.html       // Test page with CSS keyframes + transitions
│   │   ├── gsap-page.html            // Test page with GSAP timelines + ScrollTrigger
│   │   ├── multi-library.html        // Test page with GSAP + Lenis + Lottie
│   │   └── static-page.html          // Page with zero animations (negative test)
│   ├── unit/
│   │   ├── config.test.ts
│   │   ├── browser.test.ts
│   │   ├── detectors/
│   │   │   ├── css.test.ts
│   │   │   ├── gsap.test.ts
│   │   │   └── registry.test.ts
│   │   └── pipeline/
│   │       ├── navigate.test.ts
│   │       ├── discover.test.ts
│   │       ├── capture.test.ts
│   │       ├── extract.test.ts
│   │       └── report.test.ts
│   └── integration/
│       ├── full-pipeline.test.ts
│       └── mcp-tools.test.ts
│
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── .gitignore
├── .npmignore
├── LICENSE
└── README.md
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `.gitignore`, `.npmignore`, `LICENSE`, `src/index.ts` (placeholder)

- [ ] **Step 1: Create repo directory and initialize git**

```bash
mkdir -p /home/ak96/Documents/Project/mcp-animation-inspector
cd /home/ak96/Documents/Project/mcp-animation-inspector
git init
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "mcp-animation-inspector",
  "version": "0.1.0",
  "description": "MCP server that helps AI assistants understand website animations via Playwright, pluggable detectors, and frame capture",
  "type": "module",
  "bin": {
    "mcp-animation-inspector": "./dist/index.js"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit",
    "inspector": "npx @modelcontextprotocol/inspector dist/index.js"
  },
  "keywords": ["mcp", "animation", "playwright", "inspector", "ai", "claude"],
  "license": "MIT",
  "engines": { "node": ">=20" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.27.1",
    "playwright": "^1.52.0",
    "zod": "^3.25.0"
  },
  "optionalDependencies": {
    "@anthropic-ai/sdk": "^0.39.0"
  },
  "devDependencies": {
    "tsup": "^8.5.0",
    "tsx": "^4.19.0",
    "typescript": "^5.9.0",
    "vitest": "^3.2.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Create tsup.config.ts**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  shims: true,
  dts: false,
  splitting: false,
  sourcemap: false,
  minify: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
```

- [ ] **Step 5: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
```

- [ ] **Step 6: Create .gitignore**

```
node_modules/
dist/
*.tgz
.env
.DS_Store
```

- [ ] **Step 7: Create .npmignore**

```
src/
tests/
tsconfig.json
tsup.config.ts
vitest.config.ts
.gitignore
```

- [ ] **Step 8: Create LICENSE (MIT)**

Standard MIT license with current year and author.

- [ ] **Step 9: Create placeholder src/index.ts**

```typescript
#!/usr/bin/env node

console.error('mcp-animation-inspector: starting...');
```

- [ ] **Step 10: Install dependencies and verify build**

```bash
cd /home/ak96/Documents/Project/mcp-animation-inspector
npm install
npx playwright install chromium
npm run build
```

Expected: `dist/index.js` created, no errors.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold project with deps, build config, and structure"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `src/types/inventory.ts`, `src/types/frames.ts`, `src/types/code.ts`, `src/types/report.ts`, `src/types/index.ts`

- [ ] **Step 1: Create src/types/inventory.ts**

```typescript
export interface AnimationInventory {
  detector: string;
  triggers: string[];
  selector: string;
  properties: string[];
  triggerDetails: string[];
  confidence: number;
}

export interface AnimationInfo {
  triggers: string[];
  selector: string;
  properties: string[];
  triggerDetails: string[];
  confidence: number;
}
```

- [ ] **Step 2: Create src/types/frames.ts**

```typescript
import type { AnimationInventory } from './inventory.js';

export interface Frame {
  image: string;
  label: string;
  timestamp?: number;
  viewport: { width: number; height: number };
}

export interface FrameSet {
  animation: AnimationInventory;
  frames: Frame[];
}
```

- [ ] **Step 3: Create src/types/code.ts**

```typescript
import type { AnimationInventory } from './inventory.js';

export interface AnimationCode {
  animation: AnimationInventory;
  css?: {
    keyframes?: string;
    transitions?: string;
    computedStyles?: Record<string, string>;
  };
  js?: {
    library:
      | 'gsap'
      | 'framer-motion'
      | 'lottie'
      | 'webgl'
      | 'scroll-library'
      | (string & {});
    config: Record<string, unknown>;
    rawSnippet?: string;
  };
  timing: {
    duration?: number;
    delay?: number;
    easing?: string;
    repeat?: number | 'infinite';
  };
}
```

- [ ] **Step 4: Create src/types/report.ts**

```typescript
import type { AnimationInventory } from './inventory.js';
import type { FrameSet } from './frames.js';
import type { AnimationCode } from './code.js';

export interface PageStructure {
  title: string;
  sections: {
    selector: string;
    tag: string;
    text?: string;
    children: number;
  }[];
  interactiveElements: {
    selector: string;
    type: string;
    text?: string;
  }[];
  landmarks: {
    role: string;
    selector: string;
    label?: string;
  }[];
}

export interface InspectionError {
  stage: string;
  detector?: string;
  selector?: string;
  error: string;
}

export interface InspectionReport {
  schemaVersion: string;
  url: string;
  timestamp: string;
  techStack: string[];
  inventory: AnimationInventory[];
  frames: FrameSet[];
  code: AnimationCode[];
  descriptions?: string[];
  meta: {
    inspectionDuration: number;
    detectorsRun: string[];
    errors: InspectionError[];
  };
}
```

- [ ] **Step 5: Create src/types/index.ts**

```typescript
export type { AnimationInventory, AnimationInfo } from './inventory.js';
export type { Frame, FrameSet } from './frames.js';
export type { AnimationCode } from './code.js';
export type {
  PageStructure,
  InspectionError,
  InspectionReport,
} from './report.js';
```

- [ ] **Step 6: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/types/
git commit -m "feat: add TypeScript type definitions for all pipeline data"
```

---

## Task 3: Configuration Module

**Files:**
- Create: `src/config.ts`
- Test: `tests/unit/config.test.ts`

- [ ] **Step 1: Write failing test for config defaults**

Create `tests/unit/config.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseConfig, type Config } from '../../src/config.js';

describe('parseConfig', () => {
  it('returns defaults when no overrides provided', () => {
    const config = parseConfig({});
    expect(config.headless).toBe(true);
    expect(config.viewport).toEqual({ width: 1440, height: 900 });
    expect(config.timeout).toBe(30_000);
    expect(config.waitForNetworkIdle).toBe(true);
    expect(config.scrollPositions).toEqual([0, 25, 50, 75, 100]);
    expect(config.maxFramesPerAnimation).toBe(5);
    expect(config.maxTotalFrames).toBe(20);
    expect(config.elementCrop).toBe(true);
    expect(config.dismissCookieBanners).toBe(true);
    expect(config.captureHoverStates).toBe(true);
    expect(config.captureClickStates).toBe(false);
    expect(config.imageFormat).toBe('jpeg');
    expect(config.imageQuality).toBe(75);
    expect(config.enabledDetectors).toBe('all');
    expect(config.autoDescribe).toBe(false);
    expect(config.descriptionModel).toBe('claude-sonnet-4-6');
    expect(config.transport).toBe('stdio');
    expect(config.httpPort).toBe(3100);
    expect(config.prefersReducedMotion).toBe(false);
    expect(config.userAgent).toBeNull();
    expect(config.anthropicApiKey).toBeNull();
  });

  it('merges partial overrides with defaults', () => {
    const config = parseConfig({ headless: false, timeout: 60_000 });
    expect(config.headless).toBe(false);
    expect(config.timeout).toBe(60_000);
    expect(config.viewport).toEqual({ width: 1440, height: 900 });
  });

  it('reads ANTHROPIC_API_KEY from env', () => {
    const original = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'sk-test-123';
    const config = parseConfig({});
    expect(config.anthropicApiKey).toBe('sk-test-123');
    if (original) {
      process.env.ANTHROPIC_API_KEY = original;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it('rejects invalid config values', () => {
    expect(() => parseConfig({ timeout: -1 })).toThrow();
    expect(() => parseConfig({ imageQuality: 200 })).toThrow();
    expect(() => parseConfig({ transport: 'websocket' as 'stdio' })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/config.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement src/config.ts**

```typescript
import { z } from 'zod';

const ViewportSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const ConfigSchema = z.object({
  headless: z.boolean().default(true),
  viewport: ViewportSchema.default({ width: 1440, height: 900 }),
  timeout: z.number().int().min(1000).default(30_000),
  waitForNetworkIdle: z.boolean().default(true),

  scrollPositions: z.array(z.number().min(0).max(100)).default([0, 25, 50, 75, 100]),
  maxFramesPerAnimation: z.number().int().min(1).default(5),
  maxTotalFrames: z.number().int().min(1).default(20),
  elementCrop: z.boolean().default(true),
  dismissCookieBanners: z.boolean().default(true),
  captureHoverStates: z.boolean().default(true),
  captureClickStates: z.boolean().default(false),
  imageFormat: z.enum(['jpeg', 'png']).default('jpeg'),
  imageQuality: z.number().int().min(1).max(100).default(75),

  enabledDetectors: z.union([z.literal('all'), z.array(z.string())]).default('all'),

  anthropicApiKey: z.string().nullable().default(null),
  autoDescribe: z.boolean().default(false),
  descriptionModel: z.string().default('claude-sonnet-4-6'),

  userAgent: z.string().nullable().default(null),
  prefersReducedMotion: z.boolean().default(false),

  transport: z.enum(['stdio', 'http']).default('stdio'),
  httpPort: z.number().int().min(1).max(65535).default(3100),
});

export type Config = z.infer<typeof ConfigSchema>;

export function parseConfig(overrides: Record<string, unknown>): Config {
  const withEnv = {
    ...overrides,
    anthropicApiKey:
      overrides.anthropicApiKey ??
      process.env.ANTHROPIC_API_KEY ??
      null,
  };

  return ConfigSchema.parse(withEnv);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/config.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config.ts tests/unit/config.test.ts
git commit -m "feat: add Zod-validated config with defaults and env parsing"
```

---

## Task 4: Browser Manager

**Files:**
- Create: `src/browser.ts`, `src/utils/stealth.ts`
- Test: `tests/unit/browser.test.ts`

- [ ] **Step 1: Write failing tests for BrowserManager**

Create `tests/unit/browser.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { BrowserManager } from '../../src/browser.js';
import { parseConfig } from '../../src/config.js';

describe('BrowserManager', () => {
  let manager: BrowserManager;

  afterEach(async () => {
    if (manager) await manager.shutdown();
  });

  it('acquires and releases a page', async () => {
    manager = new BrowserManager(parseConfig({}));
    const page = await manager.acquirePage();
    expect(page).toBeDefined();
    expect(page.isClosed()).toBe(false);
    await manager.releasePage(page);
  });

  it('enforces max concurrent pages', async () => {
    manager = new BrowserManager(parseConfig({}));
    const pages = await Promise.all([
      manager.acquirePage(),
      manager.acquirePage(),
      manager.acquirePage(),
    ]);
    expect(pages).toHaveLength(3);

    // 4th should queue — test with short timeout
    const timeoutPromise = Promise.race([
      manager.acquirePage(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 500)
      ),
    ]);
    await expect(timeoutPromise).rejects.toThrow('timeout');

    // Release one, 4th should now succeed
    await manager.releasePage(pages[0]!);
    const page4 = await manager.acquirePage();
    expect(page4).toBeDefined();

    await manager.releasePage(pages[1]!);
    await manager.releasePage(pages[2]!);
    await manager.releasePage(page4);
  });

  it('shuts down cleanly', async () => {
    manager = new BrowserManager(parseConfig({}));
    const page = await manager.acquirePage();
    await manager.releasePage(page);
    await manager.shutdown();
    // After shutdown, acquiring should relaunch
    const page2 = await manager.acquirePage();
    expect(page2).toBeDefined();
    await manager.releasePage(page2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/browser.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create src/utils/stealth.ts**

```typescript
import type { BrowserContext } from 'playwright';

export async function applyStealthScripts(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });

    (window as Record<string, unknown>).chrome = {
      runtime: {},
      loadTimes: () => ({}),
      csi: () => ({}),
    };
  });
}
```

- [ ] **Step 4: Implement src/browser.ts**

```typescript
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

  constructor(config: Config) {
    this.config = config;
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
      }, QUEUE_TIMEOUT_MS);

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
```

- [ ] **Step 5: Run tests**

```bash
npm test -- tests/unit/browser.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/browser.ts src/utils/stealth.ts tests/unit/browser.test.ts
git commit -m "feat: add BrowserManager with page pool, queue, and crash recovery"
```

---

## Task 5: Cookie Banner Dismissal Utility

**Files:**
- Create: `src/utils/cookies.ts`

- [ ] **Step 1: Implement src/utils/cookies.ts**

```typescript
import type { Page } from 'playwright';

const ACCEPT_SELECTORS = [
  '#onetrust-accept-btn-handler',
  '.onetrust-close-btn-handler',
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
  '#CybotCookiebotDialogBodyButtonAccept',
  // Quantcast
  '.qc-cmp2-summary-buttons button[mode="primary"]',
  '#qc-cmp2-ui button.css-47sehv',
  'button[id*="accept" i]',
  'button[class*="accept" i]',
  'button[data-consent="accept"]',
  '[aria-label*="Accept" i]',
  '[aria-label*="Agree" i]',
  'button:has-text("Accept all")',
  'button:has-text("Accept All")',
  'button:has-text("Accept cookies")',
  'button:has-text("Agree")',
  'button:has-text("I Accept")',
  'button:has-text("OK")',
];

const BANNER_HIDE_CSS = `
  [id*="cookie" i], [class*="cookie-banner" i],
  [id*="consent" i], [class*="consent" i],
  [id*="gdpr" i], [class*="gdpr" i],
  .cc-window, .cc-banner,
  #cookielaw-info-bar, .cookie-notice, #cookie-notice {
    display: none !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }
`;

export async function dismissCookieBanners(page: Page): Promise<void> {
  for (const selector of ACCEPT_SELECTORS) {
    try {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 300 })) {
        await btn.click();
        await page.waitForTimeout(300);
        return;
      }
    } catch {
      // Not found — try next
    }
  }

  // Fallback: hide banners via CSS
  await page.addStyleTag({ content: BANNER_HIDE_CSS });
}
```

- [ ] **Step 2: Create src/utils/selectors.ts**

```typescript
export function buildSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const cls = el.classList?.length
    ? `.${Array.from(el.classList).slice(0, 2).join('.')}`
    : '';
  return `${tag}${id}${cls}`;
}
```

- [ ] **Step 3: Create src/utils/logger.ts**

```typescript
const DEBUG = process.env.DEBUG?.includes('mcp-animation-inspector') ?? false;

export function debug(stage: string, ...args: unknown[]): void {
  if (DEBUG) {
    console.error(`[mcp-animation-inspector:${stage}]`, ...args);
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/utils/
git commit -m "feat: add cookie dismissal, selector utility, and debug logger"
```

---

## Task 6: Detector Interface & Registry

**Files:**
- Create: `src/detectors/types.ts`, `src/detectors/index.ts`
- Test: `tests/unit/detectors/registry.test.ts`

- [ ] **Step 1: Write failing test for detector registry**

Create `tests/unit/detectors/registry.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getDetectors, getDetectorByName } from '../../../src/detectors/index.js';

describe('Detector Registry', () => {
  it('returns all built-in detectors', () => {
    const detectors = getDetectors();
    expect(detectors.length).toBe(8);
    const names = detectors.map((d) => d.name);
    expect(names).toContain('css');
    expect(names).toContain('gsap');
    expect(names).toContain('framer-motion');
    expect(names).toContain('lottie');
    expect(names).toContain('webgl');
    expect(names).toContain('scroll-library');
    expect(names).toContain('cursor');
    expect(names).toContain('page-transition');
  });

  it('filters detectors by name', () => {
    const detectors = getDetectors(['css', 'gsap']);
    expect(detectors).toHaveLength(2);
  });

  it('retrieves single detector by name', () => {
    const detector = getDetectorByName('css');
    expect(detector).toBeDefined();
    expect(detector!.name).toBe('css');
  });

  it('returns undefined for unknown detector', () => {
    expect(getDetectorByName('nonexistent')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test — should fail**

```bash
npm test -- tests/unit/detectors/registry.test.ts
```

- [ ] **Step 3: Create src/detectors/types.ts**

```typescript
import type { Page } from 'playwright';
import type { AnimationInfo } from '../types/index.js';

export interface AnimationDetector {
  name: string;
  detect(page: Page): Promise<boolean>;
  extract(page: Page): Promise<AnimationInfo[]>;
}
```

- [ ] **Step 4: Create all 8 detector files (skeleton implementations)**

Each detector follows the same pattern. Create these files with skeleton implementations that detect correctly but return basic extraction data. Full extraction logic is built in Tasks 7-8.

`src/detectors/css.ts`:

```typescript
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
```

`src/detectors/gsap.ts`:

```typescript
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
      const win = window as Record<string, unknown>;
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
```

`src/detectors/framer-motion.ts`:

```typescript
import type { Page } from 'playwright';
import type { AnimationDetector } from './types.js';
import type { AnimationInfo } from '../types/index.js';

export const framerMotionDetector: AnimationDetector = {
  name: 'framer-motion',

  async detect(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      return (
        !!document.querySelector('[data-framer-component-type]') ||
        !!document.querySelector('[data-motion]') ||
        '__framer_importFromPackage' in window
      );
    });
  },

  async extract(page: Page): Promise<AnimationInfo[]> {
    return page.evaluate(() => {
      const results: AnimationInfo[] = [];
      const elements = document.querySelectorAll(
        '[data-framer-component-type], [data-motion], [style*="transform"]'
      );

      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        const id = el.id ? `#${el.id}` : '';
        const cls = el.classList?.length
          ? `.${Array.from(el.classList).slice(0, 2).join('.')}`
          : '';
        const selector = `${el.tagName.toLowerCase()}${id}${cls}`;
        const isMotion = el.hasAttribute('data-motion');

        results.push({
          triggers: isMotion ? ['load', 'viewport'] : ['load'],
          selector,
          properties: ['transform', 'opacity'],
          triggerDetails: isMotion
            ? ['framer-motion component', 'viewport-enter']
            : ['framer component'],
          confidence: el.hasAttribute('data-framer-component-type') ? 0.9 : 0.6,
        });
      }

      return results;
    });
  },
};
```

`src/detectors/lottie.ts`:

```typescript
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
      const results: AnimationInfo[] = [];
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

      return results;
    });
  },
};
```

`src/detectors/webgl.ts`:

```typescript
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
```

`src/detectors/scroll-library.ts`:

```typescript
import type { Page } from 'playwright';
import type { AnimationDetector } from './types.js';
import type { AnimationInfo } from '../types/index.js';

export const scrollLibraryDetector: AnimationDetector = {
  name: 'scroll-library',

  async detect(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      return (
        '__lenis' in window ||
        'lenis' in window ||
        !!document.querySelector('[data-lenis-prevent]') ||
        !!document.querySelector('[data-scroll-container]') ||
        !!document.querySelector('[data-scroll]')
      );
    });
  },

  async extract(page: Page): Promise<AnimationInfo[]> {
    return page.evaluate(() => {
      const results: AnimationInfo[] = [];
      const win = window as Record<string, unknown>;

      if ('__lenis' in win || 'lenis' in win) {
        results.push({
          triggers: ['scroll'],
          selector: 'html',
          properties: ['smooth-scroll'],
          triggerDetails: ['Lenis smooth scroll active'],
          confidence: 0.9,
        });
      }

      const scrollElements = document.querySelectorAll('[data-scroll]');
      for (const el of scrollElements) {
        const id = el.id ? `#${el.id}` : '';
        const cls = el.classList?.length
          ? `.${Array.from(el.classList).slice(0, 2).join('.')}`
          : '';
        const selector = `${el.tagName.toLowerCase()}${id}${cls}`;
        const speed = el.getAttribute('data-scroll-speed');

        results.push({
          triggers: ['scroll', 'viewport'],
          selector,
          properties: ['transform'],
          triggerDetails: [
            'Locomotive/data-scroll element',
            speed ? `speed: ${speed}` : 'viewport-enter',
          ],
          confidence: 0.85,
        });
      }

      return results;
    });
  },
};
```

`src/detectors/cursor.ts`:

```typescript
import type { Page } from 'playwright';
import type { AnimationDetector } from './types.js';
import type { AnimationInfo } from '../types/index.js';

export const cursorDetector: AnimationDetector = {
  name: 'cursor',

  async detect(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      const bodyStyle = window.getComputedStyle(document.body);
      if (bodyStyle.cursor === 'none') return true;

      const htmlStyle = window.getComputedStyle(document.documentElement);
      if (htmlStyle.cursor === 'none') return true;

      // Check for custom cursor elements
      const cursorEls = document.querySelectorAll(
        '[class*="cursor" i], [id*="cursor" i]'
      );
      for (const el of cursorEls) {
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'absolute') {
          return true;
        }
      }

      return false;
    });
  },

  async extract(page: Page): Promise<AnimationInfo[]> {
    return page.evaluate(() => {
      const results: AnimationInfo[] = [];
      const cursorEls = document.querySelectorAll(
        '[class*="cursor" i], [id*="cursor" i]'
      );

      for (const el of cursorEls) {
        const style = window.getComputedStyle(el);
        if (style.position !== 'fixed' && style.position !== 'absolute') continue;

        const id = el.id ? `#${el.id}` : '';
        const cls = el.classList?.length
          ? `.${Array.from(el.classList).slice(0, 2).join('.')}`
          : '';
        const selector = `${el.tagName.toLowerCase()}${id}${cls}`;

        results.push({
          triggers: ['hover'],
          selector,
          properties: ['transform', 'opacity', 'scale'],
          triggerDetails: ['custom cursor element follows mouse'],
          confidence: 0.75,
        });
      }

      return results;
    });
  },
};
```

`src/detectors/page-transition.ts`:

```typescript
import type { Page } from 'playwright';
import type { AnimationDetector } from './types.js';
import type { AnimationInfo } from '../types/index.js';

export const pageTransitionDetector: AnimationDetector = {
  name: 'page-transition',

  async detect(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      return (
        'startViewTransition' in document ||
        'barba' in window ||
        'swup' in window ||
        !!document.querySelector('[data-barba]') ||
        !!document.querySelector('[data-swup]')
      );
    });
  },

  async extract(page: Page): Promise<AnimationInfo[]> {
    return page.evaluate(() => {
      const results: AnimationInfo[] = [];

      if ('startViewTransition' in document) {
        results.push({
          triggers: ['click'],
          selector: 'document',
          properties: ['view-transition'],
          triggerDetails: ['View Transitions API detected'],
          confidence: 0.9,
        });
      }

      if ('barba' in window || document.querySelector('[data-barba]')) {
        results.push({
          triggers: ['click'],
          selector: '[data-barba="container"]',
          properties: ['opacity', 'transform'],
          triggerDetails: ['Barba.js page transition'],
          confidence: 0.9,
        });
      }

      if ('swup' in window || document.querySelector('[data-swup]')) {
        results.push({
          triggers: ['click'],
          selector: '[data-swup]',
          properties: ['opacity', 'transform'],
          triggerDetails: ['Swup page transition'],
          confidence: 0.9,
        });
      }

      return results;
    });
  },
};
```

- [ ] **Step 5: Create src/detectors/index.ts**

```typescript
import type { AnimationDetector } from './types.js';
import { cssDetector } from './css.js';
import { gsapDetector } from './gsap.js';
import { framerMotionDetector } from './framer-motion.js';
import { lottieDetector } from './lottie.js';
import { webglDetector } from './webgl.js';
import { scrollLibraryDetector } from './scroll-library.js';
import { cursorDetector } from './cursor.js';
import { pageTransitionDetector } from './page-transition.js';

const ALL_DETECTORS: AnimationDetector[] = [
  cssDetector,
  gsapDetector,
  framerMotionDetector,
  lottieDetector,
  webglDetector,
  scrollLibraryDetector,
  cursorDetector,
  pageTransitionDetector,
];

export function getDetectors(filter?: string[]): AnimationDetector[] {
  if (!filter) return [...ALL_DETECTORS];
  return ALL_DETECTORS.filter((d) => filter.includes(d.name));
}

export function getDetectorByName(name: string): AnimationDetector | undefined {
  return ALL_DETECTORS.find((d) => d.name === name);
}

export { type AnimationDetector } from './types.js';
```

- [ ] **Step 6: Run registry tests**

```bash
npm test -- tests/unit/detectors/registry.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/detectors/
git commit -m "feat: add 8 animation detectors with registry"
```

---

## Task 7: Navigate Pipeline Stage

**Files:**
- Create: `src/pipeline/navigate.ts`
- Test: `tests/unit/pipeline/navigate.test.ts`
- Test fixture: `tests/fixtures/static-page.html`

- [ ] **Step 1: Create test fixture**

Create `tests/fixtures/static-page.html`:

```html
<!DOCTYPE html>
<html>
<head><title>Test Page</title></head>
<body>
  <h1>Static Test Page</h1>
  <p>No animations here.</p>
  <script>window.__testReady = true;</script>
</body>
</html>
```

- [ ] **Step 2: Write failing test**

Create `tests/unit/pipeline/navigate.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import { BrowserManager } from '../../../src/browser.js';
import { parseConfig } from '../../../src/config.js';
import { navigateTo } from '../../../src/pipeline/navigate.js';

describe('navigate', () => {
  let manager: BrowserManager;

  afterEach(async () => {
    if (manager) await manager.shutdown();
  });

  it('loads a page and returns metadata', async () => {
    manager = new BrowserManager(parseConfig({}));
    const page = await manager.acquirePage();
    const fixture = `file://${path.resolve('tests/fixtures/static-page.html')}`;

    const result = await navigateTo(page, fixture, parseConfig({}));

    expect(result.title).toBe('Test Page');
    expect(result.techStack).toBeInstanceOf(Array);

    await manager.releasePage(page);
  });
});
```

- [ ] **Step 3: Run test — should fail**

```bash
npm test -- tests/unit/pipeline/navigate.test.ts
```

- [ ] **Step 4: Implement src/pipeline/navigate.ts**

```typescript
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
```

- [ ] **Step 5: Run test**

```bash
npm test -- tests/unit/pipeline/navigate.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pipeline/navigate.ts tests/unit/pipeline/navigate.test.ts tests/fixtures/static-page.html
git commit -m "feat: add navigate pipeline stage with tech stack detection"
```

---

## Task 8: Discover Pipeline Stage

**Files:**
- Create: `src/pipeline/discover.ts`
- Test: `tests/unit/pipeline/discover.test.ts`
- Test fixture: `tests/fixtures/css-animations.html`

- [ ] **Step 1: Create CSS test fixture**

Create `tests/fixtures/css-animations.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>CSS Animation Test</title>
  <style>
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .animated-box {
      width: 200px;
      height: 200px;
      background: blue;
      animation: fadeIn 1s ease-in-out;
    }
    .hover-box {
      width: 200px;
      height: 200px;
      background: red;
      transition: transform 0.5s ease;
    }
    .hover-box:hover {
      transform: scale(1.1);
    }
    .short-transition {
      transition: color 0.05s;
    }
  </style>
</head>
<body>
  <div class="animated-box">Fade In</div>
  <div class="hover-box">Hover Me</div>
  <div class="short-transition">Short (should be filtered)</div>
</body>
</html>
```

- [ ] **Step 2: Write failing test**

Create `tests/unit/pipeline/discover.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import { BrowserManager } from '../../../src/browser.js';
import { parseConfig } from '../../../src/config.js';
import { discoverAnimations } from '../../../src/pipeline/discover.js';

describe('discover', () => {
  let manager: BrowserManager;

  afterEach(async () => {
    if (manager) await manager.shutdown();
  });

  it('discovers CSS animations on a page', async () => {
    manager = new BrowserManager(parseConfig({}));
    const page = await manager.acquirePage();
    const fixture = `file://${path.resolve('tests/fixtures/css-animations.html')}`;
    await page.goto(fixture, { waitUntil: 'networkidle' });

    const inventory = await discoverAnimations(page, parseConfig({}));

    // Should find the animated-box and hover-box, but NOT short-transition
    expect(inventory.length).toBeGreaterThanOrEqual(1);
    const selectors = inventory.map((a) => a.selector);
    expect(selectors.some((s) => s.includes('animated-box'))).toBe(true);

    await manager.releasePage(page);
  });

  it('returns empty array for static pages', async () => {
    manager = new BrowserManager(parseConfig({}));
    const page = await manager.acquirePage();
    const fixture = `file://${path.resolve('tests/fixtures/static-page.html')}`;
    await page.goto(fixture, { waitUntil: 'networkidle' });

    const inventory = await discoverAnimations(page, parseConfig({}));
    expect(inventory).toEqual([]);

    await manager.releasePage(page);
  });
});
```

- [ ] **Step 3: Run test — should fail**

```bash
npm test -- tests/unit/pipeline/discover.test.ts
```

- [ ] **Step 4: Implement src/pipeline/discover.ts**

```typescript
import type { Page } from 'playwright';
import type { Config } from '../config.js';
import type { AnimationInventory } from '../types/index.js';
import { getDetectors } from '../detectors/index.js';
import type { InspectionError } from '../types/index.js';

const DETECTOR_TIMEOUT_MS = 5_000;

export interface DiscoverResult {
  inventory: AnimationInventory[];
  detectorsRun: string[];
  errors: InspectionError[];
}

export async function discoverAnimations(
  page: Page,
  config: Config,
): Promise<AnimationInventory[]> {
  const result = await discoverWithMeta(page, config);
  return result.inventory;
}

export async function discoverWithMeta(
  page: Page,
  config: Config,
): Promise<DiscoverResult> {
  const filter =
    config.enabledDetectors === 'all' ? undefined : config.enabledDetectors;
  const detectors = getDetectors(filter);

  const inventory: AnimationInventory[] = [];
  const detectorsRun: string[] = [];
  const errors: InspectionError[] = [];

  for (const detector of detectors) {
    detectorsRun.push(detector.name);

    try {
      const detected = await Promise.race([
        detector.detect(page),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error('Detector timeout')), DETECTOR_TIMEOUT_MS)
        ),
      ]);

      if (!detected) continue;

      const animations = await Promise.race([
        detector.extract(page),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Extract timeout')), DETECTOR_TIMEOUT_MS)
        ),
      ]);

      for (const anim of animations) {
        inventory.push({
          detector: detector.name,
          ...anim,
        });
      }
    } catch (err) {
      errors.push({
        stage: 'discover',
        detector: detector.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { inventory, detectorsRun, errors };
}
```

- [ ] **Step 5: Run test**

```bash
npm test -- tests/unit/pipeline/discover.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pipeline/discover.ts tests/unit/pipeline/discover.test.ts tests/fixtures/css-animations.html
git commit -m "feat: add discover pipeline stage with detector orchestration"
```

---

## Task 9: Capture Pipeline Stage

**Files:**
- Create: `src/pipeline/capture.ts`
- Test: `tests/unit/pipeline/capture.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/pipeline/capture.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import { BrowserManager } from '../../../src/browser.js';
import { parseConfig } from '../../../src/config.js';
import { captureFrames } from '../../../src/pipeline/capture.js';
import type { AnimationInventory } from '../../../src/types/index.js';

describe('capture', () => {
  let manager: BrowserManager;

  afterEach(async () => {
    if (manager) await manager.shutdown();
  });

  it('captures scroll position screenshots', async () => {
    manager = new BrowserManager(parseConfig({}));
    const page = await manager.acquirePage();
    const fixture = `file://${path.resolve('tests/fixtures/css-animations.html')}`;
    await page.goto(fixture, { waitUntil: 'networkidle' });

    const result = await captureFrames(page, [], parseConfig({}));

    // Should have scroll screenshots
    expect(result.scrollFrames.length).toBeGreaterThan(0);
    expect(result.scrollFrames[0]!.image).toBeTruthy();
    expect(result.scrollFrames[0]!.label).toContain('scroll');

    await manager.releasePage(page);
  });

  it('captures element hover states', async () => {
    manager = new BrowserManager(parseConfig({}));
    const page = await manager.acquirePage();
    const fixture = `file://${path.resolve('tests/fixtures/css-animations.html')}`;
    await page.goto(fixture, { waitUntil: 'networkidle' });

    const inventory: AnimationInventory[] = [
      {
        detector: 'css',
        triggers: ['hover'],
        selector: '.hover-box',
        properties: ['transform'],
        triggerDetails: ['transition: transform'],
        confidence: 0.8,
      },
    ];

    const result = await captureFrames(page, inventory, parseConfig({}));

    expect(result.animationFrames.length).toBeGreaterThan(0);
    expect(result.animationFrames[0]!.frames.length).toBeGreaterThan(0);

    await manager.releasePage(page);
  });
});
```

- [ ] **Step 2: Run test — should fail**

```bash
npm test -- tests/unit/pipeline/capture.test.ts
```

- [ ] **Step 3: Implement src/pipeline/capture.ts**

```typescript
import type { Page } from 'playwright';
import type { Config } from '../config.js';
import type { AnimationInventory, Frame, FrameSet } from '../types/index.js';

interface CaptureResult {
  scrollFrames: Frame[];
  animationFrames: FrameSet[];
}

export async function captureFrames(
  page: Page,
  inventory: AnimationInventory[],
  config: Config,
): Promise<CaptureResult> {
  const viewport = page.viewportSize() ?? config.viewport;
  const scrollFrames = await captureScrollPositions(page, config, viewport);
  const animationFrames = await captureAnimationStates(page, inventory, config, viewport);

  // 2MB payload guard — reduce quality or drop frames if too large
  const allFrames = [...scrollFrames, ...animationFrames.flatMap((fs) => fs.frames)];
  const totalBytes = allFrames.reduce((sum, f) => sum + f.image.length, 0);
  const MAX_PAYLOAD = 2 * 1024 * 1024; // 2MB in base64 chars (~1.5MB actual)

  if (totalBytes > MAX_PAYLOAD) {
    // Drop lowest-confidence animation frames first
    const sortedSets = [...animationFrames].sort(
      (a, b) => a.animation.confidence - b.animation.confidence,
    );
    while (
      sortedSets.length > 0 &&
      [...scrollFrames, ...sortedSets.flatMap((fs) => fs.frames)]
        .reduce((s, f) => s + f.image.length, 0) > MAX_PAYLOAD
    ) {
      sortedSets.shift(); // drop lowest confidence
    }
    return { scrollFrames, animationFrames: sortedSets };
  }

  return { scrollFrames, animationFrames };
}

async function captureScrollPositions(
  page: Page,
  config: Config,
  viewport: { width: number; height: number },
): Promise<Frame[]> {
  const frames: Frame[] = [];

  for (const pct of config.scrollPositions) {
    const scrollY = await page.evaluate((percent) => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const target = (maxScroll * percent) / 100;
      window.scrollTo({ top: target, behavior: 'instant' as ScrollBehavior });
      return target;
    }, pct);

    await page.waitForTimeout(150);

    const buffer = await page.screenshot({
      type: config.imageFormat === 'png' ? 'png' : 'jpeg',
      quality: config.imageFormat === 'jpeg' ? config.imageQuality : undefined,
    });

    frames.push({
      image: buffer.toString('base64'),
      label: `scroll-${pct}%`,
      viewport,
    });
  }

  return frames;
}

async function captureAnimationStates(
  page: Page,
  inventory: AnimationInventory[],
  config: Config,
  viewport: { width: number; height: number },
): Promise<FrameSet[]> {
  const frameSets: FrameSet[] = [];
  let totalFrames = 0;

  // Sort by confidence descending — high-confidence animations get frames first
  const sorted = [...inventory].sort((a, b) => b.confidence - a.confidence);

  for (const anim of sorted) {
    if (totalFrames >= config.maxTotalFrames) break;

    const frames: Frame[] = [];

    // Hover states
    if (config.captureHoverStates && anim.triggers.includes('hover')) {
      const hoverFrames = await captureHoverState(page, anim, config, viewport);
      frames.push(...hoverFrames);
    }

    // Element crop at current state
    if (config.elementCrop && frames.length === 0) {
      const cropFrame = await captureElementCrop(page, anim, config, viewport);
      if (cropFrame) frames.push(cropFrame);
    }

    const allowed = config.maxFramesPerAnimation - frames.length;
    const trimmed = frames.slice(0, Math.min(frames.length, config.maxFramesPerAnimation));

    if (trimmed.length > 0) {
      frameSets.push({ animation: anim, frames: trimmed });
      totalFrames += trimmed.length;
    }
  }

  return frameSets;
}

async function captureHoverState(
  page: Page,
  anim: AnimationInventory,
  config: Config,
  viewport: { width: number; height: number },
): Promise<Frame[]> {
  const frames: Frame[] = [];

  try {
    const locator = page.locator(anim.selector).first();
    if (!(await locator.isVisible({ timeout: 1000 }))) return frames;

    // Before hover
    const beforeBuffer = config.elementCrop
      ? await locator.screenshot({
          type: config.imageFormat === 'png' ? 'png' : 'jpeg',
          quality: config.imageFormat === 'jpeg' ? config.imageQuality : undefined,
        })
      : await page.screenshot({
          type: config.imageFormat === 'png' ? 'png' : 'jpeg',
          quality: config.imageFormat === 'jpeg' ? config.imageQuality : undefined,
        });

    frames.push({
      image: beforeBuffer.toString('base64'),
      label: `${anim.selector}-hover-before`,
      viewport,
    });

    // Hover
    await locator.hover();
    await page.waitForTimeout(400);

    const afterBuffer = config.elementCrop
      ? await locator.screenshot({
          type: config.imageFormat === 'png' ? 'png' : 'jpeg',
          quality: config.imageFormat === 'jpeg' ? config.imageQuality : undefined,
        })
      : await page.screenshot({
          type: config.imageFormat === 'png' ? 'png' : 'jpeg',
          quality: config.imageFormat === 'jpeg' ? config.imageQuality : undefined,
        });

    frames.push({
      image: afterBuffer.toString('base64'),
      label: `${anim.selector}-hover-after`,
      viewport,
    });

    // Reset mouse
    await page.mouse.move(0, 0);
  } catch {
    // Element not interactable — skip
  }

  return frames;
}

async function captureElementCrop(
  page: Page,
  anim: AnimationInventory,
  config: Config,
  viewport: { width: number; height: number },
): Promise<Frame | null> {
  try {
    const locator = page.locator(anim.selector).first();
    if (!(await locator.isVisible({ timeout: 1000 }))) return null;

    const buffer = await locator.screenshot({
      type: config.imageFormat === 'png' ? 'png' : 'jpeg',
      quality: config.imageFormat === 'jpeg' ? config.imageQuality : undefined,
    });

    return {
      image: buffer.toString('base64'),
      label: `${anim.selector}-current`,
      viewport,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test**

```bash
npm test -- tests/unit/pipeline/capture.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/capture.ts tests/unit/pipeline/capture.test.ts
git commit -m "feat: add capture pipeline stage with scroll, hover, and element crops"
```

---

## Task 10: Extract Pipeline Stage

**Files:**
- Create: `src/pipeline/extract.ts`
- Test: `tests/unit/pipeline/extract.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/pipeline/extract.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import { BrowserManager } from '../../../src/browser.js';
import { parseConfig } from '../../../src/config.js';
import { extractAnimationCode } from '../../../src/pipeline/extract.js';
import type { AnimationInventory } from '../../../src/types/index.js';

describe('extract', () => {
  let manager: BrowserManager;

  afterEach(async () => {
    if (manager) await manager.shutdown();
  });

  it('extracts CSS animation code', async () => {
    manager = new BrowserManager(parseConfig({}));
    const page = await manager.acquirePage();
    const fixture = `file://${path.resolve('tests/fixtures/css-animations.html')}`;
    await page.goto(fixture, { waitUntil: 'networkidle' });

    const inventory: AnimationInventory[] = [
      {
        detector: 'css',
        triggers: ['load'],
        selector: '.animated-box',
        properties: ['fadeIn'],
        triggerDetails: ['animation: fadeIn'],
        confidence: 0.8,
      },
    ];

    const result = await extractAnimationCode(page, inventory);

    expect(result.length).toBe(1);
    expect(result[0]!.css).toBeDefined();
    expect(result[0]!.timing.duration).toBeGreaterThan(0);

    await manager.releasePage(page);
  });
});
```

- [ ] **Step 2: Run test — should fail**

```bash
npm test -- tests/unit/pipeline/extract.test.ts
```

- [ ] **Step 3: Implement src/pipeline/extract.ts**

```typescript
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
    const win = window as Record<string, unknown>;
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
```

- [ ] **Step 4: Run test**

```bash
npm test -- tests/unit/pipeline/extract.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/extract.ts tests/unit/pipeline/extract.test.ts
git commit -m "feat: add extract pipeline stage for CSS and GSAP code extraction"
```

---

## Task 11: Describe & Report Pipeline Stages

**Files:**
- Create: `src/pipeline/describe.ts`, `src/pipeline/report.ts`
- Test: `tests/unit/pipeline/report.test.ts`

- [ ] **Step 1: Implement src/pipeline/describe.ts**

```typescript
import type { Config } from '../config.js';
import type { FrameSet, AnimationCode } from '../types/index.js';

export async function describeAnimations(
  frames: FrameSet[],
  code: AnimationCode[],
  config: Config,
): Promise<string[] | undefined> {
  if (!config.autoDescribe || !config.anthropicApiKey) {
    return undefined;
  }

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: config.anthropicApiKey });

    const imageContent = frames
      .flatMap((fs) => fs.frames)
      .slice(0, 5)
      .map((f) => ({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: 'image/jpeg' as const,
          data: f.image,
        },
      }));

    const codeContext = code
      .map((c) => {
        const parts: string[] = [`Element: ${c.animation.selector}`];
        if (c.css?.keyframes) parts.push(`Keyframes: ${c.css.keyframes}`);
        if (c.css?.transitions) parts.push(`Transition: ${c.css.transitions}`);
        if (c.js?.rawSnippet) parts.push(`JS: ${c.js.rawSnippet}`);
        if (c.timing.duration) parts.push(`Duration: ${c.timing.duration}ms`);
        if (c.timing.easing) parts.push(`Easing: ${c.timing.easing}`);
        return parts.join('\n');
      })
      .join('\n\n');

    const message = await client.messages.create({
      model: config.descriptionModel,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContent,
            {
              type: 'text',
              text: `Describe the animations visible in these website screenshots. Here is the extracted animation code for context:\n\n${codeContext}\n\nFor each animation, describe: what element animates, what the animation does visually, the trigger (scroll, hover, page load), timing/easing, and the overall effect. Be specific and technical.`,
            },
          ],
        },
      ],
    });

    const text = message.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    return text ? [text] : undefined;
  } catch {
    return undefined;
  }
}
```

- [ ] **Step 2: Implement src/pipeline/report.ts**

```typescript
import type {
  AnimationInventory,
  FrameSet,
  AnimationCode,
  InspectionReport,
  InspectionError,
  Frame,
} from '../types/index.js';

interface ReportInput {
  url: string;
  techStack: string[];
  inventory: AnimationInventory[];
  scrollFrames: Frame[];
  animationFrames: FrameSet[];
  code: AnimationCode[];
  descriptions?: string[];
  detectorsRun: string[];
  errors: InspectionError[];
  startTime: number;
}

export function buildReport(input: ReportInput): InspectionReport {
  return {
    schemaVersion: '1.0.0',
    url: input.url,
    timestamp: new Date().toISOString(),
    techStack: input.techStack,
    inventory: input.inventory,
    frames: [
      // Scroll frames as a special "page-scroll" FrameSet
      ...(input.scrollFrames.length > 0
        ? [
            {
              animation: {
                detector: 'page',
                triggers: ['scroll'],
                selector: 'document',
                properties: ['scroll-position'],
                triggerDetails: input.scrollFrames.map((f) => f.label),
                confidence: 1,
              },
              frames: input.scrollFrames,
            },
          ]
        : []),
      ...input.animationFrames,
    ],
    code: input.code,
    descriptions: input.descriptions,
    meta: {
      inspectionDuration: Date.now() - input.startTime,
      detectorsRun: input.detectorsRun,
      errors: input.errors,
    },
  };
}
```

- [ ] **Step 3: Write test for report builder**

Create `tests/unit/pipeline/report.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildReport } from '../../../src/pipeline/report.js';

describe('buildReport', () => {
  it('builds a valid InspectionReport', () => {
    const report = buildReport({
      url: 'https://example.com',
      techStack: ['GSAP 3.12'],
      inventory: [],
      scrollFrames: [],
      animationFrames: [],
      code: [],
      descriptions: undefined,
      detectorsRun: ['css', 'gsap'],
      errors: [],
      startTime: Date.now() - 5000,
    });

    expect(report.schemaVersion).toBe('1.0.0');
    expect(report.url).toBe('https://example.com');
    expect(report.techStack).toEqual(['GSAP 3.12']);
    expect(report.meta.detectorsRun).toEqual(['css', 'gsap']);
    expect(report.meta.inspectionDuration).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/unit/pipeline/report.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/describe.ts src/pipeline/report.ts tests/unit/pipeline/report.test.ts
git commit -m "feat: add describe (optional Claude Vision) and report pipeline stages"
```

---

## Task 12: MCP Server & Tool Registration

**Files:**
- Create: `src/server.ts`, all files in `src/tools/`
- Modify: `src/index.ts`

- [ ] **Step 1: Create src/tools/inspect-animation.ts**

```typescript
import type { Config } from '../config.js';
import type { BrowserManager } from '../browser.js';
import { navigateTo } from '../pipeline/navigate.js';
import { discoverWithMeta } from '../pipeline/discover.js';
import { captureFrames } from '../pipeline/capture.js';
import { extractAnimationCode } from '../pipeline/extract.js';
import { describeAnimations } from '../pipeline/describe.js';
import { buildReport } from '../pipeline/report.js';
import type { InspectionReport } from '../types/index.js';

export async function inspectAnimation(
  url: string,
  browserManager: BrowserManager,
  config: Config,
): Promise<InspectionReport> {
  const startTime = Date.now();

  // Wall-clock timeout — spec requires hard abort at config.timeout
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), config.timeout);

  const page = await browserManager.acquirePage();

  try {
    const pipeline = async (): Promise<InspectionReport> => {
      const { title, techStack } = await navigateTo(page, url, config);
      if (abort.signal.aborted) throw new Error('Pipeline timeout exceeded');

      const { inventory, detectorsRun, errors } = await discoverWithMeta(page, config);
      if (abort.signal.aborted) throw new Error('Pipeline timeout exceeded');

      const { scrollFrames, animationFrames } = await captureFrames(page, inventory, config);
      if (abort.signal.aborted) throw new Error('Pipeline timeout exceeded');

      const code = await extractAnimationCode(page, inventory);
      const descriptions = await describeAnimations(animationFrames, code, config);

      return buildReport({
        url,
        techStack,
        inventory,
        scrollFrames,
        animationFrames,
        code,
        descriptions,
        detectorsRun,
        errors,
        startTime,
      });
    };

    const timeoutPromise = new Promise<never>((_, reject) => {
      abort.signal.addEventListener('abort', () =>
        reject(new Error(`Pipeline timeout: exceeded ${config.timeout}ms`))
      );
    });

    return await Promise.race([pipeline(), timeoutPromise]);
  } finally {
    clearTimeout(timer);
    await browserManager.releasePage(page);
  }
}
```

- [ ] **Step 2: Create src/tools/discover-animations.ts**

```typescript
import type { Config } from '../config.js';
import type { BrowserManager } from '../browser.js';
import { navigateTo } from '../pipeline/navigate.js';
import { discoverWithMeta } from '../pipeline/discover.js';
import type { AnimationInventory } from '../types/index.js';

export async function discoverAnimationsTool(
  url: string,
  browserManager: BrowserManager,
  config: Config,
): Promise<{ inventory: AnimationInventory[]; techStack: string[] }> {
  const page = await browserManager.acquirePage();

  try {
    const { techStack } = await navigateTo(page, url, config);
    const { inventory } = await discoverWithMeta(page, config);
    return { inventory, techStack };
  } finally {
    await browserManager.releasePage(page);
  }
}
```

- [ ] **Step 3: Create src/tools/capture-frames.ts**

```typescript
import type { Config } from '../config.js';
import type { BrowserManager } from '../browser.js';
import type { AnimationInventory, FrameSet, Frame } from '../types/index.js';
import { navigateTo } from '../pipeline/navigate.js';
import { discoverAnimations } from '../pipeline/discover.js';
import { captureFrames } from '../pipeline/capture.js';

export async function captureFramesTool(
  url: string,
  browserManager: BrowserManager,
  config: Config,
  inventory?: AnimationInventory[],
): Promise<{ scrollFrames: Frame[]; animationFrames: FrameSet[] }> {
  const page = await browserManager.acquirePage();

  try {
    await navigateTo(page, url, config);
    const inv = inventory ?? (await discoverAnimations(page, config));
    return captureFrames(page, inv, config);
  } finally {
    await browserManager.releasePage(page);
  }
}
```

- [ ] **Step 4: Create src/tools/extract-animation-code.ts**

```typescript
import type { Config } from '../config.js';
import type { BrowserManager } from '../browser.js';
import type { AnimationInventory, AnimationCode } from '../types/index.js';
import { navigateTo } from '../pipeline/navigate.js';
import { discoverAnimations } from '../pipeline/discover.js';
import { extractAnimationCode } from '../pipeline/extract.js';

export async function extractAnimationCodeTool(
  url: string,
  browserManager: BrowserManager,
  config: Config,
  inventory?: AnimationInventory[],
): Promise<AnimationCode[]> {
  const page = await browserManager.acquirePage();

  try {
    await navigateTo(page, url, config);
    const inv = inventory ?? (await discoverAnimations(page, config));
    return extractAnimationCode(page, inv);
  } finally {
    await browserManager.releasePage(page);
  }
}
```

- [ ] **Step 5: Create src/tools/describe-animations.ts**

```typescript
import type { Config } from '../config.js';
import type { BrowserManager } from '../browser.js';
import type { FrameSet, AnimationCode } from '../types/index.js';
import { inspectAnimation } from './inspect-animation.js';
import { describeAnimations } from '../pipeline/describe.js';

export async function describeAnimationsTool(
  input: { url: string } | { frames: FrameSet[]; code: AnimationCode[] },
  browserManager: BrowserManager,
  config: Config,
): Promise<string[]> {
  if (!config.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY is required for describe_animations');
  }

  const describeConfig = { ...config, autoDescribe: true };

  if ('url' in input) {
    const report = await inspectAnimation(input.url, browserManager, describeConfig);
    return report.descriptions ?? ['No descriptions generated.'];
  }

  const result = await describeAnimations(input.frames, input.code, describeConfig);
  return result ?? ['No descriptions generated.'];
}
```

- [ ] **Step 6: Create src/tools/get-page-structure.ts**

```typescript
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

    return page.evaluate(() => {
      const title = document.title;

      const sections = Array.from(
        document.querySelectorAll('header, main, section, footer, article, aside, nav'),
      ).map((el) => {
        const id = el.id ? `#${el.id}` : '';
        const cls = el.classList.length
          ? `.${Array.from(el.classList).slice(0, 2).join('.')}`
          : '';
        return {
          selector: `${el.tagName.toLowerCase()}${id}${cls}`,
          tag: el.tagName.toLowerCase(),
          text: el.querySelector('h1, h2, h3')?.textContent?.trim()?.slice(0, 80),
          children: el.children.length,
        };
      });

      const interactiveElements = Array.from(
        document.querySelectorAll('a[href], button, input, select, textarea, [role="button"]'),
      )
        .slice(0, 50)
        .map((el) => {
          const id = el.id ? `#${el.id}` : '';
          return {
            selector: `${el.tagName.toLowerCase()}${id}`,
            type: el.tagName.toLowerCase(),
            text: el.textContent?.trim()?.slice(0, 50),
          };
        });

      const landmarks = Array.from(
        document.querySelectorAll('[role]'),
      ).map((el) => ({
        role: el.getAttribute('role') ?? '',
        selector: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`,
        label: el.getAttribute('aria-label') ?? undefined,
      }));

      return { title, sections, interactiveElements, landmarks };
    });
  } finally {
    await browserManager.releasePage(page);
  }
}
```

- [ ] **Step 7: Create src/server.ts**

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Config } from './config.js';
import { BrowserManager } from './browser.js';
import { inspectAnimation } from './tools/inspect-animation.js';
import { discoverAnimationsTool } from './tools/discover-animations.js';
import { captureFramesTool } from './tools/capture-frames.js';
import { extractAnimationCodeTool } from './tools/extract-animation-code.js';
import { describeAnimationsTool } from './tools/describe-animations.js';
import { getPageStructureTool } from './tools/get-page-structure.js';
import type { Frame, FrameSet } from './types/index.js';

function framesToContent(frames: Frame[]) {
  return frames.flatMap((f) => [
    { type: 'text' as const, text: `[${f.label}]` },
    { type: 'image' as const, data: f.image, mimeType: 'image/jpeg' as const },
  ]);
}

export function createServer(config: Config): {
  server: McpServer;
  browserManager: BrowserManager;
} {
  const server = new McpServer(
    { name: 'mcp-animation-inspector', version: '0.1.0' },
    { capabilities: { logging: {} } },
  );

  const browserManager = new BrowserManager(config);

  // Tool: inspect_animation
  server.tool(
    'inspect_animation',
    { description: 'Full animation inspection pipeline — discovers, captures frames, extracts code, and optionally describes all animations on a page', inputSchema: { url: z.string().url().describe('URL of the page to inspect') } },
    async ({ url }) => {
      const report = await inspectAnimation(url, browserManager, config);
      const allFrames = report.frames.flatMap((fs) => fs.frames);
      return {
        content: [
          { type: 'text', text: JSON.stringify({ ...report, frames: report.frames.map((fs) => ({ ...fs, frames: fs.frames.map((f) => ({ ...f, image: '[base64]' })) })) }, null, 2) },
          ...framesToContent(allFrames),
        ],
      };
    },
  );

  // Tool: discover_animations
  server.tool(
    'discover_animations',
    { description: 'Detect all animations on a page — returns inventory of animated elements with triggers, properties, and confidence scores', inputSchema: { url: z.string().url().describe('URL of the page to scan') } },
    async ({ url }) => {
      const result = await discoverAnimationsTool(url, browserManager, config);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // Tool: capture_frames
  server.tool(
    'capture_frames',
    {
      description: 'Capture screenshots at scroll positions and animation states. Pass inventory from discover_animations to skip re-detection.',
      inputSchema: {
        url: z.string().url().describe('URL of the page to capture'),
        inventory: z.array(z.object({
          detector: z.string(),
          triggers: z.array(z.string()),
          selector: z.string(),
          properties: z.array(z.string()),
          triggerDetails: z.array(z.string()),
          confidence: z.number(),
        })).optional().describe('Optional — pass inventory from discover_animations to skip re-detection'),
        scroll_positions: z.array(z.number().min(0).max(100)).optional().describe('Override default scroll positions (percentages)'),
      },
    },
    async ({ url, inventory, scroll_positions }) => {
      const captureConfig = scroll_positions ? { ...config, scrollPositions: scroll_positions } : config;
      const result = await captureFramesTool(url, browserManager, captureConfig, inventory);
      const allFrames = [...result.scrollFrames, ...result.animationFrames.flatMap((fs) => fs.frames)];
      return {
        content: framesToContent(allFrames),
      };
    },
  );

  // Tool: extract_animation_code
  server.tool(
    'extract_animation_code',
    {
      description: 'Extract CSS rules, JS animation configs, and timing data. Pass inventory from discover_animations to skip re-detection.',
      inputSchema: {
        url: z.string().url().describe('URL of the page to extract from'),
        inventory: z.array(z.object({
          detector: z.string(),
          triggers: z.array(z.string()),
          selector: z.string(),
          properties: z.array(z.string()),
          triggerDetails: z.array(z.string()),
          confidence: z.number(),
        })).optional().describe('Optional — pass inventory from discover_animations'),
        filter: z.array(z.string()).optional().describe('Filter by detector names, e.g. ["css", "gsap"]'),
      },
    },
    async ({ url, inventory, filter }) => {
      const result = await extractAnimationCodeTool(url, browserManager, config, inventory);
      const filtered = filter ? result.filter((c) => filter.includes(c.animation.detector)) : result;
      return {
        content: [{ type: 'text', text: JSON.stringify(filtered, null, 2) }],
      };
    },
  );

  // Tool: describe_animations
  server.tool(
    'describe_animations',
    {
      description: 'Generate natural language descriptions of animations (requires ANTHROPIC_API_KEY)',
      inputSchema: {
        url: z.string().url().describe('URL of the page to describe'),
      },
    },
    async ({ url }) => {
      if (!config.anthropicApiKey) {
        return {
          content: [{ type: 'text', text: 'Error: ANTHROPIC_API_KEY is required for describe_animations. Set it via environment variable or config.' }],
          isError: true,
        };
      }
      const descriptions = await describeAnimationsTool({ url }, browserManager, config);
      return {
        content: [{ type: 'text', text: descriptions.join('\n\n') }],
      };
    },
  );

  // Tool: get_page_structure
  server.tool(
    'get_page_structure',
    { description: 'Get semantic DOM structure, interactive elements, and landmarks of a page', inputSchema: { url: z.string().url().describe('URL of the page to analyze') } },
    async ({ url }) => {
      const structure = await getPageStructureTool(url, browserManager, config);
      return {
        content: [{ type: 'text', text: JSON.stringify(structure, null, 2) }],
      };
    },
  );

  return { server, browserManager };
}
```

- [ ] **Step 8: Update src/index.ts**

```typescript
#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { parseConfig } from './config.js';
import { createServer } from './server.js';

async function main() {
  const config = parseConfig({});
  const { server, browserManager } = createServer(config);

  // Graceful shutdown
  const shutdown = async () => {
    await browserManager.shutdown();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  if (config.transport === 'http') {
    // HTTP transport — Task 13
    console.error(`HTTP transport not yet implemented. Use stdio.`);
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('mcp-animation-inspector: running on stdio');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
```

- [ ] **Step 9: Build and verify**

```bash
npm run build
npm run lint
```

Expected: Build succeeds, no type errors.

- [ ] **Step 10: Commit**

```bash
git add src/server.ts src/tools/ src/index.ts
git commit -m "feat: add MCP server with 6 tools and full pipeline integration"
```

---

## Task 13: HTTP Transport

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add express dependency**

```bash
npm install express
npm install -D @types/express
```

- [ ] **Step 2: Update src/index.ts with HTTP transport**

Add HTTP transport branch to the existing `main()` function:

```typescript
if (config.transport === 'http') {
  const { default: express } = await import('express');
  const { StreamableHTTPServerTransport } = await import(
    '@modelcontextprotocol/sdk/server/streamableHttp.js'
  );
  const { randomUUID } = await import('node:crypto');

  const app = express();
  app.use(express.json());

  const sessions = new Map<string, StreamableHTTPServerTransport>();

  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (sessionId && sessions.has(sessionId)) {
      const transport = sessions.get(sessionId)!;
      await transport.handleRequest(req, res, req.body);
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    const sessionServer = createServer(config);
    await sessionServer.server.connect(transport);

    transport.on('close', () => {
      sessions.delete(transport.sessionId!);
    });
    sessions.set(transport.sessionId!, transport);

    await transport.handleRequest(req, res, req.body);
  });

  app.listen(config.httpPort, () => {
    console.error(`mcp-animation-inspector: HTTP server on port ${config.httpPort}`);
  });
  return;
}
```

- [ ] **Step 3: Build and verify**

```bash
npm run build
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add src/index.ts package.json package-lock.json
git commit -m "feat: add StreamableHTTP transport option"
```

---

## Task 14: Integration Test

**Files:**
- Create: `tests/fixtures/gsap-page.html`, `tests/integration/full-pipeline.test.ts`

- [ ] **Step 1: Create GSAP test fixture**

Create `tests/fixtures/gsap-page.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>GSAP Test Page</title>
  <style>
    .box { width: 100px; height: 100px; background: blue; margin: 50px; }
    .scroll-section { height: 200vh; padding: 100px; }
    .hover-card { width: 200px; height: 150px; background: green; transition: transform 0.3s ease; }
    .hover-card:hover { transform: scale(1.05); }
  </style>
</head>
<body>
  <div class="box" id="hero-box">Animated Box</div>
  <div class="hover-card">Hover me</div>
  <div class="scroll-section">
    <div class="box" id="scroll-box">Scroll Box</div>
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
  <script>
    gsap.registerPlugin(ScrollTrigger);
    gsap.from("#hero-box", { opacity: 0, y: 50, duration: 1 });
    gsap.from("#scroll-box", {
      opacity: 0, x: -100, duration: 0.8,
      scrollTrigger: { trigger: "#scroll-box", start: "top 80%" }
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Write integration test**

Create `tests/integration/full-pipeline.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import { parseConfig } from '../../src/config.js';
import { BrowserManager } from '../../src/browser.js';
import { inspectAnimation } from '../../src/tools/inspect-animation.js';

describe('Full Pipeline Integration', () => {
  let browserManager: BrowserManager;

  afterEach(async () => {
    if (browserManager) await browserManager.shutdown();
  });

  it('inspects a page with CSS animations', async () => {
    const config = parseConfig({});
    browserManager = new BrowserManager(config);
    const fixture = `file://${path.resolve('tests/fixtures/css-animations.html')}`;

    const report = await inspectAnimation(fixture, browserManager, config);

    expect(report.schemaVersion).toBe('1.0.0');
    expect(report.url).toBe(fixture);
    expect(report.inventory.length).toBeGreaterThan(0);
    expect(report.frames.length).toBeGreaterThan(0);
    expect(report.meta.errors).toEqual([]);
  });

  it('returns empty inventory for static pages', async () => {
    const config = parseConfig({});
    browserManager = new BrowserManager(config);
    const fixture = `file://${path.resolve('tests/fixtures/static-page.html')}`;

    const report = await inspectAnimation(fixture, browserManager, config);

    expect(report.inventory).toEqual([]);
    // Should still have scroll frames
    expect(report.frames.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/
git commit -m "test: add integration tests with CSS and GSAP fixtures"
```

---

## Task 15: README & npm Publish Prep

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README.md**

Comprehensive README with:
- Project description and badges
- Quick start (npx, Claude Code integration)
- Available tools table (all 6)
- Configuration reference
- Built-in detectors table
- Architecture diagram (text-based)
- Example output
- Contributing guide (how to add detectors)
- License

- [ ] **Step 2: Test npx execution locally**

```bash
cd /home/ak96/Documents/Project/mcp-animation-inspector
npm run build
node dist/index.js
```

Verify it starts without errors (will wait for stdio input).

- [ ] **Step 3: Test with MCP Inspector**

```bash
npm run inspector
```

Verify all 6 tools appear in the inspector.

- [ ] **Step 4: Final commit**

```bash
git add README.md
git commit -m "docs: add comprehensive README with usage, config, and contributing guide"
```

---

## Execution Order & Dependencies

```
Task 1 (Scaffolding)
  ↓
Task 2 (Types)          ← no deps beyond Task 1
  ↓
Task 3 (Config)         ← needs Types for reference
  ↓
Task 4 (Browser)        ← needs Config
  ↓
Task 5 (Cookies)        ← standalone util
  ↓
Task 6 (Detectors)      ← needs Types
  ↓
Task 7 (Navigate)       ← needs Browser, Config, Cookies
  ↓
Task 8 (Discover)       ← needs Detectors, Config
  ↓
Task 9 (Capture)        ← needs Types, Config
  ↓
Task 10 (Extract)       ← needs Types
  ↓
Task 11 (Describe+Report) ← needs Types, Config
  ↓
Task 12 (MCP Server)    ← needs ALL pipeline + tools
  ↓
Task 13 (HTTP)          ← needs Server
  ↓
Task 14 (Integration)   ← needs everything
  ↓
Task 15 (README)        ← final
```

**Parallel waves for subagent execution:**
- Wave 1: Task 1
- Wave 2: Tasks 2, 5 (Types + Cookies — independent)
- Wave 3: Tasks 3, 6 (Config + Detectors — both depend on Types)
- Wave 4: Tasks 4, 7, 8, 9, 10 (Browser, Navigate, Discover, Capture, Extract — mostly independent pipeline stages, but Browser needed first)
  - Sub-wave 4a: Task 4 (Browser)
  - Sub-wave 4b: Tasks 7, 8, 9, 10 (pipeline stages — all need Browser)
- Wave 5: Task 11 (Describe + Report)
- Wave 6: Task 12 (MCP Server)
- Wave 7: Tasks 13, 14 (HTTP + Integration — can parallel)
- Wave 8: Task 15 (README)
