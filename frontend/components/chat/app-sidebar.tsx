"use client";

import Link from "next/link";
import type { User } from "next-auth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { PlusIcon, VercelIcon } from "./icons";
import { SidebarHistory } from "./sidebar-history";
import { SidebarToggle } from "./sidebar-toggle";
import { SidebarUserNav } from "./sidebar-user-nav";

export function AppSidebar({ user }: { user: User | undefined }) {
  return (
    <Sidebar className="border-r-0" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
            <SidebarMenuButton
              asChild
              className="h-9 cursor-pointer px-2 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden"
            >
              <Link className="flex items-center gap-2" href="/">
                <VercelIcon size={16} />
                <span className="font-medium">Kasparro Shopper</span>
              </Link>
            </SidebarMenuButton>
            <SidebarToggle className="group-data-[collapsible=icon]:size-8" />
          </SidebarMenuItem>
          <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
            <SidebarMenuButton
              asChild
              className="h-9 cursor-pointer px-2 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Link className="flex items-center gap-2" href="/">
                <PlusIcon size={16} />
                <span>New Chat</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarHistory user={user} />
      </SidebarContent>

      <SidebarFooter>
        {user ? <SidebarUserNav user={user} /> : null}
      </SidebarFooter>
    </Sidebar>
  );
}
