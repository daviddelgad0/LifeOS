import { cookies } from "next/headers";

// Server-only. Returns a valid Whoop access token from the auth cookies,
// silently refreshing (and rotating) it when the short-lived access token has
// expired. Shared by every /api/whoop route. Client id is public; only the
// secret comes from the environment.
const CLIENT_ID = "55b30dd5-3520-404b-82e8-be484d13e46a";

export async function getWhoopToken(): Promise<string | null> {
  const jar = await cookies();
  const access = jar.get("whoop_access")?.value;
  if (access) return access;

  const refresh = jar.get("whoop_refresh")?.value;
  if (!refresh) return null;

  const res = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refresh,
      client_id: CLIENT_ID,
      client_secret: process.env.WHOOP_CLIENT_SECRET ?? "",
      // Required for Whoop to return a fresh refresh_token alongside the access one.
      scope: "offline",
    }),
  });
  if (!res.ok) return null;

  const { access_token, refresh_token, expires_in } = await res.json();
  const secure = process.env.NODE_ENV === "production";
  jar.set("whoop_access", access_token, {
    httpOnly: true,
    secure,
    maxAge: expires_in ?? 3600,
    path: "/",
    sameSite: "lax",
  });
  // Whoop rotates the refresh token on every refresh. Persist the new one and
  // roll its 30-day window forward, so the connection stays alive indefinitely
  // as long as the app is opened at least once a month.
  if (refresh_token) {
    jar.set("whoop_refresh", refresh_token, {
      httpOnly: true,
      secure,
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
    });
  }
  return access_token;
}
