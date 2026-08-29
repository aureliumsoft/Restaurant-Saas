import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

import { isPlatformAdmin } from "@/lib/auth/admin";
import { DASHBOARD_MODULES } from "@/constant/dashboardModules";
import {
  isCustomerOrderFlowPath,
  legacyWebAppRedirectPath,
} from "@/lib/customer-storefront-paths";
import { looksLikeCustomerGoogleOAuthState } from "@/lib/customer-auth/google-oauth-state-shape";
import {
  rewritePathnameForUrlIds,
  rewriteSearchParamsForUrlIds,
} from "@/lib/url-id-middleware";

/** Same fallback as `authOptions.secret` in `lib/auth-options.ts` (dev only). */
function resolveNextAuthJwtSecret(): string | undefined {
  const fromEnv = process.env.NEXTAUTH_SECRET?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV !== "production") return "dev-nextauth-secret";
  return undefined;
}

function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isDashboardPath(pathname: string): boolean {
  if (pathname === "/no-access") return true;
  return DASHBOARD_MODULES.some(
    (m) => pathname === m.path || pathname.startsWith(`${m.path}/`)
  );
}

/** Staff-facing terminals: require a signed-in session (JWT) at the edge. */
function isStaffTerminalPath(pathname: string): boolean {
  const roots = [
    "/kds",
    "/kds-screen",
    "/pos",
    "/order-display",
  ] as const;
  return roots.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

function getSubdomainFromHost(hostname: string) {
  // Local dev: royalspoon.localhost
  if (hostname.endsWith(".localhost")) {
    const sub = hostname.replace(".localhost", "");
    if (sub && sub !== "www") return sub;
    return null;
  }

  // Production: royalspoon.domain.com (set NEXT_PUBLIC_ROOT_DOMAIN=domain.com)
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (rootDomain && hostname.endsWith(`.${rootDomain}`)) {
    const sub = hostname.slice(0, -(`.${rootDomain}`.length));
    if (sub && sub !== "www") return sub;
  }

  return null;
}

function isSubdomainStorefrontGlobalPath(pathname: string): boolean {
  if (isCustomerOrderFlowPath(pathname)) return true;
  if (pathname === "/track-order" || pathname.startsWith("/track-order/")) {
    return true;
  }
  return false;
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  let pathname = url.pathname;
  let urlIdsDecoded = false;

  const rewrittenPath = rewritePathnameForUrlIds(pathname);
  if (rewrittenPath !== pathname) {
    url.pathname = rewrittenPath;
    pathname = rewrittenPath;
    urlIdsDecoded = true;
  }
  if (rewriteSearchParamsForUrlIds(url.searchParams)) {
    urlIdsDecoded = true;
  }

  const finish = () =>
    urlIdsDecoded ? NextResponse.rewrite(url) : NextResponse.next();

  // Kiosk / customer Google login reuses NextAuth's registered redirect URI
  // (`/api/auth/callback/google`) to avoid Google Error 400 redirect_uri_mismatch.
  if (pathname === "/api/auth/callback/google") {
    const state = url.searchParams.get("state");
    if (looksLikeCustomerGoogleOAuthState(state)) {
      url.pathname = "/api/customer-auth/google/callback";
      return NextResponse.rewrite(url);
    }
  }

  const needsAuth =
    isStaffTerminalPath(pathname) ||
    isAdminPath(pathname) ||
    isDashboardPath(pathname);

  if (needsAuth) {
    const secret = resolveNextAuthJwtSecret();
    if (!secret) {
      console.error(
        "[middleware] NEXTAUTH_SECRET is missing in production; cannot verify protected routes."
      );
      const login = new URL("/login", req.url);
      login.searchParams.set("callbackUrl", `${pathname}${url.search}`);
      return NextResponse.redirect(login);
    }
    const token = await getToken({ req, secret });
    if (!token) {
      const login = new URL("/login", req.url);
      login.searchParams.set("callbackUrl", `${pathname}${url.search}`);
      return NextResponse.redirect(login);
    }
    if (isAdminPath(pathname)) {
      const email =
        typeof token.email === "string" ? token.email : undefined;
      const role =
        typeof token.role === "string" ? token.role : undefined;
      const allowed =
        token.platformAdmin === true || isPlatformAdmin(email, role);
      if (!allowed) {
        return NextResponse.redirect(new URL("/", req.url));
      }
    }
  }

  // Legacy `/web-app/*` → route-group URLs (no `/web-app` segment).
  if (pathname === "/web-app" || pathname.startsWith("/web-app/")) {
    url.pathname = legacyWebAppRedirectPath(pathname);
    return NextResponse.redirect(url, 308);
  }

  const hostname = (req.headers.get("host") || "").split(":")[0];
  const subdomain = getSubdomainFromHost(hostname);

  if (!subdomain) {
    return finish();
  }

  // Keep API untouched so handlers can read host/subdomain directly.
  if (pathname.startsWith("/api")) return finish();

  const tenantPrefix = `/${subdomain}`;
  if (pathname === tenantPrefix || pathname.startsWith(`${tenantPrefix}/`)) {
    return finish();
  }

  if (isSubdomainStorefrontGlobalPath(pathname)) {
    return finish();
  }

  if (pathname === "/") {
    url.pathname = tenantPrefix;
    return NextResponse.rewrite(url);
  }

  url.pathname = `${tenantPrefix}${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js).*)"],
};
