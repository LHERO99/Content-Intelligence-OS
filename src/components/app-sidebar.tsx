"use client";

import { LayoutDashboard, FileText, PenTool, Activity, LogOut, User, ShieldCheck, History, Workflow } from "lucide-react"
import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { useBranding } from "@/components/providers/branding-provider"
import { useI18n } from "@/i18n/use-i18n"
import { LanguageSwitcher } from "@/components/language-switcher"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

// Menu items.
const items = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Content-Planung",
    url: "/planning",
    icon: FileText,
  },
  {
    title: "Content-Erstellung",
    url: "/creation",
    icon: PenTool,
  },
  {
    title: "Content-Monitoring",
    url: "/monitoring",
    icon: Activity,
  },
  {
    title: "Content-Historie",
    url: "/history",
    icon: History,
  },
]

const adminItems = [
  {
    title: "Content-Agent Builder",
    url: "/content-agent-builder",
    icon: Workflow,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = useSession()
  const { logoUrl, primaryColor } = useBranding()
  const { t } = useI18n()

  return (
    <Sidebar {...props}>
      <SidebarHeader className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-center px-2">
            <Image
              src={logoUrl}
              alt="App Logo"
              width={140}
              height={36}
              priority
              className="h-auto w-auto max-h-[60px] object-contain"
            />
          </div>
          <div className="flex items-center gap-2 font-bold px-2" style={{ color: primaryColor }}>
            <ShieldCheck className="h-5 w-5" />
              <span className="text-sm">SEO Content Intelligence</span>
            </div>
          </div>
        </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("sidebar.navigation")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const localizedTitle =
                  item.url === "/"
                    ? t("sidebar.dashboard")
                    : item.url === "/planning"
                      ? t("sidebar.contentPlanning")
                      : item.url === "/creation"
                        ? t("sidebar.contentCreation")
                        : item.url === "/monitoring"
                          ? t("sidebar.contentMonitoring")
                          : item.url === "/history"
                            ? t("sidebar.contentHistory")
                            : item.title
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton render={<Link href={item.url} />}>
                      <item.icon />
                      <span>{localizedTitle}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>

            {session?.user?.role === "Admin" && (
              <>
                <Separator className="my-2" />
                <SidebarMenu>
                  {adminItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton render={<Link href={item.url} />}>
                        <item.icon />
                        <span>{t("sidebar.agentBuilder")}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <Separator className="mb-4" />
        {session ? (
          <div className="space-y-4">
            {session?.user?.role === "Admin" && (
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton render={<Link href="/admin" />}>
                    <ShieldCheck className="text-red-600" />
                    <span>{t("sidebar.adminArea")}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            )}
            <LanguageSwitcher />
            <Link href="/profile" className="flex items-center gap-3 px-2 hover:bg-gray-100 rounded-md p-1 transition-colors">
              <div className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ backgroundColor: primaryColor }}>
                <User className="h-4 w-4" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-sm font-medium">{session.user?.name}</span>
                <span className="truncate text-xs text-gray-500">{session.user?.role}</span>
              </div>
            </Link>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <LogOut />
                  <span>{t("sidebar.signOut")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton render={<Link href="/auth/signin" />}>
                <User />
                <span>{t("sidebar.signIn")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
