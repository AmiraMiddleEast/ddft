import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phase 4 Pitfall 6: keep @react-pdf/renderer out of Turbopack's bundler tree.
  // Its transitive deps (fontkit, @react-pdf/textkit) are CJS and rely on dynamic require,
  // which Turbopack cannot tree-shake safely. Must run as a real Node import in Server Actions.
  serverExternalPackages: ["@react-pdf/renderer"],
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
