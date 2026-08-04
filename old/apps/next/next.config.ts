import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@venture/domain"],
  serverExternalPackages: ["node:sqlite"],
  poweredByHeader: false,
};

export default nextConfig;
