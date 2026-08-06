import { NextRequest, NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8000";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const res = await fetch(`${BACKEND_URL}/api/auth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    // Django's EmailTokenObtainPairSerializer (accounts/serializers.py)
    // already returns a deliberately generic message here, so it's safe
    // to surface as-is rather than duplicating copy in the frontend too.
    const detail = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: detail.detail ?? "Invalid email or password." },
      { status: res.status }
    );
  }

  const data = await res.json();
  await setAuthCookies({ access: data.access, refresh: data.refresh });

  return NextResponse.json({ ok: true });
}
