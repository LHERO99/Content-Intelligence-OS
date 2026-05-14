"use client";

import { LayoutDashboard, FileText, PenTool, Activity, LogOut, User, ShieldCheck, History, Workflow, Building2, BarChart3, MessageSquare, ShieldAlert, Scale, Globe } from "lucide-react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useBranding } from "@/components/providers/branding-provider"
import { useI18n } from "@/i18n/use-i18n"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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

const superAdminItems = [
  {
    title: "navDashboard",
    url: "/super-admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "navTenants",
    url: "/super-admin/tenants",
    icon: Building2,
  },
  {
    title: "navPricing",
    url: "/super-admin/pricing",
    icon: BarChart3,
  },
  {
    title: "navFeedback",
    url: "/super-admin/feedback",
    icon: MessageSquare,
  },
  {
    title: "navHealth",
    url: "/super-admin/health",
    icon: Activity,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = useSession()
  const { logoUrl, primaryColor } = useBranding()
  const { t } = useI18n()
  const router = useRouter()

  const isSuperAdmin = session?.user?.role === "SuperAdmin"

  return (
    <Sidebar {...props}>
      <SidebarHeader className="p-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-center px-1">
            <Image
              src={logoUrl}
              alt="App Logo"
              width={120}
              height={32}
              priority
              className="h-auto w-auto max-h-[50px] object-contain"
            />
          </div>
          <div className="flex items-center gap-2 font-bold px-1" style={{ color: primaryColor }}>
              <span className="text-xs">Plexaro</span>
            </div>
          </div>
        </SidebarHeader>
      <SidebarContent>

        {/* ── Super-Admin Navigation ── */}
        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" />
              {t("superAdmin.groupLabel")}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {superAdminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton render={<Link href={item.url} />}>
                      <item.icon />
                      <span>{t(`superAdmin.${item.title}`)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* ── Regular Content Navigation (hidden for SuperAdmin) ── */}
        {!isSuperAdmin && (
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
        )}

      </SidebarContent>
      <SidebarFooter className="p-3">
        <Separator className="mb-3" />
        {session ? (
          <div className="space-y-2">
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
            {!isSuperAdmin && (
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton render={<Link href="/feedback" />}>
                    <MessageSquare />
                    <span>{t("sidebar.feedbackLink")}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            )}

            {/* ── User Dropdown ── */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-3 w-full px-2 py-1.5 rounded-md hover:bg-accent transition-colors text-left">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  <User className="h-4 w-4" />
                </div>
                <span className="truncate text-sm font-medium">{session.user?.name}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <div className="px-2 py-1.5 text-sm font-medium truncate border-b mb-1">
                  {session.user?.name}
                </div>
                <DropdownMenuItem className="cursor-pointer" onClick={() => router.push("/profile")}>
                  <User className="h-4 w-4" />
                  {t("sidebar.profile")}
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={() => router.push("/legal")}>
                  <Scale className="h-4 w-4" />
                  {t("sidebar.legalLink")}
                </DropdownMenuItem>
                <LanguageSwitcherItem />
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                  onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                >
                  <LogOut className="h-4 w-4" />
                  {t("sidebar.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* ── Copyright ── */}
            <p className="text-xs text-muted-foreground/60 px-2 py-1 select-none">
              © {new Date().getFullYear()} Plexaro
            </p>
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

// ── Inline Language Switcher as Dropdown Item ─────────────────────────────────

function LanguageSwitcherItem() {
  const { locale, setLocale, t } = useI18n()
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-default">
      <Globe className="h-4 w-4 shrink-0" />
      <span className="flex-1">{t("common.language")}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setLocale("de")}
          className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${
            locale === "de"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          }`}
        >
          DE
        </button>
        <button
          type="button"
          onClick={() => setLocale("en")}
          className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${
            locale === "en"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          }`}
        >
          EN
        </button>
      </div>
    </div>
  )
}
