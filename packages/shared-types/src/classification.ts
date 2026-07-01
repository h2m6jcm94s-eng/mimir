import { z } from 'zod';

export const ClassificationTier = z.union([z.literal(0), z.literal(1), z.literal(2)]);
export type ClassificationTier = z.infer<typeof ClassificationTier>;

export const ClassificationConfidence = z.object({
  score: z.number().min(0).max(1),
  threshold: z.number().min(0).max(1),
});
export type ClassificationConfidence = z.infer<typeof ClassificationConfidence>;

export const ClassificationRequest = z.object({
  prompt: z.string(),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        contentType: z.string(),
        size: z.number(),
      })
    )
    .default([]),
  retrievedContext: z.array(z.string()).default([]),
});
export type ClassificationRequest = z.infer<typeof ClassificationRequest>;

export const ClassificationResult = z.object({
  tier: ClassificationTier,
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  fallback: z.boolean().default(false),
  policyVersion: z.string().default('1.0'),
  assignedTier: ClassificationTier.optional(),
  matchedRule: z.string().optional(),
  signals: z.array(z.string()).optional(),
  conformanceFlags: z.array(z.string()).optional(),
});
export type ClassificationResult = z.infer<typeof ClassificationResult>;

export const DEFAULT_CLASSIFICATION_THRESHOLD = 0.85;
