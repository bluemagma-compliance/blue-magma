"use client";

import type React from "react";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { UserManagementContent } from "@/components/user-management-content";
import {
	  LayoutDashboard,
	  Rocket,
	  Settings,
	  LogOut,
	  UserPlus,
	  HelpCircle,
	  Menu,
	  CreditCard,
	  Zap,
	  FolderKanban,
	  Database,
	  ShieldCheck,
	} from "lucide-react";
import { cn } from "@/lib/utils";
import { isFeatureEnabled } from "@/config/features";
import { useIsFreePlan } from "@/hooks/useFreePlan";

// Base navigation items
	const baseNavigation = [
	  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
	  { name: "Projects", href: "/projects", icon: FolderKanban },
	  { name: "Trust Center", href: "/trust", icon: ShieldCheck },
	  { name: "Knowledge Base", href: "/knowledge-base", icon: Database },
	  { name: "Integrations", href: "/integrations", icon: Zap },
	];

// Conditional navigation items based on feature flags
const conditionalNavigation = [
  ...(isFeatureEnabled("deployments")
    ? [{ name: "Deployments", href: "/deployments", icon: Rocket }]
    : []),
];

// Combine base and conditional navigation
const navigation = [
  ...baseNavigation.slice(0, 4), // Dashboard, Projects, Data Sources, and AI Chat
  ...conditionalNavigation, // Feature-flagged items (Deployments)
  ...baseNavigation.slice(4), // Rest of the items
];

const footerNavigation = [
  { id: "invite", name: "Invite collaborators", href: "#", icon: UserPlus },
  { id: "billing", name: "Billing", href: "/billing", icon: CreditCard },
  { id: "help", name: "Help & support", href: "/help", icon: HelpCircle },
  { id: "settings", name: "Settings", href: "/settings", icon: Settings },
  { id: "logout", name: "Logout", href: "/login", icon: LogOut },
];

interface SidebarProps {
  children: React.ReactNode;
}

export function SimpleSidebar({ children }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { logoutUser } = useAuth();
  const { isFreePlan, loading: planLoading } = useIsFreePlan();

  const handleLogout = async () => {
    try {
      setMobileOpen(false); // Close mobile sidebar if open

      // Use AuthContext service method
      await logoutUser();
    } catch (error) {
      console.error("Failed to logout:", error);
      // Fallback: redirect to login even if service method fails
      router.push("/login");
    }
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo Header */}
      <div className="flex items-center justify-center h-16 px-4 border-b">
        <Image
          src="/logos/pngs/20 Blue Horizontal.png"
          alt="Blue Magma"
          width={220}
          height={50}
          className="h-16 w-auto max-w-full dark:hidden"
        />
        <Image
          src="/logos/pngs/28 Orange Horizontal.png"
          alt="Blue Magma"
          width={220}
          height={50}
          className="h-16 w-auto max-w-full hidden dark:block"
        />
      </div>

      {/* Navigation */}
      <div className="flex-1 p-2 space-y-1">
        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive =
              pathname.startsWith(item.href) &&
              (item.href === "/" ? pathname === "/" : true);
            const isRestrictedItem =
              item.href === "/knowledge-base" || item.href === "/integrations";

            // Lazy-load only the restricted items while plan is loading
            if (planLoading && isRestrictedItem) {
              return (
                <div
                  key={item.name}
                  className="h-9 rounded-lg bg-muted animate-pulse"
                />
              );
            }

            const isFreeRestricted = isFreePlan && isRestrictedItem;

            if (isFreeRestricted) {
              // On the free plan, clicking restricted nav items should take users
              // to the subscription page instead of being completely disabled.
              return (
                <button
                  key={item.name}
                  type="button"
                  className={cn(
                    "flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 gap-3 border border-dashed",
                    "text-muted-foreground hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 cursor-pointer dark:hover:bg-blue-950 dark:hover:text-blue-300 dark:hover:border-blue-800",
                  )}
	                  disabled
	                  aria-disabled="true"
                >
                  <item.icon className="h-4 w-4 shrink-0 transition-colors duration-200" />
                  <span className="flex-1 text-left">{item.name}</span>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                    Upgrade
                  </span>
                </button>
              );
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 gap-3 cursor-pointer border border-transparent",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 hover:scale-[1.02] active:scale-[0.98] dark:hover:bg-blue-950 dark:hover:text-blue-300 dark:hover:border-blue-800",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0 transition-colors duration-200" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="border-t p-2">
        <nav className="space-y-1">
          {footerNavigation.map((item) => {
            if (item.id === "invite") {
              // Lazy-load only the Invite collaborators item while plan is loading
              if (planLoading) {
                return (
                  <div
                    key={item.id}
                    className="h-9 rounded-lg bg-muted animate-pulse"
                  />
                );
              }

              // For free plan, clicking Invite collaborators should take users to
              // the subscription page rather than being a disabled upgrade-only entry.
              if (isFreePlan) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      "flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 gap-3 border border-dashed",
                      "text-muted-foreground hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 cursor-pointer dark:hover:bg-blue-950 dark:hover:text-blue-300 dark:hover:border-blue-800",
                    )}
	                    disabled
	                    aria-disabled="true"
                  >
                    <item.icon className="h-4 w-4 shrink-0 transition-colors duration-200" />
                    <span className="flex-1 text-left">{item.name}</span>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                      Upgrade
                    </span>
                  </button>
                );
              }

              return (
                <Dialog
                  key={item.id}
                  open={isInviteModalOpen}
                  onOpenChange={setIsInviteModalOpen}
                >
                  <DialogTrigger asChild>
                    <button
                      onClick={() => {
                        setIsInviteModalOpen(true);
                        setMobileOpen(false); // Close mobile sidebar if open
                      }}
                      className={cn(
                        "flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 gap-3 cursor-pointer border border-transparent",
                        "hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 hover:scale-[1.02] active:scale-[0.98] dark:hover:bg-blue-950 dark:hover:text-blue-300 dark:hover:border-blue-800",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0 transition-colors duration-200" />
                      {item.name}
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px] md:max-w-[700px] lg:max-w-[800px]">
                    <UserManagementContent
                      onClose={() => setIsInviteModalOpen(false)}
                    />
                  </DialogContent>
                </Dialog>
              );
            }

            const isActive = item.href !== "#" && pathname.startsWith(item.href);
            const isLogoutLink = item.id === "logout";
            const linkIsActive = !isLogoutLink && isActive;

            if (isLogoutLink) {
              return (
                <button
                  key={item.id}
                  onClick={handleLogout}
                  className={cn(
                    "flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 gap-3 cursor-pointer border border-transparent",
                    "hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 hover:scale-[1.02] active:scale-[0.98] dark:hover:bg-blue-950 dark:hover:text-blue-300 dark:hover:border-blue-800",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0 transition-colors duration-200" />
                  {item.name}
                </button>
              );
            }

            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => {
                  setMobileOpen(false);
                }}
                className={cn(
                  "flex items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 gap-3 border border-transparent",
                  linkIsActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 hover:scale-[1.02] active:scale-[0.98] dark:hover:bg-blue-950 dark:hover:text-blue-300 dark:hover:border-blue-800",
                  item.href === "#"
                    ? "cursor-not-allowed opacity-75"
                    : "cursor-pointer",
                )}
                aria-disabled={item.href === "#"}
                tabIndex={item.href === "#" ? -1 : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0 transition-colors duration-200" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:flex-col md:fixed md:inset-y-0 bg-background border-r md:w-64">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden fixed top-3 left-3 z-50"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle sidebar</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 md:ml-64">{children}</div>
    </div>
  );
}
