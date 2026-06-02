/**
 * `BizError` — the runtime error class thrown by `@keel/http` when the
 * backend returns a non-zero envelope code (Requirement 5.4).
 *
 * The shape matches `BizErrorPayload` from `@keel/types`, but the class
 * itself extends `Error` so it integrates with stack traces, `instanceof`
 * checks, and React error boundaries.
 *
 * Lives in its own file (rather than next to the response interceptor) so
 * higher layers can `import { BizError } from '@keel/http'` without dragging
 * in axios.
 */

import type { BizErrorPayload } from '@keel/types';

export class BizError extends Error implements BizErrorPayload {
  readonly code: number;
  readonly traceId?: string;

  constructor(code: number, message: string, traceId?: string) {
    super(message);
    this.name = 'BizError';
    this.code = code;
    if (traceId !== undefined) {
      this.traceId = traceId;
    }
    // Preserve the prototype chain across transpilation targets so that
    // `err instanceof BizError` keeps working when this is bundled to ES5.
    Object.setPrototypeOf(this, BizError.prototype);
  }
}

/** Type guard. Cheap and safe across realms (does not rely on `instanceof`). */
export function isBizError(value: unknown): value is BizError {
  return (
    value instanceof Error &&
    (value as { name?: string }).name === 'BizError' &&
    typeof (value as { code?: unknown }).code === 'number'
  );
}
