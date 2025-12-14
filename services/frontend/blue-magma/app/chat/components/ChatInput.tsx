"use client";

import React, { useState, useRef, useEffect } from "react";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isConnected?: boolean;
  placeholder?: string;
  suggestedQuestions?: string[];
}

export default function ChatInput({
  onSendMessage,
  isLoading,
  isConnected = true,
  placeholder = "Type your message...",
  suggestedQuestions,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  // Refocus textarea after message is sent (when loading changes from true to false)
  useEffect(() => {
    if (!isLoading && isConnected && textareaRef.current) {
      // Small delay to ensure the DOM has updated
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isLoading, isConnected]);

  // Initial focus when component mounts and is connected
  useEffect(() => {
    if (isConnected && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isConnected]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading && isConnected) {
      onSendMessage(message);
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const defaultSuggestedQuestions = [
    "What security vulnerabilities should I look for?",
    "Analyze the architecture of this codebase",
    "Check for compliance with security standards",
    "What are the main code quality issues?",
  ];

  return (
    <div className="border-t border-gray-200 dark:border-border bg-white dark:bg-card px-4 py-3">
      {/* Suggested questions (show when input is empty) - more compact */}
      {!message && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 dark:text-muted-foreground mb-1.5">💡 Try asking:</div>
          <div className="flex flex-wrap gap-1.5">
            {(suggestedQuestions ?? defaultSuggestedQuestions).slice(0, 3).map((question, index) => (
              <button
                key={index}
                onClick={() => setMessage(question)}
                className="text-xs px-2 py-1 bg-gray-50 dark:bg-muted hover:bg-gray-100 dark:hover:bg-muted/80 rounded text-gray-600 dark:text-muted-foreground transition-colors"
                disabled={isLoading}
              >
                {question.length > 30 ? question.substring(0, 30) + '...' : question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex items-end space-x-3">
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isConnected ? placeholder : "Connecting to chat service..."}
            disabled={isLoading || !isConnected}
            rows={1}
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-input text-gray-900 dark:text-foreground placeholder:text-gray-500 dark:placeholder:text-muted-foreground focus:ring-2 focus:ring-blue-500 dark:focus:ring-primary focus:border-transparent resize-none max-h-32 disabled:bg-gray-50 dark:disabled:bg-muted disabled:text-gray-500 dark:disabled:text-muted-foreground"
          />
        </div>
        
        <button
          type="submit"
          disabled={!message.trim() || isLoading || !isConnected}
          className="inline-flex items-center px-3 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Sending...
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
              Send
            </>
          )}
        </button>
      </form>

      {/* Hint text - more compact */}
      <div className="mt-1.5 text-xs text-gray-400">
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  );
}
