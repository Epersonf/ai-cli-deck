import { ProfileTemplateSchema, parseJsonc } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import { BUILTIN_TEMPLATES } from '../infrastructure/providers/builtinTemplates.js';
import { exportTemplate } from './templateExport.js';

describe('exportTemplate', () => {
  it('writes every built-in template as commented JSON that reads back identical', () => {
    for (const template of BUILTIN_TEMPLATES) {
      const text = exportTemplate(template);
      expect(text).toContain('// The engine that runs the chat');
      expect(ProfileTemplateSchema.parse(parseJsonc(text))).toEqual(template);
    }
  });
});
