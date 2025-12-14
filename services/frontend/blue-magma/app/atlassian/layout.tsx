import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Atlassian Integration - Blue Magma",
  description: "Atlassian OAuth callback and integration handling.",
};

export default function AtlassianLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

