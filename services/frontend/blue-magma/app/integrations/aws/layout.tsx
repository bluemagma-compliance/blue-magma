import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AWS Integration - Blue Magma",
  description:
    "Connect your AWS account to Blue Magma for streamlined compliance management.",
};

export default function AwsIntegrationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
