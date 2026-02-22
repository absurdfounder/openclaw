/**
 * iMessage runtime accessor — Phase 4 scaffold.
 *
 * Provides runtime API access for iMessage channel operations.
 * All interactions with core runtime go through this module
 * (replacing direct src/** imports).
 */

import type { OpenClawPluginApi } from "../../../src/plugin-sdk/index.js";

export type IMessageRuntime = {
  /** Log helper scoped to iMessage. */
  log: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
  /** Check if verbose logging is enabled. */
  isVerbose: () => boolean;
};

export function createIMessageRuntime(api: OpenClawPluginApi): IMessageRuntime {
  const childLogger = api.runtime?.logging?.getChildLogger("imessage");
  return {
    log: {
      info: (msg: string) => childLogger?.info?.(msg),
      warn: (msg: string) => childLogger?.warn?.(msg),
      error: (msg: string) => childLogger?.error?.(msg),
    },
    isVerbose: () => api.runtime?.logging?.shouldLogVerbose?.() ?? false,
  };
}
