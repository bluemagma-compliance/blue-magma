"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { maskProfanity } from "@/lib/utils";

interface ChatMessage {
  id: string;
  type: "user" | "assistant" | "system" | "thought";
  content: string;
  timestamp: Date;
  intermediateSteps?: string[];
  thought?: {
    content: string;
    node?: string;
    phase?: string;
    category?: string;
    timestamp?: string;
  };
}

interface MessageGroup {
  id: string;
  type: "message" | "thought-group";
  message?: ChatMessage;
  thoughts?: ChatMessage[];
}

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

export default function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const processedGroupsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Group messages and thoughts together
  const groupMessages = (messages: ChatMessage[]): MessageGroup[] => {
    const groups: MessageGroup[] = [];
    let currentThoughts: ChatMessage[] = [];

    for (const message of messages) {
      if (message.type === "thought") {
        currentThoughts.push(message);
      } else {
        // If we have accumulated thoughts, create a thought group
        if (currentThoughts.length > 0) {
          groups.push({
            id: `thought-group-${groups.length}`,
            type: "thought-group",
            thoughts: [...currentThoughts]
          });
          currentThoughts = [];
        }

        // Add the regular message
        groups.push({
          id: message.id,
          type: "message",
          message: message
        });
      }
    }

    // Handle any remaining thoughts at the end
    if (currentThoughts.length > 0) {
      groups.push({
        id: `thought-group-${groups.length}`,
        type: "thought-group",
        thoughts: [...currentThoughts]
      });
    }

    return groups;
  };

  const toggleGroup = (groupId: string) => {
    const newCollapsed = new Set(collapsedGroups);
    if (newCollapsed.has(groupId)) {
      newCollapsed.delete(groupId);
    } else {
      newCollapsed.add(groupId);
    }
    setCollapsedGroups(newCollapsed);
  };

  // Simple markdown renderer for basic formatting
  const renderMarkdown = (text: string) => {
    // Convert **bold** to <strong>
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Convert *italic* to <em>
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Convert `code` to <code>
    text = text.replace(/`(.*?)`/g, '<code class="bg-gray-200 px-1 rounded text-sm">$1</code>');

    // Convert ### headers to <h3>
    text = text.replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>');

    // Convert ## headers to <h2>
    text = text.replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>');

    // Convert # headers to <h1>
    text = text.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>');

    // Convert line breaks to <br>
    text = text.replace(/\n/g, '<br>');

    return text;
  };

  const renderThought = (message: ChatMessage) => {
    return (
      <div className="flex justify-start mb-1">
        <div className="max-w-2xl px-3 py-2 rounded-lg bg-gray-50 dark:bg-muted border-l-3 border-gray-300 dark:border-border text-gray-600 dark:text-muted-foreground text-sm italic opacity-80">
          <div className="flex items-center space-x-2">
            <span>💭</span>
						<span>{maskProfanity(message.content)}</span>
            {message.thought?.category && (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                message.thought.category === 'routing' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                message.thought.category === 'workflow' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                message.thought.category === 'llm' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' :
                message.thought.category === 'data' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                message.thought.category === 'error' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 dark:bg-gray-800/30 text-gray-700 dark:text-gray-300'
              }`}>
                {message.thought.category}
              </span>
            )}
          </div>
          {message.thought?.node && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
							{maskProfanity(message.thought.node)}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.type === "user";
    const isSystem = message.type === "system";
		const maskedContent = maskProfanity(message.content);

    return (
      <div
        key={message.id}
        className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
      >
        <div
          className={`max-w-3xl px-4 py-3 rounded-lg ${
            isUser
              ? "bg-blue-600 dark:bg-primary text-white dark:text-primary-foreground"
              : isSystem
              ? "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200"
              : "bg-gray-100 dark:bg-card text-gray-900 dark:text-foreground"
          }`}
        >
          {/* Message content with markdown rendering */}
          <div
            className="break-words"
            dangerouslySetInnerHTML={{
							__html: isUser ? maskedContent : renderMarkdown(maskedContent)
            }}
          />

          {/* Intermediate steps for assistant messages */}
          {message.intermediateSteps && message.intermediateSteps.length > 0 && (
            <details className="mt-3 text-sm opacity-75">
              <summary className="cursor-pointer hover:opacity-100">
                🔍 Show reasoning steps ({message.intermediateSteps.length})
              </summary>
              <div className="mt-2 pl-4 border-l-2 border-gray-300 dark:border-border">
                {message.intermediateSteps.map((step, index) => (
                  <div key={index} className="mb-2 text-xs">
									<span className="font-medium">Step {index + 1}:</span> {maskProfanity(step)}
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Timestamp */}
          <div
            className={`text-xs mt-2 ${
              isUser ? "text-blue-200 dark:text-primary-foreground/70" : "text-gray-500 dark:text-muted-foreground"
            }`}
          >
            {formatTime(message.timestamp)}
          </div>
        </div>
      </div>
    );
  };

  const renderGroup = (group: MessageGroup) => {
    if (group.type === "message" && group.message) {
      return renderMessage(group.message);
    }

    if (group.type === "thought-group" && group.thoughts) {
      // Auto-collapse new thought groups by default
      if (!processedGroupsRef.current.has(group.id)) {
        processedGroupsRef.current.add(group.id);
        setCollapsedGroups(prev => new Set([...prev, group.id]));
      }

      const isCollapsed = collapsedGroups.has(group.id);
      const thoughtCount = group.thoughts.length;

      return (
        <div key={group.id} className="mb-2">
          {/* Collapsible header */}
          <button
            onClick={() => toggleGroup(group.id)}
            className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-1 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-muted transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            <span>
              {isCollapsed ? `Show ${thoughtCount} thoughts` : `Hide ${thoughtCount} thoughts`}
            </span>
          </button>

          {/* Thoughts content */}
          {!isCollapsed && (
            <div className="space-y-1">
              {group.thoughts.map((thought) => (
                <div key={thought.id}>
                  {renderThought(thought)}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  const messageGroups = groupMessages(messages);

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <div className="space-y-2">
        {messageGroups.map(renderGroup)}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="max-w-3xl px-4 py-3 rounded-lg bg-gray-100 dark:bg-card">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-sm text-gray-600 dark:text-muted-foreground">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
