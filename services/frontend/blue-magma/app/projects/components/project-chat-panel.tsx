"use client";

import { useState } from "react";
import { ChevronRight, ChevronLeft, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import dynamic from "next/dynamic";
import Image from "next/image";
import type { UiAction } from "@/app/chat/services/websocket";


// Dynamically import ChatInterface to avoid SSR issues
const ChatInterface = dynamic(
  () => import("@/app/chat/components/ChatInterface"),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Loading chat...</p></div> }
);

interface ProjectChatPanelProps {
  projectId: string;
  projectName: string;
  onUpdateEvent?: (updateType?: string, uiActions?: UiAction[]) => void;
  onAuditorUpdate?: (updateType?: string, uiActions?: UiAction[]) => void;
  onAgentUpdate?: (updateType?: string, uiActions?: UiAction[]) => void;
  onRegisterFrontendEventSender?: (sender: (eventName: string, payload: Record<string, unknown>) => void) => void;
  disableProjectId?: boolean;
  entryPoint?: string;
  resumeSessionId?: string;
  initiallyOpen?: boolean;
  suggestedQuestions?: string[];
}

export function ProjectChatPanel({
  projectId,
  projectName,
  onUpdateEvent,
  onAuditorUpdate,
  onAgentUpdate,
  onRegisterFrontendEventSender,
  disableProjectId,
  entryPoint,
  resumeSessionId,
  initiallyOpen,
  suggestedQuestions,
}: ProjectChatPanelProps) {
  const [isOpen, setIsOpen] = useState(initiallyOpen ?? false);

  // Wrapper function that calls the appropriate callback based on update type
  const handleUpdateEvent = (updateType?: string, uiActions?: UiAction[]) => {
    console.log("🔄 [ProjectChatPanel] Update event triggered, updateType:", updateType, "uiActions:", uiActions);

    if (updateType === "documentation_template") {
      console.log("🔄 [ProjectChatPanel] Refreshing documentation template");
      if (onUpdateEvent) {
        onUpdateEvent(updateType, uiActions);
      }
    } else if (updateType === "auditors") {
      console.log("🔄 [ProjectChatPanel] Refreshing auditors");
      if (onAuditorUpdate) {
        onAuditorUpdate(updateType, uiActions);
      }
    } else if (updateType === "agents") {
      console.log("🔄 [ProjectChatPanel] Refreshing agents");
      if (onAgentUpdate) {
        onAgentUpdate(updateType, uiActions);
      }
    } else {
      console.log("🔄 [ProjectChatPanel] Unknown update type, refreshing all");
      if (onUpdateEvent) {
        onUpdateEvent(updateType, uiActions);
      }
      if (onAuditorUpdate) {
        onAuditorUpdate(updateType, uiActions);
      }
      if (onAgentUpdate) {
        onAgentUpdate(updateType, uiActions);
      }
    }
  };

  return (
    <>
      {/* Chat Panel - Floating with gaps and rounded edges */}
      <div
        className={`fixed bg-background border border-border shadow-2xl transition-all duration-300 flex flex-col rounded-2xl ${
          isOpen ? "w-[500px] opacity-100" : "w-0 opacity-0 pointer-events-none"
        }`}
        style={{
          top: '12px',
          right: '12px',
          bottom: '24px',
          height: 'calc(100vh - 36px)',
          zIndex: 50,
          marginTop: 0
        }}
      >
        {/* Keep ChatInterface mounted but hidden to maintain WebSocket connection */}
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b border-border bg-muted/50 flex-shrink-0 rounded-t-2xl ${isOpen ? '' : 'hidden'}`}>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            <span className="font-semibold text-sm">AI Assistant</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Chat Content - Always mounted to keep WebSocket alive */}
        <div
          className="flex-1 min-h-0 overflow-hidden rounded-b-2xl"
          style={{
            visibility: isOpen ? 'visible' : 'hidden'
          }}
        >
          <ChatInterface
            organizationId={projectId}
            serviceStatus={{ success: true }}
            onUpdateEvent={handleUpdateEvent}
            onRegisterFrontendEventSender={onRegisterFrontendEventSender}
            disableProjectId={disableProjectId}
            entryPoint={entryPoint}
            resumeSessionId={resumeSessionId}
            suggestedQuestions={suggestedQuestions}
          />
        </div>
      </div>

      {/* Toggle Button - Floating on the right */}
      {!isOpen && (
        <div className="fixed right-6 bottom-6 z-40 rounded-full p-[2px] bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 shadow-2xl hover:shadow-2xl transition-transform hover:scale-110 w-[68px] h-[68px] grid place-items-center">
          <Button
            className="rounded-full h-16 w-16 p-0 overflow-hidden bg-transparent ring-0 focus:ring-0 focus-visible:ring-0"
            onClick={() => setIsOpen(true)}
            title="Open AI Chat"
            aria-label="Open AI Chat"
          >
            <Image src="/logos/jpgs/neckbeard.jpg" alt="Open AI Chat" width={64} height={64} className="w-16 h-16 rounded-full object-cover block" />
          </Button>
        </div>
      )}

      {/* No overlay - chat panel is transparent to clicks */}
    </>
  );
}

