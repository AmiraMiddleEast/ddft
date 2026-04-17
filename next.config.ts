import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Per RESEARCH §Next 16 Server Action body size limit.
      // One file per Server Action call (Option A, locked): 10 MB raw + FormData overhead + base64 headroom → 15mb.
      bodySizeLimit: "15mb",
    },
    // Next 15.5+ added a second gate that also defaults to 1 MB for standalone/production (VPS deployment target).
    // Must be raised independently of serverActions.bodySizeLimit.
    // CITED: nextjs.org/docs/app/api-reference/config/next-config-js/proxyClientMaxBodySize
    proxyClientMaxBodySize: "15mb",
  },
};

export default nextConfig;
