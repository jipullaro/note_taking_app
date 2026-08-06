import { NextResponse } from "next/server";
import { getRefreshToken, refreshAccessToken, setAuthCookies, clearAuthCookies } from "@/lib/auth";

export async function POST() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    return NextResponse.json({ error: "No session to refresh." }, { status: 401 });
  }

  const tokens = await refreshAccessToken(refreshToken);
  if (!tokens) {
    await clearAuthCookies();
    return NextResponse.json({ error: "Session expired." }, { status: 401 });
  }

  await setAuthCookies(tokens);
  return NextResponse.json({ ok: true });
}
