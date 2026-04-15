"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AgentWorkflowV2Management } from "@/features/agent-workflow-v2/components/agent-workflow-v2-management";

export default function ContentAgentBuilderPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "Admin") {
      router.push("/");
    }
  }, [router, session?.user?.role, status]);

  if (status === "loading") {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (session?.user?.role !== "Admin") {
    return null;
  }

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Content-Agent Builder</h1>
      </div>
      <AgentWorkflowV2Management />
    </div>
  );
}
