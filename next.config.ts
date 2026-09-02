import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Knowledge uploads accept files up to 2 MB; Next's default limit is 1 MB.
      bodySizeLimit: "3mb",
    },
  },
  poweredByHeader: false,
};

export default nextConfig;
