import { NextRequest, NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8000";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const registerRes = await fetch(`${BACKEND_URL}/api/auth/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!registerRes.ok) {
    const detail = await registerRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: firstErrorMessage(detail) ?? "Could not create your account." },
      { status: registerRes.status }
    );
  }

  // Auto-login right after registration so "Sign Up" drops the user straight
  // into the dashboard, matching the "Yay, New Friend!" screen's intent.
  const tokenRes = await fetch(`${BACKEND_URL}/api/auth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!tokenRes.ok) {
    // Account was created but auto-login failed for some reason; the user
    // can still log in manually.
    return NextResponse.json({ ok: true, autoLogin: false });
  }

  const data = await tokenRes.json();
  await setAuthCookies({ access: data.access, refresh: data.refresh });

  return NextResponse.json({ ok: true, autoLogin: true });
}

// Django's serializers already return safe, curated, user-facing messages
// (see accounts/serializers.py — RegisterSerializer's email field in
// particular is worded to avoid confirming whether an email is already
// registered), so it's fine to surface them as-is here.
function firstErrorMessage(detail: Record<string, unknown>): string | undefined {
  const firstValue = Object.values(detail)[0];
  if (Array.isArray(firstValue)) return String(firstValue[0]);
  if (typeof firstValue === "string") return firstValue;
  return undefined;
}
