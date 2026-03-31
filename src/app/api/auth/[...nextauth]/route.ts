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
        console.log("Authorize callback triggered for:", credentials?.email);
        if (!credentials?.email || !credentials?.password) {
          console.log("Missing credentials");
          return null;
        }

        // 1. Try Airtable first
        try {
          console.log("Checking Airtable for user...");
          const airtableUser = await getUserByEmail(credentials.email);
          if (airtableUser && airtableUser.Password) {
            console.log("User found in Airtable, verifying password...");
            // Check if password matches (it should be stored as a bcrypt hash in Airtable)
            const isValid = await bcrypt.compare(credentials.password, airtableUser.Password);
            
            if (isValid) {
              console.log("Airtable password valid");
              return {
                id: airtableUser.id,
                name: airtableUser.Name,
                email: airtableUser.Email,
                role: airtableUser.Role,
              };
            }
            console.log("Airtable password invalid");
          } else if (!airtableUser) {
            console.log("User not found in Airtable, checking if first user...");
            // First User as Admin Auto-Registration
            const userCount = await countUsers();
            console.log("Current user count:", userCount);
            if (userCount === 0) {
              console.log("First user detected, registering as Admin...");
              const hashedPassword = await bcrypt.hash(credentials.password, 10);
              const newUser = await createUser({
                Name: credentials.email.split('@')[0], // Default name from email
                Email: credentials.email,
                Password: hashedPassword,
                Role: 'Admin',
              });

              if (newUser) {
                console.log("First user registered successfully");
                return {
                  id: newUser.id,
                  name: newUser.Name,
                  email: newUser.Email,
                  role: newUser.Role,
                };
              }
            }
          }
        } catch (error) {
          console.error("Airtable auth error, falling back to mock users:", error);
        }

        // 2. Fallback to mock users for demonstration
        console.log("Falling back to mock users...");
        const mockUsers = [
          { id: "1", name: "Admin User", email: "admin@example.com", password: "password", role: "Admin" },
          { id: "2", name: "Editor User", email: "editor@example.com", password: "password", role: "Editor" },
        ];

        const user = mockUsers.find(
          (u) => u.email === credentials.email && u.password === credentials.password
        );

        if (user) {
          console.log("Mock user found and authenticated");
          const { password, ...userWithoutPassword } = user;
          return userWithoutPassword;
        }
        console.log("Authentication failed: No user found");
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: any; user: any }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
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
