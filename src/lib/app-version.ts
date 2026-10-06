import pkg from "../../package.json";

/** Public product label. Dawn is still in active beta. */
export const APP_CHANNEL = "Beta";
export const APP_VERSION = String(pkg.version || "0.1.0");
export const APP_VERSION_LABEL = `${APP_CHANNEL} · v${APP_VERSION}`;
