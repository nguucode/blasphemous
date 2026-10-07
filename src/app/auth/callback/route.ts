import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";
import { adoptAnonymousDemos } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

// Google comes back here with a one-time code (PKCE), exchanged for a session cookie.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await adoptAnonymousDemos(supabase, data.user.id);
      return NextResponse.redirect(`${origin}${safeNext(searchParams.get("next"))}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=callback`);
}
