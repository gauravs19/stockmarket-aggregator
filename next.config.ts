import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Override webpack config to allow transformers.js to work client-side
  serverExternalPackages: ['sharp', 'onnxruntime-node'],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "sharp$": false,
      "onnxruntime-node$": false,
    }
    return config;
  }
};

export default nextConfig;
