"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { UserManagementContent } from "@/components/user-management-content";

interface UserManagementModalProps {
  children: React.ReactNode;
}

export function UserManagementModal({ children }: UserManagementModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[600px] md:max-w-[700px] lg:max-w-[800px]">
        <UserManagementContent onClose={() => setIsOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
