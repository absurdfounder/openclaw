import type { GatewayTlsConfig } from "../../config/types.gateway.js";
import {
  type GatewayTlsRuntime,
  loadGatewayTlsRuntime as loadGatewayTlsRuntimeConfig,
} from "../../infra/tls/gateway.js";

export type { GatewayTlsRuntime } from "../../infra/tls/gateway.js";

export async function loadGatewayTlsRuntime(
  cfg: GatewayTlsConfig | undefined,
  log?: { info?: (msg: string) => void; warn?: (msg: string) => void },
): Promise<GatewayTlsRuntime> {
  return await loadGatewayTlsRuntimeConfig(cfg, log);
}

export function shouldRejectNonTlsConnection(params: {
  tlsEnabled: boolean;
  tlsRequired: boolean;
  remoteAddr?: string;
}): boolean {
  if (!params.tlsEnabled || !params.tlsRequired) return false;
  // Allow loopback connections without TLS
  const addr = params.remoteAddr ?? "";
  if (addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1" || addr === "localhost") return false;
  return true;
}
