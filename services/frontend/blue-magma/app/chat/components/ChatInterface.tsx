"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import type { Codebase, CodebaseVersion } from "@/types/api";
import { getWebSocketConfig } from "../actions";
import { ChatWebSocketService, type ConnectionStatus, type ChatResponse, type UiAction } from "../services/websocket";
import ChatHeader from "./ChatHeader";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";


interface ChatMessage {
  id: string;
  type: "user" | "assistant" | "system" | "thought";
  content: string;
  timestamp: Date;
  thought?: {
    content: string;
    node?: string;
    phase?: string;
    category?: string;
    timestamp?: string;
  };
}

interface ChatInterfaceProps {
  organizationId: string;
  serviceStatus: {
    success: boolean;
    status?: string;
    services?: Record<string, string>;
  };
  onUpdateEvent?: (updateType?: string, uiActions?: UiAction[]) => void;
  onRegisterFrontendEventSender?: (sender: (eventName: string, payload: Record<string, unknown>) => void) => void;
  entryPoint?: string;
  disableProjectId?: boolean;
  resumeSessionId?: string;
  /** Notifies parent when the underlying chat session ID is known/changes. */
  onSessionIdChange?: (sessionId: string | null) => void;
  /** Allows parent (e.g. onboarding overlay) to own SCF redirects and side-effects like marking onboarding complete. */
  onRedirectToScf?: (sessionId: string) => void;
  /** Optional: Override the suggested questions displayed in the input area */
  suggestedQuestions?: string[];
}

