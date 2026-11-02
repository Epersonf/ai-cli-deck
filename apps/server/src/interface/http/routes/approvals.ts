import { ApprovalDecisionSchema, ApprovalStatusSchema } from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const IdParams = z.object({ id: z.string().min(1) });
const ListQuery = z.object({ status: ApprovalStatusSchema.optional() });
const DecisionBody = z.object({ decision: ApprovalDecisionSchema });

export function approvalRoutes(app: FastifyInstance, c: Container): void {
  app.get('/api/approvals', (request) => {
    const { status } = parseWith(ListQuery, request.query);
    return c.approvals.list(status);
  });

  app.post('/api/approvals/:id/decision', (request) => {
    const { id } = parseWith(IdParams, request.params);
    const { decision } = parseWith(DecisionBody, request.body);
    return c.approvals.decide(id, decision);
  });
}
