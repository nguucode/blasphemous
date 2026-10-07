import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Every page that changes is dynamic, so prerendered pages served from assets are enough; no R2 bucket.
export default defineCloudflareConfig({ incrementalCache: staticAssetsIncrementalCache });
