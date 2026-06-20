import { z } from 'zod';

export const SetPinRequest = z.object({
  pin: z.string().min(4).max(32),
  currentPin: z.string().min(4).max(32).optional(),
});
export type SetPinRequest = z.infer<typeof SetPinRequest>;
