import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  allowedDevOrigins: ["books.bezrabotnyi.com"],

  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;