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
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
