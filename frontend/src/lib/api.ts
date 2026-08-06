const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * Server-side fetch: called from Server Components with an explicit access
 * token (from lib/auth's requireAuth()), talking to Django directly — no
 * extra hop through the Next.js proxy.
 */
export async function serverApiFetch<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BACKEND_URL}/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  return parseResponse<T>(res);
}

/**
 * Client-side fetch: called from Client Components, hits our same-origin
 * /api/proxy route, which attaches the token from the httpOnly cookie and
 * transparently retries once after a refresh on 401.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/proxy${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  return parseResponse<T>(res);
}
