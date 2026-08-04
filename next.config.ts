import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@venture/domain"],
  serverExternalPackages: ["mysql2", "nodemailer"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
