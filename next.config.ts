import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure committed specimen scans ship with serverless API routes on Vercel.
  outputFileTracingIncludes: {
    "/api/scans/[slug]": ["./scans/**/*"],
    "/api/scans/[slug]/image": ["./scans/**/*"],
    "/api/capture": ["./scans/**/*"],
  },
};

export default nextConfig;
