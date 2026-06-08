import type { NextConfig } from "next";

const s3Hostname = process.env.S3_PUBLIC_URL
  ? new URL(process.env.S3_PUBLIC_URL).hostname
  : null;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: s3Hostname
      ? [{ protocol: "https", hostname: s3Hostname }]
      : [],
  },
};

export default nextConfig;
