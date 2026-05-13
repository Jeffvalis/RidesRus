import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",        // Generate static HTML/CSS/JS files
  basePath: "/RidesRus",   // Must match your GitHub repository name
  images: {
    unoptimized: true,     // Required for static export (no image server)
  },
};

export default nextConfig;
