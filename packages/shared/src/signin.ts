import { z } from 'zod';

/**
 * How a profile (or built-in provider) gets its credentials. There is no terminal: the server runs the
 * CLI's own login with the profile's folder and the web app shows the steps.
 *  - claude-account: `claude auth login --claudeai` (Claude subscription, in the browser)
 *  - claude-console: `claude auth login --console` (Anthropic Console, API billing, in the browser)
 *  - codex-chatgpt: `codex login --device-auth` (ChatGPT account: open a link, type a code)
 *  - key: paste an API key or token (Claude: `claude setup-token` token `sk-ant-oat…` or API key; Codex/endpoints: API key)
 *  - machine: use the login this machine's CLI already has (no setup)
 */
export const SignInMethodSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/)
  .max(80);
export type SignInMethod = z.infer<typeof SignInMethodSchema>;

/** Whether a provider can answer right now, and with what. */
export const AuthInfoSchema = z.object({
  state: z.enum(['signed-in', 'signed-out', 'unknown']),
  /** Human text such as "Claude subscription", "Console API", "ChatGPT", "API key", "this machine's login". */
  via: z.string().nullable(),
  /** The account (an e-mail) when the CLI reports one. */
  account: z.string().nullable(),
});
export type AuthInfo = z.infer<typeof AuthInfoSchema>;

/** A login in progress (or just finished) for one provider; at most one per provider. */
export const SignInFlowSchema = z.object({
  method: SignInMethodSchema,
  state: z.enum(['running', 'done', 'failed', 'cancelled']),
  /** The page to open (the CLI prints it). */
  url: z.string().nullable(),
  /** A device code to type on that page (Codex), when there is one. */
  code: z.string().nullable(),
  /** The CLI waits for the code the page shows after authorizing (Claude): send it with the input route. */
  needsCode: z.boolean(),
  /** What the CLI printed, cleaned of colours and control codes (shown small, for support). */
  output: z.string(),
  error: z.string().nullable(),
});
export type SignInFlow = z.infer<typeof SignInFlowSchema>;

export const StartSignInBodySchema = z.object({ method: SignInMethodSchema });
export const SignInInputBodySchema = z.object({ text: z.string().trim().min(1).max(2000) });

/** A folder of the machine the deck runs on, for the folder picker. */
export const FsDirSchema = z.object({ name: z.string(), path: z.string() });
export const FsDirsSchema = z.object({
  /** The folder listed (absolute, normalised). */
  path: z.string(),
  /** Its parent; null at a root. */
  parent: z.string().nullable(),
  home: z.string(),
  /** Drives on Windows (`C:\`...), `/` elsewhere. */
  roots: z.array(FsDirSchema),
  /** Sub-folders only, sorted, hidden ones last. */
  dirs: z.array(FsDirSchema),
});
export type FsDirs = z.infer<typeof FsDirsSchema>;

/** Sets (or clears, with null) the model new chats of a provider/profile start with. */
export const SetDefaultModelBodySchema = z.object({
  model: z.string().trim().min(1).max(200).nullable(),
});
