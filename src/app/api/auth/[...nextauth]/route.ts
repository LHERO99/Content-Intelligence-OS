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

        try {
          console.log("[Auth] Checking Airtable for user...");
          
          const authResult = await Promise.race([
            (async () => {
              try {
                const airtableUser = await getUserByEmail(credentials.email);
                
                if (airtableUser) {
                  if (!airtableUser.Password) {
                    console.log("[Auth] User found but has no password set in Airtable");
                    return "NO_PASSWORD";
                  }

                  console.log("[Auth] User found in Airtable, verifying password...");
                  const isValid = await bcrypt.compare(credentials.password, airtableUser.Password);
                  
                  if (isValid) {
                    console.log("[Auth] Airtable password valid");
                    const userObject = {
                      id: airtableUser.id,
                      name: airtableUser.Name || credentials.email.split('@')[0],
                      email: airtableUser.Email,
                      role: airtableUser.Role || 'Viewer',
                    };
                    console.log("[Auth] Returning user object:", JSON.stringify(userObject));
                    return userObject;
                  }
                  console.log("[Auth] Airtable password invalid");
                  return "INVALID_PASSWORD";
                }

                // No user found, check if we should create the first admin
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
                  console.error("[Auth] Failed to create first user");
                }
                
                return "NO_USER";
              } catch (innerError) {
                console.error("[Auth] Inner Airtable logic error:", innerError);
                throw innerError;
              }
            })(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Airtable auth timeout after 8s")), 8000)
            )
          ]);

          if (typeof authResult === "object" && authResult !== null) {
            console.log(`[Auth] Airtable auth successful in ${Date.now() - startTime}ms`);
            return authResult as any;
          }

          console.log(`[Auth] Airtable auth result: ${authResult}`);
          return null;
        } catch (error) {
          console.error("[Auth] Airtable auth critical error or timeout:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: any; user: any }) {
      console.log("JWT callback triggered", { hasUser: !!user, tokenRole: token.role });
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      console.log("Session callback triggered", { tokenRole: token.role });
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
    strategy: "jwt" as const,
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
