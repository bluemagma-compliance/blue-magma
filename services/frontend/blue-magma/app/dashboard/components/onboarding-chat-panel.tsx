"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import { updateOnboardStatus } from "../actions";

// Dynamically import ChatInterface to avoid SSR issues
const ChatInterface = dynamic(
  () => import("@/app/chat/components/ChatInterface"),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Loading chat...</p></div> }
);

interface OnboardingChatPanelProps {
  organizationId: string;
  isOnboarding: boolean;
  onClose?: () => void;
}

export function OnboardingChatPanel({ organizationId, isOnboarding, onClose }: OnboardingChatPanelProps) {
  const router = useRouter();
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);

  const handleCollapse = () => {
    // Just collapse the onboarding chat without changing onboard status
    onClose?.();
  };

  const handleSkipOnboarding = async () => {
    try {
      if (isOnboarding) {
        await updateOnboardStatus("completed");
      }
    } catch (error) {
      console.error("Failed to update onboard status on skip:", error);
    } finally {
      const target = chatSessionId
        ? `/scf?resume_session_id=${encodeURIComponent(chatSessionId)}`
        : "/scf";
      router.push(target);
      onClose?.();
    }
  };

  const handleRedirectToScf = async (sessionId: string) => {
    try {
      if (isOnboarding) {
        await updateOnboardStatus("completed");
      }
    } catch (error) {
      console.error("Failed to update onboard status on redirect:", error);
    } finally {
      // Keep the onboarding chat visible until we actually navigate to SCF.
      setTimeout(() => {
        router.push(`/scf?resume_session_id=${encodeURIComponent(sessionId)}`);
      }, 2000);
    }
  };

  return (
    <>
      {/* Full-screen overlay backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={handleCollapse}
      />

      {/* Full-screen chat panel */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full h-full max-w-4xl max-h-[90vh] bg-background rounded-lg shadow-2xl border border-border flex flex-col">
          {/* Header with close button */}
          <div className="flex items-center justify-end p-6 border-b border-border bg-muted/30 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleCollapse}
              title="Collapse"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Chat Content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ChatInterface
              organizationId={organizationId}
              serviceStatus={{ success: true }}
              entryPoint="onboarding"
              onSessionIdChange={setChatSessionId}
              onRedirectToScf={handleRedirectToScf}
            />
          </div>

          {/* Footer with skip button */}
          <div className="flex items-center justify-end p-6 border-t border-border bg-muted/30 flex-shrink-0">
            <Button
              onClick={handleSkipOnboarding}
              className="gap-2"
            >
              Skip onboarding
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

