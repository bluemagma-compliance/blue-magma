"use client";

import { isFeatureEnabled, type FeatureFlags } from "@/config/features";

interface FeatureGateProps {
  feature: keyof FeatureFlags;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * FeatureGate component for conditional rendering based on feature flags
 *
 * @example
 * <FeatureGate feature="deployments">
 *   <DeploymentComponent />
 * </FeatureGate>
 *
 * @example
 * <FeatureGate feature="deployments" fallback={<ComingSoonMessage />}>
 *   <DeploymentComponent />
 * </FeatureGate>
 */
export function FeatureGate({
  feature,
  children,
  fallback = null,
}: FeatureGateProps) {
  if (isFeatureEnabled(feature)) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
}

/**
 * Hook to check if a feature is enabled
 *
 * @example
 * const isDeploymentsEnabled = useFeatureFlag('deployments')
 */
export function useFeatureFlag(feature: keyof FeatureFlags): boolean {
  return isFeatureEnabled(feature);
}

/**
 * Higher-order component for feature gating
 *
 * @example
 * const DeploymentPage = withFeatureFlag('deployments')(DeploymentPageComponent)
 */
export function withFeatureFlag<P extends object>(feature: keyof FeatureFlags) {
  return function (Component: React.ComponentType<P>) {
    return function FeatureGatedComponent(props: P) {
      if (!isFeatureEnabled(feature)) {
        return (
          <div className="flex items-center justify-center min-h-[400px] p-4">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">
                Feature Not Available
              </h2>
              <p className="text-muted-foreground">
                This feature is currently disabled.
              </p>
            </div>
          </div>
        );
      }
      return <Component {...props} />;
    };
  };
}

/**
 * Component to show when a feature is coming soon
 */
export function ComingSoonBadge({ feature }: { feature: string }) {
  return (
    <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
      Coming Soon
    </span>
  );
}

/**
 * Component to show feature status in development
 */
export function FeatureDebugInfo() {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black text-white p-2 rounded text-xs opacity-50 hover:opacity-100 transition-opacity">
      <details>
        <summary className="cursor-pointer">Feature Flags</summary>
        <div className="mt-2 space-y-1">
          <div>
            Deployments: {isFeatureEnabled("deployments") ? "✅" : "❌"}
          </div>
          <div>
            Real-time: {isFeatureEnabled("realTimeUpdates") ? "✅" : "❌"}
          </div>
          <div>
            Analytics: {isFeatureEnabled("advancedAnalytics") ? "✅" : "❌"}
          </div>
        </div>
      </details>
    </div>
  );
}
