import { z } from 'zod';
import { AgentFeaturesSchema } from './agent.js';
import { ProfileTemplateSchema } from './template.js';

export const PluginAuthMethodSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/)
    .max(80),
  label: z.string().min(1).max(100),
  translations: z
    .record(
      z.string(),
      z.object({
        label: z.string().max(100),
        description: z.string().max(500).optional(),
        help: z.string().max(2000).optional(),
      }),
    )
    .optional(),
  description: z.string().max(500).default(''),
  flow: z.enum(['code', 'device', 'key', 'machine']).default('code'),
  help: z.string().max(2000).default(''),
  url: z.string().url().optional(),
});
export type PluginAuthMethod = z.infer<typeof PluginAuthMethodSchema>;

/** Metadata can be inspected without executing the plugin's modules. */
export const ProviderPluginManifestSchema = z.object({
  plugin: z.literal(1),
  order: z.number().int().min(0).default(999),
  machine: z.boolean().default(false),
  tests: z.array(z.string().max(200)).default([]),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  entry: z
    .string()
    .regex(/^[a-zA-Z0-9_./-]+$/)
    .refine(
      (value) =>
        !value.split('/').includes('..') && (value.endsWith('.mjs') || value.endsWith('.ts')),
    ),
  template: ProfileTemplateSchema,
  features: AgentFeaturesSchema.default({
    modes: ['default'],
    efforts: [],
    compaction: 'none',
    autoCompactThreshold: false,
    cacheIdleRiskMs: null,
  }),
  authMethods: z.array(PluginAuthMethodSchema).max(10).default([]),
});
export type ProviderPluginManifest = z.infer<typeof ProviderPluginManifestSchema>;
export const PluginPackageBodySchema = z.object({ data: z.string().min(1).max(12_000_000) });
