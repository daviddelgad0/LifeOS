import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const REDIRECT_URI =
  "https://life-os-jade-phi.vercel.app/api/google-calendar/callback";
const CLIENT_ID =
  "69828376765-9hb2hn88uvnqs762btbtkkp5u5ihfuuv.apps.googleusercontent.com";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  // Land back on the School tab's sync section.
  const base = new URL("/school?tab=settings", req.url);

  if (!code) {
    const err = req.nextUrl.searchParams.get("error") ?? "no_code";
    base.searchParams.set("google", "error");
    base.searchParams.set("reason", err);
    return NextResponse.redirect(base);
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    base.searchParams.set("google", "error");
    base.searchParams.set("reason", detail.slice(0, 120) || `token_${res.status}`);
    return NextResponse.redirect(base);
  }

  const { access_token, refresh_token, expires_in } = await res.json();
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";

  jar.set("gcal_access", access_token, {
    httpOnly: true,
    secure,
    maxAge: expires_in ?? 3600,
    path: "/",
    sameSite: "lax",
  });
  // Google only returns a refresh token on the first consent (prompt=consent
  // forces it). Persist it for silent re-auth later.
  if (refresh_token) {
    jar.set("gcal_refresh", refresh_token, {
      httpOnly: true,
      secure,
      maxAge: 60 * 60 * 24 * 180,
      path: "/",
      sameSite: "lax",
    });
  }

  base.searchParams.set("google", "connected");
  return NextResponse.redirect(base);
}
