import { describe, expect, it } from 'vitest';
import { ProfileTemplateSchema } from './template.js';
import { fieldProblem, fieldVars, fillText, templateProblems } from './templateFill.js';

const template = ProfileTemplateSchema.parse({
  schema: 1,
  id: 't',
  label: 'T',
  command: 'x',
  fields: [{ key: 'api', label: 'API', type: 'url', required: true }],
  env: { U: '{field.api}', H: '{field.api.host}' },
});

describe('template placeholders and fields', () => {
  it('fills known names and leaves unknown ones as written', () => {
    expect(fillText('a {x} b {y}', { x: '1' })).toBe('a 1 b {y}');
    expect(fieldVars(template, { api: 'https://llm.dev/v1' })).toEqual({
      'field.api': 'https://llm.dev/v1',
      'field.api.host': 'llm.dev',
    });
  });

  it('reports unknown placeholders only', () => {
    expect(templateProblems(template)).toEqual([]);
    const withJson = { ...template, args: ['{mcpUrl}', '{oops}', '{"json": 1}'] };
    expect(templateProblems(withJson)).toEqual(['unknown placeholder {oops}']);
  });

  it('checks the values typed for the fields', () => {
    expect(fieldProblem(template, {})).toMatch(/required/);
    expect(fieldProblem(template, { api: 'nope' })).toMatch(/http/);
    expect(fieldProblem(template, { api: 'https://x.dev', other: '1' })).toMatch(/Unknown field/);
    expect(fieldProblem(template, { api: 'https://x.dev' })).toBeNull();
  });
});
