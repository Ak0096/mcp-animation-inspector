import { z } from 'zod';

export const AnimationInventorySchema = z.object({
  detector: z.string(),
  triggers: z.array(z.string()),
  selector: z.string().min(1).regex(
    /^[a-zA-Z][a-zA-Z0-9\-_#.\[\]=*~+:>, "'^$|\\()]*$/,
    'Invalid CSS selector format',
  ),
  properties: z.array(z.string()),
  triggerDetails: z.array(z.string()),
  confidence: z.number(),
});

export const AnimationInfoSchema = z.object({
  triggers: z.array(z.string()),
  selector: z.string().min(1),
  properties: z.array(z.string()),
  triggerDetails: z.array(z.string()),
  confidence: z.number(),
});
