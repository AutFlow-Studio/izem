import React from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  CalendarDays, 
  CreditCard, 
  Files, 
  BarChart3, 
  CheckSquare, 
  Settings,
  Search,
  Command,
  Bell,
  User,
  LogOut,
  Menu,
  X,
  UserPlus,
  FolderPlus,
  RefreshCw,
  Receipt,
  CheckCircle2,
  Upload,
  ListTodo,
  CheckCheck,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListNotifications,
  getListNotificationsQueryKey,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
} from "@workspace/api-client-react";
import { useAuth } from "@/components/auth-provider";
import { useAgencyProfile } from "@/components/agency-profile-provider";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const NOTIF_ICON_MAP: Record<string, React.ElementType> = {
  client_created: UserPlus,
  project_created: FolderPlus,
  project_status_changed: RefreshCw,
  invoice_created: Receipt,
  invoice_paid: CheckCircle2,
  document_uploaded: Upload,
  task_created: ListTodo,
  task_completed: CheckCheck,
};

function NotifIcon({ type }: { type: string }) {
  const Icon = NOTIF_ICON_MAP[type] ?? Bell;
  return <Icon size={14} className="shrink-0 mt-0.5 text-muted-foreground" />;
}

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/projects", label: "Projects", icon: Briefcase },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/meetings", label: "Meetings", icon: CalendarDays },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/documents", label: "Documents", icon: Files },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { user, logout } = useAuth();
  const { profile: agencyProfile } = useAgencyProfile();
  const queryClient = useQueryClient();

  const initials = (user?.name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase())
    .slice(0, 2)
    .join("") || "?";

  // ── Real notification data from the API ───────────────────────────────────
  const { data: notifData } = useListNotifications({
    query: { queryKey: getListNotificationsQueryKey(), refetchInterval: 30_000 },
  });
  const notifications = notifData?.notifications ?? [];
  const unreadCount = notifData?.unreadCount ?? 0;

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotif = useDeleteNotification();

  function invalidateNotifications() {
    queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
  }

  function handleMarkRead(id: number) {
    markRead.mutate({ id }, { onSuccess: invalidateNotifications });
  }

  function handleMarkAllRead() {
    markAllRead.mutate(undefined, { onSuccess: invalidateNotifications });
  }

  function handleDelete(id: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    deleteNotif.mutate({ id }, { onSuccess: invalidateNotifications });
  }

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const query = new FormData(e.currentTarget).get("q");
    if (query) {
      setLocation(`/search?q=${encodeURIComponent(query.toString())}`);
    }
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/30">
      {/* Mobile Nav Overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-72 border-r border-border/50 bg-card/95 backdrop-blur-xl flex flex-col z-40 transition-transform duration-300 md:hidden",
        mobileNavOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-border/50">
          <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
              <Command size={14} />
            </div>
            <span className="truncate">{agencyProfile.agencyName}</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
          <div className="px-3 pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Workspace
          </div>
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileNavOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                )}
              >
                <item.icon size={16} className={cn(isActive ? "text-primary" : "text-muted-foreground")} />
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="p-4 border-t border-border/50">
          <Link href="/settings" onClick={() => setMobileNavOpen(false)} className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
            location.startsWith("/settings")
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
          )}>
            <Settings size={16} />
            Settings
          </Link>
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside className="w-64 border-r border-border/50 bg-card/50 backdrop-blur-xl flex flex-col flex-shrink-0 z-20 hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-border/50">
          <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
              <Command size={14} />
            </div>
            <span className="truncate">{agencyProfile.agencyName}</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
          <div className="px-3 pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Workspace
          </div>
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
              )}>
                <item.icon size={16} className={cn(isActive ? "text-primary" : "text-muted-foreground")} />
                {item.label}
              </Link>
            );
          })}
        </div>
        
        <div className="p-4 border-t border-border/50">
          <Link href="/settings" className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
            location.startsWith("/settings")
              ? "bg-primary/10 text-primary" 
              : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
          )}>
            <Settings size={16} />
            Settings
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-border/50 bg-background/80 backdrop-blur-md z-10 sticky top-0">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <button
              type="button"
              className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors flex-shrink-0"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <form onSubmit={handleSearch} className="relative group flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={16} />
              <input 
                type="search" 
                name="q"
                placeholder="Search clients, projects, invoices..." 
                className="w-full h-10 pl-10 pr-4 bg-secondary/50 border border-transparent rounded-full text-sm focus:outline-none focus:bg-background focus:border-primary/30 focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/70"
                defaultValue={new URLSearchParams(window.location.search).get("q") || ""}
              />
            </form>
          </div>
          
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary/80 transition-colors relative">
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 rounded-full bg-accent border-2 border-background flex items-center justify-center text-[9px] font-bold text-accent-foreground px-0.5">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 max-h-[480px] flex flex-col">
                <div className="flex items-center justify-between px-3 py-2">
                  <DropdownMenuLabel className="p-0 text-sm">
                    Notifications
                    {unreadCount > 0 && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {unreadCount} unread
                      </span>
                    )}
                  </DropdownMenuLabel>
                  {unreadCount > 0 && (
                    <button
                      onClick={(e) => { e.preventDefault(); handleMarkAllRead(); }}
                      className="text-xs text-primary hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <DropdownMenuSeparator className="mt-0" />
                <div className="overflow-y-auto flex-1">
                  {notifications.length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                      You're all caught up.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={cn(
                          "flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-secondary/50 transition-colors group",
                          !n.isRead && "bg-accent/5"
                        )}
                        onClick={() => {
                          if (!n.isRead) handleMarkRead(n.id);
                          if (n.href) setLocation(n.href);
                        }}
                      >
                        {!n.isRead && (
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                        )}
                        {n.isRead && <span className="mt-1.5 w-1.5 h-1.5 shrink-0" />}
                        <NotifIcon type={n.type} />
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm leading-tight", !n.isRead && "font-medium")}>
                            {n.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                          <p className="text-xs text-muted-foreground/60 mt-0.5">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        <button
                          onClick={(e) => handleDelete(n.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-all shrink-0"
                          title="Dismiss"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-xs font-bold text-white shadow-sm ring-2 ring-background cursor-pointer">
                  {initials}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="font-medium">{user?.name ?? ""}</span>
                    <span className="text-xs font-normal text-muted-foreground">{user?.email ?? ""}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/settings" className="flex items-center gap-2">
                    <User size={14} />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/settings" className="flex items-center gap-2">
                    <Settings size={14} />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive"
                  onClick={async () => {
                    await logout();
                    toast({ title: "Signed out", description: "You have been signed out of AutFlow Studio." });
                  }}
                >
                  <LogOut size={14} className="mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
