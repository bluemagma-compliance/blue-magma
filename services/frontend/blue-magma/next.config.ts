import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Enable experimental features for better development experience
	experimental: {
		// Enable turbopack for faster builds (already enabled in package.json dev script)
		turbo: {
			// Configure turbopack for better hot reloading
			rules: {
				"*.svg": {
					loaders: ["@svgr/webpack"],
					as: "*.js",
				},
			},
		},
		// Allow larger payloads for Server Actions (needed for SCF config export)
		serverActions: {
			bodySizeLimit: "10mb",
		},
	},

  // Strip non-critical console statements from client bundles in production
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },

  // Configure webpack for better hot reloading in Docker
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Enable polling for file changes in Docker environments
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },

};

export default nextConfig;
