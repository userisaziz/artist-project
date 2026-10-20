/** Cursor-paginated list (backend `{items, next_cursor}`). */
export interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

export interface NamedRef {
  id: number;
  name: string;
}

/** Every failed API call becomes an ApiError — screens switch on `.code`, never on raw status. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  /** The underlying error (e.g. the fetch TypeError), kept for debugging; screens never read it. */
  readonly cause?: unknown;
  constructor(code: string, message: string, status: number, options?: { cause?: unknown }) {
    super(message);
    this.code = code;
    this.status = status;
    if (options && 'cause' in options) this.cause = options.cause;
  }
}
