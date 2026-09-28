import { buildExtension } from "./build.mjs";

/**
 * Chrome 148 is the floor (`minimum_chrome_version`): it is the first release
 * with the `browser` namespace and with `runtime.onMessage` listeners that
 * answer by returning a Promise, which the background uses. No polyfill.
 */
await buildExtension("chrome", "chrome148");
