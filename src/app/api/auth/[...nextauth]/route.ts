import NextAuth, { DefaultSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getUserByEmail, countUsers, createUser } from "@/lib/airtable";
import bcrypt from "bcryptjs";

declare module "next-auth" {
  interface Session {
    user: {
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
  }
}

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "admin@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const startTime = Date.now();
        console.log("[Auth] Authorize callback triggered for:", credentials?.email);
        
        if (!credentials?.email || !credentials?.password) {
          console.log("[Auth] Missing credentials");
          return null;
        }

        // 1. Try Airtable first
        try {
          console.log("[Auth] Checking Airtable for user...");
          
          // Wrap the entire Airtable logic in a timeout to ensure it doesn't hang NextAuth
          const authResult = await Promise.race([
            (async () => {
              const airtableUser = await getUserByEmail(credentials.email);
              if (airtableUser && airtableUser.Password) {
                console.log("[Auth] User found in Airtable, verifying password...");
                const isValid = await bcrypt.compare(credentials.password, airtableUser.Password);
                
                if (isValid) {
                  console.log("[Auth] Airtable password valid");
                  return {
                    id: airtableUser.id,
                    name: airtableUser.Name,
                    email: airtableUser.Email,
                    role: airtableUser.Role,
                  };
                }
                console.log("[Auth] Airtable password invalid");
              } else if (!airtableUser) {
                console.log("[Auth] User not found in Airtable, checking if first user...");
                const userCount = await countUsers();
                console.log("[Auth] Current user count:", userCount);
                if (userCount === 0) {
                  console.log("[Auth] First user detected, registering as Admin...");
                  const hashedPassword = await bcrypt.hash(credentials.password, 10);
                  const newUser = await createUser({
                    Name: credentials.email.split('@')[0],
                    Email: credentials.email,
                    Password: hashedPassword,
                    Role: 'Admin',
                  });

                  if (newUser) {
                    console.log("[Auth] First user registered successfully");
                    return {
                      id: newUser.id,
                      name: newUser.Name,
                      email: newUser.Email,
                      role: newUser.Role,
                    };
                  }
                }
              }
              return "NO_USER";
            })(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Airtable auth timeout")), 8000)
            )
          ]);

          if (authResult !== "NO_USER") {
            console.log(`[Auth] Airtable auth successful in ${Date.now() - startTime}ms`);
            return authResult as any;
          }
        } catch (error) {
          console.error("[Auth] Airtable auth error or timeout:", error);
        }

        // 2. Fallback to mock users for demonstration
        console.log("[Auth] Falling back to mock users...");
        const mockUsers = [
          { id: "1", name: "Admin User", email: "admin@example.com", password: "password", role: "Admin" },
          { id: "2", name: "Editor User", email: "editor@example.com", password: "password", role: "Editor" },
        ];

        const user = mockUsers.find(
          (u) => u.email === credentials.email && u.password === credentials.password
        );

        if (user) {
          console.log(`[Auth] Mock user authenticated in ${Date.now() - startTime}ms`);
          const { password, ...userWithoutPassword } = user;
          return userWithoutPassword;
        }
        
        console.log(`[Auth] Authentication failed after ${Date.now() - startTime}ms`);
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: any; user: any }) {
      console.log("JWT callback triggered", { hasUser: !!user, tokenRole: token.role });
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      console.log("Session callback triggered", { tokenRole: token.role });
      if (session.user) {
        session.user.role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  session: {
    strategy: "jwt" as const,
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
