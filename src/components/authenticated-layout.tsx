"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { GlobalAlerts } from "@/components/global-alerts";
import { PasswordChangeModal } from "@/components/password-change-modal";

export function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const isAuthPage = pathname?.startsWith("/auth/");

  console.log("AuthenticatedLayout status:", status, "pathname:", pathname);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00463c]"></div>
      </div>
    );
  }

  if (status === "authenticated" && !isAuthPage) {
    return (
      <SidebarProvider defaultOpen={true} className="min-h-screen items-stretch">
        <AppSidebar collapsible="none" className="h-screen sticky top-0" />
        <main className="flex-1 min-h-screen overflow-y-auto bg-[#f8faf9]">
          <div className="p-8 pt-6">
            <GlobalAlerts />
            {children}
          </div>
        </main>
        <PasswordChangeModal />
      </SidebarProvider>
    );
  }

  return (
    <main className="flex-1 bg-[#f8faf9]">
      <div className="p-8 pt-6">
        <GlobalAlerts />
        {children}
      </div>
    </main>
  );
}
