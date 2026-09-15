import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    serverActions: {
      // Vercel Functions reject request bodies over 4.5 MB. Keep enough room
      // for the multipart form fields that accompany a 4 MB photo.
      bodySizeLimit: "4.25mb",
    },
  },
};

export default nextConfig;
