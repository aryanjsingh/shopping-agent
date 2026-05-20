"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ShoppingBagIcon, SquarePen, Search } from "lucide-react";
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
import { SidebarHistory } from "./sidebar-history";
import { SidebarToggle } from "./sidebar-toggle";
import { SidebarUserNav } from "./sidebar-user-nav";

export function AppSidebar({ user }: { user: User | undefined }) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  function handleNewChat() {
    if (pathname === "/") {
      router.refresh();
    } else {
      router.push("/");
    }
  }

  return (
    <Sidebar className="border-r-0" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
            <SidebarMenuButton
              asChild
              className="h-10 cursor-pointer px-2 rounded-xl transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden"
            >
              <Link className="flex items-center gap-2.5" href="/">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <ShoppingBagIcon size={13} />
                </span>
                <span className="flex flex-col min-w-0">
                  <span className="font-semibold text-[14px] leading-none text-foreground tracking-tight">
                    Kasparro Shopper
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
            <SidebarToggle className="group-data-[collapsible=icon]:size-8" />
          </SidebarMenuItem>
          <SidebarMenuItem className="group-data-[collapsible=icon]:hidden px-2 py-0.5">
            <SidebarMenuButton
              onClick={handleNewChat}
              className="h-10 w-full cursor-pointer px-3 rounded-lg bg-transparent hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200 active:scale-[0.98] font-medium text-[13px] text-sidebar-foreground/80 flex items-center justify-start gap-2.5 border-none shadow-none"
            >
              <SquarePen size={16} className="text-sidebar-foreground/75" />
              <span>New chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="group-data-[collapsible=icon]:hidden px-2 py-0.5">
            <SidebarMenuButton
              onClick={() => setIsSearchOpen(true)}
              className="h-10 w-full cursor-pointer px-3 rounded-lg bg-transparent hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200 active:scale-[0.98] font-medium text-[13px] text-sidebar-foreground/80 flex items-center justify-start gap-2.5 border-none shadow-none"
            >
              <Search size={16} className="text-sidebar-foreground/75" />
              <span>Search chats</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="scroll-fade-y">
        <SidebarHistory
          user={user}
          isSearchOpen={isSearchOpen}
          setIsSearchOpen={setIsSearchOpen}
        />
      </SidebarContent>

      <SidebarFooter>
        {user ? <SidebarUserNav user={user} /> : null}
      </SidebarFooter>
    </Sidebar>
  );
}
