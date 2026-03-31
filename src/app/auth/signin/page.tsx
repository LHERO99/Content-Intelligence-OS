"use client";

import { signIn } from "next-auth/react";
import { useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter, useSearchParams } from "next/navigation";

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") || "/planning";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        console.error("Sign-in error:", result.error);
        setError("Invalid credentials");
        setIsLoading(false);
      } else {
        console.log("Sign-in successful, redirecting to:", callbackUrl);
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      console.error("Unexpected sign-in error:", err);
      setError("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#e7f3ee]">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-[#00463c]">SEO Content Intelligence OS</h2>
          <p className="mt-2 text-sm text-gray-600">Sign in to your account</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded bg-red-50 p-2 text-sm text-red-500 text-center">
              {error}
            </div>
          )}
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="border-gray-300 focus:border-[#00463c] focus:ring-[#00463c]"
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="border-gray-300 focus:border-[#00463c] focus:ring-[#00463c]"
              />
            </div>
          </div>

          <div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#00463c] hover:bg-[#00332b] text-white"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </div>
        </form>
        <div className="mt-4 text-xs text-gray-500 text-center">
          <p>Admin: admin@example.com / password</p>
          <p>Editor: editor@example.com / password</p>
        </div>
      </div>
    </div>
  );
}

export default function SignIn() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <SignInForm />
    </Suspense>
  );
}
