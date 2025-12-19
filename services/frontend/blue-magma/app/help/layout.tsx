import type { ReactNode } from "react";
import { SimpleSidebar } from "@/components/sidebar";

export default function HelpLayout({ children }: { children: ReactNode }) {
  return <SimpleSidebar>{children}</SimpleSidebar>;
}

