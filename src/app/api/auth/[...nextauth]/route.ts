import NextAuth, { DefaultSession, NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getUserByEmail, countUsers, createUser } from "@/lib/airtable";
import bcrypt from "bcryptjs";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // 1. Check if user exists
          const user = await getUserByEmail(credentials.email);

          if (user) {
            // 2. Verify password
            if (!user.Password) return null;
            const isValid = await bcrypt.compare(credentials.password, user.Password);
            
            if (isValid) {
              return {
                id: user.id,
                name: user.Name,
                email: user.Email,
                role: user.Role,
              };
            }
            return null;
          }

          // 3. If no user, check if table is empty
          const userCount = await countUsers();
          
          if (userCount === 0) {
            // 4. Create first user as Admin
            const hashedPassword = await bcrypt.hash(credentials.password, 10);
            const newUser = await createUser({
              Name: credentials.email.split('@')[0],
              Email: credentials.email,
              Password: hashedPassword,
              Role: 'Admin',
            });

            if (newUser) {
              return {
                id: newUser.id,
                name: newUser.Name,
                email: newUser.Email,
                role: newUser.Role,
              };
            }
          }

          // 5. User not found and table not empty
          return null;
        } catch (error) {
          console.error("[Auth] Authorize error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  session: {
    strategy: "jwt",
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
