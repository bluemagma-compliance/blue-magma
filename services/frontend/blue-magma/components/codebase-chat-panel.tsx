"use client";

import { useState, type FormEvent, useRef, useEffect } from "react";
	import { Button } from "@/components/ui/button";
	import { Card } from "@/components/ui/card";
	import { Input } from "@/components/ui/input";
	import { ScrollArea } from "@/components/ui/scroll-area";
	import { Send, User, Bot } from "lucide-react";
	import { cn, maskProfanity } from "@/lib/utils";

type ChatMessage = {
  id: string;
  text: string;
  sender: "user" | "ai";
};

interface CodebaseChatPanelProps {
  codebaseName: string;
}

export function CodebaseChatPanel({ codebaseName }: CodebaseChatPanelProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "ai-init",
      text: `Ready to answer questions about ${codebaseName}.`,
      sender: "ai",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
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

    // Simulate AI response
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const aiResponse: ChatMessage = {
      id: Date.now().toString() + "-ai",
      text: `Simulated answer about ${codebaseName} regarding: "${messageText}"`,
      sender: "ai",
    };
    setMessages((prev) => [...prev, aiResponse]);
    setIsLoading(false);
  };

  useEffect(() => {
    // Scroll to bottom when new messages are added or loading state changes
    scrollToBottom();
  }, [messages, isLoading]);

  return (
    <Card className="flex h-full flex-col">
      {/* Compact header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-sm">Chat with {codebaseName}</h3>
        </div>
      </div>

      {/* Messages area - takes up most space */}
      <div className="flex-1 overflow-hidden p-4">
        <ScrollArea className="h-full pr-4 -mr-4" ref={scrollAreaRef}>
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex items-start gap-2",
                  message.sender === "user" ? "justify-end" : "justify-start",
                )}
              >
                {message.sender === "ai" && (
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Bot className="h-3.5 w-3.5" />
                  </span>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm",
                    message.sender === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
				                >
				                  {maskProfanity(message.text)}
                </div>
                {message.sender === "user" && (
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex items-start gap-2 justify-start">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Bot className="h-3.5 w-3.5" />
                </span>
                <div className="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-foreground shadow-sm">
                  <span className="animate-pulse">AI is thinking...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Compact input area - always visible at bottom */}
      <div className="border-t p-3">
        <form
          onSubmit={handleSubmit}
          className="flex w-full items-center space-x-2"
        >
          <Input
            type="text"
            placeholder="Ask a question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 h-9"
          />
          <Button type="submit" size="sm" disabled={!input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
}
