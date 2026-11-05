import { z } from 'zod';

/** A saved message sent to a session with one tap. `enter` also presses Enter after it. */
export const QuickPromptSchema = z.object({
  label: z.string().trim().min(1).max(32),
  text: z.string().min(1).max(8000),
  enter: z.boolean(),
});
export type QuickPrompt = z.infer<typeof QuickPromptSchema>;

export const QuickPromptsSchema = z.object({ prompts: z.array(QuickPromptSchema).max(50) });
export type QuickPrompts = z.infer<typeof QuickPromptsSchema>;

/** Until the user saves their own list. */
export const DEFAULT_PROMPTS: readonly QuickPrompt[] = [
  { label: 'continue', text: 'continue', enter: true },
  { label: 'run tests', text: 'Run the tests and fix what fails.', enter: true },
  { label: 'explain', text: 'Explain the error above and how to fix it.', enter: true },
  { label: 'commit + push', text: 'Commit the changes and push.', enter: true },
];
