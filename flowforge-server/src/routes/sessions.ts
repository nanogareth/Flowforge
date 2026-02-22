import { Router, Request, Response } from "express";
import path from "path";
import { authMiddleware } from "../auth/middleware";
import { config } from "../config";
import { getActiveSessions } from "../terminal/session-manager";
import { getConversationHistory } from "../lib/claude-sessions";

export const sessionsRouter = Router();

sessionsRouter.get(
  "/api/sessions/active",
  authMiddleware,
  (req: Request, res: Response) => {
    const cwdPrefix = (req.query.cwd as string) || undefined;
    res.json(getActiveSessions(cwdPrefix));
  },
);

sessionsRouter.get(
  "/api/sessions/history",
  authMiddleware,
  async (req: Request, res: Response) => {
    const projectName = req.query.project as string;
    if (!projectName) {
      res.status(400).json({ error: "project query param required" });
      return;
    }

    try {
      const projectPath = path.resolve(config.cloneDir, projectName);
      const conversations = await getConversationHistory(projectPath);
      res.json(conversations);
    } catch {
      res.status(500).json({ error: "Failed to read session history" });
    }
  },
);
