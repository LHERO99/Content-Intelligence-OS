import NextAuth, { DefaultSession, NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getUserByEmail, countUsers, createUser } from "@/lib/postgres";
import bcrypt from "bcryptjs";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      tenantId: string;
      passwordChanged: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
    tenantId: string;
    passwordChanged: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    tenantId: string;
    passwordChanged: boolean;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
        tenantId: { label: "TenantId", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          console.log("[Auth] Authorize attempt for:", credentials.email, "tenant:", credentials.tenantId ?? "(default)");

          // When a tenantId is provided (multi-tenant flow), look up within that tenant.
          // Otherwise fall back to the default tenant (legacy single-tenant behaviour).
          const user = await getUserByEmail(credentials.email, credentials.tenantId || undefined);
          console.log("[Auth] User found in DB:", user ? "Yes" : "No");

          if (user) {
            // Check if account is active
            if (user.Is_Active === false) {
              console.log("[Auth] User account is deactivated");
              return null;
            }
            // Verify password
            if (!user.Password) {
              console.log("[Auth] User has no password set");
              return null;
            }
            const isValid = await bcrypt.compare(credentials.password, user.Password);
            console.log("[Auth] Password valid:", isValid);

            if (isValid) {
              // Always use tenantId from the DB row — never trust the client-supplied value.
              // getUserByEmail already filters by (email AND tenantId), so user.TenantId
              // is guaranteed to match the tenant that was queried.
              return {
                id:              user.id,
                name:            user.Name,
                email:           user.Email,
                role:            user.Role,
                tenantId:        user.TenantId ?? "",
                passwordChanged: user.Password_Changed === true,
              };
            }
            return null;
          }

          // If no user found, check if bootstrap is explicitly enabled and
          // the users table is completely empty (first-time setup only).
          // Guard with BOOTSTRAP_ENABLED=true to prevent race-condition attacks
          // in production environments.
          if (process.env.BOOTSTRAP_ENABLED !== 'true') {
            console.log("[Auth] User not found and bootstrap is disabled");
            return null;
          }

          const userCount = await countUsers();
          console.log("[Auth] User count in DB:", userCount);

          if (userCount === 0) {
            console.log("[Auth] Creating first admin user");
            const hashedPassword = await bcrypt.hash(credentials.password, 10);
            const newUser = await createUser({
              Name:             credentials.email.split("@")[0],
              Email:            credentials.email,
              Password:         hashedPassword,
              Role:             "Admin",
              Password_Changed: true,
            });

            if (newUser) {
              console.log("[Auth] First admin user created:", newUser.id);
              return {
                id:              newUser.id,
                name:            newUser.Name,
                email:           newUser.Email,
                role:            newUser.Role,
                tenantId:        newUser.TenantId ?? "",
                passwordChanged: true,
              };
            }
          }

          console.log("[Auth] User not found and table not empty");
          return null;
        } catch (error) {
          console.error("[Auth] Authorize error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id              = user.id;
        token.role            = user.role;
        token.tenantId        = user.tenantId;
        token.passwordChanged = user.passwordChanged;
      }
      // Handle session update triggered by update() — e.g. after password change
      if (trigger === "update" && session?.user?.passwordChanged !== undefined) {
        token.passwordChanged = session.user.passwordChanged;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id              = token.id;
        session.user.role            = token.role;
        session.user.tenantId        = token.tenantId;
        session.user.passwordChanged = token.passwordChanged;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
