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
