import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
    /* config options here */
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
