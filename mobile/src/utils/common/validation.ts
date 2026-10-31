import type { ZodType } from 'zod';

/**
 * The first thing the operator still has to fix, in the order the schema asks for it.
 *
 * Forms that gate a header button (rather than a submit event) need a synchronous hint, so they read the
 * schema here instead of going through React Hook Form's asynchronous error state. One schema, two ways to
 * consume it — never a second set of imperative checks beside it.
 */
export function firstIssue(schema: ZodType, values: unknown): string | null {
  const result = schema.safeParse(values);
  if (result.success) return null;
  return result.error.issues[0]?.message ?? null;
}
