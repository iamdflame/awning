import { NextResponse, type NextRequest } from "next/server";
import { blockedOnTenantHost, resolveHost, rewriteTarget } from "./lib/host";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const root = (process.env.AWNING_ROOT_DOMAIN || "awning.sh").toLowerCase();
  const extra = (process.env.AWNING_EXTRA_ROOT_HOSTS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const host = resolveHost(req.headers.get("x-forwarded-host") ?? req.headers.get("host"), root, extra);
  if (blockedOnTenantHost(host, url.pathname)) return new NextResponse("Not found", { status: 404, headers: { "content-type": "text/plain" } });
  const target = rewriteTarget(host, url.pathname, url.searchParams);
  if (!target) return NextResponse.next();
  const rewritten = url.clone();
  rewritten.pathname = target;
  rewritten.search = "";
  return NextResponse.rewrite(rewritten);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
