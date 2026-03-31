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
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // 1. Try Airtable first
        try {
          const airtableUser = await getUserByEmail(credentials.email);
          if (airtableUser && airtableUser.Password) {
            // Check if password matches (it should be stored as a bcrypt hash in Airtable)
            const isValid = await bcrypt.compare(credentials.password, airtableUser.Password);
            
            if (isValid) {
              return {
                id: airtableUser.id,
                name: airtableUser.Name,
                email: airtableUser.Email,
                role: airtableUser.Role,
              };
            }
          } else if (!airtableUser) {
            // First User as Admin Auto-Registration
            const userCount = await countUsers();
            if (userCount === 0) {
              const hashedPassword = await bcrypt.hash(credentials.password, 10);
              const newUser = await createUser({
                Name: credentials.email.split('@')[0], // Default name from email
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
          }
        } catch (error) {
          console.error("Airtable auth error, falling back to mock users:", error);
        }

        // 2. Fallback to mock users for demonstration
        const mockUsers = [
          { id: "1", name: "Admin User", email: "admin@example.com", password: "password", role: "Admin" },
          { id: "2", name: "Editor User", email: "editor@example.com", password: "password", role: "Editor" },
        ];

        const user = mockUsers.find(
          (u) => u.email === credentials.email && u.password === credentials.password
        );

        if (user) {
          const { password, ...userWithoutPassword } = user;
          return userWithoutPassword;
        }
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
