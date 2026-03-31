"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { GlobalAlerts } from "@/components/global-alerts";

export function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const isAuthPage = pathname?.startsWith("/auth/");

  console.log("AuthenticatedLayout status:", status, "pathname:", pathname);

  if (status === "authenticated" && !isAuthPage) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <main className="flex-1">
          <div className="p-6">
            <SidebarTrigger />
            <GlobalAlerts />
            {children}
          </div>
        </main>
      </SidebarProvider>
    );
  }

  return (
    <main className="flex-1">
      <div className="p-6">
        <GlobalAlerts />
        {children}
      </div>
    </main>
  );
}
