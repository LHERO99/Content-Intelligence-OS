import type { Metadata } from "next";
import { Poppins, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/auth-provider";
import { AlertsProvider } from "@/components/alerts-provider";
import { AuthenticatedLayout } from "@/components/authenticated-layout";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
      className={`${poppins.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AuthProvider>
          <AlertsProvider>
            <TooltipProvider>
              <AuthenticatedLayout>
                {children}
              </AuthenticatedLayout>
            </TooltipProvider>
          </AlertsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
