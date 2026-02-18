export interface TailscaleInfo {
  available: boolean;
  ip: string | null;
  hostname: string | null;
  serverPort: number;
}

/**
 * Discover Tailscale info from a server's /api/tailscale endpoint.
 */
export async function discoverServer(
  serverUrl: string,
): Promise<TailscaleInfo> {
  const base = serverUrl.replace(/\/+$/, "");
  const response = await fetch(`${base}/api/tailscale`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Discovery failed (${response.status})`);
  }

  return response.json();
}

/**
 * Check if a Tailscale IP+port is reachable via health endpoint.
 */
export async function checkTailscaleReachable(
  ip: string,
  port: number,
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`http://${ip}:${port}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Normalize a bare IP, hostname, or full URL into a proper server URL.
 * Examples:
 *   "100.64.1.2" → "http://100.64.1.2:7433"
 *   "my-pc" → "http://my-pc:7433"
 *   "http://100.64.1.2:7433" → "http://100.64.1.2:7433"
 */
export function buildServerUrl(input: string, port: number = 7433): string {
  const trimmed = input.trim().replace(/\/+$/, "");

  // Already a full URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `http://${trimmed}:${port}`;
}
