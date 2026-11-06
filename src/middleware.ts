import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = req.auth?.user?.role;
  const portalPublic = pathname === "/portal/login" || pathname === "/portal/signup";

  if (pathname.startsWith("/staff")) {
    if (!req.auth) {
      const url = new URL("/login", req.nextUrl);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (role === "CLIENT") return NextResponse.redirect(new URL("/portal", req.nextUrl));
  }

  if (pathname.startsWith("/portal") && !portalPublic) {
    if (!req.auth) {
      const url = new URL("/portal/login", req.nextUrl);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (role !== "CLIENT") return NextResponse.redirect(new URL("/staff", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/staff/:path*", "/portal/:path*"],
};
