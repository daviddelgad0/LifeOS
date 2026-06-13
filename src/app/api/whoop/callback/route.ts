import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// Public values — must match the authorize request in settings exactly.
const CLIENT_ID = "55b30dd5-3520-404b-82e8-be484d13e46a";
const REDIRECT_URI = "https://life-os-jade-phi.vercel.app/api/whoop/callback";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const base = new URL("/settings", req.url);

  if (!code) {
    const err = req.nextUrl.searchParams.get("error") ?? "no_code";
    base.searchParams.set("whoop", "error");
    base.searchParams.set("reason", err);
    return NextResponse.redirect(base);
  }

  const res = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: process.env.WHOOP_CLIENT_SECRET ?? "",
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    base.searchParams.set("whoop", "error");
    base.searchParams.set("reason", detail.slice(0, 120) || `token_${res.status}`);
    return NextResponse.redirect(base);
  }

  const { access_token, refresh_token, expires_in } = await res.json();
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";

  jar.set("whoop_access", access_token, {
    httpOnly: true,
    secure,
    maxAge: expires_in ?? 3600,
    path: "/",
    sameSite: "lax",
  });
  jar.set("whoop_refresh", refresh_token, {
    httpOnly: true,
    secure,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
  });

  base.searchParams.set("whoop", "connected");
  return NextResponse.redirect(base);
}
