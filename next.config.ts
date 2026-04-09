import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@e2b/desktop"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "frame-src https://*.e2b.app https://*.vercel.app https://*.vercel.run https://va.vercel-scripts.com",
              "frame-ancestors 'self' https://*.vercel.app https://*.vercel.run",
              "connect-src 'self' wss://*.e2b.app https://*.e2b.app https://*.vercel.app https://*.vercel.run",
              "img-src 'self' data: https://*.e2b.app https://*.vercel.app https://*.vercel.run",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.e2b.app https://*.vercel.app https://*.vercel.run https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
            ].join("; "),
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
