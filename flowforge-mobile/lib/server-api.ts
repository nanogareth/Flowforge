export async function cloneAndLaunch(
  serverUrl: string,
  serverToken: string,
  cloneUrl: string,
  launchClaude: boolean = true,
): Promise<{ sessionId?: string }> {
  const normalizedUrl = serverUrl.replace(/\/+$/, "");
  const response = await fetch(`${normalizedUrl}/api/clone`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serverToken}`,
    },
    body: JSON.stringify({ cloneUrl, launchClaude }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Clone failed (${response.status}): ${text}`);
  }

  // Read NDJSON stream for the final result
  const text = await response.text();
  const lines = text.trim().split("\n");
  const lastLine = lines[lines.length - 1];
  const result = JSON.parse(lastLine);

  if (result.type === "error") {
    throw new Error(result.message);
  }

  return { sessionId: result.sessionId };
}
