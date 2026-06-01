import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@dolphin-id/adapter-evm",
    "@dolphin-id/adapter-sui",
    "@dolphin-id/core",
    "@dolphin-id/react",
    "@dolphin-id/server",
    "@dolphin-id/ui"
  ]
};

export default nextConfig;
