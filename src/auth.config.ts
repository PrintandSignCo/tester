import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.clientId = user.clientId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub ?? "";
      const role = token.role;
      session.user.role = role === "ADMIN" || role === "CLIENT" || role === "STAFF" ? role : "STAFF";
      session.user.clientId = typeof token.clientId === "string" ? token.clientId : null;
      return session;
    },
  },
} satisfies NextAuthConfig;
