import { z } from 'zod';
import { AnimationInventorySchema, AnimationInfoSchema } from './schemas.js';

export type AnimationInventory = z.infer<typeof AnimationInventorySchema>;
export type AnimationInfo = z.infer<typeof AnimationInfoSchema>;
