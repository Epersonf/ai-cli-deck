import { z } from 'zod';
import { AgentKindSchema } from './agent.js';

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
 * How to run one kind of agent as a clean profile. Pure data (JSON): the deck starts the `agent` engine
 * with `env`, nothing else. Built-in templates (Claude Code, Codex, DeepSeek...) use this same format,
 * so anyone can add another endpoint by importing a file.
 */
export const ProfileTemplateSchema = z.object({
  schema: z.literal(1),
  id: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'the id is lowercase letters, digits and dashes')
    .max(40),
  label: z.string().trim().min(1).max(60),
  description: z.string().max(300).default(''),
  /** The engine that runs the chat: Claude Code's SDK, Codex CLI, Antigravity CLI or Grok Build. */
  agent: AgentKindSchema,
  /** Model the chat starts with (the person can change it in the chat). */
  model: z.string().max(100).nullable().default(null),
  env: z
    .record(z.string().regex(ENV_NAME, 'an environment variable name'), z.string().max(500))
    .default({}),
  /** The environment variable this CLI reads its config folder from; set to the profile's own folder. */
  home: z
    .object({ env: z.string().regex(ENV_NAME) })
    .nullable()
    .default(null),
  fields: z.array(TemplateFieldSchema).max(10).default([]),
  /**
   * An API key typed in the profile dialog (hidden) and kept in the profile's own folder; it reaches the
   * agent as `env`. For `claude` with `env` ANTHROPIC_API_KEY, a Claude Code token (`sk-ant-oat...`) is
   * passed as CLAUDE_CODE_OAUTH_TOKEN instead.
   */
  apiKey: z
    .object({
      env: z.string().regex(ENV_NAME),
      label: z.string().min(1).max(100),
      /** False: the profile works without one (the CLI's own sign-in in the home folder, if any). */
      required: z.boolean().default(true),
    })
    .nullable()
    .default(null),
  /** Built-in CLI that `clideck setup` can download for this template (so the profile shows "install"). */
  install: z.enum(['claude', 'codex', 'antigravity', 'grok']).nullable().default(null),
});
export type ProfileTemplate = z.infer<typeof ProfileTemplateSchema>;

/** A template as the UI sees it. */
export const TemplateInfoSchema = ProfileTemplateSchema.extend({
  builtin: z.boolean(),
  plugin: z.object({ version: z.string(), hasTests: z.boolean().default(false) }).optional(),
});
export type TemplateInfo = z.infer<typeof TemplateInfoSchema>;

export const ImportTemplateBodySchema = z.object({ text: z.string().min(2).max(100_000) });