export default function ChatInterface({
  organizationId,
  serviceStatus,
  onUpdateEvent,
  onRegisterFrontendEventSender,
  entryPoint,
  disableProjectId,
  resumeSessionId,
  onSessionIdChange,
  onRedirectToScf,
  suggestedQuestions,
}: ChatInterfaceProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // WebSocket connection state
  const [wsService, setWsService] = useState<ChatWebSocketService | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const isScfResumeSession = entryPoint === "scf_config" && !!resumeSessionId;

  // Refs to prevent double initialization in React StrictMode
  const wsServiceRef = useRef<ChatWebSocketService | null>(null);
  const isInitializingRef = useRef(false);
  const onUpdateEventRef = useRef(onUpdateEvent);

  const onRegisterFrontendEventSenderRef = useRef(onRegisterFrontendEventSender);
  const onRedirectToScfRef = useRef(onRedirectToScf);


  // Update the ref when onUpdateEvent changes
  useEffect(() => {
    onUpdateEventRef.current = onUpdateEvent;
  }, [onUpdateEvent]);
  // Update the ref when onRegisterFrontendEventSender changes
  useEffect(() => {
    onRegisterFrontendEventSenderRef.current = onRegisterFrontendEventSender;
  }, [onRegisterFrontendEventSender]);



	  const handleWebSocketMessage = useCallback((response: ChatResponse) => {
    // Compact, structured inbound log for debugging chat traffic
    console.log("📨 [ChatInterface] Received WebSocket response", {
      success: response.success,
      response: response.response,
      error: response.error,
      updateType: response.updateType,
      hasUiActions: !!response.uiActions && response.uiActions.length > 0,
      thought: response.thought ? {
        contentPreview: response.thought.content?.slice(0, 120),
        phase: response.thought.phase,
        category: response.thought.category,
      } : undefined,
      redirect: response.redirect,
    });

		    // Handle optional backfilled chat history (type: "history" ack)
		    if (response.history && response.history.length > 0) {
		      const now = Date.now();
		      const mappedHistory: ChatMessage[] = response.history.map((msg, idx) => {
		        const role = (msg.role || "").toLowerCase();
		        let type: ChatMessage["type"];
		        if (role === "user") type = "user";
		        else if (role === "assistant") type = "assistant";
		        else type = "system";

		        return {
		          id: `history_${idx}_${now}`,
		          type,
		          content: msg.content,
		          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
		        };
		      });

		      // Append history to any existing messages (e.g. connection banners).
		      // For SCF resume sessions we intentionally keep the loading indicator
		      // active after history backfill so the "AI is thinking..." message
		      // stays visible until the first new assistant response arrives.
		      setMessages((prev: ChatMessage[]) => [...prev, ...mappedHistory]);
		      if (!isScfResumeSession) {
		        setIsLoading(false);
		      }
		      return;
		    }
	  
    // Handle redirect events (e.g. redirect to SCF configurator)
    if (response.redirect) {
      const { destination, sessionId } = response.redirect;

      if (destination === "scf" && sessionId) {
        const redirectMessage: ChatMessage = {
          id: `system_redirect_${Date.now()}`,
          type: "system",
          content: "➡️ Redirecting you to the SCF Configurator...",
          timestamp: new Date(),
        };

        setMessages((prev: ChatMessage[]) => [...prev, redirectMessage]);

        // If a parent wants to own SCF redirects (e.g. onboarding overlay), delegate to it
        if (onRedirectToScfRef.current) {
          onRedirectToScfRef.current(sessionId);
        } else {
          // Fallback: perform the redirect here after a short delay
          setTimeout(() => {
            router.push(`/scf?resume_session_id=${encodeURIComponent(sessionId)}`);
          }, 2000);
        }
      }

      return;
    }

    // Handle thought messages
    if (response.thought) {
      const thoughtMessage: ChatMessage = {
        id: `thought_${Date.now()}_${Math.random()}`,
        type: "thought",
        content: response.thought.content,
        timestamp: new Date(),
        thought: response.thought,
      };

      setMessages((prev: ChatMessage[]) => [...prev, thoughtMessage]);
      return; // Don't set loading to false for thoughts
    }

    // Handle update signal - trigger refresh callback
    if (response.success && response.response === "__UPDATE_SIGNAL__") {
      console.log("🔄 [ChatInterface] Update signal", {
        updateType: response.updateType,
        uiActions: response.uiActions,
        hasOnUpdateEventHandler: !!onUpdateEventRef.current,
      });
      if (onUpdateEventRef.current) {
        onUpdateEventRef.current(response.updateType, response.uiActions);
      } else {
        console.warn("⚠️ [ChatInterface] No onUpdateEvent callback provided!");
      }
      return; // Don't add message to chat
    }

    // Handle regular assistant responses
    if (response.success && response.response) {
      const assistantMessage: ChatMessage = {
        id: `assistant_${Date.now()}`,
        type: "assistant",
        content: response.response,
        timestamp: new Date(),
      };

      setMessages((prev: ChatMessage[]) => [...prev, assistantMessage]);
    } else if (response.error) {
      // Handle error
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        type: "system",
        content: `❌ Sorry, I encountered an error: ${response.error}`,
        timestamp: new Date(),
      };

      setMessages((prev: ChatMessage[]) => [...prev, errorMessage]);
    }

    // Only set loading to false for non-thought messages
		  if (!response.thought) {
		      setIsLoading(false);
		    }
		  }, [router, isScfResumeSession]);

  const initializeWebSocket = useCallback(async () => {
    try {
      // Prevent double initialization
      if (isInitializingRef.current || wsServiceRef.current) {
        console.log("WebSocket already exists or initializing, skipping...");
        return;
      }

      isInitializingRef.current = true;
      console.log("🚀 Initializing WebSocket connection...");
      setIsLoading(true);

      // Get WebSocket configuration
      const configResult = await getWebSocketConfig();
      if (!configResult.success || !configResult.config) {
        throw new Error(configResult.error || "Failed to get WebSocket configuration");
      }

      // Add projectId, entryPoint and resumeSessionId to the config
      const configWithProject = {
        ...configResult.config,
        projectId: disableProjectId ? undefined : organizationId,
        entryPoint,
        resumeSessionId,
      };

      // Create WebSocket service
      const service = new ChatWebSocketService(configWithProject);

      // Set up message handler
      service.onMessage(handleWebSocketMessage);

      // Set up status handler
      service.onStatusChange((status: ConnectionStatus) => {
        console.log("WebSocket status changed:", status);
        setConnectionStatus(status);
      });

      // Connect
      await service.connect();

      // Store references
      wsServiceRef.current = service;
      setWsService(service);

    } catch (error) {
      console.error("Error initializing WebSocket:", error);
      setConnectionStatus("error");
      isInitializingRef.current = false;

      // Add error message
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        type: "system",
        content: `❌ Failed to connect to chat service. Please refresh the page and try again.

Error: ${error instanceof Error ? error.message : "Unknown connection error"}`,
        timestamp: new Date(),
      };
      setMessages([errorMessage]);
      // Always stop loading if initialization fails
      setIsLoading(false);
    } finally {
      // For SCF resume sessions, keep the loading indicator until the first assistant message arrives
      if (!isScfResumeSession) {
        setIsLoading(false);
      }
    }
  }, [handleWebSocketMessage, organizationId, entryPoint, disableProjectId, resumeSessionId, isScfResumeSession]);

  // Initialize WebSocket connection
  useEffect(() => {
    // Prevent double initialization in React StrictMode
    if (isInitializingRef.current || wsServiceRef.current) {
      console.log("WebSocket initialization already in progress or service exists, skipping...");
      return;
    }

    initializeWebSocket();

    // Cleanup on unmount
    return () => {
      if (wsServiceRef.current) {
        console.log("Cleaning up WebSocket connection...");
        wsServiceRef.current.disconnect();
        wsServiceRef.current = null;
        isInitializingRef.current = false;
      }
    };
  }, [initializeWebSocket]);

  // Handle connection status changes
  useEffect(() => {
    if (connectionStatus === "connected" && wsService) {
      const currentSessionId = wsService.getSessionId();
      setSessionId(currentSessionId);

      if (onSessionIdChange) {
        onSessionIdChange(currentSessionId);
      }

      // Expose a safe frontend_event sender to parent components (e.g. SCF page)
      if (onRegisterFrontendEventSenderRef.current) {
        onRegisterFrontendEventSenderRef.current((eventName, payload) => {
          console.log("📤 [ChatInterface] Sending frontend_event", {
            eventName,
            payload,
          });
          wsService
            .sendFrontendEvent(eventName, payload)
            .catch(error => {
              console.error("[ChatInterface] Failed to send frontend_event:", error);
            });
        });
      }
    }
  }, [connectionStatus, wsService, onSessionIdChange]);

  // Handle sending messages
  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading || connectionStatus !== "connected" || !wsService) {
      if (connectionStatus !== "connected") {
        const errorMessage: ChatMessage = {
          id: `error_${Date.now()}`,
          type: "system",
          content: "❌ Not connected to chat service. Please wait for connection or refresh the page.",
          timestamp: new Date(),
        };
        setMessages((prev: ChatMessage[]) => [...prev, errorMessage]);
      }
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      type: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev: ChatMessage[]) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      console.log("📤 [ChatInterface] Sending user message", {
        content: content.trim(),
      });
      // Send message via WebSocket
      await wsService.sendMessage(content.trim());
      // Response will be handled by handleWebSocketMessage
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        type: "system",
        content: "❌ Failed to send message. Please check your connection and try again.",
        timestamp: new Date(),
      };

      setMessages((prev: ChatMessage[]) => [...prev, errorMessage]);
      setIsLoading(false);
    }
  };





  // Compute default suggestions based on entry point if none provided by parent
  const computedSuggestions = useMemo(() => {
    if (suggestedQuestions && suggestedQuestions.length > 0) return suggestedQuestions;

    switch (entryPoint) {
      case "onboarding":
        return [
          "Give me a quick tour of the app",
          "Help me set up the SCF Configurator",
          "What can you do?",
        ];
      case "scf_config":
        return [
          resumeSessionId ? "Resume my last SCF session" : "Filter controls to SOC 2 and L1 core",
          "Show coverage gaps for ISO 27001",
          "Select all AI_OPS controls",
        ];
      default:
        return [
          "What security vulnerabilities should I look for?",
          "Analyze the architecture of this codebase",
          "Check for compliance with security standards",
        ];
    }
  }, [entryPoint, resumeSessionId, suggestedQuestions]);

  return (
    <div className="w-full h-full flex flex-col bg-gray-50 dark:bg-background">
      <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-background shadow-sm">
        {/* Header */}
        <div className="flex-shrink-0">
          <ChatHeader
            serviceStatus={serviceStatus}
            connectionStatus={connectionStatus}
            sessionId={sessionId}
          />
        </div>

        {/* Connection Status Banner */}
        {connectionStatus !== "connected" && (
          <div className={`px-6 py-2 text-sm font-medium flex-shrink-0 ${
            connectionStatus === "connecting"
              ? "bg-yellow-50 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-200 border-b border-yellow-200 dark:border-yellow-800"
              : connectionStatus === "error"
              ? "bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200 border-b border-red-200 dark:border-red-800"
              : "bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700"
          }`}>
            {connectionStatus === "connecting" && "Connecting..."}
            {connectionStatus === "error" && "Connection failed. Trying to reconnect..."}
            {connectionStatus === "disconnected" && "Disconnected from chat service"}
          </div>
        )}

        {/* Messages - Fixed height container with proper scrolling */}
        <div className="flex-1 min-h-0">
          <ChatMessages
            messages={messages}
            isLoading={isLoading}
          />
        </div>

        {/* Input */}
        <div className="flex-shrink-0">
          <ChatInput
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            isConnected={connectionStatus === "connected"}
            placeholder="Ask me anything..."
            suggestedQuestions={computedSuggestions}
          />
        </div>
      </div>
    </div>
  );
}
