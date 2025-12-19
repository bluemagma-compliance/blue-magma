import type { ReactNode } from "react";
import { SimpleSidebar } from "@/components/sidebar"; // Import the sidebar

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <SimpleSidebar>
      {" "}
      {/* Wrap children with SimpleSidebar */}
      <div className="container mx-auto py-8 px-4 md:px-6 lg:px-8">
        {" "}
        {/* Added lg:px-8 for a bit more padding on large screens */}
        {children}
      </div>
    </SimpleSidebar>
  );
}
