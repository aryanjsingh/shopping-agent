import type { ComponentProps } from "react";

import { type SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { SidebarLeftIcon } from "./icons";

export function SidebarToggle({
  className,
}: ComponentProps<typeof SidebarTrigger>) {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      aria-label="Toggle sidebar"
      className={cn(
        "size-7 shrink-0 cursor-pointer rounded-lg text-sidebar-foreground/50 shadow-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-0",
        className
      )}
      data-testid="sidebar-toggle-button"
      onClick={toggleSidebar}
      size="icon"
      variant="ghost"
    >
      <SidebarLeftIcon size={14} />
    </Button>
  );
}
