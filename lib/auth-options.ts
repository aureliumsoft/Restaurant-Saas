import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { legacyRoleFromAccountRole } from "@/lib/auth/account-role";
import { isPlatformAdmin, jwtRoleFromAccount } from "@/lib/auth/admin";
import { ensureGlobalSignupRolesExist } from "@/lib/ensure-global-signup-roles";
import { GLOBAL_ROLE_SLUG, getGlobalRoleIdBySlug } from "@/lib/global-roles";
import { upsertNewsletterSubscriber } from "@/lib/newsletter/subscribe";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

const providers = [
  CredentialsProvider({
    name: "Email and Password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const parsed = credentialsSchema.safeParse(credentials);
      if (!parsed.success) return null;

      const user = await db.user.findUnique({
        where: { email: parsed.data.email },
        include: {
          accountRole: {
            select: { slug: true, name: true, restaurantId: true },
          },
        },
      });

      if (!user?.password) {
        console.warn("[auth][credentials] user not found or no password", {
          email: parsed.data.email,
        });
        return null;
      }

      const ok = await verifyPassword(parsed.data.password, user.password);
      if (!ok) {
        console.warn("[auth][credentials] invalid password", {
          email: parsed.data.email,
        });
        return null;
      }

      const legacy = legacyRoleFromAccountRole(user.accountRole ?? null);
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: jwtRoleFromAccount(user.email ?? null, legacy),
        roleName: user.accountRole?.name ?? null,
        roleId: user.roleId ?? null,
      };
    },
  }),
  ...(googleClientId && googleClientSecret
    ? [
        GoogleProvider({
          clientId: googleClientId,
          clientSecret: googleClientSecret,
        }),
      ]
    : []),
];

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers,
  callbacks: {
    async signIn(params: any) {
      const { user, account, profile } = params as {
        user: any;
        account: any;
        profile?: any;
      };
      if (account?.provider === "google") {
        const email = user.email ?? (profile as any)?.email;
        if (!email) return false;

        const existing = await db.user.findUnique({
          where: { email },
        });

        if (!existing) {
          const name =
            user.name ?? (profile as any)?.name ?? (profile as any)?.given_name;
          const picture = user.image ?? (profile as any)?.picture;

          const usernameBase =
            email
              .split("@")[0]
              .replace(/[^a-zA-Z0-9_]/g, "")
              .slice(0, 20) || "user";

          const username = `${usernameBase}_${Math.random()
            .toString(36)
            .slice(2, 6)}`;

          await ensureGlobalSignupRolesExist();
          const defaultUserRoleId = await getGlobalRoleIdBySlug(
            GLOBAL_ROLE_SLUG.CUSTOMER_USER
          );

          await db.user.create({
            data: {
              name: name || email,
              username,
              email,
              image: picture ?? null,
              roleId: defaultUserRoleId,
            },
          });
        }

        const displayName =
          user.name ?? (profile as any)?.name ?? (profile as any)?.given_name;
        await upsertNewsletterSubscriber({
          email,
          name: typeof displayName === "string" ? displayName : null,
          source: "google",
        });
      }

      return true;
    },

    async jwt(params: any) {
      const { token, user } = params as {
        token: any;
        user?: any;
        account?: any;
      };
      if (user) {
        const u = user as any;
        if (u.id) token.id = String(u.id);
        if (u.role) token.role = String(u.role);
        if (u.roleName != null) token.roleName = String(u.roleName);
        if (u.email) token.email = u.email;
        if (u.roleId !== undefined) token.roleId = u.roleId;
      }

      const email = token.email as string | undefined;
      if (email) {
        const existing = await db.user.findUnique({
          where: { email },
          include: {
            accountRole: {
              select: { slug: true, name: true, restaurantId: true },
            },
          },
        });
        if (existing) {
          token.id = existing.id;
          const legacy = legacyRoleFromAccountRole(existing.accountRole ?? null);
          token.role = jwtRoleFromAccount(
            existing.email ?? email,
            legacy
          );
          token.roleName = existing.accountRole?.name ?? null;
          token.roleId = existing.roleId ?? null;
          token.name = existing.name;
          if (existing.email) token.email = existing.email;
        }
      }

      if (token.email) {
        const r =
          typeof token.role === "string" && token.role !== ""
            ? token.role
            : "UNKNOW";
        token.role = jwtRoleFromAccount(String(token.email), r);
        token.platformAdmin = isPlatformAdmin(
          String(token.email),
          typeof token.role === "string" ? token.role : undefined
        );
      }

      if (token.id && !token.sub) token.sub = String(token.id);

      return token;
    },

    async session(params: any) {
      const { session, token } = params as { session: any; token: any };
      if (session.user) {
        if (token.id) session.user.id = String(token.id);
        if (token.role !== undefined)
          session.user.role = String(token.role);
        if (token.roleName !== undefined && token.roleName !== null) {
          session.user.roleName = String(token.roleName);
        }
        if (token.roleId !== undefined) {
          session.user.roleId =
            token.roleId === null || token.roleId === ''
              ? null
              : String(token.roleId);
        }
        if (token.email) session.user.email = token.email as string;
        if (token.name) session.user.name = String(token.name);
        session.user.isPlatformAdmin = token.platformAdmin === true;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login',
    newUser: '/dashboard',
  },
  secret:
    process.env.NEXTAUTH_SECRET ??
    (process.env.NODE_ENV === "production" ? undefined : "dev-nextauth-secret"),
  // Avoid [next-auth][warn][DEBUG_ENABLED] on every request; set NEXTAUTH_DEBUG=true when needed.
  debug: process.env.NEXTAUTH_DEBUG === "true",
};
