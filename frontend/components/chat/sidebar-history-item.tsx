import Link from "next/link";
import { memo } from "react";
import type { Chat } from "@/lib/db/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";
import { MoreHorizontalIcon, PencilEditIcon, TrashIcon } from "./icons";

const PureChatItem = ({
  chat,
  isActive,
  onDelete,
  onRename,
  setOpenMobile,
}: {
  chat: Chat;
  isActive: boolean;
  onDelete: (chatId: string) => void;
  onRename: (chat: Chat) => void;
  setOpenMobile: (open: boolean) => void;
}) => {
  const createdLabel = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(chat.createdAt));

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        className="h-10 rounded-md text-[13px] text-sidebar-foreground/25 transition-all duration-150 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground/80 data-[active=true]:!bg-sidebar-accent data-[active=true]:!text-foreground"
        isActive={isActive}
      >
        <Link
          href={`/chat/${chat.id}`}
          onClick={() => setOpenMobile(false)}
          title={`${chat.title} · ${createdLabel}`}
        >
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{chat.title}</span>
          </span>
        </Link>
      </SidebarMenuButton>

      <DropdownMenu modal={true}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            className="mr-0.5 rounded-md text-sidebar-foreground/50 ring-0 transition-colors duration-150 focus-visible:ring-0 hover:text-sidebar-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground !top-2.5"
            showOnHover={!isActive}
          >
            <MoreHorizontalIcon />
            <span className="sr-only">More</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" side="bottom">
          <DropdownMenuItem onSelect={() => onRename(chat)}>
            <PencilEditIcon />
            <span>Rename</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => onDelete(chat.id)}
            variant="destructive"
          >
            <TrashIcon />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
};

export const ChatItem = memo(PureChatItem, (prevProps, nextProps) => {
  if (prevProps.isActive !== nextProps.isActive) {
    return false;
  }
  return prevProps.chat.id === nextProps.chat.id &&
    prevProps.chat.title === nextProps.chat.title;
});
