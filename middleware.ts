import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./lib/supabase/env";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow API routes through — they handle their own auth if needed
  if (pathname.startsWith("/api")) {
    return NextResponse.next({ request });
  }

  // Block /dev/ pages outside of local development
  if (pathname.startsWith("/dev") && process.env.NODE_ENV !== "development") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const config = getSupabaseConfig();

  // Supabase not configured yet — let the app load without auth redirects
  if (!config) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh session — keeps auth tokens valid on every request
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed-in user hitting root or auth pages → send to app
  if (user && (pathname === "/" || pathname.startsWith("/auth"))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Signed-out user hitting any app page → send to login
  if (!user && !pathname.startsWith("/auth")) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Skip static assets and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
