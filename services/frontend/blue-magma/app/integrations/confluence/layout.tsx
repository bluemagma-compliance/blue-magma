import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Confluence Integration - Blue Magma",
  description:
    "Connect your Confluence workspace for automated documentation scanning and compliance tracking.",
};

export default function ConfluenceIntegrationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

