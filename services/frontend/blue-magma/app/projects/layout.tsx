import type { ReactNode } from "react";
import { SimpleSidebar } from "@/components/sidebar";

export default function ProjectsLayout({ children }: { children: ReactNode }) {
  return <SimpleSidebar>{children}</SimpleSidebar>;
}

