"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { GlobalAlerts } from "@/components/global-alerts";
import { PasswordChangeModal } from "@/components/password-change-modal";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/use-i18n";

const VIEWPORT_WARNING_BREAKPOINT = 1240;
const VIEWPORT_WARNING_STORAGE_KEY = "viewport-warning-dismissed";

export function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const { locale } = useI18n();
  const tr = (de: string, en: string) => (locale === "de" ? de : en);
  const [dismissedViewportWarning, setDismissedViewportWarning] = useState(false);
  const [showViewportWarning, setShowViewportWarning] = useState(false);

  const isAuthPage = pathname?.startsWith("/auth/");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedDismissed = sessionStorage.getItem(VIEWPORT_WARNING_STORAGE_KEY) === "1";
    if (storedDismissed) {
      setDismissedViewportWarning(true);
    }

    const evaluateViewport = () => {
      const isSmallViewport = window.innerWidth < VIEWPORT_WARNING_BREAKPOINT;
      setShowViewportWarning(isSmallViewport && !storedDismissed && !dismissedViewportWarning);
    };

    evaluateViewport();
    window.addEventListener("resize", evaluateViewport);
    return () => window.removeEventListener("resize", evaluateViewport);
  }, [dismissedViewportWarning]);

  const dismissViewportWarning = () => {
    setDismissedViewportWarning(true);
    setShowViewportWarning(false);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(VIEWPORT_WARNING_STORAGE_KEY, "1");
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (status === "authenticated" && !isAuthPage) {
    return (
      <SidebarProvider defaultOpen={true} className="min-h-screen items-stretch">
        <AppSidebar collapsible="none" className="h-screen sticky top-0" />
        <main className="flex-1 min-h-screen overflow-y-auto bg-[#f8faf9]">
          <div className="p-8 pt-[72px]">
            <GlobalAlerts />
            {children}
          </div>
        </main>
        <PasswordChangeModal />
        <Dialog
          open={showViewportWarning}
          onOpenChange={(open) => {
            if (!open) {
              dismissViewportWarning();
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{tr("Hinweis zur Bildschirmgröße", "Screen Size Notice")}</DialogTitle>
              <DialogDescription>
                {tr(
                  "Dieses Tool ist primär für Desktop-Geräte ausgelegt. Bei kleineren Bildschirmen kann die Usability eingeschränkt sein.",
                  "This tool is primarily designed for desktop devices. Usability may be limited on smaller screens."
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" onClick={dismissViewportWarning}>
                {tr("Verstanden", "Got it")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarProvider>
    );
  }

  return (
    <main className="flex-1 bg-[#f8faf9]">
      <div className="p-8 pt-[72px]">
        <GlobalAlerts />
        {children}
      </div>
    </main>
  );
}
