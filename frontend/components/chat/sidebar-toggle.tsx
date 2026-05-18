import type { ComponentProps } from "react";

import { type SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { SidebarLeftIcon } from "./icons";

export function SidebarToggle({
  className,
}: ComponentProps<typeof SidebarTrigger>) {
  const { toggleSidebar } = useSidebar();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label="Toggle sidebar"
          className={cn(
            "size-9 rounded-xl border-border/50 bg-muted/35 text-muted-foreground shadow-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-0 focus-visible:border-border/50 active:translate-y-0",
            className
          )}
          data-testid="sidebar-toggle-button"
          onClick={toggleSidebar}
          size="icon"
          variant="outline"
        >
          <SidebarLeftIcon size={16} />
        </Button>
      </TooltipTrigger>
      <TooltipContent align="start" className="hidden md:block">
        Toggle Sidebar
      </TooltipContent>
    </Tooltip>
  );
}
