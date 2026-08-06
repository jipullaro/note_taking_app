import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8000";

const isProd = process.env.NODE_ENV === "production";

const baseCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  path: "/",
};

export interface TokenPair {
  access: string;
  refresh?: string;
}

/** Sets the JWT cookies on a Route Handler / Server Action cookie store. */
export async function setAuthCookies(tokens: TokenPair) {
  const store = await cookies();
  store.set(ACCESS_COOKIE, tokens.access, {
    ...baseCookieOptions,
    maxAge: 60 * 30, // matches SIMPLE_JWT ACCESS_TOKEN_LIFETIME default (30 min)
  });
  if (tokens.refresh) {
    store.set(REFRESH_COOKIE, tokens.refresh, {
      ...baseCookieOptions,
      maxAge: 60 * 60 * 24 * 7, // matches SIMPLE_JWT REFRESH_TOKEN_LIFETIME default (7 days)
    });
  }
}

export async function clearAuthCookies() {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function getAccessToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value;
}

/** Calls Django's token/refresh endpoint. Returns the new token pair, or null if the refresh token is invalid/expired. */
export async function refreshAccessToken(refreshToken: string): Promise<TokenPair | null> {
  const res = await fetch(`${BACKEND_URL}/api/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: refreshToken }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  // SIMPLE_JWT ROTATE_REFRESH_TOKENS=True returns a new refresh token too.
  return { access: data.access, refresh: data.refresh };
}

/** Server Component guard: redirects to /login if there's no access token cookie.
 * Note: this does not attempt a proactive refresh (Server Components can't set
 * response cookies) — an expired-but-refreshable session on first page load
 * will bounce to /login. Subsequent client-side API calls made after login
 * refresh transparently via the /api/proxy route. */
export async function requireAuth(): Promise<string> {
  const token = await getAccessToken();
  if (!token) {
    redirect("/login");
  }
  return token;
}
