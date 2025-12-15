"use client";

import { useEffect, useState } from "react";
import { Zap, FileText, Lock, Database } from "lucide-react";

export function InitializingAnimation() {
  const [stage, setStage] = useState(0);

  const stages = [
    { icon: FileText, label: "Building documentation..." },
    { icon: Lock, label: "Configuring policies..." },
    { icon: Database, label: "Setting up data sources..." },
    { icon: Zap, label: "Initializing AI agents..." },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStage((prev) => (prev + 1) % stages.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [stages.length]);

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      {/* Animated workers container - looping animation */}
      <div className="mb-8 flex items-center justify-center gap-4">
        {stages.map((s, index) => {
          const Icon = s.icon;
          const isActive = index === stage;

          return (
            <div
              key={index}
              className={`transition-all duration-500 ${
                isActive
                  ? "scale-125 text-primary"
                  : "scale-100 text-muted-foreground opacity-40"
              }`}
            >
              <div
                className={`${
                  isActive ? "animate-bounce" : ""
                }`}
              >
                <Icon className="h-8 w-8" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Main message */}
      <h3 className="text-lg font-semibold mb-2 text-center">
        We&apos;re building your documentation! 🚀
      </h3>

      {/* Current stage - looping */}
      <p className="text-sm text-muted-foreground text-center mb-6 h-5">
        {stages[stage].label}
      </p>

      {/* Cute message */}
      <p className="text-xs text-muted-foreground text-center">
        This usually takes a few moments. Grab a coffee! ☕
      </p>
    </div>
  );
}

