"use client";

import Image from "next/image";
import type { ConnectionStatus } from "../services/websocket";

interface ChatHeaderProps {
  serviceStatus: {
    success: boolean;
    status?: string;
    services?: Record<string, string>;
  };
  connectionStatus?: ConnectionStatus;
  sessionId?: string | null;
}

export default function ChatHeader({
  serviceStatus,
  connectionStatus,
  sessionId,
}: ChatHeaderProps) {


  const getConnectionStatusColor = (status?: ConnectionStatus) => {
    switch (status) {
      case "connected":
        return "text-green-600";
      case "connecting":
        return "text-yellow-600";
      case "disconnected":
        return "text-gray-600";
      case "error":
        return "text-red-600";
      default:
        return "text-gray-400";
    }
  };

  const getConnectionStatusText = (status?: ConnectionStatus) => {
    switch (status) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting";
      case "disconnected":
        return "Disconnected";
      case "error":
        return "Error";
      default:
        return "Unknown";
    }
  };

  return (
    <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-border px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left side - Title and status */}
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 rounded-full overflow-hidden border-2 border-purple-500 dark:border-primary shadow-lg">
            <Image
              src="/logos/jpgs/neckbeard.jpg"
              alt="Magnus AI CISO"
              width={40}
              height={40}
              className="object-cover"
            />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900 dark:text-foreground">
              Magnus, AI CISO
              <span className="ml-2 text-xs font-normal text-muted-foreground">he&apos;s new be nice (loves dinosaurs)</span>
            </h1>
            <div className="flex items-center space-x-2 text-sm">
              {connectionStatus && (
                <span className={getConnectionStatusColor(connectionStatus)}>
                  {getConnectionStatusText(connectionStatus)}
                </span>
              )}
              {sessionId && (
                <span className="text-gray-400 text-xs">
                  • Session: {sessionId.substring(0, 8)}...
                </span>
              )}
            </div>
          </div>
        </div>


      </div>
    </div>
  );
}
