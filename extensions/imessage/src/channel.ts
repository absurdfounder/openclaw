/**
 * iMessage channel adapter — Phase 4 scaffold.
 *
 * This file will hold the iMessage channel implementation
 * once migrated from direct core imports to api.runtime calls.
 *
 * Key responsibilities:
 * - Inbound message handling (AppleScript/BlueBubbles bridge)
 * - Outbound message delivery (send via iMessage)
 * - Group chat routing and mention handling
 * - Media attachment support
 * - Pairing and allowlist management
 */

export interface IMessageChannelConfig {
  /** Enable iMessage channel. */
  enabled: boolean;
  /** Path to the iMessage database (chat.db). */
  dbPath?: string;
  /** Delivery method: applescript | bluebubbles. */
  deliveryMethod?: "applescript" | "bluebubbles";
  /** BlueBubbles server URL (when using bluebubbles delivery). */
  blueBubblesUrl?: string;
  /** BlueBubbles API password. */
  blueBubblesPassword?: string;
}

// Placeholder — will be replaced with full channel adapter in next iteration
export function createIMessageChannel(_config: IMessageChannelConfig) {
  return {
    id: "imessage" as const,
    name: "iMessage",
    enabled: _config.enabled,
  };
}
