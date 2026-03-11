import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "**.supabase.co",
                pathname: "/storage/v1/object/public/**",
            },
            {
                protocol: "https",
                hostname: "**.supabase.co",
                pathname: "/storage/v1/object/sign/**",
            },
            {
                protocol: "https",
                hostname: "**.supabase.co",
                pathname: "/storage/v1/render/image/**",
            },
            {
                protocol: "https",
                hostname: "emesteker.com",
            },
        ],
    },
};

export default withSentryConfig(nextConfig, {
    org: "teker-market",
    project: "teker-market",
    silent: !process.env.CI,
    widenClientFileUpload: true,
    reactComponentAnnotation: {
        enabled: true,
    },
    tunnelRoute: "/monitoring",
    disableLogger: true,
});
