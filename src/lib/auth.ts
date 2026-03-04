import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db, getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import type { TierId } from "@/lib/tiers";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      tierId: TierId;
    };
  }

  interface User {
    tierId?: TierId;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(getDb() as any, {
    usersTable: schema.users as any,
    accountsTable: schema.accounts as any,
    sessionsTable: schema.sessions as any,
    verificationTokensTable: schema.verificationTokens as any,
  }),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    newUser: "/app",
  },
  providers: [
    Credentials({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;

        const [user] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, email))
          .limit(1);

        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          tierId: user.tierId as TierId,
          emailVerified: user.emailVerified || null,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.tierId = (user as any).tierId || "starter";
        token.isEmailVerified = !!(user as any).emailVerified;
        token.lastRefreshed = Date.now();
        token.issuedAt = Date.now();
      }

      // Re-read from DB every 5 minutes to pick up tier changes, email verification, and password changes
      const lastRefreshed = (token.lastRefreshed as number) || 0;
      if (trigger === "update" || Date.now() - lastRefreshed > 5 * 60 * 1000) {
        try {
          const [freshUser] = await db
            .select({
              tierId: schema.users.tierId,
              emailVerified: schema.users.emailVerified,
              passwordChangedAt: schema.users.passwordChangedAt,
            })
            .from(schema.users)
            .where(eq(schema.users.id, token.id as string))
            .limit(1);

          if (freshUser) {
            token.tierId = freshUser.tierId || "starter";
            token.isEmailVerified = !!freshUser.emailVerified;

            // Invalidate session if password was changed after this token was issued
            if (freshUser.passwordChangedAt && token.issuedAt) {
              const pwChangedMs = new Date(freshUser.passwordChangedAt).getTime();
              if (pwChangedMs > (token.issuedAt as number)) {
                // Return empty token to force re-login
                return { id: null } as any;
              }
            }
          } else {
            // User deleted — invalidate session
            return { id: null } as any;
          }
          token.lastRefreshed = Date.now();
        } catch {
          // Silently fail — use cached values
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token && token.id) {
        session.user.id = token.id as string;
        session.user.tierId = (token.tierId as TierId) || "starter";
        (session.user as any).isEmailVerified = (token.isEmailVerified as boolean) ?? false;
      }
      return session;
    },
  },
});
