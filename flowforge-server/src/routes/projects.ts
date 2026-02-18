import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { authMiddleware } from "../auth/middleware";
import { config } from "../config";

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
