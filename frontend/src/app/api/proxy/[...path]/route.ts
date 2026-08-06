import { NextRequest, NextResponse } from "next/server";
import {
  getAccessToken,
  getRefreshToken,
  refreshAccessToken,
  setAuthCookies,
  clearAuthCookies,
} from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8000";

type RouteParams = { params: Promise<{ path: string[] }> };

async function forward(request: NextRequest, accessToken: string, path: string) {
  const search = request.nextUrl.search;
  const body =
    request.method === "GET" || request.method === "DELETE"
      ? undefined
      : await request.text();

  return fetch(`${BACKEND_URL}/api/${path}${search}`, {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body,
    cache: "no-store",
  });
}

async function handle(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  const joinedPath = path.join("/") + "/"; // DRF routers expect a trailing slash

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let backendRes = await forward(request, accessToken, joinedPath);

  if (backendRes.status === 401) {
    const refreshToken = await getRefreshToken();
    const tokens = refreshToken ? await refreshAccessToken(refreshToken) : null;

    if (!tokens) {
      await clearAuthCookies();
      return NextResponse.json({ error: "Session expired." }, { status: 401 });
    }

    await setAuthCookies(tokens);
    backendRes = await forward(request, tokens.access, joinedPath);
  }

  const responseBody = backendRes.status === 204 ? null : await backendRes.text();
  return new NextResponse(responseBody, {
    status: backendRes.status,
    headers: { "Content-Type": backendRes.headers.get("Content-Type") ?? "application/json" },
  });
}

export {
  handle as GET,
  handle as POST,
  handle as PATCH,
  handle as PUT,
  handle as DELETE,
};
