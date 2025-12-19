"use client";

import type React from "react";
import { usePathname } from "next/navigation";
import { AuthenticatedLayout } from "@/components/authenticated-layout";

export default function TrustLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isPublicTrustRoute = pathname?.startsWith("/trust/public");

  // For the public Trust Center page we intentionally do NOT wrap the
  // content in the authenticated app shell so there is no sidebar/nav
  // and no auth requirement.
  if (isPublicTrustRoute) {
    return <>{children}</>;
  }

  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}
