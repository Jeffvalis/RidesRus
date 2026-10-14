import type { ApiErrorBody, ErrorCode } from './contracts';

/** Thrown for any non-2xx response; `code` is stable and safe to branch on. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK' | 'INTERNAL' | string,
    message: string,
    readonly issues?: ApiErrorBody['issues'],
  ) {
    super(message);
  }

  get isNetwork() {
    return this.code === 'NETWORK';
  }
}

export type ApiClientOptions = {
  baseUrl: string;
  getToken?: () => string | null | undefined;
  /** Called on 401 so the app can sign the user out. */
  onUnauthorized?: () => void;
  timeoutMs?: number;
};

/** Minimal fetch wrapper shared by every RidesRus client. */
export class ApiClient {
  constructor(private readonly opts: ApiClientOptions) {}

  get baseUrl() {
    return this.opts.baseUrl;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = this.opts.getToken?.();
    let res: Response;
    try {
      res = await fetch(`${this.opts.baseUrl}${path}`, {
        method,
        headers: {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.opts.timeoutMs ?? 15_000),
      });
    } catch {
      throw new ApiError(0, 'NETWORK', "Can't reach RidesRus. Check your connection and try again.");
    }
    const text = await res.text();
    const data = text ? safeJson(text) : null;
    if (!res.ok) {
      const err = (data ?? {}) as Partial<ApiErrorBody>;
      if (res.status === 401) this.opts.onUnauthorized?.();
      throw new ApiError(res.status, err.code ?? 'INTERNAL', err.message ?? 'Something went wrong.', err.issues);
    }
    return data as T;
  }

  get<T>(path: string) {
    return this.request<T>('GET', path);
  }
  post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, body ?? {});
  }
  put<T>(path: string, body?: unknown) {
    return this.request<T>('PUT', path, body ?? {});
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Random id for idempotency keys; uses Web Crypto where available. */
export function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
