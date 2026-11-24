import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    // 로그인이 없으므로(D-26) 첫 화면은 바로 My Show
    return [{ source: "/", destination: "/shows", permanent: false }];
  },
};

export default nextConfig;
