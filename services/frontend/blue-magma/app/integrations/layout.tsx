import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Integrations - Blue Magma",
  description:
    "Connect your development tools and services to streamline your compliance workflow.",
};

export default function IntegrationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
