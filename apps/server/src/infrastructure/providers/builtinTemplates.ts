import type { ProfileTemplate } from '@deck/shared';
import { bundledManifests } from '../plugins/manifests.js';

/** Compatibility view: built-in profile bases are now metadata inside complete provider packages. */
export const BUILTIN_TEMPLATES: readonly ProfileTemplate[] = bundledManifests().map(
  ({ manifest }) => manifest.template,
);
export const BUILTIN_IDS: readonly string[] = BUILTIN_TEMPLATES.map((template) => template.id);
