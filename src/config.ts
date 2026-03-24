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

/** Map of env-var names → config keys with coercion functions. */
const ENV_MAP: Record<string, { key: keyof Config; coerce: (v: string) => unknown }> = {
  timeout:                  { key: 'timeout',                coerce: Number },
  headless:                 { key: 'headless',               coerce: v => v !== 'false' },
  imageFormat:              { key: 'imageFormat',             coerce: v => v },
  imageQuality:             { key: 'imageQuality',            coerce: Number },
  maxFramesPerAnimation:    { key: 'maxFramesPerAnimation',   coerce: Number },
  maxTotalFrames:           { key: 'maxTotalFrames',          coerce: Number },
  transport:                { key: 'transport',               coerce: v => v },
  httpPort:                 { key: 'httpPort',                coerce: Number },
  autoDescribe:             { key: 'autoDescribe',            coerce: v => v === 'true' },
  descriptionModel:         { key: 'descriptionModel',        coerce: v => v },
  ANTHROPIC_API_KEY:        { key: 'anthropicApiKey',          coerce: v => v },
};

export function parseConfig(overrides: Record<string, unknown>): Config {
  const fromEnv: Record<string, unknown> = {};
  for (const [envKey, { key, coerce }] of Object.entries(ENV_MAP)) {
    const val = process.env[envKey];
    if (val !== undefined) fromEnv[key] = coerce(val);
  }

  return ConfigSchema.parse({ ...fromEnv, ...overrides });
}
