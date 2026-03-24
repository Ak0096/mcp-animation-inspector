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
import type { Frame } from './types/index.js';

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
    'Full animation inspection pipeline — discovers, captures frames, extracts code, and optionally describes all animations on a page',
    { url: z.string().url().describe('URL of the page to inspect') },
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
    'Detect all animations on a page — returns inventory of animated elements with triggers, properties, and confidence scores',
    { url: z.string().url().describe('URL of the page to scan') },
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
    'Capture screenshots at scroll positions and animation states. Pass inventory from discover_animations to skip re-detection.',
    {
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
    'Extract CSS rules, JS animation configs, and timing data. Pass inventory from discover_animations to skip re-detection.',
    {
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
    'Generate natural language descriptions of animations (requires ANTHROPIC_API_KEY)',
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
      const descriptions = await describeAnimationsTool({ url }, browserManager, config);
      return {
        content: [{ type: 'text', text: descriptions.join('\n\n') }],
      };
    },
  );

  // Tool: get_page_structure
  server.tool(
    'get_page_structure',
    'Get semantic DOM structure, interactive elements, and landmarks of a page',
    { url: z.string().url().describe('URL of the page to analyze') },
    async ({ url }) => {
      const structure = await getPageStructureTool(url, browserManager, config);
      return {
        content: [{ type: 'text', text: JSON.stringify(structure, null, 2) }],
      };
    },
  );

  return { server, browserManager };
}
