import { z } from 'zod';

const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** One value asked when a profile is made from a template (an API base URL, a program...). */
export const TemplateFieldSchema = z.object({
  /** Used as `{field.<key>}` in the template. */
  key: z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/, 'a field key is letters and digits'),
  label: z.string().trim().min(1).max(60),
  type: z.enum(['text', 'url']).default('text'),
  required: z.boolean().default(false),
  hint: z.string().max(200).default(''),
  placeholder: z.string().max(100).default(''),
});
export type TemplateField = z.infer<typeof TemplateFieldSchema>;

/**
 * How to start one kind of AI CLI as a clean profile. Pure data (JSON): the deck runs `command`
 * with `args` and `env`, nothing else. Built-in templates (Claude Code, Codex, DeepSeek...) use this
 * same format, so anyone can add another CLI by importing a file.
 */
export const ProfileTemplateSchema = z.object({
  schema: z.literal(1),
  id: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'the id is lowercase letters, digits and dashes')
    .max(40),
  label: z.string().trim().min(1).max(60),
  description: z.string().max(300).default(''),
  /** Program to run. Empty means the default shell. */
  command: z.string().max(200).default(''),
  args: z.array(z.string().max(500)).max(50).default([]),
  env: z
    .record(z.string().regex(ENV_NAME, 'an environment variable name'), z.string().max(500))
    .default({}),
  /** The environment variable this CLI reads its config folder from; set to the profile's own folder. */
  home: z
    .object({ env: z.string().regex(ENV_NAME) })
    .nullable()
    .default(null),
  fields: z.array(TemplateFieldSchema).max(10).default([]),
  /** Ask for an API key (hidden) on first start, via `clideck ensure-key`. */
  apiKey: z
    .object({
      env: z.string().regex(ENV_NAME),
      label: z.string().min(1).max(100),
      /** Remember it in `<home>/settings.json` (Claude Code's own config); otherwise it is asked every start. */
      remember: z.boolean().default(false),
    })
    .nullable()
    .default(null),
  /** Arguments that give the CLI the deck's MCP server and briefing (see the placeholders). */
  mcpArgs: z.array(z.string().max(500)).max(20).default([]),
  /** Built-in CLI that `clideck setup` can download for this template (so the profile shows "install"). */
  install: z.enum(['claude', 'codex']).nullable().default(null),
});
export type ProfileTemplate = z.infer<typeof ProfileTemplateSchema>;

/** A template as the UI sees it. */
export const TemplateInfoSchema = ProfileTemplateSchema.extend({ builtin: z.boolean() });
export type TemplateInfo = z.infer<typeof TemplateInfoSchema>;

export const ImportTemplateBodySchema = z.object({ text: z.string().min(2).max(100_000) });
