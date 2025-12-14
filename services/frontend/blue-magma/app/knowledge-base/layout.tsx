"use client";

import { AuthenticatedLayout } from "@/components/authenticated-layout";

export default function KnowledgeBaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}
