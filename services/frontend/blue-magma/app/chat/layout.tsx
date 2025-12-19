import { Metadata } from "next";
import { AuthenticatedLayout } from "@/components/authenticated-layout";

export const metadata: Metadata = {
  title: "AI Chat Assistant | Blue Magma",
  description: "Chat with our AI assistant for codebase analysis, security reviews, and compliance insights.",
};

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthenticatedLayout>
      {children}
    </AuthenticatedLayout>
  );
}
