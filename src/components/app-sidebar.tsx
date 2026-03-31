"use client";

import { LayoutDashboard, FileText, PenTool, Activity, LogOut, User, ShieldCheck } from "lucide-react"
import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"

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
]

export function AppSidebar() {
  const { data: session } = useSession()

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-center px-2">
            <Image
              src="/docmorris-logo.png"
              alt="DocMorris Logo"
              width={140}
              height={36}
              priority
              className="h-auto w-auto"
            />
          </div>
          <div className="flex items-center gap-2 font-bold text-[#00463c] px-2">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-sm">SEO Content Intelligence</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton render={<Link href={item.url} />}>
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <Separator className="mb-4" />
        {session ? (
          <div className="space-y-4">
            <Link href="/profile" className="flex items-center gap-3 px-2 hover:bg-gray-100 rounded-md p-1 transition-colors">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00463c] text-white">
                <User className="h-4 w-4" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-sm font-medium">{session.user?.name}</span>
                <span className="truncate text-xs text-gray-500">{session.user?.role}</span>
              </div>
            </Link>
            <SidebarMenu>
              {session?.user?.role === "Admin" && (
                <SidebarMenuItem>
                  <SidebarMenuButton render={<Link href="/admin" />}>
                    <ShieldCheck className="text-red-600" />
                    <span>Admin-Bereich</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <LogOut />
                  <span>Abmelden</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton render={<Link href="/auth/signin" />}>
                <User />
                <span>Anmelden</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
