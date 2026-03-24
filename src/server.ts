import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Config } from './config.js';
import { BrowserManager, ServerBusyError } from './browser.js';
import { inspectAnimation } from './tools/inspect-animation.js';
import { discoverAnimationsTool } from './tools/discover-animations.js';
import { captureFramesTool } from './tools/capture-frames.js';
import { extractAnimationCodeTool } from './tools/extract-animation-code.js';
import { describeAnimationsTool } from './tools/describe-animations.js';
import { getPageStructureTool } from './tools/get-page-structure.js';
import type { Frame } from './types/index.js';
import { AnimationInventorySchema } from './types/index.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };

function sanitizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/\/home\/[^\s]+/g, '[path]')
            .replace(/at\s+.*\(.*\)/g, '')
            .trim();
}

function formatMcpError(err: unknown) {
  const message = err instanceof ServerBusyError
    ? `${err.message} (retry after ${err.retryAfterMs}ms)`
    : sanitizeError(err);
  return {
    content: [{ type: 'text' as const, text: `Error: ${message}` }],
    isError: true,
  };
}

function framesToContent(frames: Frame[]) {
  return frames.flatMap((f) => [
    { type: 'text' as const, text: `[${f.label}]` },
    { type: 'image' as const, data: f.image, mimeType: 'image/jpeg' as const },
  ]);
}

export function createServer(config: Config, sharedBrowser?: BrowserManager): {
  server: McpServer;
  browserManager: BrowserManager;
} {
  const server = new McpServer(
    { name: 'mcp-animation-inspector', version: pkg.version },
    { capabilities: { logging: {} } },
  );

  const browserManager = sharedBrowser ?? new BrowserManager(config);

  // Tool: inspect_animation
  server.tool(
    'inspect_animation',
    'Full animation inspection pipeline — discovers, captures frames, extracts code, and optionally describes all animations on a page. Returns { schemaVersion, url, techStack, inventory, frames, code, descriptions, meta }',
    { url: z.string().url().describe('URL of the page to inspect') },
    async ({ url }) => {
      try {
        const report = await inspectAnimation(url, browserManager, config);
        const allFrames = report.frames.flatMap((fs) => fs.frames);
        const summary = `Found ${report.inventory.length} animations (${report.techStack.join(', ') || 'no libraries detected'}). Detectors: ${report.meta.detectorsRun.join(', ')}. Inspection: ${report.meta.inspectionDuration}ms.${report.meta.errors.length > 0 ? ` Errors: ${report.meta.errors.length}` : ''}`;
        return {
          content: [
            { type: 'text', text: summary },
            { type: 'text', text: JSON.stringify({ ...report, frames: report.frames.map((fs) => ({ ...fs, frames: fs.frames.map((f) => ({ ...f, image: '[base64]' })) })) }, null, 2) },
            ...framesToContent(allFrames),
          ],
        };
      } catch (err) {
        return formatMcpError(err);
      }
    },
  );

  // Tool: discover_animations
  server.tool(
    'discover_animations',
    'Detect all animations on a page — returns { inventory: AnimationInventory[], techStack: string[] }',
    { url: z.string().url().describe('URL of the page to scan') },
    async ({ url }) => {
      try {
        const result = await discoverAnimationsTool(url, browserManager, config);
        if (result.inventory.length === 0) {
          return { content: [{ type: 'text', text: `No animations detected on ${url}.` }] };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return formatMcpError(err);
      }
    },
  );

  // Tool: capture_frames
  server.tool(
    'capture_frames',
    'Capture screenshots at scroll positions and animation states. Default scroll positions: [0, 25, 50, 75, 100]%. Pass inventory from discover_animations to skip re-detection.',
    {
      url: z.string().url().describe('URL of the page to capture'),
      inventory: z.array(AnimationInventorySchema).optional().describe('Optional — pass inventory from discover_animations to skip re-detection'),
      scroll_positions: z.array(z.number().min(0).max(100)).optional().describe('Override default scroll positions (percentages)'),
    },
    async ({ url, inventory, scroll_positions }) => {
      try {
        const captureConfig = scroll_positions ? { ...config, scrollPositions: scroll_positions } : config;
        const result = await captureFramesTool(url, browserManager, captureConfig, inventory);
        const allFrames = [...result.scrollFrames, ...result.animationFrames.flatMap((fs) => fs.frames)];
        const animFrameCount = result.animationFrames.flatMap(fs => fs.frames).length;
        const uniqueAnimations = result.animationFrames.length;
        const summary = `Captured ${result.scrollFrames.length} scroll frames, ${animFrameCount} animation frames for ${uniqueAnimations} animations.`;
        return {
          content: [{ type: 'text', text: summary }, ...framesToContent(allFrames)],
        };
      } catch (err) {
        return formatMcpError(err);
      }
    },
  );

  // Tool: extract_animation_code
  server.tool(
    'extract_animation_code',
    'Extract CSS rules, JS animation configs, and timing data. Returns AnimationCode[] with css, js, and timing data. Pass inventory from discover_animations to skip re-detection.',
    {
      url: z.string().url().describe('URL of the page to extract from'),
      inventory: z.array(AnimationInventorySchema).optional().describe('Optional — pass inventory from discover_animations'),
      filter: z.array(z.string()).optional().describe('Filter by detector names, e.g. ["css", "gsap"]'),
    },
    async ({ url, inventory, filter }) => {
      try {
        const result = await extractAnimationCodeTool(url, browserManager, config, inventory);
        const filtered = filter ? result.filter((c) => filter.includes(c.animation.detector)) : result;
        return {
          content: [{ type: 'text', text: JSON.stringify(filtered, null, 2) }],
        };
      } catch (err) {
        return formatMcpError(err);
      }
    },
  );

  // Tool: describe_animations
  server.tool(
    'describe_animations',
    'Generate natural language descriptions of animations. Returns string[] of descriptions. Requires ANTHROPIC_API_KEY env var.',
    {
      url: z.string().url().describe('URL of the page to describe'),
    },
    async ({ url }) => {
      if (!config.anthropicApiKey) {
        return {
          content: [{ type: 'text', text: 'Error: ANTHROPIC_API_KEY is required for describe_animations. Set it via environment variable or config.' }],
          isError: true,
        };
      }
      try {
        const descriptions = await describeAnimationsTool({ url }, browserManager, config);
        return {
          content: [{ type: 'text', text: descriptions.join('\n\n') }],
        };
      } catch (err) {
        return formatMcpError(err);
      }
    },
  );

  // Tool: get_page_structure
  server.tool(
    'get_page_structure',
    'Get semantic DOM structure, interactive elements (max 50), and landmarks of a page. Returns { title, sections, interactiveElements, landmarks }',
    { url: z.string().url().describe('URL of the page to analyze') },
    async ({ url }) => {
      try {
        const structure = await getPageStructureTool(url, browserManager, config);
        return {
          content: [{ type: 'text', text: JSON.stringify(structure, null, 2) }],
        };
      } catch (err) {
        return formatMcpError(err);
      }
    },
  );

  return { server, browserManager };
}
