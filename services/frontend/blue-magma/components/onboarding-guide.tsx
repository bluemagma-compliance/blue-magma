"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  FileText,
  CheckCircle,
  ArrowRight,
  Plus,
  Settings,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { AddCodebaseModal } from "@/components/add-codebase-modal";
import Link from "next/link";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  completed: boolean;
  action?: React.ReactNode;
}

interface OnboardingGuideProps {
  totalCodebases: number;
  totalReports: number;
  firstCodebaseId?: string;
}

export function OnboardingGuide({
  totalCodebases,
  totalReports,
  firstCodebaseId,
}: OnboardingGuideProps) {
  // State for collapsible and dismissible functionality
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const steps: OnboardingStep[] = [
    {
      id: "add-codebase",
      title: "Add Your First Codebase",
      description:
        "Connect your Git repository to start monitoring compliance and security",
      icon: Package,
      completed: totalCodebases > 0,
      action: (
        <AddCodebaseModal>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Codebase
          </Button>
        </AddCodebaseModal>
      ),
    },
    {
      id: "run-scan",
      title: "Run Your First Scan",
      description: "Generate compliance reports and identify potential issues",
      icon: FileText,
      completed: totalReports > 0,
      action:
        totalCodebases > 0 && firstCodebaseId ? (
          <Link href={`/codebases/${firstCodebaseId}`}>
            <Button size="sm" variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              View Codebase
            </Button>
          </Link>
        ) : undefined,
    },
    {
      id: "setup-report",
      title: "Setup a Report",
      description: "Configure automated reporting schedules for your codebases",
      icon: Settings,
      completed: false, // TODO: Update when report scheduling is implemented
      action:
        totalCodebases > 0 ? (
          <Button size="sm" variant="outline" disabled>
            <Settings className="mr-2 h-4 w-4" />
            Coming Soon
          </Button>
        ) : undefined,
    },
  ];

  const completedSteps = steps.filter((step) => step.completed).length;
  const progressPercentage = (completedSteps / steps.length) * 100;

  // Don't show onboarding if everything is complete or if dismissed
  if (completedSteps === steps.length || isDismissed) {
    return null;
  }

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg text-blue-900">
              Getting Started
            </CardTitle>
            <p className="text-sm text-blue-700 mt-1">
              Complete these steps to set up your compliance monitoring
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              {completedSteps}/{steps.length} Complete
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-100"
            >
              {isCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDismissed(true)}
              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Progress bar - only show when not collapsed */}
        {!isCollapsed && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-blue-600 mb-1">
              <span>Progress</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-in-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        )}
      </CardHeader>

      {/* Content - only show when not collapsed */}
      {!isCollapsed && (
        <CardContent className="space-y-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isNext =
              !step.completed &&
              steps.slice(0, index).every((s) => s.completed);

            return (
              <div
                key={step.id}
                className={`flex items-center space-x-4 p-3 rounded-lg border transition-all ${
                  step.completed
                    ? "bg-green-50 border-green-200"
                    : isNext
                      ? "bg-white border-blue-200 shadow-sm"
                      : "bg-gray-50 border-gray-200 opacity-75"
                }`}
              >
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    step.completed
                      ? "bg-green-100 text-green-600"
                      : isNext
                        ? "bg-blue-100 text-blue-600"
                        : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {step.completed ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h4
                    className={`font-medium ${
                      step.completed
                        ? "text-green-900"
                        : isNext
                          ? "text-gray-900"
                          : "text-gray-500"
                    }`}
                  >
                    {step.title}
                  </h4>
                  <p
                    className={`text-sm ${
                      step.completed
                        ? "text-green-700"
                        : isNext
                          ? "text-gray-600"
                          : "text-gray-400"
                    }`}
                  >
                    {step.description}
                  </p>
                </div>

                {!step.completed && step.action && isNext && (
                  <div className="flex-shrink-0">{step.action}</div>
                )}

                {step.completed && (
                  <div className="flex-shrink-0">
                    <Badge
                      variant="secondary"
                      className="bg-green-100 text-green-800"
                    >
                      Complete
                    </Badge>
                  </div>
                )}
              </div>
            );
          })}

          {completedSteps > 0 && completedSteps < steps.length && (
            <div className="mt-6 p-4 bg-blue-100 rounded-lg">
              <div className="flex items-center space-x-2 text-blue-800">
                <ArrowRight className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Great progress! Complete the remaining steps to unlock the
                  full potential of Blue Magma.
                </span>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
