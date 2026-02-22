import fs from "fs";
import path from "path";
import os from "os";
import readline from "readline";
import type { ConversationInfo } from "../types";

export function buildClaudeSlug(absolutePath: string): string {
  return absolutePath
    .replace(/:/g, "")
    .replace(/[\\/]+/g, "--")
    .replace(/^-+/, "");
}

export async function parseSessionFile(
  filePath: string,
): Promise<ConversationInfo | null> {
  const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  try {
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.type === "file-history-snapshot") continue;
        if (entry.type === "progress") continue;

        return {
          sessionId: entry.sessionId || path.basename(filePath, ".jsonl"),
          slug: entry.slug || null,
          timestamp: entry.timestamp || null,
          gitBranch: entry.gitBranch || null,
        };
      } catch {
        continue;
      }
    }
  } finally {
    rl.close();
    stream.destroy();
  }

  const stat = fs.statSync(filePath);
  return {
    sessionId: path.basename(filePath, ".jsonl"),
    slug: null,
    timestamp: stat.mtime.toISOString(),
    gitBranch: null,
  };
}

export async function getConversationHistory(
  projectAbsPath: string,
  limit = 20,
  claudeProjectsDir?: string,
): Promise<ConversationInfo[]> {
  const slug = buildClaudeSlug(projectAbsPath);
  const projectsDir =
    claudeProjectsDir || path.join(os.homedir(), ".claude", "projects");

  if (!fs.existsSync(projectsDir)) return [];

  const dirs = fs.readdirSync(projectsDir);
  const matchingDir = dirs.find((d) => d === slug);
  if (!matchingDir) return [];

  const sessionDir = path.join(projectsDir, matchingDir);
  const files = fs.readdirSync(sessionDir).filter((f) => f.endsWith(".jsonl"));

  const conversations: ConversationInfo[] = [];
  const parsePromises = files.map(async (file) => {
    const info = await parseSessionFile(path.join(sessionDir, file));
    if (info) conversations.push(info);
  });
  await Promise.all(parsePromises);

  conversations.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return conversations.slice(0, limit);
}
