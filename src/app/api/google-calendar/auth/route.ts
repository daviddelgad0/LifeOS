import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const REDIRECT_URI =
  "https://life-os-jade-phi.vercel.app/api/google-calendar/callback";
const SCOPE = "https://www.googleapis.com/auth/calendar";

// Returns the Google OAuth URL as JSON. The client navigates to it directly
// (a server-side redirect to an external domain bounces inside an iOS PWA),
// and the client_id stays server-side instead of needing a NEXT_PUBLIC var.
export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }
  const params = new URLSearchParams({
    client_id: clientId,
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
