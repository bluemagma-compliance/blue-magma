"use client";

import { ChevronLeft } from "lucide-react";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";

export const BackButton = (props: { className?: string; label?: string }) => {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      className={props.className}
      onClick={() => router.back()}
    >
      <ChevronLeft className="h-4 w-4 mr-1" />
      {props.label || "Back"}
    </Button>
  );
};
