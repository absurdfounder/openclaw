import type { ChannelPlugin, OpenClawPluginApi, PluginLogger } from "../../src/plugin-sdk/index.js";

/**
 * iMessage channel plugin.
 *
 * Phase 4 of plugin-sdk refactor: moves iMessage from direct core imports
 * to the SDK + Runtime API surface.
 *
 * Config keys, CLI behavior, and documentation remain unchanged.
 */

let logger: PluginLogger | undefined;

const plugin: ChannelPlugin = {
  id: "imessage",
  name: "iMessage",
  version: "0.1.0",
  channel: "imessage",

  async onLoad(api: OpenClawPluginApi) {
    logger = api.runtime?.logging?.getChildLogger("imessage");
    logger?.info?.("iMessage plugin loaded (scaffold — Phase 4)");
  },

  async onUnload() {
    logger?.info?.("iMessage plugin unloaded");
    logger = undefined;
  },
};

export default plugin;
