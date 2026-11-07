import { z } from 'zod';
import { CURRENCIES } from '@/lib/money';
import { PERIODS } from '@/lib/demo/insights';
export const scopeSchema = z.object({ environment: z.enum(['test','live']) });
export const threadSchema = scopeSchema.extend({ title: z.string().trim().min(1).max(120), currency: z.enum(CURRENCIES), period: z.enum(PERIODS) });
export const threadIdSchema = z.object({ threadId: z.string().uuid(), environment: z.enum(['test','live']) });
export const uiMessageSchema = z.object({ id: z.string().min(1).max(150), role: z.enum(['user','assistant']), parts: z.array(z.record(z.string(), z.unknown())).max(150), metadata: z.unknown().optional() });
export const chatBodySchema = threadIdSchema.extend({
  messages: z.array(uiMessageSchema).max(200),
  contextPath: z.string().max(300).optional(),
  // Prototype: the client supplies the thread scope because there is no
  // account or server-side thread store yet. The real backend must load and
  // verify this from its own database instead of trusting the request.
  thread: z.object({
    title: z.string().max(120),
    environment: z.enum(['test', 'live']),
    currency: z.enum(CURRENCIES),
    period: z.enum(PERIODS),
  }),
});
export const toolQuerySchema = z.object({ module: z.string(), currency: z.string(), period: z.string(), from: z.string().nullable(), to: z.string().nullable(), status: z.string().nullable(), reference: z.string().nullable() }).strict();
export type ToolResult = { kind: 'report' | 'records' | 'action_preview' | 'unavailable'; title: string; source: string; currency: string; from: string; to: string; sample: boolean; metrics: { label: string; value: number | null; unit: string; definition: string }[]; rows: { id: string; name: string; amount: number; status: string; route: string }[]; series: { key: string; value: number; previous: number }[]; limitations: string[]; action?: { type: string; target: string; amount: number; expiresAt: string; route: string } };
