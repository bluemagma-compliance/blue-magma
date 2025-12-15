"use client";

import type React from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SimpleSidebar as Sidebar } from "@/components/sidebar";
import { useAuth } from "@/context/AuthContext";

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
  pageTitle?: string; // Make pageTitle optional
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If not authenticated, redirect to login
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  // Don't render the layout if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <Sidebar>
      <div className="flex flex-col min-h-screen">
        {/* Header element removed */}
        <div className="flex-1 bg-muted/30 overflow-auto">{children}</div>
      </div>
    </Sidebar>
  );
}
