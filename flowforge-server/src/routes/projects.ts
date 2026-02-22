import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { authMiddleware } from "../auth/middleware";
import { config } from "../config";
import { getActiveSessions } from "../terminal/session-manager";
import { getConversationHistory } from "../lib/claude-sessions";

export const projectsRouter = Router();

projectsRouter.get(
  "/api/projects",
  authMiddleware,
  (req: Request, res: Response) => {
    try {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(config.cloneDir, { withFileTypes: true });
      } catch {
        // cloneDir doesn't exist or isn't readable
        res.json({ cloneDir: config.cloneDir, projects: [] });
        return;
      }

      const projects: Array<{
        name: string;
        path: string;
        hasClaudeMd: boolean;
        lastModified: string;
      }> = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const dirPath = path.join(config.cloneDir, entry.name);
        const gitPath = path.join(dirPath, ".git");

        try {
          const gitStat = fs.statSync(gitPath);
          if (!gitStat.isDirectory()) continue;

          const claudeMdPath = path.join(dirPath, "CLAUDE.md");
          const hasClaudeMd = fs.existsSync(claudeMdPath);

          projects.push({
            name: entry.name,
            path: entry.name,
            hasClaudeMd,
            lastModified: gitStat.mtime.toISOString(),
          });
        } catch {
          // No .git directory — skip
          continue;
        }
      }

      // Sort by lastModified descending (most recent first)
      projects.sort(
        (a, b) =>
          new Date(b.lastModified).getTime() -
          new Date(a.lastModified).getTime(),
      );

      res.json({ cloneDir: config.cloneDir, projects });
    } catch (err) {
      res.status(500).json({ error: "Failed to list projects" });
    }
  },
);

projectsRouter.get(
  "/api/projects/:name",
  authMiddleware,
  async (req: Request, res: Response) => {
    const projectName = req.params.name as string;
    const dirPath = path.join(config.cloneDir, projectName);

    try {
      const gitPath = path.join(dirPath, ".git");
      const gitStat = fs.statSync(gitPath);
      if (!gitStat.isDirectory()) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const claudeMdPath = path.join(dirPath, "CLAUDE.md");
      const hasClaudeMd = fs.existsSync(claudeMdPath);

      const activeSessions = getActiveSessions(path.resolve(dirPath));
      const recentConversations = await getConversationHistory(
        path.resolve(dirPath),
      );

      res.json({
        name: projectName,
        path: projectName,
        hasClaudeMd,
        lastModified: gitStat.mtime.toISOString(),
        activeSessions,
        recentConversations,
      });
    } catch {
      res.status(404).json({ error: "Project not found" });
    }
  },
);
