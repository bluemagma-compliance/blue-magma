"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getCurrentPlan } from "@/app/billing/actions";

interface UseFreePlanState {
  isFreePlan: boolean;
  plan: string | null;
  loading: boolean;
  error: string | null;
}

// Minimal hook to expose whether the current org is on the free plan.
// "Free" is treated as:
// - current_plan === "free" (case-insensitive), OR
// - current_plan is null/empty (backend default)
// Any other value is treated as a paid plan so we never accidentally
// block paying customers if there is an error.
export function useIsFreePlan(): UseFreePlanState {
  const { isAuthenticated, organizationId } = useAuth();

  const [isFreePlan, setIsFreePlan] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPlan = async () => {
      // If we are not authenticated or don't have an org yet, assume not free
      // to avoid gating access incorrectly.
      if (!isAuthenticated || !organizationId) {
        setIsFreePlan(false);
        setPlan(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const currentPlan = await getCurrentPlan();
        setPlan(currentPlan);

        const normalized = currentPlan?.toLowerCase().trim();
        const isFree = !normalized || normalized === "free";

        setIsFreePlan(isFree);
        setError(null);
      } catch (err) {
        console.error("Error fetching current plan:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch current plan",
        );
        // Fail-safe: if we can't determine the plan, treat as paid so we
        // don't accidentally lock out paying users.
        setIsFreePlan(false);
      } finally {
        setLoading(false);
      }
    };

    loadPlan();
  }, [isAuthenticated, organizationId]);

  return {
    isFreePlan,
    plan,
    loading,
    error,
  };
}

