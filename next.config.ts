import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Rewards was removed — send old links and bookmarks to the homepage.
  async redirects() {
    return [{ source: "/rewards", destination: "/", permanent: true }];
  },
};

export default nextConfig;
