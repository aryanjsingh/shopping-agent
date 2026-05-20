"use client";

import { useState } from "react";
import { ChevronUp, Sun, Moon, LogIn, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import type { User } from "next-auth";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import {
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { guestRegex } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { LoaderIcon } from "./icons";
import { toast } from "./toast";

function emailToHue(email: string): number {
  let hash = 0;
  for (const char of email) {
    hash = char.charCodeAt(0) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export function SidebarUserNav({ user }: { user: User }) {
  const router = useRouter();
  const { data, status } = useSession();
  const { setTheme, resolvedTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const isGuest = guestRegex.test(data?.user?.email ?? "");

  return (
    <SidebarMenu>
      <SidebarMenuItem className="w-full px-2 py-0.5 relative">
        <div className="relative w-full">
          {isOpen && (
            <div
              className="absolute bottom-full left-0 right-0 overflow-hidden rounded-t-xl border-x border-t border-sidebar-border/60 bg-card p-1.5 flex flex-col gap-0.5 z-50 shadow-md"
              style={{ backgroundColor: "var(--card)" }}
            >
              <button
                className="cursor-pointer text-[13px] rounded-lg px-2.5 py-2 flex items-center gap-2 text-foreground/80 hover:bg-sidebar-accent hover:text-foreground transition-colors duration-150 w-full text-left"
                onClick={() =>
                  setTheme(resolvedTheme === "dark" ? "light" : "dark")
                }
                type="button"
              >
                {resolvedTheme === "light" ? (
                  <Moon className="size-3.5 text-muted-foreground/75" />
                ) : (
                  <Sun className="size-3.5 text-muted-foreground/75" />
                )}
                <span>{`Toggle ${resolvedTheme === "light" ? "dark" : "light"} mode`}</span>
              </button>
              <button
                className="w-full text-left cursor-pointer text-[13px] rounded-lg px-2.5 py-2 flex items-center gap-2 text-foreground/80 hover:bg-sidebar-accent hover:text-foreground transition-colors duration-150 border-none outline-none"
                onClick={() => {
                  if (status === "loading") {
                    toast({
                      type: "error",
                      description:
                        "Checking authentication status, please try again!",
                    });

                    return;
                  }

                  if (isGuest) {
                    router.push("/login");
                  } else {
                    signOut({
                      redirectTo: "/",
                    });
                  }
                }}
                type="button"
              >
                {isGuest ? (
                  <>
                    <LogIn className="size-3.5 text-muted-foreground/75" />
                    <span>Login to your account</span>
                  </>
                ) : (
                  <>
                    <LogOut className="size-3.5 text-muted-foreground/75" />
                    <span>Sign out</span>
                  </>
                )}
              </button>
            </div>
          )}

          {status === "loading" ? (
            <div className="h-11 flex justify-between items-center rounded-xl border border-sidebar-border/30 bg-transparent text-sidebar-foreground/50 px-3">
              <div className="flex flex-row items-center gap-2.5">
                <div className="size-6 animate-pulse rounded-full bg-sidebar-foreground/10" />
                <div className="flex flex-col items-start gap-1">
                  <span className="h-3 w-16 animate-pulse rounded bg-sidebar-foreground/10" />
                  <span className="h-2 w-24 animate-pulse rounded bg-sidebar-foreground/10" />
                </div>
              </div>
              <div className="animate-spin text-sidebar-foreground/50">
                <LoaderIcon />
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={cn(
                "h-11 w-full text-left cursor-pointer px-3 transition-all duration-200 font-semibold text-[13px] text-sidebar-foreground/85 flex items-center gap-2.5 group shadow-sm hover:shadow active:scale-[0.98]",
                isOpen
                  ? "rounded-b-xl rounded-t-none border-x border-b border-t-0 border-sidebar-border/60 bg-card"
                  : "rounded-xl border border-sidebar-border/60 bg-background/50 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
              style={isOpen ? { backgroundColor: "var(--card)" } : undefined}
              data-testid="user-nav-button"
            >
              <div
                className="size-6 shrink-0 rounded-full ring-2 ring-white/15 shadow-sm transition-transform duration-200 group-hover:scale-105"
                style={{
                  background: `linear-gradient(135deg, oklch(0.35 0.08 ${emailToHue(user.email ?? "")}), oklch(0.25 0.05 ${emailToHue(user.email ?? "") + 40}))`,
                }}
              />
              <div className="flex flex-col items-start min-w-0 leading-tight">
                <span className="truncate font-bold text-[13px] text-foreground" data-testid="user-email">
                  {isGuest ? "Guest User" : (user?.email?.split('@')[0] ?? "User")}
                </span>
                <span className="truncate text-[10px] text-sidebar-foreground/50 font-normal">
                  {isGuest ? "Anonymous Session" : (user?.email ?? "Standard Account")}
                </span>
              </div>
              <ChevronUp className={cn("ml-auto size-3.5 text-sidebar-foreground/50 transition-transform duration-200", isOpen && "rotate-180")} />
            </button>
          )}
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
