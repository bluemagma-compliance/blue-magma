import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GitHub Integration - Blue Magma",
  description:
    "Connect your GitHub repositories for automated compliance scanning and monitoring.",
};

export default function GitHubIntegrationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
