export interface Project {
  name: string;
  path: string;
  hasClaudeMd: boolean;
  lastModified: string;
}

export async function fetchProjects(
  serverUrl: string,
  serverToken: string,
): Promise<{ cloneDir: string; projects: Project[] }> {
  const normalizedUrl = serverUrl.replace(/\/+$/, "");
  const response = await fetch(`${normalizedUrl}/api/projects`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${serverToken}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch projects (${response.status}): ${text}`);
  }

  return response.json();
}

export interface CloneProgress {
  type: "progress" | "done" | "error";
  message?: string;
  sessionId?: string;
}

export async function cloneAndLaunch(
  serverUrl: string,
  serverToken: string,
  cloneUrl: string,
  launchClaude: boolean = true,
  runInit: boolean = false,
  onProgress?: (progress: CloneProgress) => void,
): Promise<{ sessionId?: string }> {
  const normalizedUrl = serverUrl.replace(/\/+$/, "");
  const response = await fetch(`${normalizedUrl}/api/clone`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serverToken}`,
    },
    body: JSON.stringify({ cloneUrl, launchClaude, runInit }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Clone failed (${response.status}): ${text}`);
  }

  // Read NDJSON stream line by line
  const text = await response.text();
  const lines = text.trim().split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as CloneProgress;
      onProgress?.(event);

      if (event.type === "error") {
        throw new Error(event.message || "Clone failed");
      }

      if (event.type === "done") {
        return { sessionId: event.sessionId };
      }
    } catch (err) {
      if (err instanceof Error && err.message !== "Clone failed") {
        // JSON parse error — skip malformed line
        continue;
      }
      throw err;
    }
  }

  // If no done event was received
  throw new Error("Clone stream ended without completion");
}
