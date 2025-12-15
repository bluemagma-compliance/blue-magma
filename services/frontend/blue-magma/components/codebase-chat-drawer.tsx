"use client";

import { useState, type FormEvent, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import Image from "next/image";

	import {
	  Send,
	  User,
	  Bot,
	  MessageCircle,
	  ChevronRight,
	  ArrowLeft,
	  Loader2,
	} from "lucide-react";
	import { cn, maskProfanity } from "@/lib/utils";
import type { Codebase } from "@/types/api";
import { askSeekerAgent } from "@/app/codebases/[codebaseid]/actions";
import { isFeatureEnabled } from "@/config/features";

type ChatMessage = {
  id: string;
  text: string;
  sender: "user" | "ai";
};

interface CodebaseChatDrawerProps {
  codebaseName: string;
  codebase?: Codebase;
}

export function CodebaseChatDrawer({
  codebaseName,
  codebase,
}: CodebaseChatDrawerProps) {
  const [input, setInput] = useState("");

  // Create initial message based on codebase availability
  const getInitialMessage = () => {
    if (!codebase?.versions?.length) {
      return `Hi! I'd love to help you with ${codebaseName}, but I need a codebase version to analyze first. Please make sure your codebase has been scanned.`;
    }
    return `Ready to answer questions about ${codebaseName}. I can help you understand the code structure, find specific functions, explain patterns, and more!`;
  };

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "ai-init", text: getInitialMessage(), sender: "ai" },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: "smooth",
        });
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: input,
      sender: "user",
    };
    const messageText = input.trim();

    // Add user message and clear input
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // Scroll to bottom immediately after user message
    setTimeout(scrollToBottom, 50);

    setIsLoading(true);

    try {
      // Get the latest codebase version ID
      const latestVersion = codebase?.versions?.[0];
      if (!latestVersion?.object_id) {
        throw new Error("No codebase version available");
      }

      // Call the seeker agent API
      const result = await askSeekerAgent(latestVersion.object_id, messageText);

      let responseText: string;
      if ("error" in result) {
        responseText = `Sorry, I encountered an error: ${result.error}`;
      } else {
        responseText = result.answer;
      }

      const aiResponse: ChatMessage = {
        id: Date.now().toString() + "-ai",
        text: responseText,
        sender: "ai",
      };
      setMessages((prev) => [...prev, aiResponse]);
    } catch (error) {
      console.error("Error in chat:", error);
      const errorResponse: ChatMessage = {
        id: Date.now().toString() + "-ai",
        text: "Sorry, I'm having trouble connecting to the AI service right now. Please try again later.",
        sender: "ai",
      };
      setMessages((prev) => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Scroll to bottom when new messages are added or loading state changes
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isLoading, isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen]);

  return (
    <>
      {isFeatureEnabled("chatWithCodebase") && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "transition-all duration-200",
            isOpen && "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          <MessageCircle className="mr-2 h-4 w-4" />
          {isOpen ? "Chat Open" : "Chat with Codebase"}
        </Button>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Custom drawer */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full bg-background border-l shadow-xl transition-all duration-300 ease-in-out z-40 flex flex-col",
          isOpen
            ? "w-full sm:w-[400px] md:w-[500px] translate-x-0"
            : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-6 w-6 items-center justify-center">
              <Image
                src="/logos/pngs/25 Orange Icon.png"
                alt="AI"
                width={24}
                height={24}
                className="rounded-sm"
              />
            </div>
            <div>
              <h3 className="font-semibold">Chat with your Codebase</h3>
              <p className="text-sm text-muted-foreground">{codebaseName}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 px-3 py-2 h-auto hover:bg-muted/50 transition-colors"
            title="Close chat"
          >
            <span className="text-sm font-medium">Close</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-hidden p-6">
          <ScrollArea className="h-full pr-4 -mr-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex items-start gap-3",
                    message.sender === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  {message.sender === "ai" && (
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white border border-gray-200">
                      <Image
                        src="/logos/pngs/25 Orange Icon.png"
                        alt="AI"
                        width={20}
                        height={20}
                        className="rounded-sm"
                      />
                    </span>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-4 py-3 text-sm shadow-sm",
                      message.sender === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                    )}
				                  >
				                    {maskProfanity(message.text)}
                  </div>
                  {message.sender === "user" && (
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </span>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex items-start gap-3 justify-start">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white border border-gray-200">
                    <Image
                      src="/logos/pngs/25 Orange Icon.png"
                      alt="AI"
                      width={20}
                      height={20}
                      className="rounded-sm"
                    />
                  </span>
                  <div className="max-w-[80%] rounded-lg bg-muted px-4 py-3 text-sm text-foreground shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"></div>
                        <div
                          className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"
                          style={{ animationDelay: "0.1s" }}
                        ></div>
                        <div
                          className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"
                          style={{ animationDelay: "0.2s" }}
                        ></div>
                      </div>
                      <span>AI is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Input area */}
        <div className="border-t p-6">
          <form
            onSubmit={handleSubmit}
            className="flex w-full items-center space-x-3"
          >
            <Input
              type="text"
              placeholder={
                !codebase?.versions?.length
                  ? "Codebase needs to be scanned first..."
                  : "Ask a question about your codebase..."
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1"
              autoFocus
              disabled={!codebase?.versions?.length}
            />
            <Button
              type="submit"
              disabled={
                !input.trim() || isLoading || !codebase?.versions?.length
              }
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
