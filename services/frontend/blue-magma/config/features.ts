// Feature flags configuration
// This allows us to enable/disable features without removing code

export interface FeatureFlags {
  // Core features
  codebases: boolean;
  rules: boolean;
  users: boolean;
  dashboard: boolean;

  // UI features
  onboardingGuide: boolean;

  // Advanced features
  deployments: boolean;
  integrations: boolean;

  // Experimental features
  aiAssistant: boolean;
  customReports: boolean;
  apiAccess: boolean;

  realTimeUpdates: boolean;
  advancedAnalytics: boolean;
  chatWithCodebase: boolean;
}

// Default feature flags - modify these to enable/disable features
const defaultFeatures: FeatureFlags = {
  // Core features (always enabled for demo)
  codebases: true,
  rules: true,
  users: true,
  dashboard: true,

  // UI features
  onboardingGuide: false,

  // Advanced features
  deployments: false, // 🚫 DISABLED FOR DEMO
  integrations: false,

  // Experimental features
  aiAssistant: false,
  customReports: false,
  apiAccess: false,

  realTimeUpdates: false,
  advancedAnalytics: false,
  chatWithCodebase: false,
};

// Environment-specific overrides
const environmentOverrides: Partial<Record<string, Partial<FeatureFlags>>> = {
  development: {
    deployments: false,
    onboardingGuide: false, // 🚫 DISABLED FOR DEV
  },
  staging: {
    deployments: true,
    onboardingGuide: false,
  },
  production: {
    // Use defaults (deployments disabled, onboardingGuide enabled)
  },
};

// Get current environment
function getCurrentEnvironment(): string {
  return process.env.NODE_ENV || "development";
}

// Merge default features with environment overrides
function getFeatureFlags(): FeatureFlags {
  const env = getCurrentEnvironment();
  const overrides = environmentOverrides[env] || {};

  return {
    ...defaultFeatures,
    ...overrides,
  };
}

// Lazy-loaded feature flags to avoid SSR issues
let _features: FeatureFlags | null = null;

function getFeatures(): FeatureFlags {
  if (!_features) {
    _features = getFeatureFlags();
  }
  return _features;
}

// Export the feature flags getter
export const features = getFeatures();

// Helper functions for checking features
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return getFeatures()[feature];
}

export function requireFeature(feature: keyof FeatureFlags): void {
  if (!isFeatureEnabled(feature)) {
    throw new Error(`Feature '${feature}' is not enabled`);
  }
}

// Note: React-specific functions are in components/feature-gate.tsx

// Debug helper to see all feature flags (development only)
export function getFeatureFlagsDebug(): FeatureFlags | null {
  if (process.env.NODE_ENV === "development") {
    return features;
  }
  return null;
}
