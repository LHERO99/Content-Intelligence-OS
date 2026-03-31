import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/auth-provider";
import { AlertsProvider } from "@/components/alerts-provider";
import { GlobalAlerts } from "@/components/global-alerts";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SEO Content Intelligence OS",
  description: "Advanced SEO Content Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AuthProvider>
          <AlertsProvider>
            <TooltipProvider>
              <SidebarProvider>
                <AppSidebar />
                <main className="flex-1">
                  <div className="p-4">
                    <SidebarTrigger />
                    <GlobalAlerts />
                    {children}
                  </div>
                </main>
              </SidebarProvider>
            </TooltipProvider>
          </AlertsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
