import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Public OAuth client id — hardcoded so a missing env var can't break the
// connect flow. Only GOOGLE_CLIENT_SECRET must live in the environment.
export const GOOGLE_CLIENT_ID =
  "69828376765-9hb2hn88uvnqs762btbtkkp5u5ihfuuv.apps.googleusercontent.com";
const REDIRECT_URI =
  "https://life-os-jade-phi.vercel.app/api/google-calendar/callback";
const SCOPE = "https://www.googleapis.com/auth/calendar";

// Returns the Google OAuth URL as JSON. The client navigates to it directly
// (a server-side redirect to an external domain bounces inside an iOS PWA).
export async function GET() {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
  });
  return NextResponse.json({
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
  });
}
